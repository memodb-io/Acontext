package normalizer

import (
	"encoding/json"
	"fmt"

	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/service"
)

// OpenAINormalizer normalizes OpenAI format to internal format using official SDK types
type OpenAINormalizer struct{}

// NormalizeFromOpenAIMessage converts OpenAI ChatCompletionMessageParamUnion to internal format
// Returns: role, parts, messageMeta, error
func (n *OpenAINormalizer) NormalizeFromOpenAIMessage(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	// Parse using official OpenAI SDK types
	var message openai.ChatCompletionMessageParamUnion
	if err := message.UnmarshalJSON(messageJSON); err != nil {
		return "", nil, nil, fmt.Errorf("failed to unmarshal OpenAI message: %w", err)
	}

	// Extract role and content based on message type
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

func normalizeOpenAIUserMessage(msg openai.ChatCompletionUserMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
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
				return "", nil, nil, err
			}
			parts = append(parts, part)
		}
	} else {
		return "", nil, nil, fmt.Errorf("OpenAI user message must have content")
	}

	// Extract message-level metadata
	messageMeta := map[string]interface{}{
		"source_format": "openai",
	}

	// Extract name field if present
	if !param.IsOmitted(msg.Name) {
		messageMeta["name"] = msg.Name.Value
	}

	return "user", parts, messageMeta, nil
}

func normalizeOpenAIAssistantMessage(msg openai.ChatCompletionAssistantMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
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
				return "", nil, nil, err
			}
			parts = append(parts, part)
		}
	}

	// Handle tool calls - UNIFIED FORMAT
	for _, toolCall := range msg.ToolCalls {
		if toolCall.OfFunction != nil {
			parts = append(parts, service.PartIn{
				Type: "tool-call",
				Meta: map[string]interface{}{
					"id":        toolCall.OfFunction.ID,
					"name":      toolCall.OfFunction.Function.Name, // Unified: was "tool_name"
					"arguments": toolCall.OfFunction.Function.Arguments,
					"type":      "function", // Store tool type
				},
			})
		}
	}

	// Handle deprecated function call
	if !param.IsOmitted(msg.FunctionCall) {
		parts = append(parts, service.PartIn{
			Type: "tool-call",
			Meta: map[string]interface{}{
				"name":      msg.FunctionCall.Name, // Unified: was "tool_name"
				"arguments": msg.FunctionCall.Arguments,
				"type":      "function",
			},
		})
	}

	// Extract message-level metadata
	messageMeta := map[string]interface{}{
		"source_format": "openai",
	}

	// Extract name field if present
	if !param.IsOmitted(msg.Name) {
		messageMeta["name"] = msg.Name.Value
	}

	return "assistant", parts, messageMeta, nil
}

func normalizeOpenAIToolMessage(msg openai.ChatCompletionToolMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
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
			"tool_call_id": msg.ToolCallID, // Keep as tool_call_id (unified format)
		},
	})

	// Extract message-level metadata
	messageMeta := map[string]interface{}{
		"source_format": "openai",
	}

	return "user", parts, messageMeta, nil
}

func normalizeOpenAIFunctionMessage(msg openai.ChatCompletionFunctionMessageParam) (string, []service.PartIn, map[string]interface{}, error) {
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
				"function_name": msg.Name, // Keep function_name for deprecated function format
			},
		},
	}

	// Extract message-level metadata
	messageMeta := map[string]interface{}{
		"source_format": "openai",
	}

	return "user", parts, messageMeta, nil
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
		meta := map[string]interface{}{}

		// Extract file_id if present
		if !param.IsOmitted(partUnion.OfFile.File.FileID) {
			meta["file_id"] = partUnion.OfFile.File.FileID.Value
		}

		// Extract base64 file_data if present
		if !param.IsOmitted(partUnion.OfFile.File.FileData) {
			meta["file_data"] = partUnion.OfFile.File.FileData.Value
		}

		// Extract filename if present
		if !param.IsOmitted(partUnion.OfFile.File.Filename) {
			meta["filename"] = partUnion.OfFile.File.Filename.Value
		}

		return service.PartIn{
			Type: "file",
			Meta: meta,
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
