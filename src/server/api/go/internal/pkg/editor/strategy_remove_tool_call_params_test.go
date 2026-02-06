package editor

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

func TestRemoveToolCallParamsStrategy_Apply(t *testing.T) {
	log := zaptest.NewLogger(t)
	err := tokenizer.Init(log)
	require.NoError(t, err, "failed to initialize tokenizer")
	t.Run("removes only tool calls above gt_token threshold", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "search",
							"arguments": `{"query": "short"}`,
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
							"arguments": `{"query": "this is a very long argument that should exceed the token threshold for removal"}`,
						},
					},
				},
			},
		}

		params := map[string]interface{}{"keep_recent_n_tool_calls": 0, "gt_token": 10}
		strategy, err := createRemoveToolCallParamsStrategy(params)
		assert.NoError(t, err)
		result, err := strategy.Apply(messages)
		assert.NoError(t, err)
		assert.Equal(t, `{"query": "short"}`, result[0].Parts[0].Meta["arguments"])
		assert.Equal(t, "{}", result[1].Parts[0].Meta["arguments"])
	})

	t.Run("keep_recent_n applies before gt_token", func(t *testing.T) {
		longArgs := `{"query": "this is a long argument that should remain because it is recent"}`
		tokCount, err := tokenizer.CountTokens(longArgs)
		require.NoError(t, err)
		require.Greater(t, tokCount, 1)

		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "search",
							"arguments": longArgs,
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
							"arguments": longArgs,
						},
					},
				},
			},
		}

		params := map[string]interface{}{
			"keep_recent_n_tool_calls": 1,
			"gt_token":                 tokCount - 1,
		}
		strategy, err := createRemoveToolCallParamsStrategy(params)
		require.NoError(t, err)
		result, err := strategy.Apply(messages)
		require.NoError(t, err)
		assert.Equal(t, "{}", result[0].Parts[0].Meta["arguments"])
		assert.Equal(t, longArgs, result[1].Parts[0].Meta["arguments"])
	})

	t.Run("skips removal when arguments missing and gt_token is set", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":   "call_1",
							"name": "search",
						},
					},
				},
			},
		}

		params := map[string]interface{}{"keep_recent_n_tool_calls": 0, "gt_token": 10}
		strategy, err := createRemoveToolCallParamsStrategy(params)
		require.NoError(t, err)
		result, err := strategy.Apply(messages)
		require.NoError(t, err)
		_, ok := result[0].Parts[0].Meta["arguments"]
		assert.False(t, ok)
	})

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

	t.Run("keep_tools prevents removal of specified tool call params", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "important_tool",
							"arguments": `{"key": "important_value"}`,
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
							"name":      "regular_tool",
							"arguments": `{"key": "regular_value"}`,
						},
					},
				},
			},
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_3",
							"name":      "important_tool",
							"arguments": `{"key": "another_important_value"}`,
						},
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 0, KeepTools: []string{"important_tool"}}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		// important_tool calls should keep their arguments
		assert.Equal(t, `{"key": "important_value"}`, result[0].Parts[0].Meta["arguments"])
		assert.Equal(t, `{"key": "another_important_value"}`, result[2].Parts[0].Meta["arguments"])
		// regular_tool should have arguments cleared
		assert.Equal(t, "{}", result[1].Parts[0].Meta["arguments"])
	})

	t.Run("keep_tools with keep_recent_n", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "regular_tool",
							"arguments": `{"key": "old_regular"}`,
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
							"name":      "important_tool",
							"arguments": `{"key": "important"}`,
						},
					},
				},
			},
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_3",
							"name":      "regular_tool",
							"arguments": `{"key": "recent_regular"}`,
						},
					},
				},
			},
		}

		// Keep 1 recent regular tool call + all important_tool calls
		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 1, KeepTools: []string{"important_tool"}}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		// Old regular call should have arguments cleared
		assert.Equal(t, "{}", result[0].Parts[0].Meta["arguments"])
		// important_tool should keep arguments
		assert.Equal(t, `{"key": "important"}`, result[1].Parts[0].Meta["arguments"])
		// Recent regular call should keep arguments (within keep_recent_n)
		assert.Equal(t, `{"key": "recent_regular"}`, result[2].Parts[0].Meta["arguments"])
	})

	t.Run("keep_tools with multiple tool names", func(t *testing.T) {
		messages := []model.Message{
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_1",
							"name":      "tool_a",
							"arguments": `{"key": "a"}`,
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
							"name":      "tool_b",
							"arguments": `{"key": "b"}`,
						},
					},
				},
			},
			{
				Parts: []model.Part{
					{
						Type: "tool-call",
						Meta: map[string]any{
							"id":        "call_3",
							"name":      "tool_c",
							"arguments": `{"key": "c"}`,
						},
					},
				},
			},
		}

		strategy := &RemoveToolCallParamsStrategy{KeepRecentN: 0, KeepTools: []string{"tool_a", "tool_c"}}
		result, err := strategy.Apply(messages)

		assert.NoError(t, err)
		// tool_a and tool_c should keep arguments
		assert.Equal(t, `{"key": "a"}`, result[0].Parts[0].Meta["arguments"])
		assert.Equal(t, `{"key": "c"}`, result[2].Parts[0].Meta["arguments"])
		// tool_b should have arguments cleared
		assert.Equal(t, "{}", result[1].Parts[0].Meta["arguments"])
	})
}

