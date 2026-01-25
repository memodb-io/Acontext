package service

import (
	"context"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
)

// countMessageTokensWithCache returns total tokens and per-message token counts.
func countMessageTokensWithCache(ctx context.Context, messages []model.Message) (int, []int, error) {
	// Pre-size the per-message cache to the message count.
	perMessage := make([]int, len(messages))
	total := 0
	for i, msg := range messages {
		// Count tokens for this message once.
		count, err := tokenizer.CountSingleMessageTokens(ctx, msg)
		if err != nil {
			return 0, nil, err
		}
		perMessage[i] = count
		total += count
	}
	return total, perMessage, nil
}

// messageHasToolResult returns true when the message contains any tool-result part.
func messageHasToolResult(msg model.Message) bool {
	for _, part := range msg.Parts {
		if part.Type == "tool-result" {
			return true
		}
	}
	return false
}

// collectToolResultMessageIndexes returns indexes of messages that contain tool-result parts.
func collectToolResultMessageIndexes(messages []model.Message) []int {
	indexes := make([]int, 0, len(messages))
	for i, msg := range messages {
		if messageHasToolResult(msg) {
			indexes = append(indexes, i)
		}
	}
	return indexes
}

// estimateTokensRemovedAfterAutoTrim estimates token reduction using per-message cache.
func estimateTokensRemovedAfterAutoTrim(
	ctx context.Context,
	originalTokens int,
	originalPerMessage []int,
	editedMessages []model.Message,
) (int, error) {
	// Fall back to full count when cache is missing or length mismatch.
	if originalPerMessage == nil || len(originalPerMessage) != len(editedMessages) {
		editedTokens, err := tokenizer.CountMessagePartsTokens(ctx, editedMessages)
		if err != nil {
			return 0, err
		}
		removed := originalTokens - editedTokens
		if removed < 0 {
			removed = 0
		}
		return removed, nil
	}

	// Recompute tokens only for messages that contain tool-result parts.
	editedTokens := originalTokens
	changedIndexes := collectToolResultMessageIndexes(editedMessages)
	for _, idx := range changedIndexes {
		oldCount := originalPerMessage[idx]
		newCount, err := tokenizer.CountSingleMessageTokens(ctx, editedMessages[idx])
		if err != nil {
			return 0, err
		}
		editedTokens = editedTokens - oldCount + newCount
	}

	removed := originalTokens - editedTokens
	if removed < 0 {
		removed = 0
	}
	return removed, nil
}
