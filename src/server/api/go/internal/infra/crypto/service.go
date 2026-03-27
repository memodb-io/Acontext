package crypto

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
)

const (
	// CompactTokenVersion is the version byte for the compact token format.
	CompactTokenVersion byte = 0x01
	// CompactAuthSecretLen is the auth_secret length in bytes for compact tokens.
	CompactAuthSecretLen = 16
	// CompactWrappedKeyLen is the AES-KW wrapped 32-byte key output length.
	CompactWrappedKeyLen = 40 // 32-byte key + 8-byte integrity check
)

// DeriveUserKEK derives a wrapping key from the auth secret and pepper.
// This key is used to encrypt/decrypt the master key embedded in API tokens.
func DeriveUserKEK(authSecret, pepper string) ([]byte, error) {
	secret := []byte(authSecret + pepper)
	salt := []byte(pepper + "-master-key-wrap")
	info := []byte(pepper + " master key wrapping")
	return DeriveKEK(secret, salt, info)
}

// GenerateMasterKey generates a random 32-byte master key for use as a KEK.
func GenerateMasterKey() ([]byte, error) {
	return GenerateDEK() // same size: 32 bytes
}

const (
	// MetaKeyAlgo is the S3 metadata key for the encryption algorithm.
	MetaKeyAlgo = "enc-algo"
	// MetaKeyDEKUser is the S3 metadata key for the user-wrapped DEK.
	MetaKeyDEKUser = "enc-dek-user"
)

// EncryptedMeta holds the metadata stored alongside an encrypted S3 object.
type EncryptedMeta struct {
	Algo           string // "AES-256-GCM"
	UserWrappedDEK string // base64(nonce + ciphertext)
}

// EncryptData encrypts plaintext using a user KEK and returns ciphertext + metadata.
// Generates a random DEK, encrypts data with it, then wraps the DEK with the user KEK.
func EncryptData(userKEK, plaintext []byte) (ciphertext []byte, meta *EncryptedMeta, err error) {
	if userKEK == nil {
		return nil, nil, errors.New("crypto: user KEK is required")
	}

	dek, err := GenerateDEK()
	if err != nil {
		return nil, nil, err
	}

	ciphertext, err = Encrypt(dek, plaintext)
	if err != nil {
		return nil, nil, err
	}

	userWrapped, err := WrapDEK(userKEK, dek)
	if err != nil {
		return nil, nil, fmt.Errorf("crypto: wrap DEK with user KEK: %w", err)
	}

	meta = &EncryptedMeta{
		Algo:           "AES-256-GCM",
		UserWrappedDEK: base64.StdEncoding.EncodeToString(userWrapped),
	}
	return ciphertext, meta, nil
}

// DecryptData decrypts ciphertext using a user KEK and the associated metadata.
func DecryptData(userKEK, ciphertext []byte, meta *EncryptedMeta) ([]byte, error) {
	if userKEK == nil {
		return nil, errors.New("crypto: user KEK is required")
	}
	if meta == nil {
		return nil, errors.New("crypto: encrypted metadata is required")
	}
	wrapped, err := base64.StdEncoding.DecodeString(meta.UserWrappedDEK)
	if err != nil {
		return nil, fmt.Errorf("crypto: decode user wrapped DEK: %w", err)
	}
	dek, err := UnwrapDEK(userKEK, wrapped)
	if err != nil {
		return nil, err
	}
	return Decrypt(dek, ciphertext)
}

// RewrapDEK re-encrypts the DEK with a new user KEK (for key rotation).
// Uses the old user KEK to unwrap, then wraps with the new user KEK.
// Idempotent: if the DEK is already wrapped with newUserKEK, returns ("", nil)
// to signal the object was already rewrapped and should be skipped.
func RewrapDEK(meta *EncryptedMeta, oldUserKEK, newUserKEK []byte) (string, error) {
	if meta == nil {
		return "", errors.New("crypto: encrypted metadata is required")
	}
	wrapped, err := base64.StdEncoding.DecodeString(meta.UserWrappedDEK)
	if err != nil {
		return "", fmt.Errorf("crypto: decode user wrapped DEK: %w", err)
	}

	// Try unwrapping with old KEK first (normal case)
	dek, err := UnwrapDEK(oldUserKEK, wrapped)
	if err != nil {
		// Old KEK failed — try new KEK to check if already rewrapped
		if _, err2 := UnwrapDEK(newUserKEK, wrapped); err2 == nil {
			// Already rewrapped with new KEK — skip
			return "", nil
		}
		// Neither KEK works — return original error
		return "", err
	}

	newWrapped, err := WrapDEK(newUserKEK, dek)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(newWrapped), nil
}

