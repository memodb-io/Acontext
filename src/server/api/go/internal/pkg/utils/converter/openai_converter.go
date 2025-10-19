package converter

import (
	"fmt"

	"github.com/bytedance/sonic"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

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
		openaiMsg := OpenAIMessage{}

		// Special handling: if user role contains only tool-result parts,
		// convert to OpenAI's tool role
		if msg.Role == "user" && c.isToolResultOnly(msg.Parts) {
			openaiMsg.Role = "tool"
			openaiMsg.ToolCallID = c.extractToolCallID(msg.Parts)
			openaiMsg.Content = c.extractToolResultContent(msg.Parts)
		} else {
			// Normal message conversion
			openaiMsg.Role = c.convertRole(msg.Role)

			// Convert parts to content
			if len(msg.Parts) > 0 {
				content, toolCalls := c.convertParts(msg.Parts, publicURLs)
				openaiMsg.Content = content
				if len(toolCalls) > 0 {
					openaiMsg.ToolCalls = toolCalls
				}
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

// isToolResultOnly checks if the message contains only tool-result parts
func (c *OpenAIConverter) isToolResultOnly(parts []model.Part) bool {
	if len(parts) == 0 {
		return false
	}
	for _, part := range parts {
		if part.Type != "tool-result" {
			return false
		}
	}
	return true
}

// extractToolCallID extracts the tool_call_id from tool-result parts
func (c *OpenAIConverter) extractToolCallID(parts []model.Part) string {
	for _, part := range parts {
		if part.Type == "tool-result" && part.Meta != nil {
			if id, ok := part.Meta["tool_call_id"].(string); ok {
				return id
			}
		}
	}
	return ""
}

// extractToolResultContent extracts the content from tool-result parts
func (c *OpenAIConverter) extractToolResultContent(parts []model.Part) string {
	for _, part := range parts {
		if part.Type == "tool-result" {
			// First try to get text
			if part.Text != "" {
				return part.Text
			}
			// Then try to get result from meta
			if part.Meta != nil {
				if result, ok := part.Meta["result"]; ok {
					if str, ok := result.(string); ok {
						return str
					}
					// If not a string, serialize to JSON
					if jsonBytes, err := sonic.Marshal(result); err == nil {
						return string(jsonBytes)
					}
				}
			}
		}
	}
	return ""
}
