package converter

import (
	"encoding/json"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// OpenAIConverter converts messages to OpenAI-compatible format using official SDK types
type OpenAIConverter struct{}

func (c *OpenAIConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	result := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages))

	for _, msg := range messages {
		// Special handling: if user role contains only tool-result parts,
		// convert to OpenAI's tool role
		if msg.Role == "user" && c.isToolResultOnly(msg.Parts) {
			toolMsg := c.convertToToolMessage(msg, publicURLs)
			result = append(result, toolMsg)
		} else {
			// Normal message conversion
			switch msg.Role {
			case "user":
				userMsg := c.convertToUserMessage(msg, publicURLs)
				result = append(result, userMsg)
			case "assistant":
				assistantMsg := c.convertToAssistantMessage(msg, publicURLs)
				result = append(result, assistantMsg)
			case "system":
				systemMsg := c.convertToSystemMessage(msg)
				result = append(result, systemMsg)
			default:
				// Default to user message
				userMsg := c.convertToUserMessage(msg, publicURLs)
				result = append(result, userMsg)
			}
		}
	}

	return result, nil
}

func (c *OpenAIConverter) convertToUserMessage(msg model.Message, publicURLs map[string]service.PublicURL) openai.ChatCompletionMessageParamUnion {
	// Check if content should be string or array
	if len(msg.Parts) == 1 && msg.Parts[0].Type == "text" {
		// Single text part - use string content
		return openai.UserMessage(msg.Parts[0].Text)
	}

	// Multiple parts or non-text parts - use array content
	contentParts := make([]openai.ChatCompletionContentPartUnionParam, 0, len(msg.Parts))
	for _, part := range msg.Parts {
		switch part.Type {
		case "text":
			contentParts = append(contentParts, openai.TextContentPart(part.Text))
		case "image":
			imageURL := c.getAssetURL(part.Asset, publicURLs)
			if imageURL != "" {
				detail := ""
				if part.Meta != nil {
					if d, ok := part.Meta["detail"].(string); ok {
						detail = d
					}
				}
				imgParam := openai.ChatCompletionContentPartImageImageURLParam{
					URL:    imageURL,
					Detail: detail,
				}
				contentParts = append(contentParts, openai.ImageContentPart(imgParam))
			}
		case "audio":
			if part.Meta != nil {
				data := ""
				format := ""
				if d, ok := part.Meta["data"].(string); ok {
					data = d
				}
				if f, ok := part.Meta["format"].(string); ok {
					format = f
				}
				audioParam := openai.ChatCompletionContentPartInputAudioInputAudioParam{
					Data:   data,
					Format: format,
				}
				contentParts = append(contentParts, openai.InputAudioContentPart(audioParam))
			}
		case "file":
			if part.Meta != nil {
				if fileID, ok := part.Meta["file_id"].(string); ok {
					fileParam := openai.ChatCompletionContentPartFileFileParam{
						FileID: param.NewOpt(fileID),
					}
					contentParts = append(contentParts, openai.FileContentPart(fileParam))
				}
			}
		}
	}

	return openai.UserMessage(contentParts)
}

func (c *OpenAIConverter) convertToAssistantMessage(msg model.Message, publicURLs map[string]service.PublicURL) openai.ChatCompletionMessageParamUnion {
	// Separate text content and tool calls
	var textContent string
	var toolCalls []openai.ChatCompletionMessageToolCallUnionParam

	for _, part := range msg.Parts {
		switch part.Type {
		case "text":
			textContent += part.Text
		case "tool-call":
			if part.Meta != nil {
				toolCall := c.convertToToolCall(part)
				if toolCall != nil {
					toolCalls = append(toolCalls, *toolCall)
				}
			}
		}
	}

	// Build assistant message
	assistantParam := openai.ChatCompletionAssistantMessageParam{}

	if textContent != "" {
		assistantParam.Content = openai.ChatCompletionAssistantMessageParamContentUnion{
			OfString: param.NewOpt(textContent),
		}
	}

	if len(toolCalls) > 0 {
		assistantParam.ToolCalls = toolCalls
	}

	return openai.ChatCompletionMessageParamUnion{
		OfAssistant: &assistantParam,
	}
}

func (c *OpenAIConverter) convertToSystemMessage(msg model.Message) openai.ChatCompletionMessageParamUnion {
	// Extract text from parts
	text := ""
	for _, part := range msg.Parts {
		if part.Type == "text" {
			text += part.Text
		}
	}

	return openai.SystemMessage(text)
}

func (c *OpenAIConverter) convertToToolMessage(msg model.Message, publicURLs map[string]service.PublicURL) openai.ChatCompletionMessageParamUnion {
	// Extract tool result information
	toolCallID := c.extractToolCallID(msg.Parts)
	content := c.extractToolResultContent(msg.Parts)

	toolParam := openai.ChatCompletionToolMessageParam{
		ToolCallID: toolCallID,
		Content: openai.ChatCompletionToolMessageParamContentUnion{
			OfString: param.NewOpt(content),
		},
	}

	return openai.ChatCompletionMessageParamUnion{
		OfTool: &toolParam,
	}
}

func (c *OpenAIConverter) convertToToolCall(part model.Part) *openai.ChatCompletionMessageToolCallUnionParam {
	if part.Meta == nil {
		return nil
	}

	id, _ := part.Meta["id"].(string)
	toolName, _ := part.Meta["tool_name"].(string)
	arguments, _ := part.Meta["arguments"].(string)

	// If arguments is not a string, marshal it
	if arguments == "" {
		if argsObj, ok := part.Meta["arguments"]; ok {
			if argsBytes, err := json.Marshal(argsObj); err == nil {
				arguments = string(argsBytes)
			}
		}
	}

	if id == "" || toolName == "" {
		return nil
	}

	functionParam := openai.ChatCompletionMessageFunctionToolCallParam{
		ID: id,
		Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
			Name:      toolName,
			Arguments: arguments,
		},
	}

	return &openai.ChatCompletionMessageToolCallUnionParam{
		OfFunction: &functionParam,
	}
}

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

func (c *OpenAIConverter) extractToolCallID(parts []model.Part) string {
	for _, part := range parts {
		if part.Type == "tool-result" && part.Meta != nil {
			if toolCallID, ok := part.Meta["tool_call_id"].(string); ok {
				return toolCallID
			}
		}
	}
	return ""
}

func (c *OpenAIConverter) extractToolResultContent(parts []model.Part) string {
	content := ""
	for _, part := range parts {
		if part.Type == "tool-result" {
			content += part.Text
		}
	}
	return content
}

func (c *OpenAIConverter) getAssetURL(asset *model.Asset, publicURLs map[string]service.PublicURL) string {
	if asset == nil {
		return ""
	}
	assetKey := asset.S3Key
	if publicURL, ok := publicURLs[assetKey]; ok {
		return publicURL.URL
	}
	return ""
}
