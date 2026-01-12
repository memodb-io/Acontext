package editor

import (
	"context"
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

// initTokenizer is a helper to initialize the tokenizer for tests
func initTokenizer(t *testing.T) {
	t.Helper()
	log := zaptest.NewLogger(t)
	err := tokenizer.Init(log)
	require.NoError(t, err, "failed to initialize tokenizer")
}

// TestCreateTokenLimitStrategy tests the factory function for TokenLimitStrategy
func TestCreateTokenLimitStrategy(t *testing.T) {
	t.Run("create with valid parameters", func(t *testing.T) {
		config := StrategyConfig{
			Type: "token_limit",
			Params: map[string]interface{}{
				"limit_tokens": float64(1000),
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		assert.NotNil(t, strategy)
		assert.Equal(t, "token_limit", strategy.Name())

		tls, ok := strategy.(*TokenLimitStrategy)
		require.True(t, ok)
		assert.Equal(t, 1000, tls.LimitTokens)
	})

	t.Run("create with int parameter", func(t *testing.T) {
		config := StrategyConfig{
			Type: "token_limit",
			Params: map[string]interface{}{
				"limit_tokens": 2000,
			},
		}

		strategy, err := CreateStrategy(config)

		require.NoError(t, err)
		tls, ok := strategy.(*TokenLimitStrategy)
		require.True(t, ok)
		assert.Equal(t, 2000, tls.LimitTokens)
	})

	t.Run("missing limit_tokens parameter", func(t *testing.T) {
		config := StrategyConfig{
			Type:   "token_limit",
			Params: map[string]interface{}{},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "requires 'limit_tokens' parameter")
	})

	t.Run("invalid parameter type", func(t *testing.T) {
		config := StrategyConfig{
			Type: "token_limit",
			Params: map[string]interface{}{
				"limit_tokens": "invalid",
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be an integer")
	})

	t.Run("zero limit_tokens", func(t *testing.T) {
		config := StrategyConfig{
			Type: "token_limit",
			Params: map[string]interface{}{
				"limit_tokens": 0,
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be > 0")
	})

	t.Run("negative limit_tokens", func(t *testing.T) {
		config := StrategyConfig{
			Type: "token_limit",
			Params: map[string]interface{}{
				"limit_tokens": -100,
			},
		}

		_, err := CreateStrategy(config)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "must be > 0")
	})
}

// TestTokenLimitStrategy_EmptyMessages tests handling of empty message arrays
func TestTokenLimitStrategy_EmptyMessages(t *testing.T) {
	t.Run("empty messages array", func(t *testing.T) {
		strategy := &TokenLimitStrategy{LimitTokens: 1000}
		messages := []model.Message{}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Empty(t, result)
		assert.Len(t, result, 0)
	})

	t.Run("nil messages array", func(t *testing.T) {
		strategy := &TokenLimitStrategy{LimitTokens: 1000}
		var messages []model.Message

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Nil(t, result)
	})
}

// TestTokenLimitStrategy_MessagesWithinLimit tests that messages under the limit are unchanged
func TestTokenLimitStrategy_MessagesWithinLimit(t *testing.T) {
	t.Run("small messages under high limit", func(t *testing.T) {
		initTokenizer(t)

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
					{Type: "text", Text: "Hi there!"},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "How are you?"},
				},
			},
		}

		// Count actual tokens
		ctx := context.Background()
		actualTokens, err := tokenizer.CountMessagePartsTokens(ctx, messages)
		require.NoError(t, err)

		// Set limit well above actual token count
		strategy := &TokenLimitStrategy{LimitTokens: actualTokens + 1000}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Len(t, result, len(messages), "all messages should be kept")
		assert.Equal(t, messages, result, "messages should be unchanged")
	})

	t.Run("messages exactly at limit", func(t *testing.T) {
		initTokenizer(t)

		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Testing exact boundary"},
				},
			},
		}

		// Count actual tokens and set limit to exact amount
		ctx := context.Background()
		actualTokens, err := tokenizer.CountMessagePartsTokens(ctx, messages)
		require.NoError(t, err)

		strategy := &TokenLimitStrategy{LimitTokens: actualTokens}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Len(t, result, len(messages), "all messages should be kept when exactly at limit")
		assert.Equal(t, messages, result)
	})
}

