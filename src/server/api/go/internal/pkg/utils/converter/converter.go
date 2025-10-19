package converter

import (
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// MessageFormat represents the format to convert messages to
type MessageFormat string

const (
	FormatAcontext  MessageFormat = "acontext"
	FormatOpenAI    MessageFormat = "openai"
	FormatAnthropic MessageFormat = "anthropic"
)

// ConvertMessagesInput represents the input for converting messages
type ConvertMessagesInput struct {
	Messages   []model.Message
	Format     MessageFormat
	PublicURLs map[string]service.PublicURL
}

// MessageConverter interface for extensible message conversion
type MessageConverter interface {
	Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error)
}

// ConvertMessages converts messages to the specified format
func ConvertMessages(input ConvertMessagesInput) (interface{}, error) {
	if input.Format == FormatAcontext || input.Format == "" {
		return input.Messages, nil
	}

	var converter MessageConverter
	switch input.Format {
	case FormatOpenAI:
		converter = &OpenAIConverter{}
	case FormatAnthropic:
		converter = &AnthropicConverter{}
	default:
		return nil, fmt.Errorf("unsupported format: %s", input.Format)
	}

	return converter.Convert(input.Messages, input.PublicURLs)
}

// ValidateFormat checks if the format is valid
func ValidateFormat(format string) (MessageFormat, error) {
	mf := MessageFormat(format)
	switch mf {
	case FormatAcontext, FormatOpenAI, FormatAnthropic:
		return mf, nil
	default:
		return "", fmt.Errorf("invalid format: %s, supported formats: acontext, openai, anthropic", format)
	}
}

// GetConvertedMessagesOutput wraps the converted messages with metadata
func GetConvertedMessagesOutput(
	messages []model.Message,
	format MessageFormat,
	publicURLs map[string]service.PublicURL,
	nextCursor string,
	hasMore bool,
) (map[string]interface{}, error) {
	convertedData, err := ConvertMessages(ConvertMessagesInput{
		Messages:   messages,
		Format:     format,
		PublicURLs: publicURLs,
	})
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"items":    convertedData,
		"has_more": hasMore,
	}

	if nextCursor != "" {
		result["next_cursor"] = nextCursor
	}

	// Include public_urls only if format is None (original format)
	if format == FormatAcontext && len(publicURLs) > 0 {
		result["public_urls"] = publicURLs
	}

	return result, nil
}
