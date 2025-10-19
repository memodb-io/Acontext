package converter

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper functions shared across all tests

func createTestMessages() []model.Message {
	sessionID := uuid.New()

	return []model.Message{
		{
			ID:        uuid.New(),
			SessionID: sessionID,
			Role:      "user",
			Parts: []model.Part{
				{
					Type: "text",
					Text: "Hello, how are you?",
				},
			},
			CreatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			SessionID: sessionID,
			Role:      "assistant",
			Parts: []model.Part{
				{
					Type: "text",
					Text: "I'm doing well, thank you! How can I help you today?",
				},
			},
			CreatedAt: time.Now(),
		},
		{
			ID:        uuid.New(),
			SessionID: sessionID,
			Role:      "user",
			Parts: []model.Part{
				{
					Type: "text",
					Text: "Can you analyze this image?",
				},
				{
					Type: "image",
					Asset: &model.Asset{
						SHA256: "abc123",
						MIME:   "image/png",
					},
					Filename: "test.png",
				},
			},
			CreatedAt: time.Now(),
		},
	}
}

func createTestPublicURLs() map[string]service.PublicURL {
	return map[string]service.PublicURL{
		"abc123": {
			URL:      "https://example.com/test.png",
			ExpireAt: time.Now().Add(24 * time.Hour),
		},
	}
}

// Tests for core converter functionality

func TestValidateFormat(t *testing.T) {
	tests := []struct {
		name      string
		format    string
		wantErr   bool
		wantValue MessageFormat
	}{
		{
			name:      "acontext format",
			format:    "acontext",
			wantErr:   false,
			wantValue: FormatAcontext,
		},
		{
			name:      "openai format",
			format:    "openai",
			wantErr:   false,
			wantValue: FormatOpenAI,
		},
		{
			name:      "anthropic format",
			format:    "anthropic",
			wantErr:   false,
			wantValue: FormatAnthropic,
		},
		{
			name:    "invalid format",
			format:  "invalid",
			wantErr: true,
		},
		{
			name:    "empty format",
			format:  "",
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
				assert.Equal(t, tt.wantValue, got)
			}
		})
	}
}

func TestConvertMessages(t *testing.T) {
	messages := createTestMessages()
	publicURLs := createTestPublicURLs()

	tests := []struct {
		name   string
		format MessageFormat
	}{
		{
			name:   "no conversion",
			format: FormatAcontext,
		},
		{
			name:   "openai conversion",
			format: FormatOpenAI,
		},
		{
			name:   "anthropic conversion",
			format: FormatAnthropic,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertMessages(ConvertMessagesInput{
				Messages:   messages,
				Format:     tt.format,
				PublicURLs: publicURLs,
			})
			require.NoError(t, err)
			assert.NotNil(t, result)

			switch tt.format {
			case FormatAcontext:
				_, ok := result.([]model.Message)
				assert.True(t, ok)
			case FormatOpenAI:
				_, ok := result.([]OpenAIMessage)
				assert.True(t, ok)
			case FormatAnthropic:
				_, ok := result.([]AnthropicMessage)
				assert.True(t, ok)
			}
		})
	}
}

func TestConvertMessages_UnsupportedFormat(t *testing.T) {
	messages := createTestMessages()

	_, err := ConvertMessages(ConvertMessagesInput{
		Messages:   messages,
		Format:     MessageFormat("unsupported"),
		PublicURLs: nil,
	})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported format")
}

func TestGetConvertedMessagesOutput(t *testing.T) {
	messages := createTestMessages()
	publicURLs := createTestPublicURLs()

	result, err := GetConvertedMessagesOutput(
		messages,
		FormatOpenAI,
		publicURLs,
		"next_cursor_value",
		true,
	)
	require.NoError(t, err)

	assert.Contains(t, result, "items")
	assert.Contains(t, result, "has_more")
	assert.Contains(t, result, "next_cursor")
	assert.Equal(t, true, result["has_more"])
	assert.Equal(t, "next_cursor_value", result["next_cursor"])

	// Public URLs should not be included for non-None formats
	assert.NotContains(t, result, "public_urls")
}

func TestGetConvertedMessagesOutput_NoneFormat(t *testing.T) {
	messages := createTestMessages()
	publicURLs := createTestPublicURLs()

	result, err := GetConvertedMessagesOutput(
		messages,
		FormatAcontext,
		publicURLs,
		"",
		false,
	)
	require.NoError(t, err)

	assert.Contains(t, result, "items")
	assert.Contains(t, result, "has_more")
	assert.NotContains(t, result, "next_cursor")
	assert.Equal(t, false, result["has_more"])

	// Public URLs should be included for None format
	assert.Contains(t, result, "public_urls")
}
