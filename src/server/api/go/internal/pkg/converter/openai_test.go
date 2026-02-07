package converter

import (
	"testing"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIConverter_Convert_TextMessage(t *testing.T) {
	converter := &OpenAIConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Hello from OpenAI!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	// OpenAI converter returns []openai.ChatCompletionMessageParamUnion
	// For testing, we just verify it doesn't error
	assert.NotNil(t, result)
}

func TestOpenAIConverter_Convert_AssistantWithToolCalls(t *testing.T) {
	converter := &OpenAIConverter{}

	// UNIFIED FORMAT: now uses unified field names
	messages := []model.Message{
		createTestMessage(model.RoleAssistant, []model.Part{
			{
				Type: model.PartTypeToolCall,
				Meta: map[string]any{
					model.MetaKeyID:         "call_123",
					model.MetaKeyName:       "get_weather",       // Unified: was "tool_name", now "name"
					model.MetaKeyArguments:  "{\"city\":\"SF\"}", // Unified: JSON string format
					model.MetaKeySourceType: "function",          // Store tool type
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestOpenAIConverter_Convert_ThinkingDowngradedToText(t *testing.T) {
	converter := &OpenAIConverter{}

	t.Run("thinking + text become separate content parts", func(t *testing.T) {
		messages := []model.Message{
			createTestMessage(model.RoleAssistant, []model.Part{
				{
					Type: model.PartTypeThinking,
					Text: "Let me reason about this...",
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

		msgs := result.([]openai.ChatCompletionMessageParamUnion)
		require.Len(t, msgs, 1)

		assistant := msgs[0].OfAssistant
		require.NotNil(t, assistant)

		// Multiple parts: should use OfArrayOfContentParts, not OfString
		assert.True(t, param.IsOmitted(assistant.Content.OfString),
			"expected OfString to be omitted when multiple content parts exist")
		require.Len(t, assistant.Content.OfArrayOfContentParts, 2)
		assert.Equal(t, "Let me reason about this...", assistant.Content.OfArrayOfContentParts[0].OfText.Text)
		assert.Equal(t, "Here is my answer.", assistant.Content.OfArrayOfContentParts[1].OfText.Text)
	})

	t.Run("single text uses OfString", func(t *testing.T) {
		messages := []model.Message{
			createTestMessage(model.RoleAssistant, []model.Part{
				{Type: model.PartTypeText, Text: "Just text."},
			}, nil),
		}

		result, err := converter.Convert(messages, nil)
		require.NoError(t, err)

		msgs := result.([]openai.ChatCompletionMessageParamUnion)
		require.Len(t, msgs, 1)

		assistant := msgs[0].OfAssistant
		require.NotNil(t, assistant)

		// Single part: should use OfString for backward compatibility
		assert.False(t, param.IsOmitted(assistant.Content.OfString))
		assert.Equal(t, "Just text.", assistant.Content.OfString.Value)
		assert.Empty(t, assistant.Content.OfArrayOfContentParts)
	})
}

func TestOpenAIConverter_Convert_ToolResult(t *testing.T) {
	converter := &OpenAIConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{
				Type: model.PartTypeToolResult,
				Text: "Weather is sunny",
				Meta: map[string]any{
					model.MetaKeyToolCallID: "call_123",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}
