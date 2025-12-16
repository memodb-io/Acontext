package editor

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
)

func TestRemoveToolCallParamsStrategy_Apply(t *testing.T) {
	t.Run("removes parameters from old tool calls", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "search",
							"arguments": `{"query": "old search"}`,
						},
					},
				},
			},
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_2",
							"name":      "search",
							"arguments": `{"query": "recent search"}`,
						},
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 1}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		assert.Equal(t, "{}", result[0].Parts[0].Meta["arguments"])
		assert.Equal(t, `{"query": "recent search"}`, result[1].Parts[0].Meta["arguments"])
	})

	t.Run("keeps all when under limit", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "search",
							"arguments": `{"query": "test"}`,
						},
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 3}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		assert.Equal(t, `{"query": "test"}`, result[0].Parts[0].Meta["arguments"])
	})

	t.Run("removes all when keep_recent_n is zero", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "search",
							"arguments": `{"query": "test"}`,
						},
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 0}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		assert.Equal(t, "{}", result[0].Parts[0].Meta["arguments"])
	})

	t.Run("returns error for negative keep_recent_n", func(t *testing.T) {
		messages := []model.Message{}
		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: -1}
		_, err := strategy.Apply(messages)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "must be >= 0")
	})

	t.Run("handles messages with no tool calls", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{Type: "text", Text: "hello"},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 1}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		assert.Equal(t, messages, result)
	})

	t.Run("handles mixed part types", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{Type: "text", Text: "hello"},
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "search",
							"arguments": `{"query": "old"}`,
						},
					},
				},
			},
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_2",
							"name":      "search",
							"arguments": `{"query": "new"}`,
						},
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 1}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		assert.Equal(t, "{}", result[0].Parts[1].Meta["arguments"])
		assert.Equal(t, `{"query": "new"}`, result[1].Parts[0].Meta["arguments"])
	})

	t.Run("handles tool call with nil meta gracefully", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: nil,
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 0}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		assert.Nil(t, result[0].Parts[0].Meta)
	})
}
