package crypto

import (
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// RFC 3394 Section 4.1 — 128-bit KEK, 128-bit data
func TestAESKeyWrap_RFC3394_128(t *testing.T) {
	kek, _ := hex.DecodeString("000102030405060708090A0B0C0D0E0F")
	plaintext, _ := hex.DecodeString("00112233445566778899AABBCCDDEEFF")
	expected, _ := hex.DecodeString("1FA68B0A8112B447AEF34BD8FB5A7B829D3E862371D2CFE5")

	wrapped, err := AESKeyWrap(kek, plaintext)
	require.NoError(t, err)
	assert.Equal(t, expected, wrapped)

	unwrapped, err := AESKeyUnwrap(kek, wrapped)
	require.NoError(t, err)
	assert.Equal(t, plaintext, unwrapped)
}

// RFC 3394 Section 4.3 — 256-bit KEK, 128-bit data
func TestAESKeyWrap_RFC3394_256_128(t *testing.T) {
	kek, _ := hex.DecodeString("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
	plaintext, _ := hex.DecodeString("00112233445566778899AABBCCDDEEFF")
	expected, _ := hex.DecodeString("64E8C3F9CE0F5BA263E9777905818A2A93C8191E7D6E8AE7")

	wrapped, err := AESKeyWrap(kek, plaintext)
	require.NoError(t, err)
	assert.Equal(t, expected, wrapped)

	unwrapped, err := AESKeyUnwrap(kek, wrapped)
	require.NoError(t, err)
	assert.Equal(t, plaintext, unwrapped)
}

// RFC 3394 Section 4.6 — 256-bit KEK, 256-bit data (our use case)
func TestAESKeyWrap_RFC3394_256_256(t *testing.T) {
	kek, _ := hex.DecodeString("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
	plaintext, _ := hex.DecodeString("00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F")
	expected, _ := hex.DecodeString("28C9F404C4B810F4CBCCB35CFB87F8263F5786E2D80ED326CBC7F0E71A99F43BFB988B9B7A02DD21")

	wrapped, err := AESKeyWrap(kek, plaintext)
	require.NoError(t, err)
	assert.Equal(t, expected, wrapped)
	assert.Len(t, wrapped, 40, "256-bit key wrapping should produce 40 bytes")

	unwrapped, err := AESKeyUnwrap(kek, wrapped)
	require.NoError(t, err)
	assert.Equal(t, plaintext, unwrapped)
}

func TestAESKeyUnwrap_WrongKEK(t *testing.T) {
	kek, _ := hex.DecodeString("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
	plaintext, _ := hex.DecodeString("00112233445566778899AABBCCDDEEFF000102030405060708090A0B0C0D0E0F")

	wrapped, err := AESKeyWrap(kek, plaintext)
	require.NoError(t, err)

	wrongKEK, _ := hex.DecodeString("FF0102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")
	_, err = AESKeyUnwrap(wrongKEK, wrapped)
	assert.Error(t, err, "wrong KEK should fail integrity check")
}

func TestAESKeyWrap_InvalidInput(t *testing.T) {
	kek, _ := hex.DecodeString("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F")

	_, err := AESKeyWrap(kek, nil)
	assert.Error(t, err)

	_, err = AESKeyWrap(kek, []byte{1, 2, 3})
	assert.Error(t, err, "non-multiple of 8 should fail")
}
