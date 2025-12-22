package normalizer

import (
	"encoding/base64"
	"encoding/json"
	"testing"

	"google.golang.org/genai"

	"github.com/stretchr/testify/assert"
)

func TestGenAINormalizer_NormalizeFromGenAIMessage(t *testing.T) {
	normalizer := &GenAINormalizer{}

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
			errContains: "invalid GenAI role",
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
			role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(tt.input))

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
				assert.Equal(t, "genai", messageMeta["source_format"])
			}
		})
	}
}

func TestGenAINormalizer_FunctionCall(t *testing.T) {
	normalizer := &GenAINormalizer{}

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

	role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "tool-call", parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "calculate", parts[0].Meta["name"])
	assert.Equal(t, "call_123", parts[0].Meta["id"])
	assert.Equal(t, "function", parts[0].Meta["type"])
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "genai", messageMeta["source_format"])
}

func TestGenAINormalizer_FunctionResponse(t *testing.T) {
	normalizer := &GenAINormalizer{}

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

	role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 1)
	assert.Equal(t, "tool-result", parts[0].Type)
	assert.Contains(t, parts[0].Text, "Result")
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta["name"])
	assert.Equal(t, "call_123", parts[0].Meta["tool_call_id"])
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "genai", messageMeta["source_format"])
}

func TestGenAINormalizer_MultipleParts(t *testing.T) {
	normalizer := &GenAINormalizer{}

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

	role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "user", role)
	assert.Len(t, parts, 3)
	assert.Equal(t, "text", parts[0].Type)
	assert.Equal(t, "First part", parts[0].Text)
	assert.Equal(t, "text", parts[1].Type)
	assert.Equal(t, "Second part", parts[1].Text)
	assert.Equal(t, "image", parts[2].Type)
	assert.NotNil(t, messageMeta)
	assert.Equal(t, "genai", messageMeta["source_format"])
}

// TestGenAINormalizer_FunctionCallAndResponseMatching tests that FunctionCall and FunctionResponse
// require matching IDs (they are in different messages with different roles)
func TestGenAINormalizer_FunctionCallAndResponseMatching(t *testing.T) {
	normalizer := &GenAINormalizer{}

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

	role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(input))

	assert.NoError(t, err)
	assert.Equal(t, "assistant", role)
	assert.Len(t, parts, 1)

	// First part should be tool-call with provided ID
	assert.Equal(t, "tool-call", parts[0].Type)
	assert.NotNil(t, parts[0].Meta)
	assert.Equal(t, "get_weather", parts[0].Meta["name"])
	assert.Equal(t, "call_123", parts[0].Meta["id"])

	assert.NotNil(t, messageMeta)
	assert.Equal(t, "genai", messageMeta["source_format"])
}

// TestGenAINormalizer_FunctionCallWithoutID tests that FunctionCall without ID returns an error
func TestGenAINormalizer_FunctionCallWithoutID(t *testing.T) {
	normalizer := &GenAINormalizer{}

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

	role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(input))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "FunctionCall.ID is required but missing")
	assert.Empty(t, role)
	assert.Nil(t, parts)
	assert.Nil(t, messageMeta)
}

// TestGenAINormalizer_FunctionResponseWithoutID tests that FunctionResponse without ID returns an error
func TestGenAINormalizer_FunctionResponseWithoutID(t *testing.T) {
	normalizer := &GenAINormalizer{}

	// FunctionResponse without ID cannot match FunctionCall because they are in different messages.
	// The user must provide matching IDs for proper matching.
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

	role, parts, messageMeta, err := normalizer.NormalizeFromGenAIMessage(json.RawMessage(input))

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "FunctionResponse.ID is required but missing")
	assert.Empty(t, role)
	assert.Nil(t, parts)
	assert.Nil(t, messageMeta)
}
