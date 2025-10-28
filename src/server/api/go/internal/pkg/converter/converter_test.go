package converter

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/datatypes"
)

// Helper function to create test messages
func createTestMessage(role string, parts []model.Part, meta map[string]any) model.Message {
	msg := model.Message{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		Role:      role,
		Parts:     parts,
		CreatedAt: time.Now(),
	}

	if meta != nil {
		msg.Meta = datatypes.NewJSONType(meta)
	} else {
		msg.Meta = datatypes.NewJSONType(map[string]any{})
	}

	return msg
}

func TestAcontextConverter_Convert_TextMessage(t *testing.T) {
	converter := &AcontextConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Hello, world!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	acontextMessages, ok := result.([]AcontextMessage)
	require.True(t, ok)
	require.Len(t, acontextMessages, 1)

	msg := acontextMessages[0]
	assert.Equal(t, "user", msg.Role)
	assert.Len(t, msg.Parts, 1)
	assert.Equal(t, "text", msg.Parts[0].Type)
	assert.Equal(t, "Hello, world!", msg.Parts[0].Text)
}

func TestAcontextConverter_Convert_WithAsset(t *testing.T) {
	converter := &AcontextConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{
				Type:     "image",
				Filename: "test.jpg",
				Asset: &model.Asset{
					S3Key: "assets/test.jpg",
					MIME:  "image/jpeg",
					SizeB: 1024,
				},
			},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"assets/test.jpg": {URL: "https://example.com/test.jpg"},
	}

	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	msg := acontextMessages[0]

	assert.Len(t, msg.Parts, 1)
	part := msg.Parts[0]
	assert.Equal(t, "image", part.Type)
	assert.NotNil(t, part.Asset)
	assert.Equal(t, "assets/test.jpg", part.Asset.S3Key)
	assert.Equal(t, "test.jpg", part.Asset.Filename)
	assert.Equal(t, "image/jpeg", part.Asset.ContentType)
	assert.Equal(t, int64(1024), part.Asset.Size)

	// Check public URL in meta
	assert.NotNil(t, part.Meta)
	assert.Equal(t, "https://example.com/test.jpg", part.Meta["public_url"])
}

func TestAcontextConverter_Convert_WithCacheControl(t *testing.T) {
	converter := &AcontextConverter{}

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

	acontextMessages := result.([]AcontextMessage)
	msg := acontextMessages[0]

	assert.Len(t, msg.Parts, 1)
	part := msg.Parts[0]
	assert.NotNil(t, part.Meta)
	assert.NotNil(t, part.Meta["cache_control"])

	cacheControl := part.Meta["cache_control"].(map[string]any)
	assert.Equal(t, "ephemeral", cacheControl["type"])
}

func TestAcontextConverter_Convert_MessageMeta(t *testing.T) {
	converter := &AcontextConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test"},
		}, map[string]any{
			"custom_field": "custom_value",
		}),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	msg := acontextMessages[0]

	assert.NotNil(t, msg.Meta)
	assert.Equal(t, "custom_value", msg.Meta["custom_field"])
}

func TestAcontextConverter_Convert_MultipleParts(t *testing.T) {
	converter := &AcontextConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "First part"},
			{Type: "text", Text: "Second part"},
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

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	msg := acontextMessages[0]

	assert.Len(t, msg.Parts, 3)
	assert.Equal(t, "text", msg.Parts[0].Type)
	assert.Equal(t, "First part", msg.Parts[0].Text)
	assert.Equal(t, "text", msg.Parts[1].Type)
	assert.Equal(t, "Second part", msg.Parts[1].Text)
	assert.Equal(t, "image", msg.Parts[2].Type)
	assert.NotNil(t, msg.Parts[2].Asset)
}

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

func TestConvertMessages_InvalidFormat(t *testing.T) {
	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test"},
		}, nil),
	}

	_, err := ConvertMessages(ConvertMessagesInput{
		Messages:   messages,
		Format:     "invalid_format",
		PublicURLs: nil,
	})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported format")
}

func TestConvertMessages_DefaultFormat(t *testing.T) {
	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test"},
		}, nil),
	}

	// Empty format should default to Acontext
	result, err := ConvertMessages(ConvertMessagesInput{
		Messages:   messages,
		Format:     "",
		PublicURLs: nil,
	})

	require.NoError(t, err)
	_, ok := result.([]AcontextMessage)
	assert.True(t, ok, "Default format should be Acontext")
}

func TestConvertMessages_AllFormats(t *testing.T) {
	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test message"},
		}, nil),
	}

	formats := []model.MessageFormat{
		model.FormatAcontext,
		model.FormatOpenAI,
		model.FormatAnthropic,
	}

	for _, format := range formats {
		t.Run(string(format), func(t *testing.T) {
			result, err := ConvertMessages(ConvertMessagesInput{
				Messages:   messages,
				Format:     format,
				PublicURLs: nil,
			})

			require.NoError(t, err)
			assert.NotNil(t, result)
		})
	}
}

func TestValidateFormat(t *testing.T) {
	tests := []struct {
		name    string
		format  string
		want    model.MessageFormat
		wantErr bool
	}{
		{
			name:    "valid acontext",
			format:  "acontext",
			want:    model.FormatAcontext,
			wantErr: false,
		},
		{
			name:    "valid openai",
			format:  "openai",
			want:    model.FormatOpenAI,
			wantErr: false,
		},
		{
			name:    "valid anthropic",
			format:  "anthropic",
			want:    model.FormatAnthropic,
			wantErr: false,
		},
		{
			name:    "invalid format",
			format:  "invalid",
			want:    "",
			wantErr: true,
		},
		{
			name:    "empty format",
			format:  "",
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateFormat(tt.format)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.want, got)
			}
		})
	}
}