// TestTokenLimitStrategy_MessagesExceedingLimit tests that oldest messages are removed when limit exceeded
func TestTokenLimitStrategy_MessagesExceedingLimit(t *testing.T) {
	t.Run("remove oldest messages to get under limit", func(t *testing.T) {
		initTokenizer(t)

		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "First message - this should be removed"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "text", Text: "Second message - this should be removed too"},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Third message - this should be kept"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "text", Text: "Fourth message - this should be kept as well"},
				},
			},
		}

		// Count tokens for messages we want to keep (last 2)
		ctx := context.Background()
		messagesToKeep := messages[2:]
		tokensToKeep, err := tokenizer.CountMessagePartsTokens(ctx, messagesToKeep)
		require.NoError(t, err)

		// Set limit to keep only last 2 messages (with small buffer)
		strategy := &TokenLimitStrategy{LimitTokens: tokensToKeep + 5}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Less(t, len(result), len(messages), "some messages should be removed")

		// Verify result is under token limit
		resultTokens, err := tokenizer.CountMessagePartsTokens(ctx, result)
		require.NoError(t, err)
		assert.LessOrEqual(t, resultTokens, strategy.LimitTokens, "result should be under token limit")

		// Verify the oldest messages were removed (check by content)
		if len(result) > 0 {
			assert.NotContains(t, result[0].Parts[0].Text, "First message", "oldest message should be removed")
		}
	})

	t.Run("remove multiple messages when needed", func(t *testing.T) {
		initTokenizer(t)

		// Create many messages
		messages := []model.Message{
			{Role: "user", Parts: []model.Part{{Type: "text", Text: "Message 1 - remove"}}},
			{Role: "assistant", Parts: []model.Part{{Type: "text", Text: "Message 2 - remove"}}},
			{Role: "user", Parts: []model.Part{{Type: "text", Text: "Message 3 - remove"}}},
			{Role: "assistant", Parts: []model.Part{{Type: "text", Text: "Message 4 - remove"}}},
			{Role: "user", Parts: []model.Part{{Type: "text", Text: "Message 5 - keep"}}},
			{Role: "assistant", Parts: []model.Part{{Type: "text", Text: "Message 6 - keep"}}},
		}

		// Count tokens for last message only
		ctx := context.Background()
		lastMessage := messages[len(messages)-1:]
		tokensForLast, err := tokenizer.CountMessagePartsTokens(ctx, lastMessage)
		require.NoError(t, err)

		// Set a very low limit to force removal of most messages
		strategy := &TokenLimitStrategy{LimitTokens: tokensForLast + 10}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		assert.Less(t, len(result), len(messages), "multiple messages should be removed")

		// Verify result is under limit
		resultTokens, err := tokenizer.CountMessagePartsTokens(ctx, result)
		require.NoError(t, err)
		assert.LessOrEqual(t, resultTokens, strategy.LimitTokens)
	})

	t.Run("very low limit removes all or nearly all messages", func(t *testing.T) {
		initTokenizer(t)

		messages := []model.Message{
			{Role: "user", Parts: []model.Part{{Type: "text", Text: "This is a relatively long message that will definitely exceed a very small token limit"}}},
			{Role: "assistant", Parts: []model.Part{{Type: "text", Text: "Another message"}}},
		}

		// Set an extremely low limit
		strategy := &TokenLimitStrategy{LimitTokens: 5}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)
		// Result should have very few or no messages
		assert.LessOrEqual(t, len(result), len(messages))

		// If there are any messages, verify under limit
		if len(result) > 0 {
			ctx := context.Background()
			resultTokens, err := tokenizer.CountMessagePartsTokens(ctx, result)
			require.NoError(t, err)
			assert.LessOrEqual(t, resultTokens, strategy.LimitTokens)
		}
	})
}

