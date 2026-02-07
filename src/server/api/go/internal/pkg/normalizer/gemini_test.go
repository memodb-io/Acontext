package normalizer

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"google.golang.org/genai"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
)

func TestGeminiNormalizer_NormalizeFromGeminiMessage(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	tests := []struct {
		name        string
		input       string
		wantRole    string
		wantPartCnt int
		wantErr     bool
		errContains string
	}{
		{
			name: "user message with text",
			input: `{
				"role": "user",
				"parts": [
					{"text": "Hello, how are you?"}
				]
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "model message with text",
			input: `{
				"role": "model",
				"parts": [
					{"text": "I'm doing well, thank you!"}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with image (inline data)",
			input: func() string {
				// Create a test image data
				imageData := []byte("fake image data")
				content := genai.Content{
					Role: "user",
					Parts: []*genai.Part{
						{
							Text: "What's in this image?",
						},
						{
							InlineData: &genai.Blob{
								MIMEType: "image/jpeg",
								Data:     imageData,
							},
						},
					},
				}
				jsonBytes, _ := json.Marshal(content)
				return string(jsonBytes)
			}(),
			wantRole:    model.RoleUser,
			wantPartCnt: 2,
			wantErr:     false,
		},
		{
			name: "model message with function call",
			input: `{
				"role": "model",
				"parts": [
					{
						"functionCall": {
							"id": "call_123",
							"name": "get_weather",
							"args": {"location": "San Francisco"}
						}
					}
				]
			}`,
			wantRole:    model.RoleAssistant,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "user message with function response",
			input: `{
				"role": "user",
				"parts": [
					{
						"functionResponse": {
							"id": "call_123",
							"name": "get_weather",
							"response": {"output": "Temperature: 72F"}
						}
					}
				]
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 1,
			wantErr:     false,
		},
		{
			name: "invalid role",
			input: `{
				"role": "system",
				"parts": [
					{"text": "System message"}
				]
			}`,
			wantErr:     true,
			errContains: "invalid Gemini role",
		},
		{
			name: "empty parts",
			input: `{
				"role": "user",
				"parts": []
			}`,
			wantRole:    model.RoleUser,
			wantPartCnt: 0,
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(tt.input))

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantRole, role)
				assert.Len(t, parts, tt.wantPartCnt)
				// Verify message metadata
				assert.NotNil(t, messageMeta)
				assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
			}
		})
	}
}

func TestGeminiNormalizer_FunctionCall(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	input := `{
		"role": "model",
		"parts": [
			{
				"functionCall": {
					"id": "call_123",
					"name": "calculate",
					"args": {"x": 5, "y": 3}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleAssistant, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeToolCall, parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "calculate", parts[0].Meta[model.MetaKeyName])
	assert.Equal(t, "call_123", parts[0].Meta[model.MetaKeyID])
	assert.Equal(t, "function", parts[0].Meta[model.MetaKeySourceType])
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
}

func TestGeminiNormalizer_FunctionResponse(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	input := `{
		"role": "user",
		"parts": [
			{
				"functionResponse": {
					"id": "call_123",
					"name": "get_weather",
					"response": {"output": "Result: 8"}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeToolResult, parts[0].Type)
	assert.Contains(t, parts[0].Text, "Result")
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta[model.MetaKeyName])
	assert.Equal(t, "call_123", parts[0].Meta[model.MetaKeyToolCallID])
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
}

func TestGeminiNormalizer_ThinkingPart(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	sigBytes := []byte("gemini-thought-signature-data")
	sigBase64 := base64.StdEncoding.EncodeToString(sigBytes)

	t.Run("thinking part with signature", func(t *testing.T) {
		// Build input using SDK types to ensure correct JSON format
		content := genai.Content{
			Role: "model",
			Parts: []*genai.Part{
				{
					Text:             "Let me reason step by step...",
					Thought:          true,
					ThoughtSignature: sigBytes,
				},
				{
					Text: "The answer is 42.",
				},
			},
		}
		inputJSON, _ := json.Marshal(content)

		role, parts, messageMeta, err := normalizer.Normalize(json.RawMessage(inputJSON))

		assert.NoError(t, err)
		assert.Equal(t, model.RoleAssistant, role)
		assert.Len(t, parts, 2)

		// First part: should be recognized as thinking
		assert.Equal(t, model.PartTypeThinking, parts[0].Type)
		assert.Equal(t, "Let me reason step by step...", parts[0].Text)
		assert.Equal(t, sigBase64, parts[0].Meta[model.MetaKeySignature])

		// Second part: regular text
		assert.Equal(t, model.PartTypeText, parts[1].Type)
		assert.Equal(t, "The answer is 42.", parts[1].Text)

		assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
	})

	t.Run("thinking part without signature", func(t *testing.T) {
		content := genai.Content{
			Role: "model",
			Parts: []*genai.Part{
				{
					Text:    "Some internal reasoning...",
					Thought: true,
				},
			},
		}
		inputJSON, _ := json.Marshal(content)

		_, parts, _, err := normalizer.Normalize(json.RawMessage(inputJSON))

		assert.NoError(t, err)
		assert.Len(t, parts, 1)
		assert.Equal(t, model.PartTypeThinking, parts[0].Type)
		assert.Equal(t, "Some internal reasoning...", parts[0].Text)
		// Meta should be empty (no signature)
		assert.Empty(t, parts[0].Meta[model.MetaKeySignature])
	})
}

func TestGeminiNormalizer_MultipleParts(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	input := `{
		"role": "user",
		"parts": [
			{"text": "First part"},
			{"text": "Second part"},
			{
				"inlineData": {
					"mimeType": "image/jpeg",
					"data": "` + base64.StdEncoding.EncodeToString([]byte("fake image")) + `"
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 3)
	assert.Equal(t, model.PartTypeText, parts[0].Type)
	assert.Equal(t, "First part", parts[0].Text)
	assert.Equal(t, model.PartTypeText, parts[1].Type)
	assert.Equal(t, "Second part", parts[1].Text)
	assert.Equal(t, model.PartTypeImage, parts[2].Type)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
}

// TestGeminiNormalizer_FunctionCallAndResponseMatching tests that FunctionCall and FunctionResponse
// require matching IDs (they are in different messages with different roles)
func TestGeminiNormalizer_FunctionCallAndResponseMatching(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	// Test case: FunctionCall with ID, FunctionResponse with matching ID
	// They can be matched because they have matching IDs.
	// FunctionCall is in "model" role, FunctionResponse is in "user" role.
	input := `{
		"role": "model",
		"parts": [
			{
				"functionCall": {
					"id": "call_123",
					"name": "get_weather",
					"args": {"location": "San Francisco"}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleAssistant, role)
	assert.Len(t, parts, 1)

	// First part should be tool-call with provided ID
	assert.Equal(t, model.PartTypeToolCall, parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta[model.MetaKeyName])
	assert.Equal(t, "call_123", parts[0].Meta[model.MetaKeyID])

	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
}

// TestGeminiNormalizer_FunctionCallWithoutID tests that FunctionCall without ID generates a UUID
func TestGeminiNormalizer_FunctionCallWithoutID(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	input := `{
		"role": "model",
		"parts": [
			{
				"functionCall": {
					"name": "calculate",
					"args": {"x": 5, "y": 3}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleAssistant, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeToolCall, parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "calculate", parts[0].Meta[model.MetaKeyName])
	// ID should be generated in format: call_xxx (short random string)
	assert.NotEmpty(t, parts[0].Meta[model.MetaKeyID])
	idStr, ok := parts[0].Meta[model.MetaKeyID].(string)
	assert.True(t, ok)
	assert.Greater(t, len(idStr), 0)
	// Should start with "call_" prefix
	assert.True(t, len(idStr) > 5, "ID should be longer than 'call_'")
	assert.Equal(t, "call_", idStr[:5], "ID should start with 'call_' prefix")
	// Generated call info (id and name) should be stored in messageMeta
	assert.NotNil(t, messageMeta)
	callInfo, exists := messageMeta[model.GeminiCallInfoKey]
	assert.True(t, exists, "call info should exist in messageMeta")

	// Handle different possible types ([]interface{} or []map[string]interface{})
	var callInfoArray []interface{}
	switch v := callInfo.(type) {
	case []interface{}:
		callInfoArray = v
	case []map[string]interface{}:
		// Convert to []interface{}
		callInfoArray = make([]interface{}, len(v))
		for i, item := range v {
			callInfoArray[i] = item
		}
	default:
		t.Fatalf("unexpected type for call info: %T", callInfo)
	}

	assert.Len(t, callInfoArray, 1, "should have one call info entry")
	callInfoObj, ok := callInfoArray[0].(map[string]interface{})
	assert.True(t, ok, "call info should be a map")
	assert.Equal(t, idStr, callInfoObj["id"], "call ID should match")
	assert.Equal(t, "calculate", callInfoObj["name"], "call name should match")
}

// TestGeminiNormalizer_FunctionResponseWithoutID tests that FunctionResponse without ID is allowed
// The ID will be resolved by the service layer before storing
func TestGeminiNormalizer_FunctionResponseWithoutID(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	// FunctionResponse without ID is allowed - it will be resolved by the service layer
	// from stored call IDs in previous messages
	input := `{
		"role": "user",
		"parts": [
			{
				"functionResponse": {
					"name": "get_weather",
					"response": {"output": "Temperature: 68F"}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleUser, role)
	assert.Len(t, parts, 1)
	assert.Equal(t, model.PartTypeToolResult, parts[0].Type)
	assert.Contains(t, parts[0].Text, "Temperature")
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta[model.MetaKeyName])
	// tool_call_id should not be set (will be resolved later)
	_, hasID := parts[0].Meta[model.MetaKeyToolCallID]
	assert.False(t, hasID)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta[model.MsgMetaSourceFormat])
}

// TestGeminiNormalizer_MultipleFunctionCalls tests multiple FunctionCalls without IDs
func TestGeminiNormalizer_MultipleFunctionCalls(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	input := `{
		"role": "model",
		"parts": [
			{
				"functionCall": {
					"name": "get_weather",
					"args": {"location": "SF"}
				}
			},
			{
				"functionCall": {
					"name": "calculate",
					"args": {"x": 1, "y": 2}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleAssistant, role)
	assert.Len(t, parts, 2)

	// Both should be tool-call parts
	assert.Equal(t, model.PartTypeToolCall, parts[0].Type)
	assert.Equal(t, model.PartTypeToolCall, parts[1].Type)
	assert.Equal(t, "get_weather", parts[0].Meta[model.MetaKeyName])
	assert.Equal(t, "calculate", parts[1].Meta[model.MetaKeyName])

	// Both should have generated IDs
	id0, ok0 := parts[0].Meta[model.MetaKeyID].(string)
	assert.True(t, ok0)
	assert.True(t, len(id0) > 5)
	assert.Equal(t, "call_", id0[:5])

	id1, ok1 := parts[1].Meta[model.MetaKeyID].(string)
	assert.True(t, ok1)
	assert.True(t, len(id1) > 5)
	assert.Equal(t, "call_", id1[:5])

	// IDs should be different
	assert.NotEqual(t, id0, id1)

	// Both should be stored in messageMeta
	callInfo, exists := messageMeta[model.GeminiCallInfoKey]
	assert.True(t, exists)

	var callInfoArray []interface{}
	switch v := callInfo.(type) {
	case []interface{}:
		callInfoArray = v
	case []map[string]interface{}:
		callInfoArray = make([]interface{}, len(v))
		for i, item := range v {
			callInfoArray[i] = item
		}
	default:
		t.Fatalf("unexpected type: %T", callInfo)
	}

	assert.Len(t, callInfoArray, 2)

	// Verify order and content
	call0, ok := callInfoArray[0].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, id0, call0["id"])
	assert.Equal(t, "get_weather", call0["name"])

	call1, ok := callInfoArray[1].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, id1, call1["id"])
	assert.Equal(t, "calculate", call1["name"])
}

// TestGeminiNormalizer_MixedFunctionCalls tests mix of FunctionCalls with and without IDs
func TestGeminiNormalizer_MixedFunctionCalls(t *testing.T) {
	normalizer := &GeminiNormalizer{}

	input := `{
		"role": "model",
		"parts": [
			{
				"functionCall": {
					"id": "call_provided",
					"name": "provided_func",
					"args": {}
				}
			},
			{
				"functionCall": {
					"name": "generated_func",
					"args": {}
				}
			}
		]
	}`

	role, parts, messageMeta, err := normalizer.NormalizeFromGeminiMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, model.RoleAssistant, role)
	assert.Len(t, parts, 2)

	// First call has provided ID
	assert.Equal(t, "call_provided", parts[0].Meta[model.MetaKeyID])

	// Second call has generated ID
	id1, ok := parts[1].Meta[model.MetaKeyID].(string)
	assert.True(t, ok)
	assert.True(t, len(id1) > 5)
	assert.Equal(t, "call_", id1[:5])

	// Both calls should be in messageMeta (all FunctionCalls are tracked, not just generated ones)
	callInfo, exists := messageMeta[model.GeminiCallInfoKey]
	assert.True(t, exists)

	var callInfoArray []interface{}
	switch v := callInfo.(type) {
	case []interface{}:
		callInfoArray = v
	case []map[string]interface{}:
		callInfoArray = make([]interface{}, len(v))
		for i, item := range v {
			callInfoArray[i] = item
		}
	default:
		t.Fatalf("unexpected type: %T", callInfo)
	}

	// Both entries should be present (provided and generated)
	assert.Len(t, callInfoArray, 2)

	// Find entries by name to verify both are present
	foundProvided := false
	foundGenerated := false
	for _, item := range callInfoArray {
		callObj, ok := item.(map[string]interface{})
		assert.True(t, ok)
		name, ok := callObj["name"].(string)
		assert.True(t, ok)
		switch name {
		case "provided_func":
			assert.Equal(t, "call_provided", callObj["id"])
			foundProvided = true
		case "generated_func":
			assert.Equal(t, id1, callObj["id"])
			foundGenerated = true
		}
	}
	assert.True(t, foundProvided, "provided_func should be in call info")
	assert.True(t, foundGenerated, "generated_func should be in call info")
}
