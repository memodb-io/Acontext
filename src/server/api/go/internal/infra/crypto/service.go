package crypto

import (
	"encoding/base64"
	"errors"
	"fmt"
)

var (
	adminKEKSalt = []byte("acontext-admin-kek")
	adminKEKInfo = []byte("acontext envelope encryption admin KEK")
	userKEKSalt  = []byte("acontext-user-kek")
	userKEKInfo  = []byte("acontext envelope encryption user KEK")
)

// EncryptionService manages envelope encryption/decryption using admin and user KEKs.
type EncryptionService struct {
	adminKEK []byte
	enabled  bool
}

// NewEncryptionService creates a new EncryptionService.
// If masterKey is empty, encryption is disabled (passthrough mode).
func NewEncryptionService(masterKey string, enabled bool) (*EncryptionService, error) {
	svc := &EncryptionService{enabled: enabled}
	if !enabled || masterKey == "" {
		svc.enabled = false
		return svc, nil
	}
	kek, err := DeriveKEK([]byte(masterKey), adminKEKSalt, adminKEKInfo)
	if err != nil {
		return nil, fmt.Errorf("crypto: derive admin KEK: %w", err)
	}
	svc.adminKEK = kek
	return svc, nil
}

// Enabled returns whether encryption is active.
func (s *EncryptionService) Enabled() bool {
	return s.enabled
}

// DeriveUserKEK derives a user KEK from the raw API key and pepper.
func DeriveUserKEK(apiKeyRaw, pepper string) ([]byte, error) {
	secret := []byte(apiKeyRaw + pepper)
	return DeriveKEK(secret, userKEKSalt, userKEKInfo)
}

// EncryptedMeta holds the metadata stored alongside an encrypted S3 object.
type EncryptedMeta struct {
	Algo           string // "AES-256-GCM"
	AdminWrappedDEK string // base64(nonce + ciphertext)
	UserWrappedDEK  string // base64(nonce + ciphertext)
}

// EncryptData encrypts plaintext and returns ciphertext + metadata for S3 storage.
// userKEK is the KEK derived from the user's API key.
func (s *EncryptionService) EncryptData(plaintext, userKEK []byte) (ciphertext []byte, meta *EncryptedMeta, err error) {
	if !s.enabled {
		return nil, nil, errors.New("crypto: encryption not enabled")
	}

	dek, err := GenerateDEK()
	if err != nil {
		return nil, nil, err
	}

	ciphertext, err = Encrypt(dek, plaintext)
	if err != nil {
		return nil, nil, err
	}

	adminWrapped, err := WrapDEK(s.adminKEK, dek)
	if err != nil {
		return nil, nil, fmt.Errorf("crypto: wrap DEK with admin KEK: %w", err)
	}

	userWrapped, err := WrapDEK(userKEK, dek)
	if err != nil {
		return nil, nil, fmt.Errorf("crypto: wrap DEK with user KEK: %w", err)
	}

	meta = &EncryptedMeta{
		Algo:           "AES-256-GCM",
		AdminWrappedDEK: base64.StdEncoding.EncodeToString(adminWrapped),
		UserWrappedDEK:  base64.StdEncoding.EncodeToString(userWrapped),
	}
	return ciphertext, meta, nil
}

// DecryptWithAdminKEK decrypts data using the admin master KEK.
func (s *EncryptionService) DecryptWithAdminKEK(ciphertext []byte, meta *EncryptedMeta) ([]byte, error) {
	if !s.enabled {
		return nil, errors.New("crypto: encryption not enabled")
	}
	wrapped, err := base64.StdEncoding.DecodeString(meta.AdminWrappedDEK)
	if err != nil {
		return nil, fmt.Errorf("crypto: decode admin wrapped DEK: %w", err)
	}
	dek, err := UnwrapDEK(s.adminKEK, wrapped)
	if err != nil {
		return nil, err
	}
	return Decrypt(dek, ciphertext)
}

// DecryptWithUserKEK decrypts data using a user-derived KEK.
func (s *EncryptionService) DecryptWithUserKEK(ciphertext, userKEK []byte, meta *EncryptedMeta) ([]byte, error) {
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

// RewrapUserDEK re-encrypts the DEK with a new user KEK (for key rotation).
// Uses admin KEK to unwrap, then wraps with the new user KEK.
func (s *EncryptionService) RewrapUserDEK(meta *EncryptedMeta, newUserKEK []byte) (string, error) {
	if !s.enabled {
		return "", errors.New("crypto: encryption not enabled")
	}
	wrapped, err := base64.StdEncoding.DecodeString(meta.AdminWrappedDEK)
	if err != nil {
		return "", fmt.Errorf("crypto: decode admin wrapped DEK: %w", err)
	}
	dek, err := UnwrapDEK(s.adminKEK, wrapped)
	if err != nil {
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
		"enc-algo":      m.Algo,
		"enc-dek-admin": m.AdminWrappedDEK,
		"enc-dek-user":  m.UserWrappedDEK,
	}
}

// MetadataFromMap extracts EncryptedMeta from S3 object metadata.
// Returns nil if the object is not encrypted (no enc-algo key).
func MetadataFromMap(metadata map[string]string) *EncryptedMeta {
	algo, ok := metadata["enc-algo"]
	if !ok || algo == "" {
		return nil
	}
	return &EncryptedMeta{
		Algo:           algo,
		AdminWrappedDEK: metadata["enc-dek-admin"],
		UserWrappedDEK:  metadata["enc-dek-user"],
	}
}
