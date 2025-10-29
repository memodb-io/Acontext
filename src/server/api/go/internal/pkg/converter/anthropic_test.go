package converter

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnthropicConverter_Convert_TextMessage(t *testing.T) {
	converter := &AnthropicConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Hello from Anthropic!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	// Anthropic converter returns []anthropic.MessageParam
	// For testing, we just verify it doesn't error
	assert.NotNil(t, result)
}

func TestAnthropicConverter_Convert_WithCacheControl(t *testing.T) {
	converter := &AnthropicConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{
				Type: "text",
				Text: "Cached content",
				Meta: map[string]any{
					"cache_control": map[string]interface{}{
						"type": "ephemeral",
					},
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAnthropicConverter_Convert_ToolUse(t *testing.T) {
	converter := &AnthropicConverter{}

	messages := []model.Message{
		createTestMessage("assistant", []model.Part{
			{
				Type: "tool-use",
				Meta: map[string]any{
					"id":        "toolu_123",
					"tool_name": "get_weather",
					"arguments": map[string]interface{}{"city": "Boston"},
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAnthropicConverter_Convert_ToolResult(t *testing.T) {
	converter := &AnthropicConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{
				Type: "tool-result",
				Text: "Weather: 72°F",
				Meta: map[string]any{
					"tool_use_id": "toolu_123",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAnthropicConverter_Convert_Image(t *testing.T) {
	converter := &AnthropicConverter{}

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
