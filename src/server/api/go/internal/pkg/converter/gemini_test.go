package converter

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiConverter_Convert_TextMessage(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Hello from Gemini!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	// Gemini converter returns []*genai.Content
	// For testing, we just verify it doesn't error
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_AssistantMessage(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("assistant", []model.Part{
			{Type: "text", Text: "I'm doing well, thank you!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_ToolCall(t *testing.T) {
	converter := &GeminiConverter{}

	// UNIFIED FORMAT: now uses unified field names
	messages := []model.Message{
		createTestMessage("assistant", []model.Part{
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_123",
					"name":      "get_weather",
					"arguments": "{\"city\":\"SF\"}",
					"type":      "function",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_ThinkingDowngradedToText(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("assistant", []model.Part{
			{
				Type: "thinking",
				Text: "Let me reason about this...",
				Meta: map[string]any{
					"signature": "sig_abc123",
				},
			},
			{
				Type: "text",
				Text: "Here is my answer.",
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_ToolResult(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{
				Type: "tool-result",
				Text: "Weather is sunny",
				Meta: map[string]any{
					"name": "get_weather",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_Image(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{
				Type:     "image",
				Filename: "image.jpg",
				Asset: &model.Asset{
					S3Key: "assets/image.jpg",
					MIME:  "image/jpeg",
					SizeB: 2048,
				},
			},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"assets/image.jpg": {URL: "https://example.com/image.jpg"},
	}

	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_MultipleParts(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "What's in this image?"},
			{
				Type:     "image",
				Filename: "image.jpg",
				Asset: &model.Asset{
					S3Key: "assets/image.jpg",
					MIME:  "image/jpeg",
					SizeB: 2048,
				},
			},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"assets/image.jpg": {URL: "https://example.com/image.jpg"},
	}

	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_InvalidRole(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("system", []model.Part{
			{Type: "text", Text: "System message"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	// Should handle invalid role gracefully (return nil content)
	require.NoError(t, err)
	assert.NotNil(t, result)
}
