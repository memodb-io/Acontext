package crypto

import (
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
)

const (
	// contentPrefixEncrypted is the first byte of an encrypted content envelope.
	// Format: 0x01 | wrappedDEK_len (2 bytes BE) | wrappedDEK | ciphertext
	// This matches the cache framing pattern used in session.go.
	contentPrefixEncrypted byte = 0x01
)

// EncodeContent encrypts text content for storage in asset_meta["content"].
// When userKEK is nil, returns plaintext unchanged.
// When userKEK is provided, encrypts and returns base64(0x01 | wrappedDEK_len | wrappedDEK | ciphertext).
func EncodeContent(userKEK []byte, plaintext string) (string, error) {
	if userKEK == nil {
		return plaintext, nil
	}

	ciphertext, encMeta, err := EncryptData(userKEK, []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("crypto: encode content: %w", err)
	}

	wrappedDEK := []byte(encMeta.UserWrappedDEK)

	// Frame: 0x01 | wrappedDEK_len (2 bytes BE) | wrappedDEK | ciphertext
	frame := make([]byte, 1+2+len(wrappedDEK)+len(ciphertext))
	frame[0] = contentPrefixEncrypted
	binary.BigEndian.PutUint16(frame[1:3], uint16(len(wrappedDEK)))
	copy(frame[3:3+len(wrappedDEK)], wrappedDEK)
	copy(frame[3+len(wrappedDEK):], ciphertext)

	return base64.StdEncoding.EncodeToString(frame), nil
}

// DecodeContent decrypts content stored in asset_meta["content"].
// Detects whether the content is encrypted (base64 with 0x01 prefix) or legacy plaintext.
// When content is encrypted, userKEK must be provided.
func DecodeContent(userKEK []byte, stored string) (string, error) {
	if stored == "" {
		return "", nil
	}

	// Try base64 decode to check for encrypted envelope
	raw, err := base64.StdEncoding.DecodeString(stored)
	if err != nil {
		// Not valid base64 — legacy plaintext
		return stored, nil
	}

	if len(raw) == 0 {
		return stored, nil
	}

	if raw[0] != contentPrefixEncrypted {
		// Valid base64 but no encrypted prefix — legacy plaintext
		return stored, nil
	}

	// Encrypted envelope: 0x01 | wrappedDEK_len (2B BE) | wrappedDEK | ciphertext
	if userKEK == nil {
		return "", errors.New("crypto: encrypted content but no user KEK provided")
	}

	if len(raw) < 3 {
		return "", errors.New("crypto: malformed encrypted content: too short")
	}

	wrappedDEKLen := int(binary.BigEndian.Uint16(raw[1:3]))
	if len(raw) < 3+wrappedDEKLen {
		return "", errors.New("crypto: malformed encrypted content: wrappedDEK length exceeds data")
	}

	wrappedDEK := string(raw[3 : 3+wrappedDEKLen])
	ciphertext := raw[3+wrappedDEKLen:]

	encMeta := &EncryptedMeta{
		Algo:           "AES-256-GCM",
		UserWrappedDEK: wrappedDEK,
	}

	plaintext, err := DecryptData(userKEK, ciphertext, encMeta)
	if err != nil {
		return "", fmt.Errorf("crypto: decrypt content: %w", err)
	}

	return string(plaintext), nil
}
