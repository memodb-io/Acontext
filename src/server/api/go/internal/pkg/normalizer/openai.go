package normalizer

import (
	"encoding/json"
	"fmt"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// OpenAINormalizer normalizes OpenAI format to internal format using official SDK types.
type OpenAINormalizer struct{}

// Normalize converts OpenAI ChatCompletionMessageParamUnion to internal format.
func (n *OpenAINormalizer) Normalize(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	var message openai.ChatCompletionMessageParamUnion
	if err := message.UnmarshalJSON(messageJSON); err != nil {
		return "", nil, nil, fmt.Errorf("failed to unmarshal OpenAI message: %w", err)
	}

	if message.OfUser != nil {
		return normalizeOpenAIUserMessage(*message.OfUser)
	} else if message.OfAssistant != nil {
		return normalizeOpenAIAssistantMessage(*message.OfAssistant)
	} else if message.OfSystem != nil {
		return "", nil, nil, fmt.Errorf("system messages are not supported. Use session-level or skill-level configuration for system prompts")
	} else if message.OfTool != nil {
		return normalizeOpenAIToolMessage(*message.OfTool)
	} else if message.OfFunction != nil {
		return normalizeOpenAIFunctionMessage(*message.OfFunction)
	} else if message.OfDeveloper != nil {
		return "", nil, nil, fmt.Errorf("developer messages are not supported. Use session-level or skill-level configuration for system prompts")
	}

	return "", nil, nil, fmt.Errorf("unknown OpenAI message type")
}

// NormalizeFromOpenAIMessage is a backward-compatible alias for Normalize.
// Deprecated: Use Normalize() via the MessageNormalizer interface instead.
func (n *OpenAINormalizer) NormalizeFromOpenAIMessage(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	return n.Normalize(messageJSON)
}

func normalizeOpenAIUserMessage(msg openai.ChatCompletionUserMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
	parts := []service.PartIn{}

	if !param.IsOmitted(msg.Content.OfString) {
		parts = append(parts, service.PartIn{
			Type: model.PartTypeText,
			Text: msg.Content.OfString.Value,
		})
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, partUnion := range msg.Content.OfArrayOfContentParts {
			part, err := normalizeOpenAIContentPart(partUnion)
			if err != nil {
				return "", nil, nil, err
			}
			parts = append(parts, part)
		}
	} else {
		return "", nil, nil, fmt.Errorf("OpenAI user message must have content")
	}

	messageMeta := map[string]interface{}{
		model.MsgMetaSourceFormat: "openai",
	}

	if !param.IsOmitted(msg.Name) {
		messageMeta[model.MetaKeyName] = msg.Name.Value
	}

	return model.RoleUser, parts, messageMeta, nil
}

func normalizeOpenAIAssistantMessage(msg openai.ChatCompletionAssistantMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
	parts := []service.PartIn{}

	if !param.IsOmitted(msg.Content.OfString) {
		if msg.Content.OfString.Value != "" {
			parts = append(parts, service.PartIn{
				Type: model.PartTypeText,
				Text: msg.Content.OfString.Value,
			})
		}
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, partUnion := range msg.Content.OfArrayOfContentParts {
			part, err := normalizeOpenAIAssistantContentPart(partUnion)
			if err != nil {
				return "", nil, nil, err
			}
			parts = append(parts, part)
		}
	}

	for _, toolCall := range msg.ToolCalls {
		if toolCall.OfFunction != nil {
			parts = append(parts, service.PartIn{
				Type: model.PartTypeToolCall,
				Meta: map[string]interface{}{
					model.MetaKeyID:         toolCall.OfFunction.ID,
					model.MetaKeyName:       toolCall.OfFunction.Function.Name,
					model.MetaKeyArguments:  toolCall.OfFunction.Function.Arguments,
					model.MetaKeySourceType: "function",
				},
			})
		}
	}

	if !param.IsOmitted(msg.FunctionCall) {
		parts = append(parts, service.PartIn{
			Type: model.PartTypeToolCall,
			Meta: map[string]interface{}{
				model.MetaKeyName:       msg.FunctionCall.Name,
				model.MetaKeyArguments:  msg.FunctionCall.Arguments,
				model.MetaKeySourceType: "function",
			},
		})
	}

	messageMeta := map[string]interface{}{
		model.MsgMetaSourceFormat: "openai",
	}

	if !param.IsOmitted(msg.Name) {
		messageMeta[model.MetaKeyName] = msg.Name.Value
	}

	return model.RoleAssistant, parts, messageMeta, nil
}

func normalizeOpenAIToolMessage(msg openai.ChatCompletionToolMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
	var content string
	if !param.IsOmitted(msg.Content.OfString) {
		content = msg.Content.OfString.Value
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, textPart := range msg.Content.OfArrayOfContentParts {
			content += textPart.Text
		}
	}

	parts := []service.PartIn{
		{
			Type: model.PartTypeToolResult,
			Text: content,
			Meta: map[string]interface{}{
				model.MetaKeyToolCallID: msg.ToolCallID,
			},
		},
	}

	messageMeta := map[string]interface{}{
		model.MsgMetaSourceFormat: "openai",
	}

	return model.RoleUser, parts, messageMeta, nil
}

func normalizeOpenAIFunctionMessage(msg openai.ChatCompletionFunctionMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
	content := ""
	if !param.IsOmitted(msg.Content) {
		content = msg.Content.Value
	}

	parts := []service.PartIn{
		{
			Type: model.PartTypeToolResult,
			Text: content,
			Meta: map[string]interface{}{
				"function_name": msg.Name, // Keep function_name for deprecated function format
			},
		},
	}

	messageMeta := map[string]interface{}{
		model.MsgMetaSourceFormat: "openai",
	}

	return model.RoleUser, parts, messageMeta, nil
}

func normalizeOpenAIContentPart(partUnion openai.ChatCompletionContentPartUnionParam) (service.PartIn, error) {
	if partUnion.OfText != nil {
		return service.PartIn{
			Type: model.PartTypeText,
			Text: partUnion.OfText.Text,
		}, nil
	} else if partUnion.OfImageURL != nil {
		return service.PartIn{
			Type: model.PartTypeImage,
			Meta: map[string]interface{}{
				model.MetaKeyURL:    partUnion.OfImageURL.ImageURL.URL,
				model.MetaKeyDetail: partUnion.OfImageURL.ImageURL.Detail,
			},
		}, nil
	} else if partUnion.OfInputAudio != nil {
		return service.PartIn{
			Type: model.PartTypeAudio,
			Meta: map[string]interface{}{
				model.MetaKeyData:        partUnion.OfInputAudio.InputAudio.Data,
				model.MetaKeyAudioFormat: partUnion.OfInputAudio.InputAudio.Format,
			},
		}, nil
	} else if partUnion.OfFile != nil {
		meta := map[string]interface{}{}

		if !param.IsOmitted(partUnion.OfFile.File.FileID) {
			meta[model.MetaKeyFileID] = partUnion.OfFile.File.FileID.Value
		}
		if !param.IsOmitted(partUnion.OfFile.File.FileData) {
			meta[model.MetaKeyFileData] = partUnion.OfFile.File.FileData.Value
		}
		if !param.IsOmitted(partUnion.OfFile.File.Filename) {
			meta[model.MetaKeyFilename] = partUnion.OfFile.File.Filename.Value
		}

		return service.PartIn{
			Type: model.PartTypeFile,
			Meta: meta,
		}, nil
	}

	return service.PartIn{}, fmt.Errorf("unsupported OpenAI content part type")
}

func normalizeOpenAIAssistantContentPart(partUnion openai.ChatCompletionAssistantMessageParamContentArrayOfContentPartUnion) (service.PartIn, error) {
	if partUnion.OfText != nil {
		return service.PartIn{
			Type: model.PartTypeText,
			Text: partUnion.OfText.Text,
		}, nil
	} else if partUnion.OfRefusal != nil {
		return service.PartIn{
			Type: model.PartTypeText,
			Text: partUnion.OfRefusal.Refusal,
			Meta: map[string]interface{}{
				model.MetaKeyIsRefusal: true,
			},
		}, nil
	}

	return service.PartIn{}, fmt.Errorf("unsupported OpenAI assistant content part type")
}
