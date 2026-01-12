package editor

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRemoveToolResultStrategy_Apply(t *testing.T) {
	t.Run("replace oldest tool results", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "What's the weather?"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call1", "name": "get_weather"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Sunny, 75°F", Meta: map[string]interface{}{"tool_call_id": "call1"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call2", "name": "get_forecast"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Clear skies tomorrow", Meta: map[string]interface{}{"tool_call_id": "call2"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call3", "name": "get_temperature"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Current temp: 75°F", Meta: map[string]interface{}{"tool_call_id": "call3"}},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 1}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Len(t, result, 7)

		// First tool result should be replaced
		assert.Equal(t, "Done", result[2].Parts[0].Text)
		assert.Equal(t, "tool-result", result[2].Parts[0].Type)
		assert.NotNil(t, result[2].Parts[0].Meta)

		// Second tool result should be replaced
		assert.Equal(t, "Done", result[4].Parts[0].Text)
		assert.Equal(t, "tool-result", result[4].Parts[0].Type)

		// Most recent tool result should keep original text
		assert.Equal(t, "Current temp: 75°F", result[6].Parts[0].Text)
		assert.Equal(t, "tool-result", result[6].Parts[0].Type)
	})

	t.Run("keep all when KeepRecentN >= total", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 1"},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 2"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 5}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// Both should keep original text
		assert.Equal(t, "Result 1", result[0].Parts[0].Text)
		assert.Equal(t, "Result 2", result[1].Parts[0].Text)
	})

	t.Run("replace all when KeepRecentN is 0", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 1"},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 2"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 0}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// All should be replaced
		assert.Equal(t, "Done", result[0].Parts[0].Text)
		assert.Equal(t, "Done", result[1].Parts[0].Text)
	})

	t.Run("no tool results in messages", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Hello"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "text", Text: "Hi there"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 1}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Len(t, result, 2)
		assert.Equal(t, "Hello", result[0].Parts[0].Text)
		assert.Equal(t, "Hi there", result[1].Parts[0].Text)
	})

	t.Run("multiple parts with some tool-results", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Question"},
					{Type: "tool-result", Text: "Old result"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "text", Text: "Answer"},
					{Type: "tool-result", Text: "Recent result"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 1}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// First part should remain unchanged
		assert.Equal(t, "Question", result[0].Parts[0].Text)
		// First tool-result should be replaced
		assert.Equal(t, "Done", result[0].Parts[1].Text)
		// Second message first part should remain unchanged
		assert.Equal(t, "Answer", result[1].Parts[0].Text)
		// Recent tool-result should keep original text
		assert.Equal(t, "Recent result", result[1].Parts[1].Text)
	})

	t.Run("negative KeepRecentN returns error", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: -1}
		_, err := strategy.Apply(messages)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be >= 0")
	})

	t.Run("custom placeholder text", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 1"},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 2"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 1, Placeholder: "Removed"}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// First should be replaced with custom placeholder
		assert.Equal(t, "Removed", result[0].Parts[0].Text)
		// Second should keep original
		assert.Equal(t, "Result 2", result[1].Parts[0].Text)
	})

	t.Run("empty placeholder defaults to Done", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 1"},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 0, Placeholder: ""}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Equal(t, "Done", result[0].Parts[0].Text)
	})

	t.Run("keep_tools prevents removal of specified tool results", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call1", "name": "important_tool"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Important result", Meta: map[string]interface{}{"tool_call_id": "call1"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call2", "name": "regular_tool"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Regular result", Meta: map[string]interface{}{"tool_call_id": "call2"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call3", "name": "important_tool"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Another important result", Meta: map[string]interface{}{"tool_call_id": "call3"}},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 0, KeepTools: []string{"important_tool"}}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// important_tool results should be kept
		assert.Equal(t, "Important result", result[1].Parts[0].Text)
		assert.Equal(t, "Another important result", result[5].Parts[0].Text)
		// regular_tool result should be replaced
		assert.Equal(t, "Done", result[3].Parts[0].Text)
	})

	t.Run("keep_tools with keep_recent_n", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call1", "name": "regular_tool"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Old regular result", Meta: map[string]interface{}{"tool_call_id": "call1"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call2", "name": "important_tool"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Important result", Meta: map[string]interface{}{"tool_call_id": "call2"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call3", "name": "regular_tool"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Recent regular result", Meta: map[string]interface{}{"tool_call_id": "call3"}},
				},
			},
		}

		// Keep 1 recent regular tool result + all important_tool results
		strategy := &RemoveToolResultStrategy{KeepRecentN: 1, KeepTools: []string{"important_tool"}}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// Old regular result should be replaced
		assert.Equal(t, "Done", result[1].Parts[0].Text)
		// important_tool result should be kept
		assert.Equal(t, "Important result", result[3].Parts[0].Text)
		// Recent regular result should be kept (within keep_recent_n)
		assert.Equal(t, "Recent regular result", result[5].Parts[0].Text)
	})

	t.Run("keep_tools with multiple tool names", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call1", "name": "tool_a"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result A", Meta: map[string]interface{}{"tool_call_id": "call1"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call2", "name": "tool_b"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result B", Meta: map[string]interface{}{"tool_call_id": "call2"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call3", "name": "tool_c"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result C", Meta: map[string]interface{}{"tool_call_id": "call3"}},
				},
			},
		}

		strategy := &RemoveToolResultStrategy{KeepRecentN: 0, KeepTools: []string{"tool_a", "tool_c"}}
		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// tool_a and tool_c should be kept
		assert.Equal(t, "Result A", result[1].Parts[0].Text)
		assert.Equal(t, "Result C", result[5].Parts[0].Text)
		// tool_b should be replaced
		assert.Equal(t, "Done", result[3].Parts[0].Text)
	})
}

