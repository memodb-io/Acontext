package normalizer

import (
	"encoding/json"
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
)

func TestOpenAINormalizer_NormalizeFromOpenAIMessage(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	tests := []struct {
		name        string
		input       string
		wantRole    string
		wantPartCnt int
		wantErr     bool
		errContains string
	}{
		{
			name: "user message with string content",
			input: `{
				"role": "user",
				"content": "Hello, how are you?"
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with array content (text)",
			input: `{
				"role": "user",
				"content": [
					{"type": "text", "text": "What's in this image?"}
				]
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with image URL",
			input: `{
				"role": "user",
				"content": [
					{"type": "text", "text": "What's in this image?"},
					{
						"type": "image_url",
						"image_url": {
							"url": "https://example.com/image.jpg",
							"detail": "high"
						}
					}
				]
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "assistant message with text",
			input: `{
				"role": "assistant",
				"content": "I can help you with that."
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "assistant message with tool calls",
			input: `{
				"role": "assistant",
				"content": "Let me check the weather.",
				"tool_calls": [
					{
						"id": "call_abc123",
						"type": "function",
						"function": {
							"name": "get_weather",
							"arguments": "{\"location\": \"San Francisco\"}"
						}
					}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "assistant message with empty content",
			input: `{
				"role": "assistant",
				"content": ""
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 0,
			wantErr:     false,
		},
		{
			name: "assistant message with refusal",
			input: `{
				"role": "assistant",
				"content": [
					{
						"type": "refusal",
						"refusal": "I cannot help with that request."
					}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "system message with string content",
			input: `{
				"role": "system",
				"content": "You are a helpful assistant."
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "system message with array content",
			input: `{
				"role": "system",
				"content": [
					{"type": "text", "text": "You are a helpful assistant."}
				]
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "developer message with string content",
			input: `{
				"role": "developer",
				"content": "This is a developer instruction."
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "tool message",
			input: `{
				"role": "tool",
				"content": "Temperature is 72F",
				"tool_call_id": "call_abc123"
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "function message (deprecated)",
			input: `{
				"role": "function",
				"name": "get_weather",
				"content": "{\"temperature\": 72}"
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with audio",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "input_audio",
						"input_audio": {
							"data": "base64_audio_data",
							"format": "wav"
						}
					}
				]
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message without content",
			input: `{
				"role": "user"
			}`,
			wantErr:     true,
			errContains: "must have content",
		},
		{
			name: "system message without content",
			input: `{
				"role": "system"
			}`,
			wantErr:     true,
			errContains: "system message must have content",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(tt.input))

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
				assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
			}
		})
	}
}

func TestOpenAINormalizer_ContentPartTypes(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	tests := []struct {
		name         string
		input        string
		wantPartType string
	}{
		{
			name: "text part",
			input: `{
				"role": "user",
				"content": [
					{"type": "text", "text": "Hello"}
				]
			}`,
			wantPartType: model.PartTypeText,
		},
		{
			name: "image_url part",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "image_url",
						"image_url": {"url": "https://example.com/img.jpg"}
					}
				]
			}`,
			wantPartType: model.PartTypeImage,
		},
		{
			name: "input_audio part",
			input: `{
				"role": "user",
				"content": [
					{
						"type": "input_audio",
						"input_audio": {"data": "audio_data", "format": "wav"}
					}
				]
			}`,
			wantPartType: model.PartTypeAudio,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(tt.input))

			assert.NoError(t, err)
			assert.Equal(t, model.RoleUser, role)
			assert.Len(t, parts, 1)
			assert.Equal(t, tt.wantPartType, parts[0].Type)
			assert.NotNil(t, messageMeta)
			assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
		})
	}
}

func TestOpenAINormalizer_ToolCallsAndResults(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	t.Run("assistant with tool call", func(t *testing.T) {
		input := `{
			"role": "assistant",
			"tool_calls": [
				{
					"id": "call_123",
					"type": "function",
					"function": {
						"name": "calculate",
						"arguments": "{\"x\": 5, \"y\": 3}"
					}
				}
			]
		}`

		role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, model.RoleAssistant, role)
		assert.Len(t, parts, 1)
		assert.Equal(t, model.PartTypeToolCall, parts[0].Type)
		assert.NotNil(t, parts[0].Meta)
		assert.Equal(t, "call_123", parts[0].Meta[model.MetaKeyID])
		// UNIFIED FORMAT: now uses "name" instead of "tool_name"
		assert.Equal(t, "calculate", parts[0].Meta[model.MetaKeyName])
		assert.Equal(t, "function", parts[0].Meta[model.MetaKeySourceType])
		assert.NotNil(t, messageMeta)
		assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
	})

	t.Run("tool result message", func(t *testing.T) {
		input := `{
			"role": "tool",
			"content": "Result: 8",
			"tool_call_id": "call_123"
		}`

		role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, model.RoleUser, role)
		assert.Len(t, parts, 1)
		assert.Equal(t, model.PartTypeToolResult, parts[0].Type)
		assert.Equal(t, "Result: 8", parts[0].Text)
		// UNIFIED FORMAT: uses "tool_call_id"
		assert.Equal(t, "call_123", parts[0].Meta[model.MetaKeyToolCallID])
		assert.NotNil(t, messageMeta)
		assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
	})

	t.Run("deprecated function call", func(t *testing.T) {
		input := `{
			"role": "assistant",
			"function_call": {
				"name": "old_function",
				"arguments": "{\"param\": \"value\"}"
			}
		}`

		role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, model.RoleAssistant, role)
		assert.Len(t, parts, 1)
		assert.Equal(t, model.PartTypeToolCall, parts[0].Type)
		// UNIFIED FORMAT: now uses "name" instead of "tool_name"
		assert.Equal(t, "old_function", parts[0].Meta[model.MetaKeyName])
		assert.Equal(t, "function", parts[0].Meta[model.MetaKeySourceType])
		assert.NotNil(t, messageMeta)
		assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
	})
}

func TestOpenAINormalizer_MultipleContentParts(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	input := `{
		"role": "user",
		"content": [
			{"type": "text", "text": "First part"},
			{"type": "text", "text": "Second part"},
			{
				"type": "image_url",
				"image_url": {"url": "https://example.com/img.jpg"}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 3)
	assert.Equal(t, model.PartTypeText, parts[0].Type)
	assert.Equal(t, "First part", parts[0].Text)
	assert.Equal(t, model.PartTypeText, parts[1].Type)
	assert.Equal(t, "Second part", parts[1].Text)
	assert.Equal(t, model.PartTypeImage, parts[2].Type)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
}

func TestOpenAINormalizer_MessageWithName(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	input := `{
		"role": "user",
		"name": "Alice",
		"content": "Hello, I'm Alice"
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeText, parts[0].Type)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
	assert.Equal(t, "Alice", messageMeta[model.MetaKeyName])
}

func TestNormalizeDeveloperMessage(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	input := `{
		"role": "developer",
		"content": "You must always respond in JSON."
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeText, parts[0].Type)
	assert.Equal(t, "You must always respond in JSON.", parts[0].Text)
	assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
	assert.Equal(t, "developer", messageMeta[model.MsgMetaOriginalRole])
}

func TestNormalizeDeveloperMessageArrayContent(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	input := `{
		"role": "developer",
		"content": [
			{"type": "text", "text": "First instruction."},
			{"type": "text", "text": "Second instruction."}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 2)
	assert.Equal(t, "First instruction.", parts[0].Text)
	assert.Equal(t, "Second instruction.", parts[1].Text)
	assert.Equal(t, "developer", messageMeta[model.MsgMetaOriginalRole])
}

func TestNormalizeSystemMessage(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	input := `{
		"role": "system",
		"content": "You are a helpful assistant."
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeText, parts[0].Type)
	assert.Equal(t, "You are a helpful assistant.", parts[0].Text)
	assert.Equal(t, "openai", messageMeta[model.MsgMetaSourceFormat])
	assert.Equal(t, "system", messageMeta[model.MsgMetaOriginalRole])
}

func TestNormalizeDeveloperMessageWithName(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	input := `{
		"role": "developer",
		"name": "orchestrator",
		"content": "Follow these rules carefully."
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "Follow these rules carefully.", parts[0].Text)
	assert.Equal(t, "developer", messageMeta[model.MsgMetaOriginalRole])
	assert.Equal(t, "orchestrator", messageMeta[model.MetaKeyName])
}
