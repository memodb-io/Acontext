package editor

import (
	"context"
	"fmt"
	"math"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
)

type MiddleOutStrategy struct{ TokenReduceTo int }

func (s *MiddleOutStrategy) Name() string { return "middle_out" }

func (s *MiddleOutStrategy) Apply(messages []model.Message) ([]model.Message, error) {
	if s.TokenReduceTo <= 0 {
		return nil, fmt.Errorf("token_reduce_to must be > 0, got %d", s.TokenReduceTo)
	}
	if len(messages) == 0 {
		return messages, nil
	}
	ctx := context.Background()
	messageTokens, totalTokens, err := countMessageTokens(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("failed to count tokens: %w", err)
	}
	if totalTokens <= s.TokenReduceTo {
		return messages, nil
	}
	result := messages
	resultTokens := messageTokens
	for totalTokens > s.TokenReduceTo && len(result) > 2 {
		mid := len(result) / 2
		var removedTokens int
		result, resultTokens, removedTokens = removeWithToolPairing(
			result,
			resultTokens,
			mid,
		)
		totalTokens -= removedTokens
	}
	for totalTokens > s.TokenReduceTo && len(result) > 0 {
		var removedTokens int
		result, resultTokens, removedTokens = removeWithToolPairing(
			result,
			resultTokens,
			0,
		)
		totalTokens -= removedTokens
	}
	return result, nil
}

func countMessageTokens(ctx context.Context, messages []model.Message) ([]int, int, error) {
	tokens := make([]int, len(messages))
	total := 0
	for i, message := range messages {
		count, err := tokenizer.CountSingleMessageTokens(ctx, message)
		if err != nil {
			return nil, 0, err
		}
		tokens[i] = count
		total += count
	}
	return tokens, total, nil
}

func removeWithToolPairing(messages []model.Message, messageTokens []int, idx int) ([]model.Message, []int, int) {
	toRemove := map[int]struct{}{idx: {}}
	queue := []int{idx}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, removedPart := range messages[current].Parts {
			switch removedPart.Type {
			case "tool-call":
				if removedPart.Meta == nil {
					continue
				}
				toolCallID, ok := removedPart.Meta["id"].(string)
				if !ok || toolCallID == "" {
					continue
				}
				enqueueToolPair(messages, toolCallID, toRemove, &queue)
			case "tool-result":
				if removedPart.Meta == nil {
					continue
				}
				toolCallID, ok := removedPart.Meta["tool_call_id"].(string)
				if !ok || toolCallID == "" {
					continue
				}
				enqueueToolPair(messages, toolCallID, toRemove, &queue)
			}
		}
	}
	removedTokens := 0
	out := make([]model.Message, 0, len(messages)-1)
	outTokens := make([]int, 0, len(messageTokens)-1)
	for i, msg := range messages {
		if _, ok := toRemove[i]; ok {
			removedTokens += messageTokens[i]
			continue
		}
		out = append(out, msg)
		outTokens = append(outTokens, messageTokens[i])
	}
	return out, outTokens, removedTokens
}

func enqueueToolPair(messages []model.Message, toolCallID string, toRemove map[int]struct{}, queue *[]int) {
	for i, msg := range messages {
		if _, ok := toRemove[i]; ok {
			continue
		}
		for _, part := range msg.Parts {
			if part.Meta == nil {
				continue
			}
			if part.Type == "tool-call" {
				if id, ok := part.Meta["id"].(string); ok && id == toolCallID {
					toRemove[i] = struct{}{}
					*queue = append(*queue, i)
					break
				}
			}
			if part.Type == "tool-result" {
				if id, ok := part.Meta["tool_call_id"].(string); ok && id == toolCallID {
					toRemove[i] = struct{}{}
					*queue = append(*queue, i)
					break
				}
			}
		}
	}
}

func createMiddleOutStrategy(params map[string]interface{}) (EditStrategy, error) {
	rawTokenReduceTo, ok := params["token_reduce_to"]
	if !ok {
		return nil, fmt.Errorf("middle_out strategy requires 'token_reduce_to' parameter")
	}
	var tokenReduceTo int
	switch v := rawTokenReduceTo.(type) {
	case float64:
		if v != math.Trunc(v) {
			return nil, fmt.Errorf("token_reduce_to must be an integer, got %v", v)
		}
		tokenReduceTo = int(v)
	case int:
		tokenReduceTo = v
	default:
		return nil, fmt.Errorf("token_reduce_to must be an integer, got %T", v)
	}
	if tokenReduceTo <= 0 {
		return nil, fmt.Errorf("token_reduce_to must be > 0, got %d", tokenReduceTo)
	}
	return &MiddleOutStrategy{TokenReduceTo: tokenReduceTo}, nil
}
