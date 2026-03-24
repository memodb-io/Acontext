package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"

	"golang.org/x/crypto/hkdf"
)

const (
	// KeySize is the AES-256 key size in bytes.
	KeySize = 32
	// NonceSize is the AES-GCM nonce size in bytes.
	NonceSize = 12
)

// DeriveKEK derives a Key Encryption Key from a secret using HKDF-SHA256.
// The salt and info parameters provide domain separation.
func DeriveKEK(secret, salt, info []byte) ([]byte, error) {
	if len(secret) == 0 {
		return nil, errors.New("crypto: secret is empty")
	}
	hkdfReader := hkdf.New(sha256.New, secret, salt, info)
	kek := make([]byte, KeySize)
	if _, err := io.ReadFull(hkdfReader, kek); err != nil {
		return nil, fmt.Errorf("crypto: HKDF derive: %w", err)
	}
	return kek, nil
}

// GenerateDEK generates a random 256-bit Data Encryption Key.
func GenerateDEK() ([]byte, error) {
	dek := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		return nil, fmt.Errorf("crypto: generate DEK: %w", err)
	}
	return dek, nil
}

// WrapDEK encrypts a DEK with a KEK using AES-256-GCM.
// Returns nonce + ciphertext concatenated.
func WrapDEK(kek, dek []byte) ([]byte, error) {
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, fmt.Errorf("crypto: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypto: new GCM: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("crypto: generate nonce: %w", err)
	}
	// nonce is prepended to the ciphertext
	return gcm.Seal(nonce, nonce, dek, nil), nil
}

// UnwrapDEK decrypts a wrapped DEK with a KEK.
// Expects nonce + ciphertext concatenated (as produced by WrapDEK).
func UnwrapDEK(kek, wrappedDEK []byte) ([]byte, error) {
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, fmt.Errorf("crypto: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypto: new GCM: %w", err)
	}
	nonceSize := gcm.NonceSize()
	if len(wrappedDEK) < nonceSize {
		return nil, errors.New("crypto: wrapped DEK too short")
	}
	nonce, ciphertext := wrappedDEK[:nonceSize], wrappedDEK[nonceSize:]
	dek, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("crypto: unwrap DEK: %w", err)
	}
	return dek, nil
}

// Encrypt encrypts plaintext with the given DEK using AES-256-GCM.
// Returns nonce + ciphertext concatenated.
func Encrypt(dek, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, fmt.Errorf("crypto: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypto: new GCM: %w", err)
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, fmt.Errorf("crypto: generate nonce: %w", err)
	}
	return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt decrypts ciphertext with the given DEK.
// Expects nonce + ciphertext concatenated (as produced by Encrypt).
func Decrypt(dek, ciphertextWithNonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, fmt.Errorf("crypto: new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypto: new GCM: %w", err)
	}
	nonceSize := gcm.NonceSize()
	if len(ciphertextWithNonce) < nonceSize {
		return nil, errors.New("crypto: ciphertext too short")
	}
	nonce, ciphertext := ciphertextWithNonce[:nonceSize], ciphertextWithNonce[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("crypto: decrypt: %w", err)
	}
	return plaintext, nil
}
