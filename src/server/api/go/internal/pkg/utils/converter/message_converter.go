package converter

import (
	"fmt"

	"github.com/bytedance/sonic"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/tmc/langchaingo/llms"
)

// MessageFormat represents the format to convert messages to
type MessageFormat string

const (
	FormatNone      MessageFormat = ""
	FormatOpenAI    MessageFormat = "openai"
	FormatLangChain MessageFormat = "langchain"
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
	if input.Format == FormatNone || input.Format == "" {
		return input.Messages, nil
	}

	var converter MessageConverter
	switch input.Format {
	case FormatOpenAI:
		converter = &OpenAIConverter{}
	case FormatLangChain:
		converter = &LangChainConverter{}
	default:
		return nil, fmt.Errorf("unsupported format: %s", input.Format)
	}

	return converter.Convert(input.Messages, input.PublicURLs)
}

// OpenAI message structures compatible with OpenAI Chat Completion API
// These are simplified for JSON serialization while maintaining API compatibility
// Reference: https://platform.openai.com/docs/api-reference/chat

type OpenAIMessage struct {
	Role         string              `json:"role"`
	Content      interface{}         `json:"content,omitempty"`
	Name         string              `json:"name,omitempty"`
	ToolCalls    []OpenAIToolCall    `json:"tool_calls,omitempty"`
	ToolCallID   string              `json:"tool_call_id,omitempty"`
	FunctionCall *OpenAIFunctionCall `json:"function_call,omitempty"`
}

type OpenAIToolCall struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"` // "function"
	Function OpenAIToolCallFunction `json:"function"`
}

type OpenAIToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string
}

type OpenAIFunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string
}

type OpenAIContentPart struct {
	Type     string          `json:"type"` // "text" | "image_url"
	Text     string          `json:"text,omitempty"`
	ImageURL *OpenAIImageURL `json:"image_url,omitempty"`
}

type OpenAIImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"` // "auto" | "low" | "high"
}

// OpenAIConverter converts messages to OpenAI-compatible format
// Note: Uses simplified structures that are JSON-compatible with OpenAI API
type OpenAIConverter struct{}

func (c *OpenAIConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	result := make([]OpenAIMessage, 0, len(messages))

	for _, msg := range messages {
		openaiMsg := OpenAIMessage{
			Role: c.convertRole(msg.Role),
		}

		// Convert parts to content
		if len(msg.Parts) > 0 {
			content, toolCalls := c.convertParts(msg.Parts, publicURLs)
			openaiMsg.Content = content
			if len(toolCalls) > 0 {
				openaiMsg.ToolCalls = toolCalls
			}
		}

		result = append(result, openaiMsg)
	}

	return result, nil
}

func (c *OpenAIConverter) convertRole(role string) string {
	// OpenAI roles: "system", "user", "assistant", "tool", "function"
	switch role {
	case "user", "assistant", "system", "tool", "function":
		return role
	default:
		return "user"
	}
}

func (c *OpenAIConverter) convertParts(parts []model.Part, publicURLs map[string]service.PublicURL) (interface{}, []OpenAIToolCall) {
	var toolCalls []OpenAIToolCall

	// If only one text part, return as string
	if len(parts) == 1 && parts[0].Type == "text" {
		return parts[0].Text, toolCalls
	}

	// Multiple parts or non-text parts, convert to array
	contentParts := make([]OpenAIContentPart, 0, len(parts))

	for _, part := range parts {
		switch part.Type {
		case "text":
			contentParts = append(contentParts, OpenAIContentPart{
				Type: "text",
				Text: part.Text,
			})

		case "image":
			imageURL := c.getAssetURL(part.Asset, publicURLs)
			if imageURL != "" {
				contentParts = append(contentParts, OpenAIContentPart{
					Type: "image_url",
					ImageURL: &OpenAIImageURL{
						URL: imageURL,
					},
				})
			}

		case "tool-call":
			// Extract tool call information from meta
			if part.Meta != nil {
				toolCall := OpenAIToolCall{
					Type: "function",
				}

				if id, ok := part.Meta["id"].(string); ok {
					toolCall.ID = id
				}
				if toolName, ok := part.Meta["tool_name"].(string); ok {
					toolCall.Function.Name = toolName
				}
				if args, ok := part.Meta["arguments"]; ok {
					if argsBytes, err := sonic.Marshal(args); err == nil {
						toolCall.Function.Arguments = string(argsBytes)
					}
				}

				toolCalls = append(toolCalls, toolCall)
			}

		case "tool-result":
			// Tool results are typically in content as text
			if resultJSON, err := sonic.Marshal(part.Meta); err == nil {
				contentParts = append(contentParts, OpenAIContentPart{
					Type: "text",
					Text: string(resultJSON),
				})
			}

		case "audio", "video", "file":
			// For media files, add as URL reference
			assetURL := c.getAssetURL(part.Asset, publicURLs)
			text := part.Text
			if assetURL != "" {
				text = fmt.Sprintf("%s\n[%s: %s]", text, part.Type, assetURL)
			}
			if text != "" {
				contentParts = append(contentParts, OpenAIContentPart{
					Type: "text",
					Text: text,
				})
			}

		default:
			// For other types, include as text if available
			if part.Text != "" {
				contentParts = append(contentParts, OpenAIContentPart{
					Type: "text",
					Text: part.Text,
				})
			}
		}
	}

	// If only text parts, concatenate them
	if len(contentParts) > 0 {
		allText := true
		for _, p := range contentParts {
			if p.Type != "text" {
				allText = false
				break
			}
		}
		if allText {
			combined := ""
			for _, p := range contentParts {
				if combined != "" {
					combined += "\n"
				}
				combined += p.Text
			}
			return combined, toolCalls
		}
	}

	return contentParts, toolCalls
}