// MetadataToMap converts EncryptedMeta to S3-compatible metadata map.
func (m *EncryptedMeta) MetadataToMap() map[string]string {
	return map[string]string{
		MetaKeyAlgo:    m.Algo,
		MetaKeyDEKUser: m.UserWrappedDEK,
	}
}

// ClearFromMap removes encryption metadata keys from the given map.
func ClearEncryptionMetadata(metadata map[string]string) {
	delete(metadata, MetaKeyAlgo)
	delete(metadata, MetaKeyDEKUser)
}

// MetadataFromMap extracts EncryptedMeta from S3 object metadata.
// Returns nil if the object is not encrypted (no enc-algo key).
func MetadataFromMap(metadata map[string]string) *EncryptedMeta {
	algo, ok := metadata[MetaKeyAlgo]
	if !ok || algo == "" {
		return nil
	}
	return &EncryptedMeta{
		Algo:           algo,
		UserWrappedDEK: metadata[MetaKeyDEKUser],
	}
}

// PackCompactToken packs a 16-byte auth_secret and 32-byte master_key into a
// compact base64url token body using AES Key Wrap (RFC 3394).
// Format: base64url( 0x01 | auth_secret_16B | AES-KW(wrappingKey, masterKey) )
// Returns the token body (without the sk-ac- prefix).
func PackCompactToken(authSecretRaw, masterKey, wrappingKey []byte) (string, error) {
	if len(authSecretRaw) != CompactAuthSecretLen {
		return "", fmt.Errorf("crypto: auth secret must be %d bytes, got %d", CompactAuthSecretLen, len(authSecretRaw))
	}
	if len(masterKey) != KeySize {
		return "", fmt.Errorf("crypto: master key must be %d bytes, got %d", KeySize, len(masterKey))
	}
	wrapped, err := AESKeyWrap(wrappingKey, masterKey)
	if err != nil {
		return "", fmt.Errorf("crypto: compact wrap: %w", err)
	}
	// 1 + 16 + 40 = 57 bytes
	buf := make([]byte, 1+CompactAuthSecretLen+len(wrapped))
	buf[0] = CompactTokenVersion
	copy(buf[1:1+CompactAuthSecretLen], authSecretRaw)
	copy(buf[1+CompactAuthSecretLen:], wrapped)
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// UnpackCompactToken decodes a compact token body and returns the auth_secret
// string (hex-encoded, for HMAC/Argon2) and the raw 32-byte master key.
func UnpackCompactToken(compactB64, pepper string) (authSecret string, masterKey []byte, err error) {
	raw, err := base64.RawURLEncoding.DecodeString(compactB64)
	if err != nil {
		return "", nil, fmt.Errorf("crypto: compact decode: %w", err)
	}
	expectedLen := 1 + CompactAuthSecretLen + CompactWrappedKeyLen
	if len(raw) != expectedLen {
		return "", nil, fmt.Errorf("crypto: compact token wrong length: got %d, want %d", len(raw), expectedLen)
	}
	if raw[0] != CompactTokenVersion {
		return "", nil, fmt.Errorf("crypto: unknown compact token version: 0x%02x", raw[0])
	}
	authSecretRaw := raw[1 : 1+CompactAuthSecretLen]
	wrappedMK := raw[1+CompactAuthSecretLen:]

	// auth_secret as hex string (used for HMAC lookup and Argon2)
	authSecret = hex.EncodeToString(authSecretRaw)

	// Derive wrapping key from hex auth_secret + pepper, then unwrap
	wrappingKey, err := DeriveUserKEK(authSecret, pepper)
	if err != nil {
		return "", nil, fmt.Errorf("crypto: compact derive KEK: %w", err)
	}
	masterKey, err = AESKeyUnwrap(wrappingKey, wrappedMK)
	if err != nil {
		return "", nil, fmt.Errorf("crypto: compact unwrap: %w", err)
	}
	return authSecret, masterKey, nil
}
