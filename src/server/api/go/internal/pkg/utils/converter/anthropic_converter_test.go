package converter

import (
	"testing"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAnthropicConverter_SimpleText(t *testing.T) {
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

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	require.Len(t, anthropicMsgs, 1)

	assert.Equal(t, "user", anthropicMsgs[0].Role)
	assert.Equal(t, "Hello", anthropicMsgs[0].Content)
}

func TestAnthropicConverter_MultiplePartsWithImage(t *testing.T) {
	messages := createTestMessages()
	publicURLs := createTestPublicURLs()

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	require.Len(t, anthropicMsgs, 3)

	// Check third message with image
	assert.Equal(t, "user", anthropicMsgs[2].Role)
	contentBlocks, ok := anthropicMsgs[2].Content.([]AnthropicContentBlock)
	require.True(t, ok)
	require.Len(t, contentBlocks, 2)

	assert.Equal(t, "text", contentBlocks[0].Type)
	assert.Equal(t, "Can you analyze this image?", contentBlocks[0].Text)

	assert.Equal(t, "image", contentBlocks[1].Type)
	require.NotNil(t, contentBlocks[1].Source)
	// Image URL will be used if base64 encoding fails
	assert.NotEmpty(t, contentBlocks[1].Source.URL)
}

func TestAnthropicConverter_ToolUse(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "assistant",
			Parts: []model.Part{
				{
					Type: "tool-call",
					Meta: map[string]interface{}{
						"id":        "toolu_123",
						"tool_name": "get_weather",
						"arguments": map[string]interface{}{
							"location": "San Francisco",
						},
					},
				},
			},
		},
	}

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	require.Len(t, anthropicMsgs, 1)

	assert.Equal(t, "assistant", anthropicMsgs[0].Role)
	contentBlocks, ok := anthropicMsgs[0].Content.([]AnthropicContentBlock)
	require.True(t, ok)
	require.Len(t, contentBlocks, 1)

	toolUseBlock := contentBlocks[0]
	assert.Equal(t, "tool_use", toolUseBlock.Type)
	assert.Equal(t, "toolu_123", toolUseBlock.ID)
	assert.Equal(t, "get_weather", toolUseBlock.Name)
	assert.Equal(t, "San Francisco", toolUseBlock.Input["location"])
}

func TestAnthropicConverter_ToolResult(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "user",
			Parts: []model.Part{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"tool_call_id": "toolu_123",
						"result":       "The weather in San Francisco is sunny, 72°F",
					},
				},
			},
		},
	}

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	require.Len(t, anthropicMsgs, 1)

	assert.Equal(t, "user", anthropicMsgs[0].Role)
	contentBlocks, ok := anthropicMsgs[0].Content.([]AnthropicContentBlock)
	require.True(t, ok)
	require.Len(t, contentBlocks, 1)

	toolResultBlock := contentBlocks[0]
	assert.Equal(t, "tool_result", toolResultBlock.Type)
	assert.Equal(t, "toolu_123", toolResultBlock.ToolUseID)
	assert.Equal(t, "The weather in San Francisco is sunny, 72°F", toolResultBlock.Content)
}

func TestAnthropicConverter_SystemMessage(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "system",
			Parts: []model.Part{
				{
					Type: "text",
					Text: "You are a helpful assistant",
				},
			},
		},
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

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	// System messages should be filtered out
	require.Len(t, anthropicMsgs, 1)
	assert.Equal(t, "user", anthropicMsgs[0].Role)
}

func TestAnthropicConverter_RoleConversion(t *testing.T) {
	tests := []struct {
		name     string
		role     string
		expected string
	}{
		{"user role", "user", "user"},
		{"assistant role", "assistant", "assistant"},
		{"system role", "system", "user"},
		{"tool role", "tool", "user"},
		{"function role", "function", "user"},
		{"unknown role", "unknown", "user"},
	}

	converter := &AnthropicConverter{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := converter.convertRole(tt.role)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestAnthropicConverter_ErrorToolResult(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "user",
			Parts: []model.Part{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"tool_call_id": "toolu_123",
						"result":       "Error: API timeout",
						"is_error":     true,
					},
				},
			},
		},
	}

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	require.Len(t, anthropicMsgs, 1)

	contentBlocks, ok := anthropicMsgs[0].Content.([]AnthropicContentBlock)
	require.True(t, ok)
	require.Len(t, contentBlocks, 1)

	toolResultBlock := contentBlocks[0]
	assert.Equal(t, "tool_result", toolResultBlock.Type)
	assert.True(t, toolResultBlock.IsError)
}

func TestAnthropicConverter_MediaFiles(t *testing.T) {
	messages := []model.Message{
		{
			ID:        uuid.New(),
			SessionID: uuid.New(),
			Role:      "user",
			Parts: []model.Part{
				{
					Type: "audio",
					Text: "Audio transcript here",
					Asset: &model.Asset{
						SHA256: "audio123",
						MIME:   "audio/mp3",
					},
				},
			},
		},
	}

	publicURLs := map[string]service.PublicURL{
		"audio123": {
			URL: "https://example.com/audio.mp3",
		},
	}

	converter := &AnthropicConverter{}
	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)

	anthropicMsgs, ok := result.([]AnthropicMessage)
	require.True(t, ok)
	require.Len(t, anthropicMsgs, 1)

	// Audio files should be converted to text with URL reference
	// Could be either string or content blocks
	content := anthropicMsgs[0].Content
	switch v := content.(type) {
	case string:
		assert.Contains(t, v, "https://example.com/audio.mp3")
	case []AnthropicContentBlock:
		require.Len(t, v, 1)
		assert.Equal(t, "text", v[0].Type)
		assert.Contains(t, v[0].Text, "https://example.com/audio.mp3")
	default:
		t.Fatalf("unexpected content type: %T", content)
	}
}

