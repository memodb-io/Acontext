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
}
