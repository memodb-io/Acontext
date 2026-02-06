package converter

import (
	"testing"

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
	assert.NotNil(t, result)
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
