package normalizer

import (
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/stretchr/testify/assert"
)

func TestExtractAnthropicCacheControl(t *testing.T) {
	tests := []struct {
		name     string
		input    anthropic.CacheControlEphemeralParam
		expected map[string]interface{}
	}{
		{
			name:  "with ephemeral type",
			input: anthropic.NewCacheControlEphemeralParam(),
			expected: map[string]interface{}{
				"type": "ephemeral",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractAnthropicCacheControl(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBuildAnthropicCacheControl(t *testing.T) {
	tests := []struct {
		name     string
		input    map[string]any
		expected *anthropic.CacheControlEphemeralParam
	}{
		{
			name: "with valid cache_control",
			input: map[string]any{
				"cache_control": map[string]interface{}{
					"type": "ephemeral",
				},
			},
			expected: func() *anthropic.CacheControlEphemeralParam {
				param := anthropic.NewCacheControlEphemeralParam()
				return &param
			}(),
		},
		{
			name:     "with nil meta",
			input:    nil,
			expected: nil,
		},
		{
			name:     "with no cache_control",
			input:    map[string]any{},
			expected: nil,
		},
		{
			name: "with invalid type",
			input: map[string]any{
				"cache_control": map[string]interface{}{
					"type": "invalid",
				},
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := BuildAnthropicCacheControl(tt.input)
			if tt.expected == nil {
				assert.Nil(t, result)
			} else {
				assert.NotNil(t, result)
				assert.Equal(t, tt.expected.Type, result.Type)
			}
		})
	}
}
