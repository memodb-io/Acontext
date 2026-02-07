package converter

import (
	"encoding/base64"
	"testing"

	"google.golang.org/genai"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGeminiConverter_Convert_TextMessage(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "Hello from Gemini!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	// Gemini converter returns []*genai.Content
	// For testing, we just verify it doesn't error
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_AssistantMessage(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleAssistant, []model.Part{
			{Type: model.PartTypeText, Text: "I'm doing well, thank you!"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_ToolCall(t *testing.T) {
	converter := &GeminiConverter{}

	// UNIFIED FORMAT: now uses unified field names
	messages := []model.Message{
		createTestMessage(model.RoleAssistant, []model.Part{
			{
				Type: model.PartTypeToolCall,
				Meta: map[string]any{
					model.MetaKeyID:         "call_123",
					model.MetaKeyName:       "get_weather",
					model.MetaKeyArguments:  "{\"city\":\"SF\"}",
					model.MetaKeySourceType: "function",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_ThinkingAsNativePart(t *testing.T) {
	converter := &GeminiConverter{}

	// Signature stored as base64-encoded string (as produced by Gemini normalizer)
	sigBytes := []byte("gemini-thought-signature-data")
	sigBase64 := base64.StdEncoding.EncodeToString(sigBytes)

	messages := []model.Message{
		createTestMessage(model.RoleAssistant, []model.Part{
			{
				Type: model.PartTypeThinking,
				Text: "Let me reason about this...",
				Meta: map[string]any{
					model.MetaKeySignature: sigBase64,
				},
			},
			{
				Type: model.PartTypeText,
				Text: "Here is my answer.",
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)

	contents := result.([]*genai.Content)
	require.Len(t, contents, 1)
	require.Len(t, contents[0].Parts, 2)

	// First part: thinking with Thought=true and ThoughtSignature
	thinkingPart := contents[0].Parts[0]
	assert.Equal(t, "Let me reason about this...", thinkingPart.Text)
	assert.True(t, thinkingPart.Thought, "thinking part should have Thought=true")
	assert.Equal(t, sigBytes, thinkingPart.ThoughtSignature, "ThoughtSignature should round-trip")

	// Second part: regular text with Thought=false
	textPart := contents[0].Parts[1]
	assert.Equal(t, "Here is my answer.", textPart.Text)
	assert.False(t, textPart.Thought, "text part should have Thought=false")
}

func TestGeminiConverter_Convert_ToolResult(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{
				Type: model.PartTypeToolResult,
				Text: "Weather is sunny",
				Meta: map[string]any{
					model.MetaKeyName: "get_weather",
				},
			},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_Image(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{
				Type:     model.PartTypeImage,
				Filename: "image.jpg",
				Asset: &model.Asset{
					S3Key: "assets/image.jpg",
					MIME:  "image/jpeg",
					SizeB: 2048,
				},
			},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"assets/image.jpg": {URL: "https://example.com/image.jpg"},
	}

	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_MultipleParts(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage(model.RoleUser, []model.Part{
			{Type: model.PartTypeText, Text: "What's in this image?"},
			{
				Type:     model.PartTypeImage,
				Filename: "image.jpg",
				Asset: &model.Asset{
					S3Key: "assets/image.jpg",
					MIME:  "image/jpeg",
					SizeB: 2048,
				},
			},
		}, nil),
	}

	publicURLs := map[string]service.PublicURL{
		"assets/image.jpg": {URL: "https://example.com/image.jpg"},
	}

	result, err := converter.Convert(messages, publicURLs)
	require.NoError(t, err)
	assert.NotNil(t, result)
}

func TestGeminiConverter_Convert_InvalidRole(t *testing.T) {
	converter := &GeminiConverter{}

	messages := []model.Message{
		createTestMessage("system", []model.Part{
			{Type: model.PartTypeText, Text: "System message"},
		}, nil),
	}

	result, err := converter.Convert(messages, nil)
	// Should handle invalid role gracefully (return nil content)
	require.NoError(t, err)
	assert.NotNil(t, result)
}
