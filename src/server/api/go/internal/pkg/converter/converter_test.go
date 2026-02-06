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
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Test"},
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
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Test"},
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
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Test message"},
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
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Test"},
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
		100, // thisTimeTokens
		"",  // editAtMessageID
	)

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotNil(t, result.Items)
	assert.Equal(t, true, result.HasMore)
	assert.Equal(t, "next_cursor_123", result.NextCursor)
	assert.Equal(t, 100, result.ThisTimeTokens)

	// Acontext format should include public_urls
	assert.NotNil(t, result.PublicURLs)
}

func TestGetConvertedMessagesOutput_NonAcontextFormat(t *testing.T) {
	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Test"},
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
		50, // thisTimeTokens
		"", // editAtMessageID
	)

	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotNil(t, result.Items)
	assert.Equal(t, false, result.HasMore)
	assert.Equal(t, 50, result.ThisTimeTokens)

	// Non-Acontext formats should NOT include public_urls
	assert.Nil(t, result.PublicURLs)
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
		0,  // thisTimeTokens
		"", // editAtMessageID
	)

	require.NoError(t, err)

	// Verify empty ids slice
	assert.NotNil(t, result.IDs, "ids field should exist even when empty")
	assert.Equal(t, 0, len(result.IDs), "should have 0 message IDs")

	// Verify items exists (don't check type, just that it exists)
	assert.NotNil(t, result.Items, "items field should exist")

	// Verify this_time_tokens is 0 for empty messages
	assert.Equal(t, 0, result.ThisTimeTokens)
}

func TestGetConvertedMessagesOutput_SingleMessage(t *testing.T) {
	// Test with single message
	msg := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Single message"},
	}, nil)

	messages := []model.Message{msg}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatAnthropic,
		nil,
		"cursor-123",
		true,
		25, // thisTimeTokens
		"", // editAtMessageID
	)

	require.NoError(t, err)

	// Verify single ID
	assert.Equal(t, 1, len(result.IDs))
	assert.Equal(t, msg.ID.String(), result.IDs[0])

	// Verify pagination fields
	assert.Equal(t, "cursor-123", result.NextCursor)
	assert.Equal(t, true, result.HasMore)
	assert.Equal(t, 25, result.ThisTimeTokens)

	// Verify items exists
	assert.NotNil(t, result.Items, "items field should exist")
}

func TestGetConvertedMessagesOutput_IDOrderMatchesItemOrder(t *testing.T) {
	// Create messages in specific order
	messages := make([]model.Message, 5)
	expectedIDs := make([]string, 5)

	for i := range 5 {
		messages[i] = createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Message"},
		}, nil)
		expectedIDs[i] = messages[i].ID.String()
	}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
		75, // thisTimeTokens
		"", // editAtMessageID
	)

	require.NoError(t, err)

	// Verify order is preserved
	assert.Equal(t, expectedIDs, result.IDs, "ID order must match message order")
}

func TestGetConvertedMessagesOutput_DifferentFormats(t *testing.T) {
	// Test that ids field is present regardless of format
	msg := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Test"},
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
			30, // thisTimeTokens
			"", // editAtMessageID
		)

		require.NoError(t, err, "format %s should not error", format)

		assert.NotNil(t, result.IDs, "ids should exist for format %s", format)
		assert.Equal(t, 1, len(result.IDs), "should have 1 ID for format %s", format)
		assert.Equal(t, msg.ID.String(), result.IDs[0], "ID should match for format %s", format)
		assert.Equal(t, 30, result.ThisTimeTokens, "this_time_tokens should be present for format %s", format)
	}
}

func TestGetConvertedMessagesOutput_WithPublicURLs(t *testing.T) {
	// Test that ids work alongside public_urls
	msg := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Test"},
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
		42, // thisTimeTokens
		"", // editAtMessageID
	)

	require.NoError(t, err)

	// Verify both ids and public_urls exist
	assert.NotNil(t, result.IDs, "ids should exist")
	assert.NotNil(t, result.PublicURLs, "public_urls should exist for Acontext format")
	assert.Equal(t, 42, result.ThisTimeTokens)
}

// ============================================
// ExtractUserMeta Tests
// ============================================

func TestExtractUserMeta_WithUserMeta(t *testing.T) {
	meta := map[string]interface{}{
		model.MsgMetaSourceFormat: "openai",
		model.UserMetaKey: map[string]interface{}{
			"key":    "value",
			"source": "web",
		},
	}

	result := ExtractUserMeta(meta)

	assert.Equal(t, map[string]interface{}{
		"key":    "value",
		"source": "web",
	}, result)
}

func TestExtractUserMeta_WithoutUserMeta(t *testing.T) {
	meta := map[string]interface{}{
		model.MsgMetaSourceFormat: "openai",
	}

	result := ExtractUserMeta(meta)

	// Should return empty map, not nil
	assert.NotNil(t, result)
	assert.Equal(t, map[string]interface{}{}, result)
}

