package normalizer

import (
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/openai/openai-go/v3/packages/param"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// AnthropicNormalizer normalizes Anthropic format to internal format using official SDK types.
type AnthropicNormalizer struct{}

// Normalize converts Anthropic MessageParam to internal format.
func (n *AnthropicNormalizer) Normalize(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	var message anthropic.MessageParam
	if err := message.UnmarshalJSON(messageJSON); err != nil {
		return "", nil, nil, fmt.Errorf("failed to unmarshal Anthropic message: %w", err)
	}

	role := string(message.Role)
	if role != model.RoleUser && role != model.RoleAssistant {
		return "", nil, nil, fmt.Errorf("invalid Anthropic role: %s (only 'user' and 'assistant' are supported)", role)
	}

	parts := []service.PartIn{}
	for _, blockUnion := range message.Content {
		part, err := normalizeAnthropicContentBlock(blockUnion)
		if err != nil {
			return "", nil, nil, err
		}
		if part.Type == "" {
			continue
		}
		parts = append(parts, part)
	}

	messageMeta := map[string]interface{}{
		model.MsgMetaSourceFormat: "anthropic",
	}

	return role, parts, messageMeta, nil
}

// NormalizeFromAnthropicMessage is a backward-compatible alias for Normalize.
// Deprecated: Use Normalize() via the MessageNormalizer interface instead.
func (n *AnthropicNormalizer) NormalizeFromAnthropicMessage(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	return n.Normalize(messageJSON)
}

func normalizeAnthropicContentBlock(blockUnion anthropic.ContentBlockParamUnion) (service.PartIn, error) {
	if blockUnion.OfText != nil {
		part := service.PartIn{
			Type: model.PartTypeText,
			Text: blockUnion.OfText.Text,
		}

		if blockUnion.OfText.CacheControl.Type != "" {
			part.Meta = map[string]interface{}{
				model.MetaKeyCacheControl: ExtractAnthropicCacheControl(blockUnion.OfText.CacheControl),
			}
		}

		return part, nil
	} else if blockUnion.OfImage != nil {
		meta := map[string]interface{}{}
		if blockUnion.OfImage.Source.OfBase64 != nil {
			meta[model.MetaKeySourceType] = "base64"
			meta[model.MetaKeyMediaType] = blockUnion.OfImage.Source.OfBase64.MediaType
			meta[model.MetaKeyData] = blockUnion.OfImage.Source.OfBase64.Data
		} else if blockUnion.OfImage.Source.OfURL != nil {
			meta[model.MetaKeySourceType] = "url"
			meta[model.MetaKeyURL] = blockUnion.OfImage.Source.OfURL.URL
		}

		if blockUnion.OfImage.CacheControl.Type != "" {
			meta[model.MetaKeyCacheControl] = ExtractAnthropicCacheControl(blockUnion.OfImage.CacheControl)
		}

		return service.PartIn{
			Type: model.PartTypeImage,
			Meta: meta,
		}, nil
	} else if blockUnion.OfToolUse != nil {
		argsBytes, err := json.Marshal(blockUnion.OfToolUse.Input)
		if err != nil {
			return service.PartIn{}, fmt.Errorf("failed to marshal tool input: %w", err)
		}

		meta := map[string]interface{}{
			model.MetaKeyID:         blockUnion.OfToolUse.ID,
			model.MetaKeyName:       blockUnion.OfToolUse.Name,
			model.MetaKeyArguments:  string(argsBytes),
			model.MetaKeySourceType: "tool_use",
		}

		if blockUnion.OfToolUse.CacheControl.Type != "" {
			meta[model.MetaKeyCacheControl] = ExtractAnthropicCacheControl(blockUnion.OfToolUse.CacheControl)
		}

		return service.PartIn{
			Type: model.PartTypeToolCall,
			Meta: meta,
		}, nil
	} else if blockUnion.OfToolResult != nil {
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
			model.MetaKeyToolCallID: blockUnion.OfToolResult.ToolUseID,
			model.MetaKeyIsError:    isError,
		}

		if blockUnion.OfToolResult.CacheControl.Type != "" {
			meta[model.MetaKeyCacheControl] = ExtractAnthropicCacheControl(blockUnion.OfToolResult.CacheControl)
		}

		return service.PartIn{
			Type: model.PartTypeToolResult,
			Text: resultText,
			Meta: meta,
		}, nil
	} else if blockUnion.OfDocument != nil {
		meta := map[string]interface{}{}
		if blockUnion.OfDocument.Source.OfBase64 != nil {
			meta[model.MetaKeySourceType] = "base64"
			meta[model.MetaKeyMediaType] = blockUnion.OfDocument.Source.OfBase64.MediaType
			meta[model.MetaKeyData] = blockUnion.OfDocument.Source.OfBase64.Data
		} else if blockUnion.OfDocument.Source.OfURL != nil {
			meta[model.MetaKeySourceType] = "url"
			meta[model.MetaKeyURL] = blockUnion.OfDocument.Source.OfURL.URL
		}

		if blockUnion.OfDocument.CacheControl.Type != "" {
			meta[model.MetaKeyCacheControl] = ExtractAnthropicCacheControl(blockUnion.OfDocument.CacheControl)
		}

		return service.PartIn{
			Type: model.PartTypeFile,
			Meta: meta,
		}, nil
	} else if blockUnion.OfThinking != nil {
		return service.PartIn{
			Type: model.PartTypeThinking,
			Text: blockUnion.OfThinking.Thinking,
			Meta: map[string]interface{}{
				model.MetaKeySignature: blockUnion.OfThinking.Signature,
			},
		}, nil
	}

	// Skip unsupported block types
	return service.PartIn{}, nil
}

// CacheControl represents cache control configuration.
type CacheControl struct {
	Type string `json:"type"` // "ephemeral"
	TTL  *int   `json:"ttl,omitempty"`
}

// ExtractAnthropicCacheControl extracts cache control from Anthropic CacheControlEphemeralParam.
func ExtractAnthropicCacheControl(cc anthropic.CacheControlEphemeralParam) map[string]interface{} {
	return map[string]interface{}{
		"type": string(cc.Type),
	}
}

// BuildAnthropicCacheControl builds Anthropic CacheControlEphemeralParam from meta.
func BuildAnthropicCacheControl(meta map[string]any) *anthropic.CacheControlEphemeralParam {
	if meta == nil {
		return nil
	}

	cacheControlData, ok := meta[model.MetaKeyCacheControl].(map[string]interface{})
	if !ok {
		return nil
	}

	controlType, ok := cacheControlData["type"].(string)
	if !ok || controlType != "ephemeral" {
		return nil
	}

	p := anthropic.NewCacheControlEphemeralParam()
	return &p
}
