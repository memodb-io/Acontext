package normalizer

import (
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/service"
)

// AcontextNormalizer normalizes Acontext (internal) format
type AcontextNormalizer struct{}

// NormalizeFromAcontextMessage converts Acontext format to internal format
// This is essentially a validation step since Acontext IS the internal format
func (n *AcontextNormalizer) NormalizeFromAcontextMessage(messageJSON json.RawMessage) (string, []service.PartIn, error) {
	var msg struct {
		Role  string           `json:"role"`
		Parts []service.PartIn `json:"parts"`
	}

	if err := json.Unmarshal(messageJSON, &msg); err != nil {
		return "", nil, fmt.Errorf("failed to unmarshal Acontext message: %w", err)
	}

	// Validate role
	validRoles := map[string]bool{"user": true, "assistant": true, "system": true}
	if !validRoles[msg.Role] {
		return "", nil, fmt.Errorf("invalid role: %s (must be one of: user, assistant, system)", msg.Role)
	}

	// Validate each part
	for i, part := range msg.Parts {
		if err := part.Validate(); err != nil {
			return "", nil, fmt.Errorf("invalid part at index %d: %w", i, err)
		}
	}

	return msg.Role, msg.Parts, nil
}

// OpenAINormalizer normalizes OpenAI format to internal format using official SDK types
type OpenAINormalizer struct{}

// NormalizeFromOpenAIMessage converts OpenAI ChatCompletionMessageParamUnion to internal format
func (n *OpenAINormalizer) NormalizeFromOpenAIMessage(messageJSON json.RawMessage) (string, []service.PartIn, error) {
	// Parse using official OpenAI SDK types
	var message openai.ChatCompletionMessageParamUnion
	if err := message.UnmarshalJSON(messageJSON); err != nil {
		return "", nil, fmt.Errorf("failed to unmarshal OpenAI message: %w", err)
	}

	// Extract role and content based on message type
	if message.OfUser != nil {
		return normalizeOpenAIUserMessage(*message.OfUser)
	} else if message.OfAssistant != nil {
		return normalizeOpenAIAssistantMessage(*message.OfAssistant)
	} else if message.OfSystem != nil {
		return normalizeOpenAISystemMessage(*message.OfSystem)
	} else if message.OfTool != nil {
		return normalizeOpenAIToolMessage(*message.OfTool)
	} else if message.OfFunction != nil {
		return normalizeOpenAIFunctionMessage(*message.OfFunction)
	} else if message.OfDeveloper != nil {
		return normalizeOpenAIDeveloperMessage(*message.OfDeveloper)
	}

	return "", nil, fmt.Errorf("unknown OpenAI message type")
}

func normalizeOpenAIUserMessage(msg openai.ChatCompletionUserMessageParam) (string, []service.PartIn, error) {
	parts := []service.PartIn{}

	// Handle content - can be string or array
	if !param.IsOmitted(msg.Content.OfString) {
		parts = append(parts, service.PartIn{
			Type: "text",
			Text: msg.Content.OfString.Value,
		})
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, partUnion := range msg.Content.OfArrayOfContentParts {
			part, err := normalizeOpenAIContentPart(partUnion)
			if err != nil {
				return "", nil, err
			}
			parts = append(parts, part)
		}
	} else {
		return "", nil, fmt.Errorf("OpenAI user message must have content")
	}

	return "user", parts, nil
}

func normalizeOpenAIAssistantMessage(msg openai.ChatCompletionAssistantMessageParam) (string, []service.PartIn, error) {
	parts := []service.PartIn{}

	// Handle content - can be string or array
	if !param.IsOmitted(msg.Content.OfString) {
		if msg.Content.OfString.Value != "" {
			parts = append(parts, service.PartIn{
				Type: "text",
				Text: msg.Content.OfString.Value,
			})
		}
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, partUnion := range msg.Content.OfArrayOfContentParts {
			part, err := normalizeOpenAIAssistantContentPart(partUnion)
			if err != nil {
				return "", nil, err
			}
			parts = append(parts, part)
		}
	}

	// Handle tool calls
	for _, toolCall := range msg.ToolCalls {
		if toolCall.OfFunction != nil {
			parts = append(parts, service.PartIn{
				Type: "tool-call",
				Meta: map[string]interface{}{
					"id":        toolCall.OfFunction.ID,
					"tool_name": toolCall.OfFunction.Function.Name,
					"arguments": toolCall.OfFunction.Function.Arguments,
				},
			})
		}
	}

	// Handle deprecated function call
	if !param.IsOmitted(msg.FunctionCall) {
		parts = append(parts, service.PartIn{
			Type: "tool-call",
			Meta: map[string]interface{}{
				"tool_name": msg.FunctionCall.Name,
				"arguments": msg.FunctionCall.Arguments,
			},
		})
	}

	return "assistant", parts, nil
}

