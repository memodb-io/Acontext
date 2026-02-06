package converter

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"google.golang.org/genai"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// GeminiConverter converts messages to Google Gemini-compatible format using official SDK types
type GeminiConverter struct{}

func (c *GeminiConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	// First pass: collect tool-call IDs and their function names
	// This mapping is needed because Gemini FunctionResponse requires function name,
	// but tool-result parts may only have tool_call_id
	toolCallIDToName := make(map[string]string)
	for _, msg := range messages {
		if msg.Role == "assistant" {
			for _, part := range msg.Parts {
				if part.Type == "tool-call" && part.Meta != nil {
					if id, ok := part.Meta["id"].(string); ok && id != "" {
						if name, ok := part.Meta["name"].(string); ok && name != "" {
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

	// Convert parts to Gemini parts
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
	// Gemini roles: "user", "model"
	switch role {
	case "user":
		return "user"
	case "assistant":
		return "model"
	default:
		return "" // Invalid role
	}
}

func (c *GeminiConverter) convertParts(parts []model.Part, publicURLs map[string]service.PublicURL, toolCallIDToName map[string]string) []*genai.Part {
	geminiParts := make([]*genai.Part, 0, len(parts))

	for _, part := range parts {
		switch part.Type {
		case "text":
			if part.Text != "" {
				geminiParts = append(geminiParts, &genai.Part{
					Text: part.Text,
				})
			}

		case "thinking":
			// Downgrade thinking blocks to plain text for Gemini format
			if part.Text != "" {
				geminiParts = append(geminiParts, &genai.Part{
					Text: part.Text,
				})
			}

		case "image":
			imagePart := c.convertImagePart(part, publicURLs)
			if imagePart != nil {
				geminiParts = append(geminiParts, imagePart)
			}

		case "tool-call":
			// UNIFIED FORMAT: Convert tool-call to Gemini FunctionCall
			if part.Meta != nil {
				functionCall := c.convertToolCallPart(part)
				if functionCall != nil {
					geminiParts = append(geminiParts, &genai.Part{
						FunctionCall: functionCall,
					})
				}
			}

		case "tool-result":
			// UNIFIED FORMAT: Convert tool-result to Gemini FunctionResponse
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
	var base64Data string
	var mimeType string

	if strings.HasPrefix(imageURL, "data:") {
		// Extract base64 data and media type
		parts := strings.SplitN(imageURL, ",", 2)
		if len(parts) != 2 {
			return nil
		}

		// Parse media type from data URL (e.g., "data:image/png;base64")
		mimeType = "image/png" // default
		if strings.Contains(parts[0], ":") && strings.Contains(parts[0], ";") {
			typePart := strings.Split(parts[0], ":")[1]
			mimeType = strings.Split(typePart, ";")[0]
		}

		base64Data = parts[1]
	} else {
		// Try to download and convert to base64
		var err error
		base64Data, mimeType, err = c.downloadImageAsBase64(imageURL)
		if err != nil {
			return nil
		}
	}

	if base64Data == "" {
		return nil
	}

	// Decode base64 string to bytes
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

	// UNIFIED FORMAT: Extract from unified field names
	name, _ := part.Meta["name"].(string)
	if name == "" {
		return nil
	}

	// Parse arguments (unified field name)
	var args map[string]interface{}
	if argsStr, ok := part.Meta["arguments"].(string); ok {
		// Arguments is JSON string, unmarshal it
		if err := json.Unmarshal([]byte(argsStr), &args); err != nil {
			args = make(map[string]interface{})
		}
	} else if argsObj, ok := part.Meta["arguments"].(map[string]interface{}); ok {
		args = argsObj
	} else {
		args = make(map[string]interface{})
	}

	functionCall := &genai.FunctionCall{
		Name: name,
		Args: args,
	}

	// Set ID if present (Gemini FunctionCall.ID is optional)
	if id, ok := part.Meta["id"].(string); ok && id != "" {
		functionCall.ID = id
	}

	return functionCall
}

func (c *GeminiConverter) convertToolResultPart(part model.Part, toolCallIDToName map[string]string) *genai.FunctionResponse {
	if part.Meta == nil {
		return nil
	}

	// UNIFIED FORMAT: Use tool_call_id (unified field name)
	name, _ := part.Meta["name"].(string)
	if name == "" {
		// Try to get name from tool_call_id mapping
		if toolCallID, ok := part.Meta["tool_call_id"].(string); ok {
			if mappedName, found := toolCallIDToName[toolCallID]; found {
				name = mappedName
			}
		}
		// If still no name, we can't create FunctionResponse
		if name == "" {
			return nil
		}
	}

	// Parse response (can be string or object)
	// Gemini FunctionResponse.Response is map[string]any
	var response map[string]interface{}
	if part.Text != "" {
		// Try to parse as JSON
		if err := json.Unmarshal([]byte(part.Text), &response); err != nil {
			// If not JSON, wrap as "output" key
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

	// Set ID if present (Gemini FunctionResponse.ID is optional)
	// This ID should match the FunctionCall.ID to link the response to the call
	if toolCallID, ok := part.Meta["tool_call_id"].(string); ok && toolCallID != "" {
		functionResponse.ID = toolCallID
	}

	return functionResponse
}

func (c *GeminiConverter) downloadImageAsBase64(imageURL string) (string, string, error) {
	resp, err := http.Get(imageURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", err
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	// Determine media type
	mimeType := resp.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/png" // default
	}

	// Encode to base64
	base64Data := base64.StdEncoding.EncodeToString(data)

	return base64Data, mimeType, nil
}

func (c *GeminiConverter) getAssetURL(asset *model.Asset, publicURLs map[string]service.PublicURL) string {
	if asset == nil {
		return ""
	}
	assetKey := asset.S3Key
	if publicURL, ok := publicURLs[assetKey]; ok {
		return publicURL.URL
	}
	return ""
}
