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
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Hello from OpenAI!"},
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
		createTestMessage("assistant", []model.Part{
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_123",
					"name":      "get_weather",       // Unified: was "tool_name", now "name"
					"arguments": "{\"city\":\"SF\"}", // Unified: JSON string format
					"type":      "function",          // Store tool type
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

func TestOpenAIConverter_Convert_ToolResult(t *testing.T) {
	converter := &OpenAIConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{
				Type: "tool-result",
				Text: "Weather is sunny",
				Meta: map[string]any{
					"tool_call_id": "call_123",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}
