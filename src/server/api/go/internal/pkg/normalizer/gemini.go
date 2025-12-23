package normalizer

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"google.golang.org/genai"

	"github.com/memodb-io/Acontext/internal/modules/service"
)

// GeminiNormalizer normalizes Google Gemini format to internal format using official SDK types
type GeminiNormalizer struct{}

// NormalizeFromGeminiMessage converts Google Gemini Content to internal format
// Returns: role, parts, messageMeta, error
func (n *GeminiNormalizer) NormalizeFromGeminiMessage(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	// Parse using official Google Gemini SDK types
	var content genai.Content
	if err := json.Unmarshal(messageJSON, &content); err != nil {
		return "", nil, nil, fmt.Errorf("failed to unmarshal Gemini message: %w", err)
	}

	// Convert role: "user" or "model" -> "user" or "assistant"
	role := normalizeGeminiRole(content.Role)
	if role == "" {
		return "", nil, nil, fmt.Errorf("invalid Gemini role: %s (only 'user' and 'model' are supported)", content.Role)
	}

	// Convert parts
	// IMPORTANT: Gemini FunctionCall.ID and FunctionResponse.ID are required for proper matching.
	// Since FunctionCall and FunctionResponse are in different messages (different roles),
	// we cannot match them without IDs. The user must provide matching IDs in Gemini format.
	parts := []service.PartIn{}
	for _, part := range content.Parts {
		partIn, err := normalizeGeminiPart(part)
		if err != nil {
			return "", nil, nil, err
		}
		parts = append(parts, partIn)
	}

	// Extract message-level metadata
	messageMeta := map[string]interface{}{
		"source_format": "gemini",
	}

	return role, parts, messageMeta, nil
}

func normalizeGeminiRole(role string) string {
	// Gemini roles: "user", "model" -> internal: "user", "assistant"
	switch role {
	case "user":
		return "user"
	case "model":
		return "assistant"
	default:
		return ""
	}
}

func normalizeGeminiPart(part *genai.Part) (service.PartIn, error) {
	if part == nil {
		return service.PartIn{}, fmt.Errorf("nil part")
	}

	// Handle text part
	if part.Text != "" {
		return service.PartIn{
			Type: "text",
			Text: part.Text,
		}, nil
	}

	// Handle image part (InlineData)
	if part.InlineData != nil {
		// Convert []byte to base64 string
		dataBase64 := base64.StdEncoding.EncodeToString(part.InlineData.Data)
		meta := map[string]interface{}{
			"type":       "base64",
			"media_type": part.InlineData.MIMEType,
			"data":       dataBase64,
		}
		return service.PartIn{
			Type: "image",
			Meta: meta,
		}, nil
	}

	// Handle function call part
	if part.FunctionCall != nil {
		// Convert args to JSON string
		argsBytes, err := json.Marshal(part.FunctionCall.Args)
		if err != nil {
			return service.PartIn{}, fmt.Errorf("failed to marshal function call args: %w", err)
		}

		// UNIFIED FORMAT: tool-call with unified field names
		// Require ID for proper matching with FunctionResponse
		if part.FunctionCall.ID == "" {
			return service.PartIn{}, fmt.Errorf("FunctionCall.ID is required but missing (function: %s)", part.FunctionCall.Name)
		}

		meta := map[string]interface{}{
			"id":        part.FunctionCall.ID,
			"name":      part.FunctionCall.Name,
			"arguments": string(argsBytes),
			"type":      "function",
		}

		return service.PartIn{
			Type: "tool-call",
			Meta: meta,
		}, nil
	}

	// Handle function response part
	if part.FunctionResponse != nil {
		// Convert response to text (Response is map[string]any)
		var responseText string
		responseBytes, err := json.Marshal(part.FunctionResponse.Response)
		if err != nil {
			responseText = ""
		} else {
			responseText = string(responseBytes)
		}

		// UNIFIED FORMAT: tool-result with unified field names
		// Require ID for proper matching with FunctionCall
		// IMPORTANT: We cannot use function name to match because:
		// 1. FunctionCall and FunctionResponse are in different messages (different roles)
		// 2. Multiple FunctionCalls with the same name would cause ambiguity
		// 3. The user must provide matching IDs in Gemini format for proper matching
		if part.FunctionResponse.ID == "" {
			return service.PartIn{}, fmt.Errorf("FunctionResponse.ID is required but missing (function: %s)", part.FunctionResponse.Name)
		}

		meta := map[string]interface{}{
			"name":         part.FunctionResponse.Name,
			"tool_call_id": part.FunctionResponse.ID,
		}

		return service.PartIn{
			Type: "tool-result",
			Text: responseText,
			Meta: meta,
		}, nil
	}

	return service.PartIn{}, fmt.Errorf("unsupported Gemini part type")
}
