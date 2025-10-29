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

	messages := []model.Message{
		createTestMessage("assistant", []model.Part{
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_123",
					"tool_name": "get_weather",
					"arguments": map[string]interface{}{"city": "SF"},
				},
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
