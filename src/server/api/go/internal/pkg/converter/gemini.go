package converter

import (
	"encoding/base64"
	"encoding/json"
	"strings"

	"google.golang.org/genai"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// GeminiConverter converts messages to Google Gemini-compatible format using official SDK types.
type GeminiConverter struct{}

func (c *GeminiConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	// First pass: collect tool-call IDs and their function names
	toolCallIDToName := make(map[string]string)
	for _, msg := range messages {
		if msg.Role == model.RoleAssistant {
			for _, part := range msg.Parts {
				if part.Type == model.PartTypeToolCall {
					if id := part.ID(); id != "" {
						if name := part.Name(); name != "" {
							toolCallIDToName[id] = name
						}
					}
				}
			}
		}
	}

	// Second pass: convert messages using the mapping
	result := make([]*genai.Content, 0, len(messages))
	for _, msg := range messages {
		geminiContent := c.convertMessage(msg, publicURLs, toolCallIDToName)
		if geminiContent != nil {
			result = append(result, geminiContent)
		}
	}

	return result, nil
}

func (c *GeminiConverter) convertMessage(msg model.Message, publicURLs map[string]service.PublicURL, toolCallIDToName map[string]string) *genai.Content {
	role := c.convertRole(msg.Role)
	if role == "" {
		return nil
	}

	parts := c.convertParts(msg.Parts, publicURLs, toolCallIDToName)
	if len(parts) == 0 {
		return nil
	}

	return &genai.Content{
		Role:  role,
		Parts: parts,
	}
}

func (c *GeminiConverter) convertRole(role string) string {
	switch role {
	case model.RoleUser:
		return "user"
	case model.RoleAssistant:
		return "model"
	default:
		return ""
	}
}

func (c *GeminiConverter) convertParts(parts []model.Part, publicURLs map[string]service.PublicURL, toolCallIDToName map[string]string) []*genai.Part {
	geminiParts := make([]*genai.Part, 0, len(parts))

	for _, part := range parts {
		switch part.Type {
		case model.PartTypeText:
			if part.Text != "" {
				geminiParts = append(geminiParts, &genai.Part{
					Text: part.Text,
				})
			}

		case model.PartTypeThinking:
			// Downgrade thinking blocks to plain text for Gemini format
			if part.Text != "" {
				geminiParts = append(geminiParts, &genai.Part{
					Text: part.Text,
				})
			}

		case model.PartTypeImage:
			imagePart := c.convertImagePart(part, publicURLs)
			if imagePart != nil {
				geminiParts = append(geminiParts, imagePart)
			}

		case model.PartTypeToolCall:
			if part.Meta != nil {
				functionCall := c.convertToolCallPart(part)
				if functionCall != nil {
					geminiParts = append(geminiParts, &genai.Part{
						FunctionCall: functionCall,
					})
				}
			}

		case model.PartTypeToolResult:
			if part.Meta != nil {
				functionResponse := c.convertToolResultPart(part, toolCallIDToName)
				if functionResponse != nil {
					geminiParts = append(geminiParts, &genai.Part{
						FunctionResponse: functionResponse,
					})
				}
			}
		}
	}

	return geminiParts
}

func (c *GeminiConverter) convertImagePart(part model.Part, publicURLs map[string]service.PublicURL) *genai.Part {
	imageURL := GetAssetURL(part.Asset, publicURLs)
	if imageURL == "" && part.Meta != nil {
		if url := part.GetMetaString(model.MetaKeyURL); url != "" {
			imageURL = url
		}
	}

	if imageURL == "" {
		return nil
	}

	var base64Data string
	var mimeType string

	if strings.HasPrefix(imageURL, "data:") {
		mimeType, base64Data = ParseDataURL(imageURL)
	} else {
		base64Data, mimeType = DownloadImageAsBase64(imageURL)
	}

	if base64Data == "" {
		return nil
	}

	dataBytes, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil
	}

	return &genai.Part{
		InlineData: &genai.Blob{
			MIMEType: mimeType,
			Data:     dataBytes,
		},
	}
}

func (c *GeminiConverter) convertToolCallPart(part model.Part) *genai.FunctionCall {
	if part.Meta == nil {
		return nil
	}

	name := part.Name()
	if name == "" {
		return nil
	}

	args := ParseToolArgumentsMap(part.Meta[model.MetaKeyArguments])

	functionCall := &genai.FunctionCall{
		Name: name,
		Args: args,
	}

	if id := part.ID(); id != "" {
		functionCall.ID = id
	}

	return functionCall
}

func (c *GeminiConverter) convertToolResultPart(part model.Part, toolCallIDToName map[string]string) *genai.FunctionResponse {
	if part.Meta == nil {
		return nil
	}

	name := part.Name()
	if name == "" {
		// Try to get name from tool_call_id mapping
		if toolCallID := part.ToolCallID(); toolCallID != "" {
			if mappedName, found := toolCallIDToName[toolCallID]; found {
				name = mappedName
			}
		}
		if name == "" {
			return nil
		}
	}

	// Parse response
	var response map[string]interface{}
	if part.Text != "" {
		if err := json.Unmarshal([]byte(part.Text), &response); err != nil {
			response = map[string]interface{}{
				"output": part.Text,
			}
		}
	} else {
		response = make(map[string]interface{})
	}

	functionResponse := &genai.FunctionResponse{
		Name:     name,
		Response: response,
	}

	if toolCallID := part.ToolCallID(); toolCallID != "" {
		functionResponse.ID = toolCallID
	}

	return functionResponse
}
