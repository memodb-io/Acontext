package editor

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
)

// TokenLimitStrategy removes oldest messages until total token count is within limit
type TokenLimitStrategy struct {
	LimitTokens int
}

// Name returns the strategy name
func (s *TokenLimitStrategy) Name() string {
	return "token_limit"
}

// Apply removes oldest messages until total token count is within the limit
// Maintains tool-call/tool-result pairing
func (s *TokenLimitStrategy) Apply(messages []model.Message) ([]model.Message, error) {
	if s.LimitTokens <= 0 {
		return nil, fmt.Errorf("limit_tokens must be > 0, got %d", s.LimitTokens)
	}

	if len(messages) == 0 {
		return messages, nil
	}

	ctx := context.Background()

	// Count total tokens
	totalTokens, err := tokenizer.CountMessagePartsTokens(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("failed to count tokens: %w", err)
	}

	// If already within limit, return as-is
	if totalTokens <= s.LimitTokens {
		return messages, nil
	}

	// Build a map of tool-call IDs to their corresponding tool-result message indices
	// This allows O(1) lookup when we need to remove paired tool-results
	toolCallIDToResultIndex := make(map[string]int)
	for i, msg := range messages {
		for _, part := range msg.Parts {
			if part.Type == model.PartTypeToolResult {
				if toolCallID := part.ToolCallID(); toolCallID != "" {
					toolCallIDToResultIndex[toolCallID] = i
				}
			}
		}
	}

	// Mark messages to remove, starting from the oldest
	toRemove := make(map[int]bool)

	// Remove messages one by one until we're within the limit
	for i := 0; i < len(messages) && totalTokens > s.LimitTokens; i++ {
		if toRemove[i] {
			continue // Already marked for removal
		}

		// Count tokens for this message
		msgTokens, err := tokenizer.CountSingleMessageTokens(ctx, messages[i])
		if err != nil {
			return nil, fmt.Errorf("failed to count tokens for message %d: %w", i, err)
		}

		// Mark this message for removal
		toRemove[i] = true
		totalTokens -= msgTokens

		// Check if this message has tool-call parts and remove corresponding tool-results
		for _, part := range messages[i].Parts {
			if part.Type == model.PartTypeToolCall {
				if id := part.ID(); id != "" {
					// Use the map to find the corresponding tool-result message (O(1) lookup)
					if resultIdx, found := toolCallIDToResultIndex[id]; found && !toRemove[resultIdx] {
						// Mark the tool-result message for removal
						resultTokens, err := tokenizer.CountSingleMessageTokens(ctx, messages[resultIdx])
						if err != nil {
							return nil, fmt.Errorf("failed to count tokens for message %d: %w", resultIdx, err)
						}
						toRemove[resultIdx] = true
						totalTokens -= resultTokens
					}
				}
			}
		}
	}

	// Build the result by excluding removed messages
	result := make([]model.Message, 0, len(messages)-len(toRemove))
	for i, msg := range messages {
		if !toRemove[i] {
			result = append(result, msg)
		}
	}

	return result, nil
}

// createTokenLimitStrategy creates a TokenLimitStrategy from config params
func createTokenLimitStrategy(params map[string]interface{}) (EditStrategy, error) {
	// Extract limit_tokens parameter (required)
	limitTokens, ok := params["limit_tokens"]
	if !ok {
		return nil, fmt.Errorf("token_limit strategy requires 'limit_tokens' parameter")
	}

	var limitTokensInt int
	// Handle both float64 (from JSON unmarshaling) and int
	switch v := limitTokens.(type) {
	case float64:
		limitTokensInt = int(v)
	case int:
		limitTokensInt = v
	default:
		return nil, fmt.Errorf("limit_tokens must be an integer, got %T", limitTokens)
	}

	if limitTokensInt <= 0 {
		return nil, fmt.Errorf("limit_tokens must be > 0, got %d", limitTokensInt)
	}

	return &TokenLimitStrategy{
		LimitTokens: limitTokensInt,
	}, nil
}