func normalizeOpenAISystemMessage(msg openai.ChatCompletionSystemMessageParam) (string, []service.PartIn, error) {
	parts := []service.PartIn{}

	// Handle content - can be string or array
	if !param.IsOmitted(msg.Content.OfString) {
		parts = append(parts, service.PartIn{
			Type: "text",
			Text: msg.Content.OfString.Value,
		})
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, textPart := range msg.Content.OfArrayOfContentParts {
			parts = append(parts, service.PartIn{
				Type: "text",
				Text: textPart.Text,
			})
		}
	} else {
		return "", nil, fmt.Errorf("OpenAI system message must have content")
	}

	return "system", parts, nil
}

func normalizeOpenAIDeveloperMessage(msg openai.ChatCompletionDeveloperMessageParam) (string, []service.PartIn, error) {
	parts := []service.PartIn{}

	// Developer messages are converted to system messages
	if !param.IsOmitted(msg.Content.OfString) {
		parts = append(parts, service.PartIn{
			Type: "text",
			Text: msg.Content.OfString.Value,
		})
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, textPart := range msg.Content.OfArrayOfContentParts {
			parts = append(parts, service.PartIn{
				Type: "text",
				Text: textPart.Text,
			})
		}
	} else {
		return "", nil, fmt.Errorf("OpenAI developer message must have content")
	}

	return "system", parts, nil
}

func normalizeOpenAIToolMessage(msg openai.ChatCompletionToolMessageParam) (string, []service.PartIn, error) {
	parts := []service.PartIn{}

	// Tool messages are converted to user messages with tool-result parts
	var content string
	if !param.IsOmitted(msg.Content.OfString) {
		content = msg.Content.OfString.Value
	} else if len(msg.Content.OfArrayOfContentParts) > 0 {
		for _, textPart := range msg.Content.OfArrayOfContentParts {
			content += textPart.Text
		}
	}

	parts = append(parts, service.PartIn{
		Type: "tool-result",
		Text: content,
		Meta: map[string]interface{}{
			"tool_call_id": msg.ToolCallID,
		},
	})

	return "user", parts, nil
}

func normalizeOpenAIFunctionMessage(msg openai.ChatCompletionFunctionMessageParam) (string, []service.PartIn, error) {
	// Function messages are converted to user messages with tool-result parts
	content := ""
	if !param.IsOmitted(msg.Content) {
		content = msg.Content.Value
	}

	parts := []service.PartIn{
		{
			Type: "tool-result",
			Text: content,
			Meta: map[string]interface{}{
				"function_name": msg.Name,
			},
		},
	}

	return "user", parts, nil
}

func normalizeOpenAIContentPart(partUnion openai.ChatCompletionContentPartUnionParam) (service.PartIn, error) {
	if partUnion.OfText != nil {
		return service.PartIn{
			Type: "text",
			Text: partUnion.OfText.Text,
		}, nil
	} else if partUnion.OfImageURL != nil {
		return service.PartIn{
			Type: "image",
			Meta: map[string]interface{}{
				"url":    partUnion.OfImageURL.ImageURL.URL,
				"detail": partUnion.OfImageURL.ImageURL.Detail,
			},
		}, nil
	} else if partUnion.OfInputAudio != nil {
		return service.PartIn{
			Type: "audio",
			Meta: map[string]interface{}{
				"data":   partUnion.OfInputAudio.InputAudio.Data,
				"format": partUnion.OfInputAudio.InputAudio.Format,
			},
		}, nil
	} else if partUnion.OfFile != nil {
		return service.PartIn{
			Type: "file",
			Meta: map[string]interface{}{
				"file_id": partUnion.OfFile.File.FileID,
			},
		}, nil
	}

	return service.PartIn{}, fmt.Errorf("unsupported OpenAI content part type")
}

func normalizeOpenAIAssistantContentPart(partUnion openai.ChatCompletionAssistantMessageParamContentArrayOfContentPartUnion) (service.PartIn, error) {
	if partUnion.OfText != nil {
		return service.PartIn{
			Type: "text",
			Text: partUnion.OfText.Text,
		}, nil
	} else if partUnion.OfRefusal != nil {
		return service.PartIn{
			Type: "text",
			Text: partUnion.OfRefusal.Refusal,
			Meta: map[string]interface{}{
				"is_refusal": true,
			},
		}, nil
	}

	return service.PartIn{}, fmt.Errorf("unsupported OpenAI assistant content part type")
}

// AnthropicNormalizer normalizes Anthropic format to internal format using official SDK types
type AnthropicNormalizer struct{}