func TestCreateRemoveToolResultStrategy(t *testing.T) {
	t.Run("create remove_tool_result strategy", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_recent_n_tool_results": float64(3),
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		assert.NotNil(t, strategy)
		assert.Equal(t, "remove_tool_result", strategy.Name())

		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Equal(t, 3, rtr.KeepRecentN)
	})

	t.Run("create with int parameter", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_recent_n_tool_results": 5,
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Equal(t, 5, rtr.KeepRecentN)
	})

	t.Run("use default value when parameter not provided", func(t *testing.T) {
		config := StrategyConfig{
			Type:   "remove_tool_result",
			Params: map[string]interface{}{},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		assert.NotNil(t, strategy)
		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Equal(t, 3, rtr.KeepRecentN, "should default to 3 when parameter not provided")
	})

	t.Run("invalid parameter type", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_recent_n_tool_results": "invalid",
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be an integer")
	})

	t.Run("create with custom placeholder", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_recent_n_tool_results": 5,
				"tool_result_placeholder":    "Cleared",
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Equal(t, 5, rtr.KeepRecentN)
		assert.Equal(t, "Cleared", rtr.Placeholder)
	})

	t.Run("invalid placeholder type returns error", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"tool_result_placeholder": 123, // Not a string
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "tool_result_placeholder must be a string")
	})

	t.Run("placeholder string is trimmed", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"tool_result_placeholder": "  Trimmed  ",
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Equal(t, "Trimmed", rtr.Placeholder, "should trim whitespace from placeholder")
	})

	t.Run("create with keep_tools parameter", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_tools": []interface{}{"tool1", "tool2"},
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Equal(t, []string{"tool1", "tool2"}, rtr.KeepTools)
	})

	t.Run("invalid keep_tools type returns error", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_tools": "not_an_array",
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "keep_tools must be an array of strings")
	})

	t.Run("invalid keep_tools element type returns error", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_tools": []interface{}{"valid", 123},
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "keep_tools must be an array of strings")
	})

	t.Run("empty keep_tools is valid", func(t *testing.T) {
		config := StrategyConfig{
			Type: "remove_tool_result",
			Params: map[string]interface{}{
				"keep_tools": []interface{}{},
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		rtr, ok := strategy.(*RemoveToolResultStrategy)
		require.True(t, ok)
		assert.Empty(t, rtr.KeepTools)
	})
}
