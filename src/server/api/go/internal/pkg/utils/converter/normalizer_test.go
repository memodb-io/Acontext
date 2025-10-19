package converter

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
)

func TestGetNormalizer(t *testing.T) {
	tests := []struct {
		name    string
		format  MessageFormat
		wantErr bool
	}{
		{
			name:    "None format returns NoOpNormalizer",
			format:  FormatAcontext,
			wantErr: false,
		},
		{
			name:    "OpenAI format returns OpenAINormalizer",
			format:  FormatOpenAI,
			wantErr: false,
		},
		{
			name:    "Anthropic format returns AnthropicNormalizer",
			format:  FormatAnthropic,
			wantErr: false,
		},
		{
			name:    "Invalid format returns error",
			format:  "invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			normalizer, err := GetNormalizer(tt.format)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, normalizer)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, normalizer)
			}
		})
	}
}

func TestNoOpNormalizer_Normalize(t *testing.T) {
	normalizer := &NoOpNormalizer{}

	role := "user"
	parts := []service.PartIn{
		{Type: "text", Text: "Hello"},
	}

	normalizedRole, normalizedParts, err := normalizer.Normalize(role, parts)

	assert.NoError(t, err)
	assert.Equal(t, role, normalizedRole)
	assert.Equal(t, parts, normalizedParts)
}

func TestOpenAINormalizer_Normalize(t *testing.T) {
	normalizer := &OpenAINormalizer{}

	tests := []struct {
		name           string
		role           string
		parts          []service.PartIn
		wantRole       string
		wantErr        bool
		checkPartsMeta bool
	}{
		{
			name: "valid user role",
			role: "user",
			parts: []service.PartIn{
				{Type: "text", Text: "Hello"},
			},
			wantRole: "user",
			wantErr:  false,
		},
		{
			name: "valid assistant role",
			role: "assistant",
			parts: []service.PartIn{
				{Type: "text", Text: "Hi there"},
			},
			wantRole: "assistant",
			wantErr:  false,
		},
		{
			name: "tool-call with name field gets converted to tool_name",
			role: "assistant",
			parts: []service.PartIn{
				{
					Type: "tool-call",
					Meta: map[string]interface{}{
						"id":        "call_123",
						"name":      "get_weather",
						"arguments": map[string]interface{}{"city": "SF"},
					},
				},
			},
			wantRole:       "assistant",
			wantErr:        false,
			checkPartsMeta: true,
		},
		{
			name: "tool role converts to user",
			role: "tool",
			parts: []service.PartIn{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"tool_call_id": "call_123",
						"result":       "Sunny, 72°F",
					},
				},
			},
			wantRole: "user",
			wantErr:  false,
		},
		{
			name: "function role converts to user",
			role: "function",
			parts: []service.PartIn{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"tool_call_id": "call_456",
						"result":       "Function result",
					},
				},
			},
			wantRole: "user",
			wantErr:  false,
		},
		{
			name: "system role stays as system",
			role: "system",
			parts: []service.PartIn{
				{Type: "text", Text: "You are a helpful assistant"},
			},
			wantRole: "system",
			wantErr:  false,
		},
		{
			name: "invalid role",
			role: "invalid_role",
			parts: []service.PartIn{
				{Type: "text", Text: "Hello"},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			normalizedRole, normalizedParts, err := normalizer.Normalize(tt.role, tt.parts)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantRole, normalizedRole)
				assert.Len(t, normalizedParts, len(tt.parts))

				if tt.checkPartsMeta {
					// Check that 'name' was converted to 'tool_name'
					if normalizedParts[0].Type == "tool-call" {
						assert.Contains(t, normalizedParts[0].Meta, "tool_name")
					}
				}
			}
		})
	}
}

func TestAnthropicNormalizer_Normalize(t *testing.T) {
	normalizer := &AnthropicNormalizer{}

	tests := []struct {
		name           string
		role           string
		parts          []service.PartIn
		wantRole       string
		wantErr        bool
		checkPartsMeta bool
	}{
		{
			name: "valid user role",
			role: "user",
			parts: []service.PartIn{
				{Type: "text", Text: "Hello"},
			},
			wantRole: "user",
			wantErr:  false,
		},
		{
			name: "valid assistant role",
			role: "assistant",
			parts: []service.PartIn{
				{Type: "text", Text: "Hi there"},
			},
			wantRole: "assistant",
			wantErr:  false,
		},
		{
			name: "tool-call with name and input fields gets normalized",
			role: "assistant",
			parts: []service.PartIn{
				{
					Type: "tool-call",
					Meta: map[string]interface{}{
						"id":    "toolu_123",
						"name":  "get_weather",
						"input": map[string]interface{}{"city": "SF"},
					},
				},
			},
			wantRole:       "assistant",
			wantErr:        false,
			checkPartsMeta: true,
		},
		{
			name: "tool-use type converts to tool-call",
			role: "assistant",
			parts: []service.PartIn{
				{
					Type: "tool-use",
					Meta: map[string]interface{}{
						"id":    "toolu_456",
						"name":  "search",
						"input": map[string]interface{}{"query": "golang"},
					},
				},
			},
			wantRole:       "assistant",
			wantErr:        false,
			checkPartsMeta: true,
		},
		{
			name: "tool_result with tool_use_id gets normalized to tool_call_id",
			role: "user",
			parts: []service.PartIn{
				{
					Type: "tool-result",
					Meta: map[string]interface{}{
						"tool_use_id": "toolu_123",
						"content":     "Sunny, 72°F",
					},
				},
			},
			wantRole:       "user",
			wantErr:        false,
			checkPartsMeta: true,
		},
		{
			name: "system role is invalid for Anthropic",
			role: "system",
			parts: []service.PartIn{
				{Type: "text", Text: "You are a helpful assistant"},
			},
			wantErr: true,
		},
		{
			name: "tool role is invalid for Anthropic",
			role: "tool",
			parts: []service.PartIn{
				{Type: "text", Text: "Result"},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			normalizedRole, normalizedParts, err := normalizer.Normalize(tt.role, tt.parts)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.wantRole, normalizedRole)

				if tt.checkPartsMeta && len(normalizedParts) > 0 {
					switch normalizedParts[0].Type {
					case "tool-call":
						// Check that 'name' was converted to 'tool_name'
						// and 'input' was converted to 'arguments'
						assert.Contains(t, normalizedParts[0].Meta, "tool_name")
						assert.Contains(t, normalizedParts[0].Meta, "arguments")

						// If original part was tool-use, verify type conversion
						if tt.parts[0].Type == "tool-use" {
							assert.Equal(t, "tool-call", normalizedParts[0].Type)
						}
					case "tool-result":
						// Check that 'tool_use_id' was converted to 'tool_call_id'
						assert.Contains(t, normalizedParts[0].Meta, "tool_call_id")
					}
				}
			}
		})
	}
}
