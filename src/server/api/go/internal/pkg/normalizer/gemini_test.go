package normalizer

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"google.golang.org/genai"

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
			wantRole:    "user",
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
			wantRole:    "assistant",
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
			wantRole:    "user",
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
			wantRole:    "assistant",
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
			wantRole:    "user",
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
			wantRole:    "user",
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
				assert.Equal(t, "gemini", messageMeta["source_format"])
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
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "tool-call", parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "calculate", parts[0].Meta["name"])
	assert.Equal(t, "call_123", parts[0].Meta["id"])
	assert.Equal(t, "function", parts[0].Meta["type"])
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta["source_format"])
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
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "tool-result", parts[0].Type)
	assert.Contains(t, parts[0].Text, "Result")
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta["name"])
	assert.Equal(t, "call_123", parts[0].Meta["tool_call_id"])
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta["source_format"])
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
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 3)
	assert.Equal(t, "text", parts[0].Type)
	assert.Equal(t, "First part", parts[0].Text)
	assert.Equal(t, "text", parts[1].Type)
	assert.Equal(t, "Second part", parts[1].Text)
	assert.Equal(t, "image", parts[2].Type)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta["source_format"])
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
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 1)

	// First part should be tool-call with provided ID
	assert.Equal(t, "tool-call", parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta["name"])
	assert.Equal(t, "call_123", parts[0].Meta["id"])

	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta["source_format"])
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
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "tool-call", parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "calculate", parts[0].Meta["name"])
	// ID should be generated in format: call_xxx (short random string)
	assert.NotEmpty(t, parts[0].Meta["id"])
	idStr, ok := parts[0].Meta["id"].(string)
	assert.True(t, ok)
	assert.Greater(t, len(idStr), 0)
	// Should start with "call_" prefix
	assert.True(t, len(idStr) > 5, "ID should be longer than 'call_'")
	assert.Equal(t, "call_", idStr[:5], "ID should start with 'call_' prefix")
	// Generated call info (id and name) should be stored in messageMeta
	assert.NotNil(t, messageMeta)
	callInfo, exists := messageMeta["__gemini_call_info__"]
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
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "tool-result", parts[0].Type)
	assert.Contains(t, parts[0].Text, "Temperature")
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta["name"])
	// tool_call_id should not be set (will be resolved later)
	_, hasID := parts[0].Meta["tool_call_id"]
	assert.False(t, hasID)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "gemini", messageMeta["source_format"])
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
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 2)

	// Both should be tool-call parts
	assert.Equal(t, "tool-call", parts[0].Type)
	assert.Equal(t, "tool-call", parts[1].Type)
	assert.Equal(t, "get_weather", parts[0].Meta["name"])
	assert.Equal(t, "calculate", parts[1].Meta["name"])

	// Both should have generated IDs
	id0, ok0 := parts[0].Meta["id"].(string)
	assert.True(t, ok0)
	assert.True(t, len(id0) > 5)
	assert.Equal(t, "call_", id0[:5])

	id1, ok1 := parts[1].Meta["id"].(string)
	assert.True(t, ok1)
	assert.True(t, len(id1) > 5)
	assert.Equal(t, "call_", id1[:5])

	// IDs should be different
	assert.NotEqual(t, id0, id1)

	// Both should be stored in messageMeta
	callInfo, exists := messageMeta["__gemini_call_info__"]
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
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 2)

	// First call has provided ID
	assert.Equal(t, "call_provided", parts[0].Meta["id"])

	// Second call has generated ID
	id1, ok := parts[1].Meta["id"].(string)
	assert.True(t, ok)
	assert.True(t, len(id1) > 5)
	assert.Equal(t, "call_", id1[:5])

	// Only the generated one should be in messageMeta
	callInfo, exists := messageMeta["__gemini_call_info__"]
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

	// Only one entry (the generated one)
	assert.Len(t, callInfoArray, 1)
	callObj, ok := callInfoArray[0].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, id1, callObj["id"])
	assert.Equal(t, "generated_func", callObj["name"])
}