// TestTokenLimitStrategy_ToolCallPairing tests that tool-call and tool-result pairs are removed together
func TestTokenLimitStrategy_ToolCallPairing(t *testing.T) {
	t.Run("remove tool-call with its paired tool-result", func(t *testing.T) {
		initTokenizer(t)

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
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call_123", "name": "get_weather"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Sunny, 75°F", Meta: map[string]interface{}{"tool_call_id": "call_123"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Thank you!"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "text", Text: "You're welcome!"},
				},
			},
		}

		// Count tokens for last 2 messages only
		ctx := context.Background()
		lastTwo := messages[3:]
		tokensForLastTwo, err := tokenizer.CountMessagePartsTokens(ctx, lastTwo)
		require.NoError(t, err)

		// Set limit to keep only last 2 messages, forcing removal of tool-call pair
		strategy := &TokenLimitStrategy{LimitTokens: tokensForLastTwo + 5}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)

		// Verify neither the tool-call nor its result are in the output
		hasToolCall := false
		hasToolResult := false
		for _, msg := range result {
			for _, part := range msg.Parts {
				if part.Type == "tool-call" {
					if meta, ok := part.Meta["id"].(string); ok && meta == "call_123" {
						hasToolCall = true
					}
				}
				if part.Type == "tool-result" {
					if meta, ok := part.Meta["tool_call_id"].(string); ok && meta == "call_123" {
						hasToolResult = true
					}
				}
			}
		}

		assert.False(t, hasToolCall, "tool-call should be removed")
		assert.False(t, hasToolResult, "tool-result should be removed with its tool-call")
	})

	t.Run("multiple tool-call pairs removed together", func(t *testing.T) {
		initTokenizer(t)

		messages := []model.Message{
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call_1", "name": "tool1"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 1", Meta: map[string]interface{}{"tool_call_id": "call_1"}},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call_2", "name": "tool2"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result 2", Meta: map[string]interface{}{"tool_call_id": "call_2"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Final message to keep"},
				},
			},
		}

		// Count tokens for last 2 messages only
		ctx := context.Background()
		lastMessages := messages[3:]
		tokensForLast, err := tokenizer.CountMessagePartsTokens(ctx, lastMessages)
		require.NoError(t, err)

		// Set limit to exactly the last message tokens to force removal of all tool pairs
		strategy := &TokenLimitStrategy{LimitTokens: tokensForLast}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)

		// Verify no tool-calls or tool-results remain
		for _, msg := range result {
			for _, part := range msg.Parts {
				assert.NotEqual(t, "tool-call", part.Type, "all tool-calls should be removed")
				assert.NotEqual(t, "tool-result", part.Type, "all tool-results should be removed")
			}
		}
	})

	t.Run("assistant message with multiple tool-calls", func(t *testing.T) {
		initTokenizer(t)

		messages := []model.Message{
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call_a", "name": "tool_a"}},
					{Type: "tool-call", Meta: map[string]interface{}{"id": "call_b", "name": "tool_b"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result A", Meta: map[string]interface{}{"tool_call_id": "call_a"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "tool-result", Text: "Result B", Meta: map[string]interface{}{"tool_call_id": "call_b"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Keep this message"},
				},
			},
		}

		// Count tokens for last message
		ctx := context.Background()
		lastMessage := messages[3:]
		tokensForLast, err := tokenizer.CountMessagePartsTokens(ctx, lastMessage)
		require.NoError(t, err)

		// Set limit to keep only last message
		strategy := &TokenLimitStrategy{LimitTokens: tokensForLast + 5}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)

		// When assistant message with multiple tool-calls is removed,
		// both tool-results should also be removed
		hasCallA := false
		hasCallB := false
		hasResultA := false
		hasResultB := false

		for _, msg := range result {
			for _, part := range msg.Parts {
				if part.Meta != nil {
					if id, ok := part.Meta["id"].(string); ok {
						if id == "call_a" {
							hasCallA = true
						}
						if id == "call_b" {
							hasCallB = true
						}
					}
					if id, ok := part.Meta["tool_call_id"].(string); ok {
						if id == "call_a" {
							hasResultA = true
						}
						if id == "call_b" {
							hasResultB = true
						}
					}
				}
			}
		}

		assert.False(t, hasCallA, "tool-call A should be removed")
		assert.False(t, hasCallB, "tool-call B should be removed")
		assert.False(t, hasResultA, "tool-result A should be removed with its call")
		assert.False(t, hasResultB, "tool-result B should be removed with its call")
	})

	t.Run("orphaned tool-result without matching call", func(t *testing.T) {
		initTokenizer(t)

		messages := []model.Message{
			{
				Role: "user",
				Parts: []model.Part{
					// Orphaned tool-result (no matching tool-call in messages)
					{Type: "tool-result", Text: "Orphaned result with some text to make it have tokens", Meta: map[string]interface{}{"tool_call_id": "nonexistent"}},
				},
			},
			{
				Role: "user",
				Parts: []model.Part{
					{Type: "text", Text: "Second message with content"},
				},
			},
			{
				Role: "assistant",
				Parts: []model.Part{
					{Type: "text", Text: "Final message"},
				},
			},
		}

		// Count tokens for last message only
		ctx := context.Background()
		lastMessage := messages[2:]
		tokensForLast, err := tokenizer.CountMessagePartsTokens(ctx, lastMessage)
		require.NoError(t, err)

		// Set limit to keep only last message, forcing removal of first two
		strategy := &TokenLimitStrategy{LimitTokens: tokensForLast + 2}

		result, err := strategy.Apply(messages)

		require.NoError(t, err)

		// Orphaned tool-result should be removable independently (not kept just because it's a tool-result)
		hasOrphanedResult := false
		for _, msg := range result {
			for _, part := range msg.Parts {
				if part.Type == "tool-result" {
					if part.Meta != nil {
						if meta, ok := part.Meta["tool_call_id"].(string); ok && meta == "nonexistent" {
							hasOrphanedResult = true
						}
					}
				}
			}
		}

		assert.False(t, hasOrphanedResult, "orphaned tool-result can be removed independently")

		// Verify we kept fewer messages
		assert.Less(t, len(result), len(messages), "some messages should be removed")
	})
}