func (c *OpenAIConverter) getAssetURL(asset *model.Asset, publicURLs map[string]service.PublicURL) string {
	if asset == nil {
		return ""
	}
	if pubURL, ok := publicURLs[asset.SHA256]; ok {
		return pubURL.URL
	}
	return ""
}

// LangChainConverter converts messages to LangChain format using official llms package types
// Reference: github.com/tmc/langchaingo/llms
type LangChainConverter struct{}

func (c *LangChainConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	result := make([]llms.ChatMessage, 0, len(messages))

	for _, msg := range messages {
		var langchainMsg llms.ChatMessage

		// Combine all text parts into content
		content := c.extractContent(msg.Parts, publicURLs)

		switch msg.Role {
		case "user":
			langchainMsg = llms.HumanChatMessage{
				Content: content,
			}
		case "assistant":
			// Check if there are tool calls
			toolCalls := c.extractToolCalls(msg.Parts)
			langchainMsg = llms.AIChatMessage{
				Content:   content,
				ToolCalls: toolCalls,
			}
		case "function":
			langchainMsg = llms.AIChatMessage{
				Content: content,
			}
		case "system":
			langchainMsg = llms.SystemChatMessage{
				Content: content,
			}
		case "tool":
			// Extract tool call ID from parts
			toolCallID := c.extractToolCallID(msg.Parts)
			langchainMsg = llms.ToolChatMessage{
				ID:      toolCallID,
				Content: content,
			}
		default:
			langchainMsg = llms.GenericChatMessage{
				Content: content,
				Role:    msg.Role,
			}
		}

		result = append(result, langchainMsg)
	}

	return result, nil
}

func (c *LangChainConverter) extractContent(parts []model.Part, publicURLs map[string]service.PublicURL) string {
	if len(parts) == 0 {
		return ""
	}

	// If single text part, return directly
	if len(parts) == 1 && parts[0].Type == "text" {
		return parts[0].Text
	}

	// Multiple parts: combine into structured content
	contentParts := make([]map[string]interface{}, 0, len(parts))

	for _, part := range parts {
		partMap := map[string]interface{}{
			"type": part.Type,
		}

		switch part.Type {
		case "text":
			partMap["text"] = part.Text

		case "image", "audio", "video", "file":
			if part.Asset != nil {
				if pubURL, ok := publicURLs[part.Asset.SHA256]; ok {
					partMap["url"] = pubURL.URL
				}
				partMap["filename"] = part.Filename
				partMap["mime"] = part.Asset.MIME
			}
			if part.Text != "" {
				partMap["text"] = part.Text
			}

		case "tool-call", "tool-result", "data":
			partMap["meta"] = part.Meta
			if part.Text != "" {
				partMap["text"] = part.Text
			}
		}

		contentParts = append(contentParts, partMap)
	}

	// Serialize to JSON string for LangChain
	if jsonBytes, err := sonic.Marshal(contentParts); err == nil {
		return string(jsonBytes)
	}

	return ""
}

func (c *LangChainConverter) extractToolCalls(parts []model.Part) []llms.ToolCall {
	var toolCalls []llms.ToolCall

	for _, part := range parts {
		if part.Type == "tool-call" && part.Meta != nil {
			toolCall := llms.ToolCall{}

			if id, ok := part.Meta["id"].(string); ok {
				toolCall.ID = id
			}
			if toolName, ok := part.Meta["tool_name"].(string); ok {
				toolCall.FunctionCall = &llms.FunctionCall{
					Name: toolName,
				}
			}
			if args, ok := part.Meta["arguments"]; ok {
				if argsBytes, err := sonic.Marshal(args); err == nil {
					if toolCall.FunctionCall != nil {
						toolCall.FunctionCall.Arguments = string(argsBytes)
					}
				}
			}

			toolCalls = append(toolCalls, toolCall)
		}
	}

	return toolCalls
}

func (c *LangChainConverter) extractToolCallID(parts []model.Part) string {
	for _, part := range parts {
		if part.Type == "tool-result" && part.Meta != nil {
			if toolCallID, ok := part.Meta["tool_call_id"].(string); ok {
				return toolCallID
			}
		}
	}
	return ""
}

// ValidateFormat checks if the format is valid
func ValidateFormat(format string) (MessageFormat, error) {
	mf := MessageFormat(format)
	switch mf {
	case FormatNone, FormatOpenAI, FormatLangChain:
		return mf, nil
	default:
		return "", fmt.Errorf("invalid format: %s, supported formats: openai, langchain", format)
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
	if format == FormatNone && len(publicURLs) > 0 {
		result["public_urls"] = publicURLs
	}

	return result, nil
}
