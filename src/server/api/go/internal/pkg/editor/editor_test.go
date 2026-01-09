package editor

import (
	"testing"

	"github.com/google/uuid"
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

func TestApplyStrategiesWithPin(t *testing.T) {
	// Helper to create messages with IDs
	createMessage := func(id string, parts []model.Part) model.Message {
		msgID, _ := uuid.Parse(id)
		return model.Message{
			ID:    msgID,
			Role:  "user",
			Parts: parts,
		}
	}

	t.Run("no pin - applies to all messages", func(t *testing.T) {
		msg1ID := "11111111-1111-1111-1111-111111111111"
		msg2ID := "22222222-2222-2222-2222-222222222222"
		msg3ID := "33333333-3333-3333-3333-333333333333"

		messages := []model.Message{
			createMessage(msg1ID, []model.Part{{Type: "tool-result", Text: "Result 1"}}),
			createMessage(msg2ID, []model.Part{{Type: "tool-result", Text: "Result 2"}}),
			createMessage(msg3ID, []model.Part{{Type: "tool-result", Text: "Result 3"}}),
		}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(1),
				},
			},
		}

		result, err := ApplyStrategiesWithPin(messages, configs, "")

		require.NoError(t, err)
		// First two should be replaced, third kept
		assert.Equal(t, "Done", result.Messages[0].Parts[0].Text)
		assert.Equal(t, "Done", result.Messages[1].Parts[0].Text)
		assert.Equal(t, "Result 3", result.Messages[2].Parts[0].Text)
		// EditAtMessageID should be the last message
		assert.Equal(t, msg3ID, result.EditAtMessageID)
	})

	t.Run("pin at middle message - only applies to messages up to pin", func(t *testing.T) {
		msg1ID := "11111111-1111-1111-1111-111111111111"
		msg2ID := "22222222-2222-2222-2222-222222222222"
		msg3ID := "33333333-3333-3333-3333-333333333333"
		msg4ID := "44444444-4444-4444-4444-444444444444"

		messages := []model.Message{
			createMessage(msg1ID, []model.Part{{Type: "tool-result", Text: "Result 1"}}),
			createMessage(msg2ID, []model.Part{{Type: "tool-result", Text: "Result 2"}}),
			createMessage(msg3ID, []model.Part{{Type: "tool-result", Text: "Result 3"}}),
			createMessage(msg4ID, []model.Part{{Type: "tool-result", Text: "Result 4"}}),
		}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(1),
				},
			},
		}

		// Pin at msg2 - only msg1 and msg2 should be edited
		result, err := ApplyStrategiesWithPin(messages, configs, msg2ID)

		require.NoError(t, err)
		// Only msg1 should be replaced (keep 1 recent within the pinned range)
		assert.Equal(t, "Done", result.Messages[0].Parts[0].Text)
		assert.Equal(t, "Result 2", result.Messages[1].Parts[0].Text)
		// msg3 and msg4 should be preserved unchanged
		assert.Equal(t, "Result 3", result.Messages[2].Parts[0].Text)
		assert.Equal(t, "Result 4", result.Messages[3].Parts[0].Text)
		// EditAtMessageID should be the pin message
		assert.Equal(t, msg2ID, result.EditAtMessageID)
	})

	t.Run("pin at first message - only first message is edited", func(t *testing.T) {
		msg1ID := "11111111-1111-1111-1111-111111111111"
		msg2ID := "22222222-2222-2222-2222-222222222222"

		messages := []model.Message{
			createMessage(msg1ID, []model.Part{{Type: "tool-result", Text: "Result 1"}}),
			createMessage(msg2ID, []model.Part{{Type: "tool-result", Text: "Result 2"}}),
		}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(0),
				},
			},
		}

		result, err := ApplyStrategiesWithPin(messages, configs, msg1ID)

		require.NoError(t, err)
		// msg1 should be edited (keep 0 means all replaced in the range)
		assert.Equal(t, "Done", result.Messages[0].Parts[0].Text)
		// msg2 should be preserved
		assert.Equal(t, "Result 2", result.Messages[1].Parts[0].Text)
		assert.Equal(t, msg1ID, result.EditAtMessageID)
	})

	t.Run("pin at last message - all messages edited", func(t *testing.T) {
		msg1ID := "11111111-1111-1111-1111-111111111111"
		msg2ID := "22222222-2222-2222-2222-222222222222"

		messages := []model.Message{
			createMessage(msg1ID, []model.Part{{Type: "tool-result", Text: "Result 1"}}),
			createMessage(msg2ID, []model.Part{{Type: "tool-result", Text: "Result 2"}}),
		}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(1),
				},
			},
		}

		result, err := ApplyStrategiesWithPin(messages, configs, msg2ID)

		require.NoError(t, err)
		assert.Equal(t, "Done", result.Messages[0].Parts[0].Text)
		assert.Equal(t, "Result 2", result.Messages[1].Parts[0].Text)
		assert.Equal(t, msg2ID, result.EditAtMessageID)
	})

	t.Run("pin message not found - applies to all messages", func(t *testing.T) {
		msg1ID := "11111111-1111-1111-1111-111111111111"
		msg2ID := "22222222-2222-2222-2222-222222222222"
		nonExistentID := "99999999-9999-9999-9999-999999999999"

		messages := []model.Message{
			createMessage(msg1ID, []model.Part{{Type: "tool-result", Text: "Result 1"}}),
			createMessage(msg2ID, []model.Part{{Type: "tool-result", Text: "Result 2"}}),
		}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(1),
				},
			},
		}

		result, err := ApplyStrategiesWithPin(messages, configs, nonExistentID)

		require.NoError(t, err)
		// Falls back to applying to all messages
		assert.Equal(t, "Done", result.Messages[0].Parts[0].Text)
		assert.Equal(t, "Result 2", result.Messages[1].Parts[0].Text)
		// EditAtMessageID should be the last message since pin was not found
		assert.Equal(t, msg2ID, result.EditAtMessageID)
	})

	t.Run("empty strategies with pin - returns all messages unchanged", func(t *testing.T) {
		msg1ID := "11111111-1111-1111-1111-111111111111"
		msg2ID := "22222222-2222-2222-2222-222222222222"

		messages := []model.Message{
			createMessage(msg1ID, []model.Part{{Type: "text", Text: "Hello"}}),
			createMessage(msg2ID, []model.Part{{Type: "text", Text: "World"}}),
		}

		result, err := ApplyStrategiesWithPin(messages, nil, msg1ID)

		require.NoError(t, err)
		assert.Equal(t, messages, result.Messages)
		// EditAtMessageID should be the last message (no strategies applied)
		assert.Equal(t, msg2ID, result.EditAtMessageID)
	})

	t.Run("empty messages - returns empty result", func(t *testing.T) {
		messages := []model.Message{}

		configs := []StrategyConfig{
			{
				Type: "remove_tool_result",
				Params: map[string]interface{}{
					"keep_recent_n_tool_results": float64(1),
				},
			},
		}

		result, err := ApplyStrategiesWithPin(messages, configs, "")

		require.NoError(t, err)
		assert.Empty(t, result.Messages)
		assert.Equal(t, "", result.EditAtMessageID)
	})
}
