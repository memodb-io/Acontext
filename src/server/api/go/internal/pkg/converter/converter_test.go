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
