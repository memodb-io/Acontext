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
		model.FormatGemini,
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
			name:    "valid gemini",
			format:  "gemini",
			want:    model.FormatGemini,
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

func TestGetConvertedMessagesOutput_EmptyMessages(t *testing.T) {
	// Test with empty message list
	messages := []model.Message{}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
	)

	require.NoError(t, err)

	// Verify empty ids slice
	ids, ok := result["ids"]
	require.True(t, ok, "ids field should exist even when empty")

	idsSlice, ok := ids.([]string)
	require.True(t, ok, "ids should be []string")
	assert.Equal(t, 0, len(idsSlice), "should have 0 message IDs")

	// Verify items exists (don't check type, just that it exists)
	_, hasItems := result["items"]
	assert.True(t, hasItems, "items field should exist")
}

func TestGetConvertedMessagesOutput_SingleMessage(t *testing.T) {
	// Test with single message
	msg := createTestMessage("user", []model.Part{
		{Type: "text", Text: "Single message"},
	}, nil)

	messages := []model.Message{msg}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatAnthropic,
		nil,
		"cursor-123",
		true,
	)

	require.NoError(t, err)

	// Verify single ID
	ids := result["ids"].([]string)
	assert.Equal(t, 1, len(ids))
	assert.Equal(t, msg.ID.String(), ids[0])

	// Verify pagination fields
	assert.Equal(t, "cursor-123", result["next_cursor"])
	assert.Equal(t, true, result["has_more"])

	// Verify items exists
	_, hasItems := result["items"]
	assert.True(t, hasItems, "items field should exist")
}

func TestGetConvertedMessagesOutput_IDOrderMatchesItemOrder(t *testing.T) {
	// Create messages in specific order
	messages := make([]model.Message, 5)
	expectedIDs := make([]string, 5)

	for i := range 5 {
		messages[i] = createTestMessage("user", []model.Part{
			{Type: "text", Text: "Message"},
		}, nil)
		expectedIDs[i] = messages[i].ID.String()
	}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
	)

	require.NoError(t, err)

	// Verify order is preserved
	actualIDs := result["ids"].([]string)
	assert.Equal(t, expectedIDs, actualIDs, "ID order must match message order")
}

func TestGetConvertedMessagesOutput_DifferentFormats(t *testing.T) {
	// Test that ids field is present regardless of format
	msg := createTestMessage("user", []model.Part{
		{Type: "text", Text: "Test"},
	}, nil)

	messages := []model.Message{msg}
	formats := []model.MessageFormat{
		model.FormatOpenAI,
		model.FormatAnthropic,
		model.FormatAcontext,
	}

	for _, format := range formats {
		result, err := GetConvertedMessagesOutput(
			messages,
			format,
			nil,
			"",
			false,
		)

		require.NoError(t, err, "format %s should not error", format)

		ids, ok := result["ids"]
		require.True(t, ok, "ids should exist for format %s", format)

		idsSlice := ids.([]string)
		assert.Equal(t, 1, len(idsSlice), "should have 1 ID for format %s", format)
		assert.Equal(t, msg.ID.String(), idsSlice[0], "ID should match for format %s", format)
	}
}

func TestGetConvertedMessagesOutput_WithPublicURLs(t *testing.T) {
	// Test that ids work alongside public_urls
	msg := createTestMessage("user", []model.Part{
		{Type: "text", Text: "Test"},
	}, nil)

	messages := []model.Message{msg}
	publicURLs := map[string]service.PublicURL{
		"hash1": {URL: "https://example.com/file1", ExpireAt: time.Now()},
	}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatAcontext,
		publicURLs,
		"",
		false,
	)

	require.NoError(t, err)

	// Verify both ids and public_urls exist
	_, hasIDs := result["ids"]
	assert.True(t, hasIDs, "ids should exist")

	_, hasURLs := result["public_urls"]
	assert.True(t, hasURLs, "public_urls should exist for Acontext format")
}
