package converter

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIConverter_SimpleText(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "user",
			Parts: []model.Part{
				{
					Type: "text",
					Text: "Hello",
				},
			},
		},
	}

	converter := &OpenAIConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	openaiMsgs, ok := result.([]OpenAIMessage)
	require.True(t, ok)
	require.Len(t, openaiMsgs, 1)

	assert.Equal(t, "user", openaiMsgs[0].Role)
	assert.Equal(t, "Hello", openaiMsgs[0].Content)
}

func TestOpenAIConverter_MultiplePartsWithImage(t *testing.T) {
	messages := createTestMessages()
	publicURLs := createTestPublicURLs()

	converter := &OpenAIConverter{}
	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)

	openaiMsgs, ok := result.([]OpenAIMessage)
	require.True(t, ok)
	require.Len(t, openaiMsgs, 3)

	// Check third message with image
	assert.Equal(t, "user", openaiMsgs[2].Role)
	contentParts, ok := openaiMsgs[2].Content.([]OpenAIContentPart)
	require.True(t, ok)
	require.Len(t, contentParts, 2)

	assert.Equal(t, "text", contentParts[0].Type)
	assert.Equal(t, "Can you analyze this image?", contentParts[0].Text)

	assert.Equal(t, "image_url", contentParts[1].Type)
	require.NotNil(t, contentParts[1].ImageURL)
	assert.Equal(t, "https://example.com/test.png", contentParts[1].ImageURL.URL)
}

func TestOpenAIConverter_ToolCall(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "assistant",
			Parts: []model.Part{
				{
					Type: "tool-call",
					Meta: map[string]interface{}{
						"id":        "call_123",
						"tool_name": "get_weather",
						"arguments": map[string]interface{}{
							"location": "San Francisco",
						},
					},
				},
			},
		},
	}

	converter := &OpenAIConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	openaiMsgs, ok := result.([]OpenAIMessage)
	require.True(t, ok)
	require.Len(t, openaiMsgs, 1)

	assert.Equal(t, "assistant", openaiMsgs[0].Role)
	require.Len(t, openaiMsgs[0].ToolCalls, 1)

	toolCall := openaiMsgs[0].ToolCalls[0]
	assert.Equal(t, "call_123", toolCall.ID)
	assert.Equal(t, "function", toolCall.Type)
	assert.Equal(t, "get_weather", toolCall.Function.Name)

	// Verify arguments are JSON
	var args map[string]interface{}
	err = json.Unmarshal([]byte(toolCall.Function.Arguments), &args)
	require.NoError(t, err)
	assert.Equal(t, "San Francisco", args["location"])
}