func TestAnthropicConverter_MergeAdjacentSameRole(t *testing.T) {
	converter := &AnthropicConverter{}

	tests := []struct {
		name           string
		messages       []model.Message
		expectedLength int
		description    string
	}{
		{
			name: "merge two adjacent user messages",
			messages: []model.Message{
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "First user message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "Second user message"},
					},
				},
			},
			expectedLength: 1,
			description:    "Two adjacent user messages should be merged into one",
		},
		{
			name: "merge three adjacent assistant messages",
			messages: []model.Message{
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "assistant",
					Parts: []model.Part{
						{Type: "text", Text: "First assistant message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "assistant",
					Parts: []model.Part{
						{Type: "text", Text: "Second assistant message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "assistant",
					Parts: []model.Part{
						{Type: "text", Text: "Third assistant message"},
					},
				},
			},
			expectedLength: 1,
			description:    "Three adjacent assistant messages should be merged into one",
		},
		{
			name: "no merge needed for alternating roles",
			messages: []model.Message{
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "User message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "assistant",
					Parts: []model.Part{
						{Type: "text", Text: "Assistant message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "Another user message"},
					},
				},
			},
			expectedLength: 3,
			description:    "Alternating roles should not be merged",
		},
		{
			name: "merge adjacent user messages but not assistant",
			messages: []model.Message{
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "First user message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "Second user message"},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "assistant",
					Parts: []model.Part{
						{Type: "text", Text: "Assistant message"},
					},
				},
			},
			expectedLength: 2,
			description:    "Adjacent user messages should merge, assistant separate",
		},
		{
			name: "merge with tool calls and results",
			messages: []model.Message{
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "assistant",
					Parts: []model.Part{
						{
							Type: "tool-call",
							Meta: map[string]interface{}{
								"id":        "call_1",
								"tool_name": "get_weather",
								"arguments": map[string]interface{}{"city": "SF"},
							},
						},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{
							Type: "tool-result",
							Meta: map[string]interface{}{
								"tool_call_id": "call_1",
								"result":       "Sunny",
							},
						},
					},
				},
				{
					ID:        uuid.New(),
					SessionID: uuid.New(),
					Role:      "user",
					Parts: []model.Part{
						{Type: "text", Text: "Thanks!"},
					},
				},
			},
			expectedLength: 2,
			description:    "Adjacent user messages (tool result + text) should merge",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := converter.Convert(tt.messages, nil)
			require.NoError(t, err)

			anthropicMsgs, ok := result.([]AnthropicMessage)
			require.True(t, ok)
			assert.Len(t, anthropicMsgs, tt.expectedLength, tt.description)

			// Verify that merged messages contain all content blocks
			if tt.expectedLength < len(tt.messages) {
				// At least one merge happened, check that content is preserved
				for _, msg := range anthropicMsgs {
					assert.NotNil(t, msg.Content, "Merged message should have content")
				}
			}
		})
	}
}

func TestAnthropicConverter_MergeContent(t *testing.T) {
	converter := &AnthropicConverter{}

	tests := []struct {
		name     string
		content1 interface{}
		content2 interface{}
		expected int // expected number of content blocks
	}{
		{
			name:     "merge two strings",
			content1: "First message",
			content2: "Second message",
			expected: 2,
		},
		{
			name:     "merge string and content blocks",
			content1: "Text message",
			content2: []AnthropicContentBlock{
				{Type: "text", Text: "Block message"},
			},
			expected: 2,
		},
		{
			name: "merge two content block arrays",
			content1: []AnthropicContentBlock{
				{Type: "text", Text: "First block"},
			},
			content2: []AnthropicContentBlock{
				{Type: "text", Text: "Second block"},
			},
			expected: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			merged := converter.mergeContent(tt.content1, tt.content2)

			blocks, ok := merged.([]AnthropicContentBlock)
			require.True(t, ok, "Merged content should be content blocks")
			assert.Len(t, blocks, tt.expected)
		})
	}
}

func TestAnthropicConverter_ToContentBlocks(t *testing.T) {
	converter := &AnthropicConverter{}

	tests := []struct {
		name     string
		content  interface{}
		expected int
	}{
		{
			name:     "nil content",
			content:  nil,
			expected: 0,
		},
		{
			name:     "string content",
			content:  "Hello, world!",
			expected: 1,
		},
		{
			name: "content blocks",
			content: []AnthropicContentBlock{
				{Type: "text", Text: "First"},
				{Type: "text", Text: "Second"},
			},
			expected: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			blocks := converter.toContentBlocks(tt.content)
			assert.Len(t, blocks, tt.expected)
		})
	}
}
