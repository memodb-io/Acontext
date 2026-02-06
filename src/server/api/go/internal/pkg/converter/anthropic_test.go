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
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Hello from Anthropic!"},
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
		createTestMessage(model.RoleUser, []model.Part{
			{
				Type: model.PartTypeText,
				Text: "Cached content",
				Meta: map[string]any{
					model.MetaKeyCacheControl: map[string]interface{}{
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

func TestAnthropicConverter_Convert_ToolCall(t *testing.T) {
	converter := &AnthropicConverter{}

	// UNIFIED FORMAT: now uses "tool-call" type and unified field names
	messages := []model.Message{
		createTestMessage(model.RoleAssistant, []model.Part{
			{
				Type: model.PartTypeToolCall, // Unified: was "tool-use", now "tool-call"
				Meta: map[string]any{
					model.MetaKeyID:         "toolu_123",
					model.MetaKeyName:       "get_weather",           // Unified: was "tool_name", now "name"
					model.MetaKeyArguments:  "{\"city\":\"Boston\"}", // Unified: JSON string format
					model.MetaKeySourceType: "tool_use",              // Store original Anthropic type
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

	// UNIFIED FORMAT: now uses "tool_call_id" instead of "tool_use_id"
	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{
				Type: model.PartTypeToolResult,
				Text: "Weather: 72°F",
				Meta: map[string]any{
					model.MetaKeyToolCallID: "toolu_123", // Unified: was "tool_use_id", now "tool_call_id"
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAnthropicConverter_Convert_ThinkingBlock(t *testing.T) {
	converter := &AnthropicConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleAssistant, []model.Part{
			{
				Type: model.PartTypeThinking,
				Text: "Let me reason step by step...",
				Meta: map[string]any{
					model.MetaKeySignature: "sig_abc123",
				},
			},
			{
				Type: model.PartTypeText,
				Text: "Here is my answer.",
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
		createTestMessage(model.RoleUser, []model.Part{
			{
				Type:     model.PartTypeImage,
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
