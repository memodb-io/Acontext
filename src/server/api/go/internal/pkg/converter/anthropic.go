package converter

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/normalizer"
)

// AnthropicConverter converts messages to Anthropic Claude-compatible format using official SDK types
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

	// Convert parts to content blocks
	contentBlocks := c.convertParts(msg.Parts, publicURLs)

	if role == "user" {
		return anthropic.NewUserMessage(contentBlocks...)
	} else {
		return anthropic.NewAssistantMessage(contentBlocks...)
	}
}

func (c *AnthropicConverter) convertRole(role string) string {
	// Anthropic roles: "user", "assistant"
	switch role {
	case "assistant":
		return "assistant"
	case "user", "tool", "function":
		return "user"
	default:
		return "user"
	}
}

func (c *AnthropicConverter) convertParts(parts []model.Part, publicURLs map[string]service.PublicURL) []anthropic.ContentBlockParamUnion {
	contentBlocks := make([]anthropic.ContentBlockParamUnion, 0, len(parts))

	for _, part := range parts {
		switch part.Type {
		case "text":
			if part.Text != "" {
				// Check if cache_control is present
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

		case "image":
			imageBlock := c.convertImagePart(part, publicURLs)
			if imageBlock != nil {
				contentBlocks = append(contentBlocks, *imageBlock)
			}

		case "tool-call":
			// UNIFIED FORMAT: Convert tool-call to Anthropic tool_use
			if part.Meta != nil {
				toolUseBlock := c.convertToolCallPart(part)
				if toolUseBlock != nil {
					contentBlocks = append(contentBlocks, *toolUseBlock)
				}
			}

		case "tool-result":
			toolResultBlock := c.convertToolResultPart(part)
			if toolResultBlock != nil {
				contentBlocks = append(contentBlocks, *toolResultBlock)
			}

		case "file":
			// Convert file to document block
			if part.Meta != nil {
				docBlock := c.convertDocumentPart(part, publicURLs)
				if docBlock != nil {
					contentBlocks = append(contentBlocks, *docBlock)
				}
			}

		case "thinking":
			// Convert thinking block back to Anthropic ThinkingBlockParam
			signature, _ := part.Meta["signature"].(string)
			block := anthropic.NewThinkingBlock(signature, part.Text)
			contentBlocks = append(contentBlocks, block)
		}
	}

	return contentBlocks
}

func (c *AnthropicConverter) convertImagePart(part model.Part, publicURLs map[string]service.PublicURL) *anthropic.ContentBlockParamUnion {
	// Try to get image URL from asset
	imageURL := c.getAssetURL(part.Asset, publicURLs)
	if imageURL == "" && part.Meta != nil {
		if url, ok := part.Meta["url"].(string); ok {
			imageURL = url
		}
	}

	if imageURL == "" {
		return nil
	}

	// Check if it's a base64 data URL or regular URL
	if strings.HasPrefix(imageURL, "data:") {
		// Extract base64 data and media type
		parts := strings.SplitN(imageURL, ",", 2)
		if len(parts) != 2 {
			return nil
		}

		// Parse media type from data URL (e.g., "data:image/png;base64")
		mediaType := "image/png" // default
		if strings.Contains(parts[0], ":") && strings.Contains(parts[0], ";") {
			typePart := strings.Split(parts[0], ":")[1]
			mediaType = strings.Split(typePart, ";")[0]
		}

		block := anthropic.NewImageBlockBase64(mediaType, parts[1])
		return &block
	}

	// Try to download and convert to base64
	if base64Data, mediaType := c.downloadImageAsBase64(imageURL); base64Data != "" {
		block := anthropic.NewImageBlockBase64(mediaType, base64Data)
		return &block
	}

	// Fall back to URL if available (note: Anthropic might not support URL directly for images in some contexts)
	// In practice, we convert to base64
	return nil
}

func (c *AnthropicConverter) convertToolCallPart(part model.Part) *anthropic.ContentBlockParamUnion {
	if part.Meta == nil {
		return nil
	}

	// UNIFIED FORMAT: Extract from unified field names
	id, _ := part.Meta["id"].(string)
	name, _ := part.Meta["name"].(string) // Unified field name

	if id == "" || name == "" {
		return nil
	}

	// Parse arguments (unified field name)
	var input interface{}
	if argsStr, ok := part.Meta["arguments"].(string); ok {
		// Arguments is JSON string, unmarshal it
		if err := json.Unmarshal([]byte(argsStr), &input); err != nil {
			input = map[string]interface{}{}
		}
	} else {
		// Arguments is already an object
		input = part.Meta["arguments"]
	}

	block := anthropic.NewToolUseBlock(id, input, name)
	return &block
}

func (c *AnthropicConverter) convertToolResultPart(part model.Part) *anthropic.ContentBlockParamUnion {
	// UNIFIED FORMAT: Use tool_call_id (unified field name)
	toolUseID := ""
	isError := false

	if part.Meta != nil {
		if id, ok := part.Meta["tool_call_id"].(string); ok { // Unified field name
			toolUseID = id
		}
		if err, ok := part.Meta["is_error"].(bool); ok {
			isError = err
		}
	}

	if toolUseID == "" {
		return nil
	}

	block := anthropic.NewToolResultBlock(toolUseID, part.Text, isError)
	return &block
}

func (c *AnthropicConverter) convertDocumentPart(part model.Part, publicURLs map[string]service.PublicURL) *anthropic.ContentBlockParamUnion {
	// Try to get document URL or base64 data from meta
	if part.Meta == nil {
		return nil
	}

	if sourceType, ok := part.Meta["type"].(string); ok {
		switch sourceType {
		case "base64":
			mediaType, _ := part.Meta["media_type"].(string)
			data, _ := part.Meta["data"].(string)
			if mediaType != "" && data != "" {
				// Use Base64PDFSourceParam for PDF documents (type and media_type fields have default values)
				source := anthropic.Base64PDFSourceParam{
					Data: data,
				}
				block := anthropic.NewDocumentBlock(source)
				return &block
			}
		case "url":
			url, _ := part.Meta["url"].(string)
			if url != "" {
				// Use URLPDFSourceParam for URL documents
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

func (c *AnthropicConverter) downloadImageAsBase64(imageURL string) (string, string) {
	resp, err := http.Get(imageURL)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", ""
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", ""
	}

	// Determine media type
	mediaType := resp.Header.Get("Content-Type")
	if mediaType == "" {
		mediaType = "image/png" // default
	}

	// Encode to base64
	base64Data := base64.StdEncoding.EncodeToString(data)

	return base64Data, mediaType
}

func (c *AnthropicConverter) getAssetURL(asset *model.Asset, publicURLs map[string]service.PublicURL) string {
	if asset == nil {
		return ""
	}
	assetKey := asset.S3Key
	if publicURL, ok := publicURLs[assetKey]; ok {
		return publicURL.URL
	}
	return ""
}