func TestCreateRemoveToolCallParamsStrategy(t *testing.T) {
	t.Run("create with keep_tools parameter", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_call_params",
			Params: map[string]interface{}{
				"keep_tools": []interface{}{"tool1", "tool2"},
			},
		}

		strategy, err := CreateStrategy(config)

		assert.NoError(t, err)
		rtcp, ok := strategy.(*RemoveToolCallParamsStrategy)
		assert.True(t, ok)
		assert.Equal(t, []string{"tool1", "tool2"}, rtcp.KeepTools)
	})

	t.Run("invalid keep_tools type returns error", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_call_params",
			Params: map[string]interface{}{
				"keep_tools": "not_an_array",
			},
		}

		_, err := CreateStrategy(config)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "keep_tools must be an array of strings")
	})

	t.Run("invalid keep_tools element type returns error", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_call_params",
			Params: map[string]interface{}{
				"keep_tools": []interface{}{"valid", 123},
			},
		}

		_, err := CreateStrategy(config)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "keep_tools must be an array of strings")
	})

	t.Run("empty keep_tools is valid", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_call_params",
			Params: map[string]interface{}{
				"keep_tools": []interface{}{},
			},
		}

		strategy, err := CreateStrategy(config)

		assert.NoError(t, err)
		rtcp, ok := strategy.(*RemoveToolCallParamsStrategy)
		assert.True(t, ok)
		assert.Empty(t, rtcp.KeepTools)
	})

	t.Run("default values when no params provided", func(t *testing.T) {
		config := StrategyConfig{
			Type:   "remove_tool_call_params",
			Params: map[string]interface{}{},
		}

		strategy, err := CreateStrategy(config)

		assert.NoError(t, err)
		rtcp, ok := strategy.(*RemoveToolCallParamsStrategy)
		assert.True(t, ok)
		assert.Equal(t, 3, rtcp.KeepRecentN)
		assert.Nil(t, rtcp.KeepTools)
	})

	t.Run("invalid gt_token type returns error", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_call_params",
			Params: map[string]interface{}{
				"gt_token": "invalid",
			},
		}

		_, err := CreateStrategy(config)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "gt_token must be an integer")
	})

	t.Run("gt_token must be > 0", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_call_params",
			Params: map[string]interface{}{
				"gt_token": 0,
			},
		}

		_, err := CreateStrategy(config)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "gt_token must be > 0")
	})
}
