package editor

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateStrategy(t *testing.T) {
	t.Run("unknown strategy type", func(t *testing.T) {
		config := StrategyConfig{
			Type:   "unknown_strategy",
			Params: map[string]interface{}{},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "unknown strategy type")
	})
}

func TestApplyStrategies(t *testing.T) {
	t.Run("apply single strategy", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 1"},
					{Type: "tool-result", Text: "Result 2"},
				},
			},
		}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(1),
				},
			},
		}

		result, err := ApplyStrategies(messages, configs)

		require.NoError(t, err)
		assert.Equal(t, "Done", result[0].Parts[0].Text)
		assert.Equal(t, "Result 2", result[0].Parts[1].Text)
	})

	t.Run("empty strategies list", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Hello"},
				},
			},
		}

		configs := []StrategyConfig{}

		result, err := ApplyStrategies(messages, configs)

		require.NoError(t, err)
		assert.Equal(t, messages, result)
	})

	t.Run("nil strategies list", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Hello"},
				},
			},
		}

		result, err := ApplyStrategies(messages, nil)

		require.NoError(t, err)
		assert.Equal(t, messages, result)
	})

	t.Run("invalid strategy in list", func(t *testing.T) {
		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Hello"},
				},
			},
		}

		configs := []StrategyConfig{
			{
				Type:   "invalid_strategy",
				Params: map[string]interface{}{},
			},
		}

		_, err := ApplyStrategies(messages, configs)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "unknown strategy type")
	})
}
