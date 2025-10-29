package normalizer

import (
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/service"
)

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

// CacheControl represents cache control configuration
type CacheControl struct {
	Type string `json:"type"` // "ephemeral"
	TTL  *int   `json:"ttl,omitempty"`
}

// ExtractAnthropicCacheControl extracts cache control from Anthropic CacheControlEphemeralParam
func ExtractAnthropicCacheControl(cc anthropic.CacheControlEphemeralParam) map[string]interface{} {
	cacheControl := map[string]interface{}{
		"type": string(cc.Type),
	}

	return cacheControl
}

// BuildAnthropicCacheControl builds Anthropic CacheControlEphemeralParam from meta
func BuildAnthropicCacheControl(meta map[string]any) *anthropic.CacheControlEphemeralParam {
	if meta == nil {
		return nil
	}

	cacheControlData, ok := meta["cache_control"].(map[string]interface{})
	if !ok {
		return nil
	}

	controlType, ok := cacheControlData["type"].(string)
	if !ok || controlType != "ephemeral" {
		return nil
	}

	param := anthropic.NewCacheControlEphemeralParam()
	return &param
}
