package crypto

import (
	"crypto/aes"
	"encoding/binary"
	"errors"
	"fmt"
)

// AES Key Wrap per RFC 3394.
// Uses AES block cipher in a deterministic wrapping mode (no nonce).
// Input must be a multiple of 8 bytes. Output is input_len + 8 bytes.

var defaultIV = [8]byte{0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6, 0xA6}

// AESKeyWrap wraps plaintext with the given KEK using RFC 3394 AES Key Wrap.
// plaintext must be a multiple of 8 bytes (e.g., 32 bytes for a 256-bit key).
// Returns wrapped data of len(plaintext) + 8 bytes.
func AESKeyWrap(kek, plaintext []byte) ([]byte, error) {
	if len(plaintext) == 0 || len(plaintext)%8 != 0 {
		return nil, errors.New("crypto: keywrap plaintext must be non-empty and multiple of 8 bytes")
	}
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, fmt.Errorf("crypto: keywrap cipher: %w", err)
	}

	n := len(plaintext) / 8
	// Initialize A with default IV and R[i] with plaintext blocks
	var A [8]byte
	copy(A[:], defaultIV[:])
	R := make([]byte, len(plaintext))
	copy(R, plaintext)

	var B [16]byte
	for j := 0; j < 6; j++ {
		for i := 0; i < n; i++ {
			copy(B[:8], A[:])
			copy(B[8:], R[i*8:(i+1)*8])
			block.Encrypt(B[:], B[:])
			t := uint64(n*j + i + 1)
			// XOR t into MSB 8 bytes
			tBytes := B[:8]
			tVal := binary.BigEndian.Uint64(tBytes)
			binary.BigEndian.PutUint64(A[:], tVal^t)
			copy(R[i*8:], B[8:])
		}
	}

	out := make([]byte, 8+len(plaintext))
	copy(out[:8], A[:])
	copy(out[8:], R)
	return out, nil
}

// AESKeyUnwrap unwraps ciphertext with the given KEK using RFC 3394 AES Key Unwrap.
// ciphertext must be at least 16 bytes and a multiple of 8.
// Returns the unwrapped plaintext of len(ciphertext) - 8 bytes.
func AESKeyUnwrap(kek, ciphertext []byte) ([]byte, error) {
	if len(ciphertext) < 16 || len(ciphertext)%8 != 0 {
		return nil, errors.New("crypto: keywrap ciphertext must be >= 16 bytes and multiple of 8")
	}
	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, fmt.Errorf("crypto: keywrap cipher: %w", err)
	}

	n := (len(ciphertext) / 8) - 1
	var A [8]byte
	copy(A[:], ciphertext[:8])
	R := make([]byte, n*8)
	copy(R, ciphertext[8:])

	var B [16]byte
	for j := 5; j >= 0; j-- {
		for i := n - 1; i >= 0; i-- {
			t := uint64(n*j + i + 1)
			tVal := binary.BigEndian.Uint64(A[:])
			binary.BigEndian.PutUint64(B[:8], tVal^t)
			copy(B[8:], R[i*8:(i+1)*8])
			block.Decrypt(B[:], B[:])
			copy(A[:], B[:8])
			copy(R[i*8:], B[8:])
		}
	}

	if A != defaultIV {
		return nil, errors.New("crypto: keywrap integrity check failed")
	}
	return R, nil
}
