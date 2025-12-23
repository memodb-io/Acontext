package normalizer

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"google.golang.org/genai"

	"github.com/memodb-io/Acontext/internal/modules/model"
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
	// we cannot match them without IDs. If IDs are missing, we generate them and store in meta.
	// We store both ID and name to enable name-based matching and validation.
	parts := []service.PartIn{}
	generatedCalls := []map[string]interface{}{} // Collect {id, name} pairs for FunctionCalls

	for _, part := range content.Parts {
		partIn, generatedCall, err := normalizeGeminiPart(part)
		if err != nil {
			return "", nil, nil, err
		}
		parts = append(parts, partIn)
		// Collect generated call info (id and name)
		if generatedCall != nil {
			generatedCalls = append(generatedCalls, generatedCall)
		}
	}

	// Extract message-level metadata
	messageMeta := map[string]interface{}{
		"source_format": "gemini",
	}

	// Add generated call info (id and name pairs) to message meta if any were generated
	if len(generatedCalls) > 0 {
		messageMeta[model.GeminiCallInfoKey] = generatedCalls
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

func normalizeGeminiPart(part *genai.Part) (service.PartIn, map[string]interface{}, error) {
	// Returns: PartIn, generatedCall (if FunctionCall ID was generated, contains {id, name}), error
	if part == nil {
		return service.PartIn{}, nil, fmt.Errorf("nil part")
	}

	// Handle text part
	if part.Text != "" {
		return service.PartIn{
			Type: "text",
			Text: part.Text,
		}, nil, nil
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
		}, nil, nil
	}

	// Handle function call part
	if part.FunctionCall != nil {
		// Convert args to JSON string
		argsBytes, err := json.Marshal(part.FunctionCall.Args)
		if err != nil {
			return service.PartIn{}, nil, fmt.Errorf("failed to marshal function call args: %w", err)
		}

		// UNIFIED FORMAT: tool-call with unified field names
		// Generate ID if missing for proper matching with FunctionResponse
		callID := part.FunctionCall.ID
		var generatedCall map[string]interface{}
		if callID == "" {
			// Generate short random ID in format: call_xxx
			// Use first 8 characters of UUID (without hyphens) for brevity
			uuidStr := uuid.New().String()
			shortID := uuidStr[:8] // Take first 8 hex characters
			callID = "call_" + shortID
			// Store both ID and name for name-based matching
			generatedCall = map[string]interface{}{
				"id":   callID,
				"name": part.FunctionCall.Name,
			}
		}

		meta := map[string]interface{}{
			"id":        callID,
			"name":      part.FunctionCall.Name,
			"arguments": string(argsBytes),
			"type":      "function",
		}

		return service.PartIn{
			Type: "tool-call",
			Meta: meta,
		}, generatedCall, nil
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
		// If ID is missing, it will be resolved by the service layer before storing
		// IMPORTANT: We cannot use function name to match because:
		// 1. FunctionCall and FunctionResponse are in different messages (different roles)
		// 2. Multiple FunctionCalls with the same name would cause ambiguity
		// 3. If ID is missing, the service layer will resolve it from stored call IDs
		meta := map[string]interface{}{
			"name": part.FunctionResponse.Name,
		}

		// Only set tool_call_id if ID is provided
		// If missing, service layer will resolve it before storing
		if part.FunctionResponse.ID != "" {
			meta["tool_call_id"] = part.FunctionResponse.ID
		}

		return service.PartIn{
			Type: "tool-result",
			Text: responseText,
			Meta: meta,
		}, nil, nil
	}

	return service.PartIn{}, nil, fmt.Errorf("unsupported Gemini part type")
}
