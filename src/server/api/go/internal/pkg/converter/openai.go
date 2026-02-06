package converter

import (
	"encoding/json"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// OpenAIConverter converts messages to OpenAI-compatible format using official SDK types.
type OpenAIConverter struct{}

func (c *OpenAIConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	result := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages))

	for _, msg := range messages {
		// Special handling: if user role contains only tool-result parts,
		// convert to OpenAI's tool role
		if msg.Role == model.RoleUser && c.isToolResultOnly(msg.Parts) {
			toolMsg := c.convertToToolMessage(msg)
			result = append(result, toolMsg)
		} else {
			switch msg.Role {
			case model.RoleUser:
				userMsg := c.convertToUserMessage(msg, publicURLs)
				result = append(result, userMsg)
			case model.RoleAssistant:
				assistantMsg := c.convertToAssistantMessage(msg)
				result = append(result, assistantMsg)
			default:
				userMsg := c.convertToUserMessage(msg, publicURLs)
				result = append(result, userMsg)
			}
		}
	}

	return result, nil
}

func (c *OpenAIConverter) convertToUserMessage(msg model.Message, publicURLs map[string]service.PublicURL) openai.ChatCompletionMessageParamUnion {
	if len(msg.Parts) == 1 && msg.Parts[0].Type == model.PartTypeText {
		userParam := openai.ChatCompletionUserMessageParam{
			Content: openai.ChatCompletionUserMessageParamContentUnion{
				OfString: param.NewOpt(msg.Parts[0].Text),
			},
		}

		if metaData := msg.Meta.Data(); len(metaData) > 0 {
			if name, ok := metaData[model.MetaKeyName].(string); ok && name != "" {
				userParam.Name = param.NewOpt(name)
			}
		}

		return openai.ChatCompletionMessageParamUnion{
			OfUser: &userParam,
		}
	}

	contentParts := make([]openai.ChatCompletionContentPartUnionParam, 0, len(msg.Parts))
	for _, part := range msg.Parts {
		switch part.Type {
		case model.PartTypeText:
			contentParts = append(contentParts, openai.TextContentPart(part.Text))
		case model.PartTypeImage:
			imageURL := GetAssetURL(part.Asset, publicURLs)
			if imageURL != "" {
				detail := part.GetMetaString(model.MetaKeyDetail)
				imgParam := openai.ChatCompletionContentPartImageImageURLParam{
					URL:    imageURL,
					Detail: detail,
				}
				contentParts = append(contentParts, openai.ImageContentPart(imgParam))
			}
		case model.PartTypeAudio:
			if part.Meta != nil {
				data := part.GetMetaString(model.MetaKeyData)
				format := part.GetMetaString(model.MetaKeyAudioFormat)
				audioParam := openai.ChatCompletionContentPartInputAudioInputAudioParam{
					Data:   data,
					Format: format,
				}
				contentParts = append(contentParts, openai.InputAudioContentPart(audioParam))
			}
		case model.PartTypeFile:
			if part.Meta != nil {
				fileParam := openai.ChatCompletionContentPartFileFileParam{}
				hasContent := false

				if fileID := part.GetMetaString(model.MetaKeyFileID); fileID != "" {
					fileParam.FileID = param.NewOpt(fileID)
					hasContent = true
				}
				if fileData := part.GetMetaString(model.MetaKeyFileData); fileData != "" {
					fileParam.FileData = param.NewOpt(fileData)
					hasContent = true
				}
				if filename := part.GetMetaString(model.MetaKeyFilename); filename != "" {
					fileParam.Filename = param.NewOpt(filename)
					hasContent = true
				}

				if hasContent {
					contentParts = append(contentParts, openai.FileContentPart(fileParam))
				}
			}
		}
	}

	userParam := openai.ChatCompletionUserMessageParam{
		Content: openai.ChatCompletionUserMessageParamContentUnion{
			OfArrayOfContentParts: contentParts,
		},
	}

	if metaData := msg.Meta.Data(); len(metaData) > 0 {
		if name, ok := metaData[model.MetaKeyName].(string); ok && name != "" {
			userParam.Name = param.NewOpt(name)
		}
	}

	return openai.ChatCompletionMessageParamUnion{
		OfUser: &userParam,
	}
}

func (c *OpenAIConverter) convertToAssistantMessage(msg model.Message) openai.ChatCompletionMessageParamUnion {
	var textContent string
	var toolCalls []openai.ChatCompletionMessageToolCallUnionParam

	for _, part := range msg.Parts {
		switch part.Type {
		case model.PartTypeText:
			textContent += part.Text
		case model.PartTypeThinking:
			if part.Text != "" {
				textContent += part.Text
			}
		case model.PartTypeToolCall:
			if part.Meta != nil {
				toolCall := c.convertToToolCall(part)
				if toolCall != nil {
					toolCalls = append(toolCalls, *toolCall)
				}
			}
		}
	}

	assistantParam := openai.ChatCompletionAssistantMessageParam{}

	if textContent != "" {
		assistantParam.Content = openai.ChatCompletionAssistantMessageParamContentUnion{
			OfString: param.NewOpt(textContent),
		}
	}

	if len(toolCalls) > 0 {
		assistantParam.ToolCalls = toolCalls
	}

	if metaData := msg.Meta.Data(); len(metaData) > 0 {
		if name, ok := metaData[model.MetaKeyName].(string); ok && name != "" {
			assistantParam.Name = param.NewOpt(name)
		}
	}

	return openai.ChatCompletionMessageParamUnion{
		OfAssistant: &assistantParam,
	}
}

func (c *OpenAIConverter) convertToToolMessage(msg model.Message) openai.ChatCompletionMessageParamUnion {
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

	id := part.ID()
	name := part.Name()
	arguments := part.Arguments()

	// If arguments is not a string, marshal it
	if arguments == "" {
		if argsObj, ok := part.Meta[model.MetaKeyArguments]; ok {
			if argsBytes, err := json.Marshal(argsObj); err == nil {
				arguments = string(argsBytes)
			}
		}
	}

	if id == "" || name == "" {
		return nil
	}

	functionParam := openai.ChatCompletionMessageFunctionToolCallParam{
		ID: id,
		Function: openai.ChatCompletionMessageFunctionToolCallFunctionParam{
			Name:      name,
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
		if part.Type != model.PartTypeToolResult {
			return false
		}
	}
	return true
}

func (c *OpenAIConverter) extractToolCallID(parts []model.Part) string {
	for _, part := range parts {
		if part.Type == model.PartTypeToolResult {
			if id := part.ToolCallID(); id != "" {
				return id
			}
		}
	}
	return ""
}

func (c *OpenAIConverter) extractToolResultContent(parts []model.Part) string {
	content := ""
	for _, part := range parts {
		if part.Type == model.PartTypeToolResult {
			content += part.Text
		}
	}
	return content
}
