package crypto

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateTestKEK(t *testing.T) []byte {
	t.Helper()
	kek, err := GenerateDEK()
	require.NoError(t, err)
	return kek
}

func TestEncodeContent_NilKEK_ReturnsPlaintext(t *testing.T) {
	plaintext := "hello world"
	result, err := EncodeContent(nil, plaintext)
	require.NoError(t, err)
	assert.Equal(t, plaintext, result)
}

func TestEncodeContent_WithKEK_ReturnsBase64WithPrefix(t *testing.T) {
	kek := generateTestKEK(t)
	plaintext := "hello world"

	result, err := EncodeContent(kek, plaintext)
	require.NoError(t, err)
	assert.NotEqual(t, plaintext, result)

	// Should be valid base64
	raw, err := base64.StdEncoding.DecodeString(result)
	require.NoError(t, err)

	// First byte should be 0x01
	assert.Equal(t, contentPrefixEncrypted, raw[0])
}

func TestDecodeContent_RoundTrip(t *testing.T) {
	kek := generateTestKEK(t)
	plaintext := "hello world with special chars: 你好世界 🌍"

	encoded, err := EncodeContent(kek, plaintext)
	require.NoError(t, err)

	decoded, err := DecodeContent(kek, encoded)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decoded)
}

func TestDecodeContent_LegacyPlaintext(t *testing.T) {
	// Legacy content has no prefix — just raw text
	legacy := "this is legacy plaintext content"
	result, err := DecodeContent(nil, legacy)
	require.NoError(t, err)
	assert.Equal(t, legacy, result)
}

func TestDecodeContent_LegacyPlaintext_WithKEK(t *testing.T) {
	// Even with a KEK, legacy plaintext should decode correctly
	kek := generateTestKEK(t)
	legacy := "this is legacy plaintext"
	result, err := DecodeContent(kek, legacy)
	require.NoError(t, err)
	assert.Equal(t, legacy, result)
}

func TestDecodeContent_EncryptedWithNilKEK_ReturnsError(t *testing.T) {
	kek := generateTestKEK(t)
	encoded, err := EncodeContent(kek, "secret")
	require.NoError(t, err)

	_, err = DecodeContent(nil, encoded)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no user KEK provided")
}

func TestDecodeContent_WrongKEK_ReturnsError(t *testing.T) {
	kek1 := generateTestKEK(t)
	kek2 := generateTestKEK(t)

	encoded, err := EncodeContent(kek1, "secret")
	require.NoError(t, err)

	_, err = DecodeContent(kek2, encoded)
	assert.Error(t, err)
}

func TestDecodeContent_EmptyString(t *testing.T) {
	result, err := DecodeContent(nil, "")
	require.NoError(t, err)
	assert.Equal(t, "", result)
}

func TestEncodeContent_EmptyPlaintext(t *testing.T) {
	kek := generateTestKEK(t)
	encoded, err := EncodeContent(kek, "")
	require.NoError(t, err)

	decoded, err := DecodeContent(kek, encoded)
	require.NoError(t, err)
	assert.Equal(t, "", decoded)
}