// NormalizeFromAnthropicMessage converts Anthropic MessageParam to internal format
func (n *AnthropicNormalizer) NormalizeFromAnthropicMessage(messageJSON json.RawMessage) (string, []service.PartIn, error) {
	// Parse using official Anthropic SDK types
	var message anthropic.MessageParam
	if err := message.UnmarshalJSON(messageJSON); err != nil {
		return "", nil, fmt.Errorf("failed to unmarshal Anthropic message: %w", err)
	}

	// Validate role (Anthropic only supports "user" and "assistant")
	role := string(message.Role)
	if role != "user" && role != "assistant" {
		return "", nil, fmt.Errorf("invalid Anthropic role: %s (only 'user' and 'assistant' are supported)", role)
	}

	// Convert content blocks
	parts := []service.PartIn{}
	for _, blockUnion := range message.Content {
		part, err := normalizeAnthropicContentBlock(blockUnion)
		if err != nil {
			return "", nil, err
		}
		parts = append(parts, part)
	}

	return role, parts, nil
}

func normalizeAnthropicContentBlock(blockUnion anthropic.ContentBlockParamUnion) (service.PartIn, error) {
	if blockUnion.OfText != nil {
		part := service.PartIn{
			Type: "text",
			Text: blockUnion.OfText.Text,
		}

		// Extract cache_control if present
		if blockUnion.OfText.CacheControl.Type != "" {
			part.Meta = map[string]interface{}{
				"cache_control": ExtractAnthropicCacheControl(blockUnion.OfText.CacheControl),
			}
		}

		return part, nil
	} else if blockUnion.OfImage != nil {
		// Handle image source
		meta := map[string]interface{}{}
		if blockUnion.OfImage.Source.OfBase64 != nil {
			meta["type"] = "base64"
			meta["media_type"] = blockUnion.OfImage.Source.OfBase64.MediaType
			meta["data"] = blockUnion.OfImage.Source.OfBase64.Data
		} else if blockUnion.OfImage.Source.OfURL != nil {
			meta["type"] = "url"
			meta["url"] = blockUnion.OfImage.Source.OfURL.URL
		}

		// Extract cache_control if present
		if blockUnion.OfImage.CacheControl.Type != "" {
			meta["cache_control"] = ExtractAnthropicCacheControl(blockUnion.OfImage.CacheControl)
		}

		return service.PartIn{
			Type: "image",
			Meta: meta,
		}, nil
	} else if blockUnion.OfToolUse != nil {
		// Convert input to JSON string
		argsBytes, err := json.Marshal(blockUnion.OfToolUse.Input)
		if err != nil {
			return service.PartIn{}, fmt.Errorf("failed to marshal tool input: %w", err)
		}

		meta := map[string]interface{}{
			"id":    blockUnion.OfToolUse.ID,
			"name":  blockUnion.OfToolUse.Name,
			"input": string(argsBytes),
		}

		// Extract cache_control if present
		if blockUnion.OfToolUse.CacheControl.Type != "" {
			meta["cache_control"] = ExtractAnthropicCacheControl(blockUnion.OfToolUse.CacheControl)
		}

		return service.PartIn{
			Type: "tool-use",
			Meta: meta,
		}, nil
	} else if blockUnion.OfToolResult != nil {
		// Handle tool result content
		var resultText string
		for _, contentItem := range blockUnion.OfToolResult.Content {
			if contentItem.OfText != nil {
				resultText += contentItem.OfText.Text
			}
		}

		isError := false
		if !param.IsOmitted(blockUnion.OfToolResult.IsError) {
			isError = blockUnion.OfToolResult.IsError.Value
		}

		meta := map[string]interface{}{
			"tool_use_id": blockUnion.OfToolResult.ToolUseID,
			"is_error":    isError,
		}

		// Extract cache_control if present
		if blockUnion.OfToolResult.CacheControl.Type != "" {
			meta["cache_control"] = ExtractAnthropicCacheControl(blockUnion.OfToolResult.CacheControl)
		}

		return service.PartIn{
			Type: "tool-result",
			Text: resultText,
			Meta: meta,
		}, nil
	} else if blockUnion.OfDocument != nil {
		// Handle document block
		meta := map[string]interface{}{}
		if blockUnion.OfDocument.Source.OfBase64 != nil {
			meta["type"] = "base64"
			meta["media_type"] = blockUnion.OfDocument.Source.OfBase64.MediaType
			meta["data"] = blockUnion.OfDocument.Source.OfBase64.Data
		} else if blockUnion.OfDocument.Source.OfURL != nil {
			meta["type"] = "url"
			meta["url"] = blockUnion.OfDocument.Source.OfURL.URL
		}

		// Extract cache_control if present
		if blockUnion.OfDocument.CacheControl.Type != "" {
			meta["cache_control"] = ExtractAnthropicCacheControl(blockUnion.OfDocument.CacheControl)
		}

		return service.PartIn{
			Type: "file",
			Meta: meta,
		}, nil
	}

	return service.PartIn{}, fmt.Errorf("unsupported Anthropic content block type")
}
