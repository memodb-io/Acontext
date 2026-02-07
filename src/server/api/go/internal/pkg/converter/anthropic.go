package converter

import (
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/normalizer"
)

// AnthropicConverter converts messages to Anthropic Claude-compatible format using official SDK types.
type AnthropicConverter struct{}

func (c *AnthropicConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	result := make([]anthropic.MessageParam, 0, len(messages))

	for _, msg := range messages {
		anthropicMsg := c.convertMessage(msg, publicURLs)
		result = append(result, anthropicMsg)
	}

	return result, nil
}

func (c *AnthropicConverter) convertMessage(msg model.Message, publicURLs map[string]service.PublicURL) anthropic.MessageParam {
	role := c.convertRole(msg.Role)
	contentBlocks := c.convertParts(msg.Parts, publicURLs)

	if role == model.RoleUser {
		return anthropic.NewUserMessage(contentBlocks...)
	}
	return anthropic.NewAssistantMessage(contentBlocks...)
}

func (c *AnthropicConverter) convertRole(role string) string {
	switch role {
	case model.RoleAssistant:
		return model.RoleAssistant
	case model.RoleUser, "tool", "function":
		return model.RoleUser
	default:
		return model.RoleUser
	}
}

func (c *AnthropicConverter) convertParts(parts []model.Part, publicURLs map[string]service.PublicURL) []anthropic.ContentBlockParamUnion {
	contentBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(parts))

	for _, part := range parts {
		switch part.Type {
		case model.PartTypeText:
			if part.Text != "" {
				if cacheControl := normalizer.BuildAnthropicCacheControl(part.Meta); cacheControl != nil {
					blockParam := anthropic.TextBlockParam{
						Text:         part.Text,
						CacheControl: *cacheControl,
					}
					result := anthropic.ContentBlockParamUnion{}
					result.OfText = &blockParam
					contentBlocks = append(contentBlocks, result)
				} else {
					contentBlocks = append(contentBlocks, anthropic.NewTextBlock(part.Text))
				}
			}

		case model.PartTypeImage:
			imageBlock := c.convertImagePart(part, publicURLs)
			if imageBlock != nil {
				contentBlocks = append(contentBlocks, *imageBlock)
			}

		case model.PartTypeToolCall:
			if part.Meta != nil {
				toolUseBlock := c.convertToolCallPart(part)
				if toolUseBlock != nil {
					contentBlocks = append(contentBlocks, *toolUseBlock)
				}
			}

		case model.PartTypeToolResult:
			toolResultBlock := c.convertToolResultPart(part)
			if toolResultBlock != nil {
				contentBlocks = append(contentBlocks, *toolResultBlock)
			}

		case model.PartTypeFile:
			if part.Meta != nil {
				docBlock := c.convertDocumentPart(part, publicURLs)
				if docBlock != nil {
					contentBlocks = append(contentBlocks, *docBlock)
				}
			}

		case model.PartTypeThinking:
			if part.Text != "" {
				signature := part.Signature()
				block := anthropic.NewThinkingBlock(signature, part.Text)
				contentBlocks = append(contentBlocks, block)
			}
		}
	}

	return contentBlocks
}

func (c *AnthropicConverter) convertImagePart(part model.Part, publicURLs map[string]service.PublicURL) *anthropic.ContentBlockParamUnion {
	imageURL := GetAssetURL(part.Asset, publicURLs)
	if imageURL == "" && part.Meta != nil {
		if url := part.GetMetaString(model.MetaKeyURL); url != "" {
			imageURL = url
		}
	}

	if imageURL == "" {
		return nil
	}

	if strings.HasPrefix(imageURL, "data:") {
		mediaType, base64Data := ParseDataURL(imageURL)
		if base64Data == "" {
			return nil
		}
		block := anthropic.NewImageBlockBase64(mediaType, base64Data)
		return &block
	}

	if base64Data, mediaType := DownloadImageAsBase64(imageURL); base64Data != "" {
		block := anthropic.NewImageBlockBase64(mediaType, base64Data)
		return &block
	}

	return nil
}

func (c *AnthropicConverter) convertToolCallPart(part model.Part) *anthropic.ContentBlockParamUnion {
	if part.Meta == nil {
		return nil
	}

	id := part.ID()
	name := part.Name()

	if id == "" || name == "" {
		return nil
	}

	input := ParseToolArguments(part.Meta[model.MetaKeyArguments])

	block := anthropic.NewToolUseBlock(id, input, name)
	return &block
}

func (c *AnthropicConverter) convertToolResultPart(part model.Part) *anthropic.ContentBlockParamUnion {
	toolUseID := part.ToolCallID()
	isError := part.IsError()

	if toolUseID == "" {
		return nil
	}

	block := anthropic.NewToolResultBlock(toolUseID, part.Text, isError)
	return &block
}

func (c *AnthropicConverter) convertDocumentPart(part model.Part, publicURLs map[string]service.PublicURL) *anthropic.ContentBlockParamUnion {
	if part.Meta == nil {
		return nil
	}

	if sourceType := part.GetMetaString(model.MetaKeySourceType); sourceType != "" {
		switch sourceType {
		case "base64":
			mediaType := part.GetMetaString(model.MetaKeyMediaType)
			data := part.GetMetaString(model.MetaKeyData)
			if mediaType != "" && data != "" {
				source := anthropic.Base64PDFSourceParam{
					Data: data,
				}
				block := anthropic.NewDocumentBlock(source)
				return &block
			}
		case "url":
			url := part.GetMetaString(model.MetaKeyURL)
			if url != "" {
				source := anthropic.URLPDFSourceParam{
					URL: url,
				}
				block := anthropic.NewDocumentBlock(source)
				return &block
			}
		}
	}

	return nil
}
