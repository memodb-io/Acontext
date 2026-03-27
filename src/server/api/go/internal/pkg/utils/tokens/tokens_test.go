package tokens

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseToken(t *testing.T) {
	tests := []struct {
		name     string
		raw      string
		prefix   string
		expected string
		ok       bool
	}{
		{
			name:     "valid token parsing",
			raw:      "Bearer abc123def456",
			prefix:   "Bearer ",
			expected: "abc123def456",
			ok:       true,
		},
		{
			name:     "API key prefix",
			raw:      "ak_test_1234567890",
			prefix:   "ak_test_",
			expected: "1234567890",
			ok:       true,
		},
		{
			name:     "non-matching prefix",
			raw:      "Bearer abc123def456",
			prefix:   "Token ",
			expected: "",
			ok:       false,
		},
		{
			name:     "empty string",
			raw:      "",
			prefix:   "Bearer ",
			expected: "",
			ok:       false,
		},
		{
			name:     "prefix only",
			raw:      "Bearer ",
			prefix:   "Bearer ",
			expected: "",
			ok:       true,
		},
		{
			name:     "prefix longer than original string",
			raw:      "abc",
			prefix:   "Bearer ",
			expected: "",
			ok:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			secret, ok := ParseToken(tt.raw, tt.prefix)
			assert.Equal(t, tt.expected, secret)
			assert.Equal(t, tt.ok, ok)
		})
	}
}

func TestParseProjectToken(t *testing.T) {
	prefix := "sk-ac-"

	tests := []struct {
		name       string
		raw        string
		wantAuth   string
		wantCompact bool
		wantOK     bool
	}{
		{
			name:     "legacy format",
			raw:      "sk-ac-somelegacysecretvalue",
			wantAuth: "somelegacysecretvalue",
			wantOK:   true,
		},
		{
			name:       "compact format (76 chars)",
			raw:        "sk-ac-AaGyw9Tl9qe4ydDh8qO0xdZNkrobQvwHWFRsnp5a3QtfbaDSDJQeRHxXPr4bGpc0g130EqBSjRNF",
			wantAuth:   "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
			wantCompact: true,
			wantOK:     true,
		},
		{
			name:   "wrong prefix",
			raw:    "sk-xx-secret",
			wantOK: false,
		},
		{
			name:   "empty string",
			raw:    "",
			wantOK: false,
		},
		{
			name:   "prefix only",
			raw:    "sk-ac-",
			wantOK: false,
		},
		{
			name:     "short token treated as legacy",
			raw:      "sk-ac-short",
			wantAuth: "short",
			wantOK:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, ok := ParseProjectToken(tt.raw, prefix)
			assert.Equal(t, tt.wantOK, ok)
			if ok {
				assert.Equal(t, tt.wantAuth, parsed.AuthSecret)
				if tt.wantCompact {
					assert.NotEmpty(t, parsed.CompactRaw)
				} else {
					assert.Empty(t, parsed.CompactRaw)
				}
			}
		})
	}
}

func TestHMAC256Hex(t *testing.T) {
	tests := []struct {
		name     string
		pepper   string
		secret   string
		expected string
	}{
		{
			name:     "basic HMAC calculation",
			pepper:   "test-pepper",
			secret:   "test-secret",
			expected: "f8c3d5c4e1a6b7d2e9f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6",
		},
		{
			name:     "empty secret",
			pepper:   "test-pepper",
			secret:   "",
			expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
		{
			name:     "empty pepper",
			pepper:   "",
			secret:   "test-secret",
			expected: "f2ca1bb6c7e907d06dafe4687b3b82e6f1e3e6b8b2e1e7d6f0c0a2b3c4d5e6f7",
		},
		{
			name:     "same input should produce same output",
			pepper:   "same-pepper",
			secret:   "same-secret",
			expected: "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HMAC256Hex(tt.pepper, tt.secret)

			// Verify output is 64 hexadecimal characters
			assert.Len(t, result, 64, "HMAC256Hex should return 64 hexadecimal characters")

			// Verify output contains only hexadecimal characters
			for _, char := range result {
				assert.True(t,
					(char >= '0' && char <= '9') || (char >= 'a' && char <= 'f'),
					"output should only contain hexadecimal characters")
			}

			// Verify same input produces same output
			result2 := HMAC256Hex(tt.pepper, tt.secret)
			assert.Equal(t, result, result2, "same input should produce same output")
		})
	}
}

func TestHMAC256Hex_Deterministic(t *testing.T) {
	// Test determinism: same input should always produce same output
	pepper := "test-pepper"
	secret := "test-secret"

	result1 := HMAC256Hex(pepper, secret)
	result2 := HMAC256Hex(pepper, secret)
	result3 := HMAC256Hex(pepper, secret)

	assert.Equal(t, result1, result2)
	assert.Equal(t, result2, result3)
	assert.Equal(t, result1, result3)
}

func TestHMAC256Hex_DifferentInputs(t *testing.T) {
	// Test different inputs produce different outputs
	pepper := "test-pepper"

	result1 := HMAC256Hex(pepper, "secret1")
	result2 := HMAC256Hex(pepper, "secret2")
	result3 := HMAC256Hex("different-pepper", "secret1")

	assert.NotEqual(t, result1, result2, "different secret should produce different output")
	assert.NotEqual(t, result1, result3, "different pepper should produce different output")
	assert.NotEqual(t, result2, result3, "different pepper and secret should produce different output")
}
