package normalizer

import (
	"encoding/json"
	"testing"

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
			wantRole:    "user",
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
			wantRole:    "user",
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
			wantRole:    "user",
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "assistant message with text",
			input: `{
				"role": "assistant",
				"content": "I can help you with that."
			}`,
			wantRole:    "assistant",
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
			wantRole:    "assistant",
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "assistant message with empty content",
			input: `{
				"role": "assistant",
				"content": ""
			}`,
			wantRole:    "assistant",
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
			wantRole:    "assistant",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "system message",
			input: `{
				"role": "system",
				"content": "You are a helpful assistant."
			}`,
			wantRole:    "system",
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
			wantRole:    "system",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "developer message (converted to system)",
			input: `{
				"role": "developer",
				"content": "This is a developer instruction."
			}`,
			wantRole:    "system",
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
			wantRole:    "user",
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
			wantRole:    "user",
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
			wantRole:    "user",
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
			errContains: "must have content",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(tt.input))

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
			wantPartType: "text",
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
			wantPartType: "image",
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
			wantPartType: "audio",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(tt.input))

			assert.NoError(t, err)
			assert.Equal(t, "user", role)
			assert.Len(t, parts, 1)
			assert.Equal(t, tt.wantPartType, parts[0].Type)
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

		role, parts, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, "assistant", role)
		assert.Len(t, parts, 1)
		assert.Equal(t, "tool-call", parts[0].Type)
		assert.NotNil(t, parts[0].Meta)
		assert.Equal(t, "call_123", parts[0].Meta["id"])
		assert.Equal(t, "calculate", parts[0].Meta["tool_name"])
	})

	t.Run("tool result message", func(t *testing.T) {
		input := `{
			"role": "tool",
			"content": "Result: 8",
			"tool_call_id": "call_123"
		}`

		role, parts, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, "user", role)
		assert.Len(t, parts, 1)
		assert.Equal(t, "tool-result", parts[0].Type)
		assert.Equal(t, "Result: 8", parts[0].Text)
		assert.Equal(t, "call_123", parts[0].Meta["tool_call_id"])
	})

	t.Run("deprecated function call", func(t *testing.T) {
		input := `{
			"role": "assistant",
			"function_call": {
				"name": "old_function",
				"arguments": "{\"param\": \"value\"}"
			}
		}`

		role, parts, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

		assert.NoError(t, err)
		assert.Equal(t, "assistant", role)
		assert.Len(t, parts, 1)
		assert.Equal(t, "tool-call", parts[0].Type)
		assert.Equal(t, "old_function", parts[0].Meta["tool_name"])
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

	role, parts, err := normalizer.NormalizeFromOpenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 3)
	assert.Equal(t, "text", parts[0].Type)
	assert.Equal(t, "First part", parts[0].Text)
	assert.Equal(t, "text", parts[1].Type)
	assert.Equal(t, "Second part", parts[1].Text)
	assert.Equal(t, "image", parts[2].Type)
}