func TestExtractUserMeta_NilMeta(t *testing.T) {
	result := ExtractUserMeta(nil)

	// Should return empty map, not nil
	assert.NotNil(t, result)
	assert.Equal(t, map[string]interface{}{}, result)
}

func TestExtractUserMeta_EmptyMeta(t *testing.T) {
	meta := map[string]interface{}{}

	result := ExtractUserMeta(meta)

	assert.NotNil(t, result)
	assert.Equal(t, map[string]interface{}{}, result)
}

func TestExtractUserMeta_WrongTypeUserMeta(t *testing.T) {
	// If __user_meta__ is not a map, should return empty
	meta := map[string]interface{}{
		model.UserMetaKey: "not a map",
	}

	result := ExtractUserMeta(meta)

	assert.NotNil(t, result)
	assert.Equal(t, map[string]interface{}{}, result)
}

// ============================================
// Metas in GetConvertedMessagesOutput Tests
// ============================================

func TestGetConvertedMessagesOutput_ExtractsMetasCorrectly(t *testing.T) {
	// Create messages with user meta
	msg1 := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Hello"},
	}, map[string]any{
		model.MsgMetaSourceFormat: "openai",
		model.UserMetaKey: map[string]interface{}{
			"source":     "web",
			"request_id": "abc123",
		},
	})

	msg2 := createTestMessage(model.RoleAssistant, []model.Part{
		{Type: model.PartTypeText, Text: "Hi there"},
	}, map[string]any{
		model.MsgMetaSourceFormat: "openai",
		model.UserMetaKey: map[string]interface{}{
			"model": "gpt-4",
		},
	})

	messages := []model.Message{msg1, msg2}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
		50,
		"",
	)

	require.NoError(t, err)

	// Verify metas array exists and has correct length
	assert.NotNil(t, result.Metas)
	assert.Equal(t, 2, len(result.Metas))

	// Verify metas contain only user meta (not system fields)
	assert.Equal(t, map[string]interface{}{
		"source":     "web",
		"request_id": "abc123",
	}, result.Metas[0])
	assert.Equal(t, map[string]interface{}{
		"model": "gpt-4",
	}, result.Metas[1])
}

func TestGetConvertedMessagesOutput_MetasOrderMatchesIDs(t *testing.T) {
	// Create 3 messages with different metas
	messages := make([]model.Message, 3)
	for i := range 3 {
		messages[i] = createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Message"},
		}, map[string]any{
			model.UserMetaKey: map[string]interface{}{
				"index": i,
			},
		})
	}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
		30,
		"",
	)

	require.NoError(t, err)

	// Verify order matches
	assert.Equal(t, 3, len(result.Metas))
	assert.Equal(t, 3, len(result.IDs))
	for i := range 3 {
		assert.Equal(t, messages[i].ID.String(), result.IDs[i])
		assert.Equal(t, i, result.Metas[i]["index"])
	}
}

func TestGetConvertedMessagesOutput_EmptyUserMeta(t *testing.T) {
	// Message without __user_meta__ field
	msg := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Hello"},
	}, map[string]any{
		model.MsgMetaSourceFormat: "openai",
		// No __user_meta__ field
	})

	messages := []model.Message{msg}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
		10,
		"",
	)

	require.NoError(t, err)

	// Should return empty map, not nil
	assert.NotNil(t, result.Metas)
	assert.Equal(t, 1, len(result.Metas))
	assert.Equal(t, map[string]interface{}{}, result.Metas[0])
}

func TestGetConvertedMessagesOutput_MixedMetas(t *testing.T) {
	// Mix of messages with and without user meta
	msg1 := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Hello"},
	}, map[string]any{
		model.UserMetaKey: map[string]interface{}{
			"has_meta": true,
		},
	})

	msg2 := createTestMessage(model.RoleAssistant, []model.Part{
		{Type: model.PartTypeText, Text: "Hi"},
	}, nil) // No meta at all

	msg3 := createTestMessage(model.RoleUser, []model.Part{
		{Type: model.PartTypeText, Text: "Bye"},
	}, map[string]any{
		model.MsgMetaSourceFormat: "openai",
		// No __user_meta__
	})

	messages := []model.Message{msg1, msg2, msg3}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
		20,
		"",
	)

	require.NoError(t, err)

	assert.Equal(t, 3, len(result.Metas))
	assert.Equal(t, map[string]interface{}{"has_meta": true}, result.Metas[0])
	assert.Equal(t, map[string]interface{}{}, result.Metas[1])
	assert.Equal(t, map[string]interface{}{}, result.Metas[2])
}

func TestGetConvertedMessagesOutput_EmptyMessages_HasEmptyMetas(t *testing.T) {
	messages := []model.Message{}

	result, err := GetConvertedMessagesOutput(
		messages,
		model.FormatOpenAI,
		nil,
		"",
		false,
		0,
		"",
	)

	require.NoError(t, err)

	// Verify metas is empty slice, not nil
	assert.NotNil(t, result.Metas)
	assert.Equal(t, 0, len(result.Metas))
}
