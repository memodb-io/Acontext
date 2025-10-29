package normalizer

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/stretchr/testify/assert"
)

func TestAnthropicNormalizer_NormalizeFromAnthropicMessage(t *testing.T) {
	normalizer := &AnthropicNormalizer{}

	tests := []struct {
		name        string
		input       string
		wantRole    string
		wantPartCnt int
		wantErr     bool
		errContains string
	}{
		{
			name: "user message with text",
			input: `{
				"role": "user",
				"content": [
					{"type": "text", "text": "Hello, how are you?"}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "assistant message with text",
			input: `{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "I'm doing well, thank you!"}
				]
			}`,
			wantRole:    "assistant",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with image (base64)",
			input: `{
				"role": "user",
				"content": [
					{"type": "text", "text": "What's in this image?"},
					{
						"type": "image",
						"source": {
							"type": "base64",
							"media_type": "image/jpeg",
							"data": "base64_encoded_image_data"
						}
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "user message with image (url)",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "image",
						"source": {
							"type": "url",
							"url": "https://example.com/image.jpg"
						}
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "assistant message with tool use",
			input: `{
				"role": "assistant",
				"content": [
					{
						"type": "tool_use",
						"id": "toolu_123",
						"name": "get_weather",
						"input": {"location": "San Francisco"}
					}
				]
			}`,
			wantRole:    "assistant",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with tool result",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "tool_result",
						"tool_use_id": "toolu_123",
						"content": [
							{"type": "text", "text": "Temperature: 72F"}
						]
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with tool result (error)",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "tool_result",
						"tool_use_id": "toolu_123",
						"is_error": true,
						"content": [
							{"type": "text", "text": "Error: API unavailable"}
						]
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with document (base64)",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "document",
						"source": {
							"type": "base64",
							"media_type": "application/pdf",
							"data": "base64_pdf_data"
						}
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "message with cache control",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "text",
						"text": "Cached content",
						"cache_control": {"type": "ephemeral"}
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "multiple content blocks",
			input: `{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "Let me check the weather."},
					{
						"type": "tool_use",
						"id": "toolu_456",
						"name": "get_weather",
						"input": {"location": "NYC"}
					}
				]
			}`,
			wantRole:    "assistant",
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "invalid role (system not supported)",
			input: `{
				"role": "system",
				"content": [
					{"type": "text", "text": "System message"}
				]
			}`,
			wantErr:     true,
			errContains: "invalid Anthropic role",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(tt.input))

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantRole, role)
				assert.Len(t, parts, tt.wantPartCnt)
			}
		})
	}
}

func TestAnthropicNormalizer_ContentBlockTypes(t *testing.T) {
	normalizer := &AnthropicNormalizer{}

	tests := []struct {
		name         string
		input        string
		wantPartType string
		checkMeta    func(t *testing.T, meta map[string]interface{})
	}{
		{
			name: "text block",
			input: `{
				"role": "user",
				"content": [
					{"type": "text", "text": "Hello"}
				]
			}`,
			wantPartType: "text",
		},
		{
			name: "image block with base64",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "image",
						"source": {
							"type": "base64",
							"media_type": "image/png",
							"data": "iVBORw0KG..."
						}
					}
				]
			}`,
			wantPartType: "image",
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "base64", meta["type"])
				// media_type is stored as-is from SDK, use fmt.Sprint to convert
				assert.Equal(t, "image/png", fmt.Sprint(meta["media_type"]))
				assert.NotEmpty(t, meta["data"])
			},
		},
		{
			name: "tool_use block",
			input: `{
				"role": "assistant",
				"content": [
					{
						"type": "tool_use",
						"id": "toolu_789",
						"name": "calculator",
						"input": {"operation": "add", "x": 5, "y": 3}
					}
				]
			}`,
			wantPartType: "tool-use",
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "toolu_789", meta["id"])
				assert.Equal(t, "calculator", meta["name"])
				assert.Contains(t, meta["input"], "operation")
			},
		},
		{
			name: "tool_result block",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "tool_result",
						"tool_use_id": "toolu_789",
						"content": [
							{"type": "text", "text": "Result: 8"}
						]
					}
				]
			}`,
			wantPartType: "tool-result",
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "toolu_789", meta["tool_use_id"])
				assert.Equal(t, false, meta["is_error"])
			},
		},
		{
			name: "document block",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "document",
						"source": {
							"type": "base64",
							"media_type": "application/pdf",
							"data": "JVBERi0x..."
						}
					}
				]
			}`,
			wantPartType: "file",
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "base64", meta["type"])
				// media_type for documents, use fmt.Sprint to convert
				assert.Equal(t, "application/pdf", fmt.Sprint(meta["media_type"]))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, parts, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(tt.input))

			assert.NoError(t, err)
			assert.Len(t, parts, 1)
			assert.Equal(t, tt.wantPartType, parts[0].Type)

			if tt.checkMeta != nil && parts[0].Meta != nil {
				tt.checkMeta(t, parts[0].Meta)
			}
		})
	}
}

func TestAnthropicNormalizer_CacheControl(t *testing.T) {
	normalizer := &AnthropicNormalizer{}

	input := `{
		"role": "user",
		"content": [
			{
				"type": "text",
				"text": "Important context to cache",
				"cache_control": {"type": "ephemeral"}
			}
		]
	}`

	role, parts, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 1)
	assert.NotNil(t, parts[0].Meta)

	cacheControl, ok := parts[0].Meta["cache_control"].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, "ephemeral", cacheControl["type"])
}

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
