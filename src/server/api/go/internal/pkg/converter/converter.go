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

// ExtractUserMeta extracts user-provided metadata from the message meta.
// User meta is stored in the __user_meta__ field to isolate it from system fields.
// Returns an empty map if no user meta exists.
func ExtractUserMeta(meta map[string]interface{}) map[string]interface{} {
	if meta == nil {
		return map[string]interface{}{}
	}
	if userMeta, ok := meta[model.UserMetaKey].(map[string]interface{}); ok {
		return userMeta
	}
	return map[string]interface{}{}
}

// GetMessagesOutput represents the response for GetMessages endpoint
// The Items field contains messages in the requested format (openai, anthropic, gemini, or acontext)
type GetMessagesOutput struct {
	Items           interface{}                  `json:"items"`                        // Messages in the requested format
	IDs             []string                     `json:"ids"`                          // Message IDs corresponding to items
	Metas           []map[string]interface{}     `json:"metas"`                        // User-provided metadata for each message (same order as items/ids)
	Events          []model.SessionEvent         `json:"events,omitempty"`             // Session events within the messages time window
	NextCursor      string                       `json:"next_cursor,omitempty"`        // Cursor for pagination
	HasMore         bool                         `json:"has_more"`                     // Whether there are more messages
	ThisTimeTokens  int                          `json:"this_time_tokens"`             // Token count for returned messages
	EditAtMessageID string                       `json:"edit_at_message_id,omitempty"` // Message ID where edit strategies were applied
	PublicURLs      map[string]service.PublicURL `json:"public_urls,omitempty"`        // Asset public URLs (only for acontext format)
}

// GetConvertedMessagesOutput wraps the converted messages with metadata
func GetConvertedMessagesOutput(
	messages []model.Message,
	format model.MessageFormat,
	publicURLs map[string]service.PublicURL,
	events []model.SessionEvent,
	nextCursor string,
	hasMore bool,
	thisTimeTokens int,
	editAtMessageID string,
) (*GetMessagesOutput, error) {
	convertedData, err := ConvertMessages(ConvertMessagesInput{
		Messages:   messages,
		Format:     format,
		PublicURLs: publicURLs,
	})
	if err != nil {
		return nil, err
	}

	// Extracting message IDs and user metas
	messageIDs := make([]string, len(messages))
	metas := make([]map[string]interface{}, len(messages))
	for i := range len(messages) {
		messageIDs[i] = messages[i].ID.String()
		// Extract user meta from __user_meta__ field
		metas[i] = ExtractUserMeta(messages[i].Meta.Data())
	}

	result := &GetMessagesOutput{
		Items:          convertedData,
		IDs:            messageIDs,
		Metas:          metas,
		Events:         events,
		HasMore:        hasMore,
		ThisTimeTokens: thisTimeTokens,
	}

	if nextCursor != "" {
		result.NextCursor = nextCursor
	}

	// Include edit_at_message_id if provided
	if editAtMessageID != "" {
		result.EditAtMessageID = editAtMessageID
	}

	// Include public_urls only if format is acontext (original format)
	if format == model.FormatAcontext && len(publicURLs) > 0 {
		result.PublicURLs = publicURLs
	}

	return result, nil
}
