package normalizer

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/memodb-io/Acontext/internal/modules/model"
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleAssistant,
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleAssistant,
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleUser,
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
			wantRole:    model.RoleAssistant,
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "assistant message with thinking block",
			input: `{
				"role": "assistant",
				"content": [
					{"type": "thinking", "thinking": "Let me reason about this...", "signature": "sig_abc123"}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "assistant message with thinking and text blocks",
			input: `{
				"role": "assistant",
				"content": [
					{"type": "thinking", "thinking": "Step 1: analyze the problem...", "signature": "sig_def456"},
					{"type": "text", "text": "Here is my answer."}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "assistant message with redacted thinking block (skipped)",
			input: `{
				"role": "assistant",
				"content": [
					{"type": "redacted_thinking", "data": "opaque-encrypted-data"},
					{"type": "text", "text": "Here is my answer."}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 1,
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
			role, parts, messageMeta, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(tt.input))

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantRole, role)
				assert.Len(t, parts, tt.wantPartCnt)
				// Verify message metadata
				assert.NotNil(t, messageMeta)
				assert.Equal(t, "anthropic", messageMeta[model.MsgMetaSourceFormat])
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
			wantPartType: model.PartTypeText,
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
			wantPartType: model.PartTypeImage,
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "base64", meta[model.MetaKeySourceType])
				// media_type is stored as-is from SDK, use fmt.Sprint to convert
				assert.Equal(t, "image/png", fmt.Sprint(meta[model.MetaKeyMediaType]))
				assert.NotEmpty(t, meta[model.MetaKeyData])
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
			wantPartType: model.PartTypeToolCall, // UNIFIED FORMAT: was "tool-use", now "tool-call"
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "toolu_789", meta[model.MetaKeyID])
				assert.Equal(t, "calculator", meta[model.MetaKeyName])
				// UNIFIED FORMAT: was "input", now "arguments"
				assert.Contains(t, meta[model.MetaKeyArguments], "operation")
				assert.Equal(t, "tool_use", meta[model.MetaKeySourceType]) // Store original type
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
			wantPartType: model.PartTypeToolResult,
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				// UNIFIED FORMAT: was "tool_use_id", now "tool_call_id"
				assert.Equal(t, "toolu_789", meta[model.MetaKeyToolCallID])
				assert.Equal(t, false, meta[model.MetaKeyIsError])
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
			wantPartType: model.PartTypeFile,
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "base64", meta[model.MetaKeySourceType])
				// media_type for documents, use fmt.Sprint to convert
				assert.Equal(t, "application/pdf", fmt.Sprint(meta[model.MetaKeyMediaType]))
			},
		},
		{
			name: "thinking block",
			input: `{
				"role": "assistant",
				"content": [
					{
						"type": "thinking",
						"thinking": "Let me analyze this carefully...",
						"signature": "sig_xyz789"
					}
				]
			}`,
			wantPartType: model.PartTypeThinking,
			checkMeta: func(t *testing.T, meta map[string]interface{}) {
				assert.Equal(t, "sig_xyz789", meta[model.MetaKeySignature])
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, parts, messageMeta, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(tt.input))

			assert.NoError(t, err)
			assert.Len(t, parts, 1)
			assert.Equal(t, tt.wantPartType, parts[0].Type)
			assert.NotNil(t, messageMeta)
			assert.Equal(t, "anthropic", messageMeta[model.MsgMetaSourceFormat])

			if tt.checkMeta != nil && parts[0].Meta != nil {
				tt.checkMeta(t, parts[0].Meta)
			}
		})
	}
}

func TestAnthropicNormalizer_ThinkingBlock(t *testing.T) {
	normalizer := &AnthropicNormalizer{}

	t.Run("thinking block extracts text and signature", func(t *testing.T) {
		input := `{
			"role": "assistant",
			"content": [
				{
					"type": "thinking",
					"thinking": "Step 1: Consider the input.\nStep 2: Form a response.",
					"signature": "sig_abc123"
				}
			]
		}`

		role, parts, _, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, model.RoleAssistant, role)
		assert.Len(t, parts, 1)
		assert.Equal(t, model.PartTypeThinking, parts[0].Type)
		assert.Equal(t, "Step 1: Consider the input.\nStep 2: Form a response.", parts[0].Text)
		assert.Equal(t, "sig_abc123", parts[0].Meta[model.MetaKeySignature])
	})

	t.Run("redacted thinking block is skipped", func(t *testing.T) {
		input := `{
			"role": "assistant",
			"content": [
				{"type": "thinking", "thinking": "Visible thinking", "signature": "sig_1"},
				{"type": "redacted_thinking", "data": "opaque-data"},
				{"type": "text", "text": "Final answer"}
			]
		}`

		role, parts, _, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, model.RoleAssistant, role)
		assert.Len(t, parts, 2)
		assert.Equal(t, model.PartTypeThinking, parts[0].Type)
		assert.Equal(t, "Visible thinking", parts[0].Text)
		assert.Equal(t, model.PartTypeText, parts[1].Type)
		assert.Equal(t, "Final answer", parts[1].Text)
	})
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

	role, parts, messageMeta, err := normalizer.NormalizeFromAnthropicMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.NotNil(t, parts[0].Meta)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "anthropic", messageMeta[model.MsgMetaSourceFormat])

	cacheControl, ok := parts[0].Meta[model.MetaKeyCacheControl].(map[string]interface{})
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
				model.MetaKeyCacheControl: map[string]interface{}{
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
				model.MetaKeyCacheControl: map[string]interface{}{
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
