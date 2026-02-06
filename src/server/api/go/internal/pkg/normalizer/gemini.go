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

// GeminiNormalizer normalizes Google Gemini format to internal format using official SDK types.
type GeminiNormalizer struct{}

// Normalize converts Google Gemini Content to internal format.
func (n *GeminiNormalizer) Normalize(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	var content genai.Content
	if err := json.Unmarshal(messageJSON, &content); err != nil {
		return "", nil, nil, fmt.Errorf("failed to unmarshal Gemini message: %w", err)
	}

	role := normalizeGeminiRole(content.Role)
	if role == "" {
		return "", nil, nil, fmt.Errorf("invalid Gemini role: %s (only 'user' and 'model' are supported)", content.Role)
	}

	parts := []service.PartIn{}
	generatedCalls := []map[string]interface{}{}

	for _, part := range content.Parts {
		partIn, generatedCall, err := normalizeGeminiPart(part)
		if err != nil {
			return "", nil, nil, err
		}
		parts = append(parts, partIn)
		if generatedCall != nil {
			generatedCalls = append(generatedCalls, generatedCall)
		}
	}

	messageMeta := map[string]interface{}{
		model.MsgMetaSourceFormat: "gemini",
	}

	if len(generatedCalls) > 0 {
		messageMeta[model.GeminiCallInfoKey] = generatedCalls
	}

	return role, parts, messageMeta, nil
}

// NormalizeFromGeminiMessage is a backward-compatible alias for Normalize.
// Deprecated: Use Normalize() via the MessageNormalizer interface instead.
func (n *GeminiNormalizer) NormalizeFromGeminiMessage(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	return n.Normalize(messageJSON)
}

func normalizeGeminiRole(role string) string {
	switch role {
	case "user":
		return model.RoleUser
	case "model":
		return model.RoleAssistant
	default:
		return ""
	}
}

func normalizeGeminiPart(part *genai.Part) (service.PartIn, map[string]interface{}, error) {
	if part == nil {
		return service.PartIn{}, nil, fmt.Errorf("nil part")
	}

	// Handle text part
	if part.Text != "" {
		return service.PartIn{
			Type: model.PartTypeText,
			Text: part.Text,
		}, nil, nil
	}

	// Handle image part (InlineData)
	if part.InlineData != nil {
		dataBase64 := base64.StdEncoding.EncodeToString(part.InlineData.Data)
		meta := map[string]interface{}{
			model.MetaKeySourceType: "base64",
			model.MetaKeyMediaType:  part.InlineData.MIMEType,
			model.MetaKeyData:       dataBase64,
		}
		return service.PartIn{
			Type: model.PartTypeImage,
			Meta: meta,
		}, nil, nil
	}

	// Handle function call part
	if part.FunctionCall != nil {
		argsBytes, err := json.Marshal(part.FunctionCall.Args)
		if err != nil {
			return service.PartIn{}, nil, fmt.Errorf("failed to marshal function call args: %w", err)
		}

		callID := part.FunctionCall.ID
		if callID == "" {
			uuidStr := uuid.New().String()
			shortID := uuidStr[:8]
			callID = "call_" + shortID
		}

		generatedCall := map[string]interface{}{
			model.MetaKeyID:   callID,
			model.MetaKeyName: part.FunctionCall.Name,
		}

		meta := map[string]interface{}{
			model.MetaKeyID:         callID,
			model.MetaKeyName:       part.FunctionCall.Name,
			model.MetaKeyArguments:  string(argsBytes),
			model.MetaKeySourceType: "function",
		}

		return service.PartIn{
			Type: model.PartTypeToolCall,
			Meta: meta,
		}, generatedCall, nil
	}

	// Handle function response part
	if part.FunctionResponse != nil {
		var responseText string
		responseBytes, err := json.Marshal(part.FunctionResponse.Response)
		if err != nil {
			responseText = ""
		} else {
			responseText = string(responseBytes)
		}

		meta := map[string]interface{}{
			model.MetaKeyName: part.FunctionResponse.Name,
		}

		if part.FunctionResponse.ID != "" {
			meta[model.MetaKeyToolCallID] = part.FunctionResponse.ID
		}

		return service.PartIn{
			Type: model.PartTypeToolResult,
			Text: responseText,
			Meta: meta,
		}, nil, nil
	}

	return service.PartIn{}, nil, fmt.Errorf("unsupported Gemini part type")
}
