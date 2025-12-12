package normalizer

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAcontextNormalizer_NormalizeFromAcontextMessage(t *testing.T) {
	normalizer := &AcontextNormalizer{}

	tests := []struct {
		name        string
		input       string
		wantRole    string
		wantPartCnt int
		wantErr     bool
		errContains string
	}{
		{
			name: "valid user message with text",
			input: `{
				"role": "user",
				"parts": [
					{"type": "text", "text": "Hello world"}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "valid assistant message with text",
			input: `{
				"role": "assistant",
				"parts": [
					{"type": "text", "text": "How can I help you?"}
				]
			}`,
			wantRole:    "assistant",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "invalid system message (not supported)",
			input: `{
				"role": "system",
				"parts": [
					{"type": "text", "text": "You are a helpful assistant."}
				]
			}`,
			wantErr:     true,
			errContains: "invalid role",
		},
		{
			name: "message with multiple parts",
			input: `{
				"role": "user",
				"parts": [
					{"type": "text", "text": "Check this image:"},
					{"type": "image", "meta": {"url": "https://example.com/image.jpg"}}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "message with tool-call",
			input: `{
				"role": "assistant",
				"parts": [
					{
						"type": "tool-call",
						"meta": {
							"id": "call_123",
							"name": "get_weather",
							"arguments": "{\"location\":\"SF\"}"
						}
					}
				]
			}`,
			wantRole:    "assistant",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "message with tool-result",
			input: `{
				"role": "user",
				"parts": [
					{
						"type": "tool-result",
						"text": "Temperature: 72F",
						"meta": {"tool_call_id": "call_123"}
					}
				]
			}`,
			wantRole:    "user",
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "invalid role",
			input: `{
				"role": "invalid_role",
				"parts": [
					{"type": "text", "text": "Hello"}
				]
			}`,
			wantErr:     true,
			errContains: "invalid role",
		},
		{
			name: "invalid JSON",
			input: `{
				"role": "user",
				"parts": [
					{"type": "text"
			}`,
			wantErr:     true,
			errContains: "failed to unmarshal",
		},
		{
			name: "invalid part type",
			input: `{
				"role": "user",
				"parts": [
					{"type": "invalid_type", "text": "Hello"}
				]
			}`,
			wantErr:     true,
			errContains: "invalid part",
		},
		{
			name: "empty parts array",
			input: `{
				"role": "user",
				"parts": []
			}`,
			wantRole:    "user",
			wantPartCnt: 0,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, messageMeta, err := normalizer.NormalizeFromAcontextMessage(json.RawMessage(tt.input))

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
				assert.Equal(t, "acontext", messageMeta["source_format"])
			}
		})
	}
}

func TestAcontextNormalizer_ValidatePartTypes(t *testing.T) {
	normalizer := &AcontextNormalizer{}

	tests := []struct {
		partType string
		input    string
	}{
		{"text", `{"role": "user", "parts": [{"type": "text", "text": "sample text"}]}`},
		{"image", `{"role": "user", "parts": [{"type": "image", "meta": {"url": "https://example.com/img.jpg"}}]}`},
		{"audio", `{"role": "user", "parts": [{"type": "audio", "meta": {"url": "https://example.com/audio.mp3"}}]}`},
		{"video", `{"role": "user", "parts": [{"type": "video", "meta": {"url": "https://example.com/video.mp4"}}]}`},
		{"file", `{"role": "user", "parts": [{"type": "file", "meta": {"url": "https://example.com/file.pdf"}}]}`},
		{"tool-call", `{"role": "assistant", "parts": [{"type": "tool-call", "meta": {"name": "test", "arguments": "{}"}}]}`},
		{"tool-result", `{"role": "user", "parts": [{"type": "tool-result", "text": "result", "meta": {"tool_call_id": "call_123"}}]}`},
		{"data", `{"role": "user", "parts": [{"type": "data", "meta": {"data_type": "json", "key": "value"}}]}`},
	}

	for _, tt := range tests {
		t.Run("valid_type_"+tt.partType, func(t *testing.T) {
			role, parts, messageMeta, err := normalizer.NormalizeFromAcontextMessage(json.RawMessage(tt.input))

			assert.NoError(t, err)
			assert.NotEmpty(t, role)
			assert.Len(t, parts, 1)
			assert.Equal(t, tt.partType, parts[0].Type)
			assert.NotNil(t, messageMeta)
			assert.Equal(t, "acontext", messageMeta["source_format"])
		})
	}
}

func TestAcontextNormalizer_MessageWithMeta(t *testing.T) {
	normalizer := &AcontextNormalizer{}

	input := `{
		"role": "user",
		"meta": {
			"name": "Alice",
			"custom_field": "custom_value"
		},
		"parts": [
			{"type": "text", "text": "Hello"}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromAcontextMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 1)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "acontext", messageMeta["source_format"])
	assert.Equal(t, "Alice", messageMeta["name"])
	assert.Equal(t, "custom_value", messageMeta["custom_field"])
}