func TestGetConvertedMessagesOutput(t *testing.T) {
	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test"},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"test_key": {URL: "https://example.com/test"},
	}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatAcontext,
		publicURLs,
		"next_cursor_123",
		true,
	)

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotNil(t, result["items"])
	assert.Equal(t, true, result["has_more"])
	assert.Equal(t, "next_cursor_123", result["next_cursor"])

	// Acontext format should include public_urls
	assert.NotNil(t, result["public_urls"])
}

func TestGetConvertedMessagesOutput_NonAcontextFormat(t *testing.T) {
	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test"},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"test_key": {URL: "https://example.com/test"},
	}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		publicURLs,
		"",
		false,
	)

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotNil(t, result["items"])
	assert.Equal(t, false, result["has_more"])

	// Non-Acontext formats should NOT include public_urls
	assert.Nil(t, result["public_urls"])
}

func TestAcontextConverter_Convert_EmptyMeta(t *testing.T) {
	converter := &AcontextConverter{}

	// Test with nil meta
	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Test", Meta: nil},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	msg := acontextMessages[0]
	part := msg.Parts[0]

	// Meta should be nil or empty
	if part.Meta != nil {
		assert.Empty(t, part.Meta)
	}
}

func TestAcontextConverter_Convert_MultipleMessages(t *testing.T) {
	converter := &AcontextConverter{}

	messages := []model.Message{
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "First message"},
		}, nil),
		createTestMessage("assistant", []model.Part{
			{Type: "text", Text: "Second message"},
		}, nil),
		createTestMessage("user", []model.Part{
			{Type: "text", Text: "Third message"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	assert.Len(t, acontextMessages, 3)
	assert.Equal(t, "user", acontextMessages[0].Role)
	assert.Equal(t, "assistant", acontextMessages[1].Role)
	assert.Equal(t, "user", acontextMessages[2].Role)
}

func TestAcontextConverter_Convert_Timestamps(t *testing.T) {
	converter := &AcontextConverter{}

	// Create a message with specific timestamps
	now := time.Now()
	msg := model.Message{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		Role:      "user",
		Parts: []model.Part{
			{Type: "text", Text: "Test message"},
		},
		CreatedAt: now,
		UpdatedAt: now.Add(5 * time.Minute), // Updated 5 minutes later
	}
	msg.Meta = datatypes.NewJSONType(map[string]any{})

	messages := []model.Message{msg}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	assert.Len(t, acontextMessages, 1)

	converted := acontextMessages[0]

	// Verify timestamps are converted to ISO 8601 strings
	expectedCreatedAt := now.Format("2006-01-02T15:04:05.999999Z07:00")
	expectedUpdatedAt := now.Add(5 * time.Minute).Format("2006-01-02T15:04:05.999999Z07:00")

	assert.Equal(t, expectedCreatedAt, converted.CreatedAt)
	assert.Equal(t, expectedUpdatedAt, converted.UpdatedAt)

	// Verify timestamps can be parsed back
	parsedCreatedAt, err := time.Parse(time.RFC3339Nano, converted.CreatedAt)
	require.NoError(t, err)
	parsedUpdatedAt, err := time.Parse(time.RFC3339Nano, converted.UpdatedAt)
	require.NoError(t, err)

	// Verify UpdatedAt is after CreatedAt
	assert.True(t, parsedUpdatedAt.After(parsedCreatedAt))
}

func TestAcontextConverter_Convert_ParentID(t *testing.T) {
	converter := &AcontextConverter{}

	parentID := uuid.New()
	msg := model.Message{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		ParentID:  &parentID,
		Role:      "user",
		Parts: []model.Part{
			{Type: "text", Text: "Reply message"},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	msg.Meta = datatypes.NewJSONType(map[string]any{})

	result, err := converter.Convert([]model.Message{msg}, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	assert.Len(t, acontextMessages, 1)

	converted := acontextMessages[0]

	// Verify ParentID is converted
	require.NotNil(t, converted.ParentID)
	assert.Equal(t, parentID.String(), *converted.ParentID)
}

func TestAcontextConverter_Convert_NoParentID(t *testing.T) {
	converter := &AcontextConverter{}

	msg := model.Message{
		ID:        uuid.New(),
		SessionID: uuid.New(),
		ParentID:  nil, // No parent
		Role:      "user",
		Parts: []model.Part{
			{Type: "text", Text: "Root message"},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	msg.Meta = datatypes.NewJSONType(map[string]any{})

	result, err := converter.Convert([]model.Message{msg}, nil)
	require.NoError(t, err)

	acontextMessages := result.([]AcontextMessage)
	assert.Len(t, acontextMessages, 1)

	converted := acontextMessages[0]

	// Verify ParentID is nil
	assert.Nil(t, converted.ParentID)
}

func TestAcontextConverter_Convert_SessionTaskProcessStatus(t *testing.T) {
	converter := &AcontextConverter{}

	testCases := []struct {
		name   string
		status string
	}{
		{"pending status", "pending"},
		{"running status", "running"},
		{"success status", "success"},
		{"failed status", "failed"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			msg := model.Message{
				ID:                       uuid.New(),
				SessionID:                uuid.New(),
				Role:                     "user",
				SessionTaskProcessStatus: tc.status,
				Parts: []model.Part{
					{Type: "text", Text: "Test message"},
				},
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}
			msg.Meta = datatypes.NewJSONType(map[string]any{})

			result, err := converter.Convert([]model.Message{msg}, nil)
			require.NoError(t, err)

			acontextMessages := result.([]AcontextMessage)
			assert.Len(t, acontextMessages, 1)

			converted := acontextMessages[0]
			assert.Equal(t, tc.status, converted.SessionTaskProcessStatus)
		})
	}
}