func TestOpenAIConverter_RoleConversion(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		expected string
	}{
		{"user role", "user", "user"},
		{"assistant role", "assistant", "assistant"},
		{"system role", "system", "system"},
		{"tool role", "tool", "tool"},
		{"function role", "function", "function"},
		{"unknown role", "unknown", "user"},
	}

	converter := &OpenAIConverter{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.convertRole(tt.role)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestOpenAIConverter_ToolResult(t *testing.T) {
	t.Run("user role with only tool-result converts to tool role", func(t *testing.T) {
		messages := []model.Message{
			{
				ID:        uuid.New(),
				SessionID: uuid.New(),
				Role:      "user",
				Parts: []model.Part{
					{
						Type: "tool-result",
						Meta: map[string]interface{}{
							"tool_call_id": "call_123",
							"result":       "The weather is sunny",
						},
					},
				},
			},
		}

		converter := &OpenAIConverter{}
		result, err := converter.Convert(messages, nil)
		require.NoError(t, err)

		openaiMsgs, ok := result.([]OpenAIMessage)
		require.True(t, ok)
		require.Len(t, openaiMsgs, 1)

		// Should be converted to tool role
		assert.Equal(t, "tool", openaiMsgs[0].Role)
		assert.Equal(t, "call_123", openaiMsgs[0].ToolCallID)
		assert.NotEmpty(t, openaiMsgs[0].Content)
	})

	t.Run("user role with tool-result and text stays as user", func(t *testing.T) {
		messages := []model.Message{
			{
				ID:        uuid.New(),
				SessionID: uuid.New(),
				Role:      "user",
				Parts: []model.Part{
					{
						Type: "text",
						Text: "Here is the result:",
					},
					{
						Type: "tool-result",
						Meta: map[string]interface{}{
							"tool_call_id": "call_456",
							"result":       "Data retrieved",
						},
					},
				},
			},
		}

		converter := &OpenAIConverter{}
		result, err := converter.Convert(messages, nil)
		require.NoError(t, err)

		openaiMsgs, ok := result.([]OpenAIMessage)
		require.True(t, ok)
		require.Len(t, openaiMsgs, 1)

		// Should stay as user role (not tool-result only)
		assert.Equal(t, "user", openaiMsgs[0].Role)
		assert.Empty(t, openaiMsgs[0].ToolCallID)
	})

	t.Run("tool-result with text field", func(t *testing.T) {
		messages := []model.Message{
			{
				ID:        uuid.New(),
				SessionID: uuid.New(),
				Role:      "user",
				Parts: []model.Part{
					{
						Type: "tool-result",
						Text: "Direct text content",
						Meta: map[string]interface{}{
							"tool_call_id": "call_789",
						},
					},
				},
			},
		}

		converter := &OpenAIConverter{}
		result, err := converter.Convert(messages, nil)
		require.NoError(t, err)

		openaiMsgs, ok := result.([]OpenAIMessage)
		require.True(t, ok)
		require.Len(t, openaiMsgs, 1)

		assert.Equal(t, "tool", openaiMsgs[0].Role)
		assert.Equal(t, "call_789", openaiMsgs[0].ToolCallID)
		assert.Equal(t, "Direct text content", openaiMsgs[0].Content)
	})
}

func TestOpenAIConverter_IsToolResultOnly(t *testing.T) {
	converter := &OpenAIConverter{}

	tests := []struct {
		name     string
		parts    []model.Part
		expected bool
	}{
		{
			name:     "empty parts",
			parts:    []model.Part{},
			expected: false,
		},
		{
			name: "only tool-result",
			parts: []model.Part{
				{Type: "tool-result"},
			},
			expected: true,
		},
		{
			name: "multiple tool-results",
			parts: []model.Part{
				{Type: "tool-result"},
				{Type: "tool-result"},
			},
			expected: true,
		},
		{
			name: "tool-result and text",
			parts: []model.Part{
				{Type: "tool-result"},
				{Type: "text"},
			},
			expected: false,
		},
		{
			name: "only text",
			parts: []model.Part{
				{Type: "text"},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.isToolResultOnly(tt.parts)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestOpenAIConverter_ExtractToolCallID(t *testing.T) {
	converter := &OpenAIConverter{}

	tests := []struct {
		name     string
		parts    []model.Part
		expected string
	}{
		{
			name:     "no parts",
			parts:    []model.Part{},
			expected: "",
		},
		{
			name: "tool-result with tool_call_id",
			parts: []model.Part{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"tool_call_id": "call_123",
					},
				},
			},
			expected: "call_123",
		},
		{
			name: "tool-result without meta",
			parts: []model.Part{
				{Type: "tool-result"},
			},
			expected: "",
		},
		{
			name: "non-tool-result part",
			parts: []model.Part{
				{Type: "text"},
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.extractToolCallID(tt.parts)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestOpenAIConverter_ExtractToolResultContent(t *testing.T) {
	converter := &OpenAIConverter{}

	tests := []struct {
		name     string
		parts    []model.Part
		expected string
	}{
		{
			name:     "no parts",
			parts:    []model.Part{},
			expected: "",
		},
		{
			name: "tool-result with text",
			parts: []model.Part{
				{
					Type: "tool-result",
					Text: "Result text",
				},
			},
			expected: "Result text",
		},
		{
			name: "tool-result with result in meta",
			parts: []model.Part{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"result": "Result from meta",
					},
				},
			},
			expected: "Result from meta",
		},
		{
			name: "tool-result with complex result",
			parts: []model.Part{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"result": map[string]interface{}{
							"status": "success",
							"data":   "complex data",
						},
					},
				},
			},
			expected: `{"data":"complex data","status":"success"}`,
		},
		{
			name: "text takes precedence over meta",
			parts: []model.Part{
				{
					Type: "tool-result",
					Text: "Text content",
					Meta: map[string]interface{}{
						"result": "Meta content",
					},
				},
			},
			expected: "Text content",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.extractToolResultContent(tt.parts)
			if tt.name == "tool-result with complex result" {
				// JSON might be in different order, so unmarshal and compare
				var expected, actual map[string]interface{}
				json.Unmarshal([]byte(tt.expected), &expected)
				json.Unmarshal([]byte(result), &actual)
				assert.Equal(t, expected, actual)
			} else {
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
