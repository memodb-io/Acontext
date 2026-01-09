package converter

import (
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// ConvertMessagesInput represents the input for converting messages
type ConvertMessagesInput struct {
	Messages   []model.Message
	Format     model.MessageFormat
	PublicURLs map[string]service.PublicURL
}

// MessageConverter interface for extensible message conversion
type MessageConverter interface {
	Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error)
}

// ConvertMessages converts messages to the specified format
func ConvertMessages(input ConvertMessagesInput) (interface{}, error) {
	var converter MessageConverter

	// Default to Acontext format if not specified
	format := input.Format
	if format == "" {
		format = model.FormatAcontext
	}

	switch format {
	case model.FormatAcontext:
		converter = &AcontextConverter{}
	case model.FormatOpenAI:
		converter = &OpenAIConverter{}
	case model.FormatAnthropic:
		converter = &AnthropicConverter{}
	case model.FormatGemini:
		converter = &GeminiConverter{}
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}

	return converter.Convert(input.Messages, input.PublicURLs)
}

// ValidateFormat checks if the format is valid
func ValidateFormat(format string) (model.MessageFormat, error) {
	mf := model.MessageFormat(format)
	switch mf {
	case model.FormatAcontext, model.FormatOpenAI, model.FormatAnthropic, model.FormatGemini:
		return mf, nil
	default:
		return "", fmt.Errorf("invalid format: %s, supported formats: acontext, openai, anthropic, gemini", format)
	}
}

// GetConvertedMessagesOutput wraps the converted messages with metadata
func GetConvertedMessagesOutput(
	messages []model.Message,
	format model.MessageFormat,
	publicURLs map[string]service.PublicURL,
	nextCursor string,
	hasMore bool,
	thisTimeTokens int,
	editAtMessageID string,
) (map[string]interface{}, error) {
	convertedData, err := ConvertMessages(ConvertMessagesInput{
		Messages:   messages,
		Format:     format,
		PublicURLs: publicURLs,
	})
	if err != nil {
		return nil, err
	}

	// Extracting message IDs
	messageIDs := make([]string, len(messages))
	for i := range len(messages) {
		messageIDs[i] = messages[i].ID.String()
	}

	result := map[string]interface{}{
		"items":            convertedData,
		"ids":              messageIDs,
		"has_more":         hasMore,
		"this_time_tokens": thisTimeTokens,
	}

	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	// Include edit_at_message_id if provided
	if editAtMessageID != "" {
		result["edit_at_message_id"] = editAtMessageID
	}

	// Include public_urls only if format is None (original format)
	if format == model.FormatAcontext && len(publicURLs) > 0 {
		result["public_urls"] = publicURLs
	}

	return result, nil
}
