package editor

import (
	"context"
	"fmt"

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
	totalTokens, err := tokenizer.CountMessagePartsTokens(ctx, messages)
	if err != nil {
		return nil, fmt.Errorf("failed to count tokens: %w", err)
	}
	if totalTokens <= s.TokenReduceTo {
		return messages, nil
	}
	result := messages
	for totalTokens > s.TokenReduceTo && len(result) > 2 {
		mid := len(result) / 2
		result = removeWithToolPairing(result, mid)
		totalTokens, err = tokenizer.CountMessagePartsTokens(ctx, result)
		if err != nil {
			return nil, fmt.Errorf("failed to count tokens: %w", err)
		}
	}
	for totalTokens > s.TokenReduceTo && len(result) > 0 {
		result = removeWithToolPairing(result, 0)
		totalTokens, err = tokenizer.CountMessagePartsTokens(ctx, result)
		if err != nil {
			return nil, fmt.Errorf("failed to count tokens: %w", err)
		}
	}
	return result, nil
}

func removeWithToolPairing(messages []model.Message, idx int) []model.Message {
	toRemove := map[int]struct{}{idx: {}}
	queue := []int{idx}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, removedPart := range messages[current].Parts {
			if removedPart.Type != "tool-call" || removedPart.Meta == nil {
				continue
			}
			toolCallID, ok := removedPart.Meta["id"].(string)
			if !ok || toolCallID == "" {
				continue
			}
			for i, msg := range messages {
				for _, part := range msg.Parts {
					if part.Type == "tool-result" && part.Meta != nil {
						if id, ok := part.Meta["tool_call_id"].(string); ok && id == toolCallID {
							if _, ok := toRemove[i]; !ok {
								toRemove[i] = struct{}{}
								queue = append(queue, i)
							}
							break
						}
					}
				}
			}
		}
	}
	out := make([]model.Message, 0, len(messages)-1)
	for i, msg := range messages {
		if _, ok := toRemove[i]; ok {
			continue
		}
		out = append(out, msg)
	}
	return out
}

func createMiddleOutStrategy(params map[string]interface{}) (EditStrategy, error) {
	rawTokenReduceTo, ok := params["token_reduce_to"]
	if !ok {
		return nil, fmt.Errorf("middle_out strategy requires 'token_reduce_to' parameter")
	}
	var tokenReduceTo int
	switch v := rawTokenReduceTo.(type) {
	case float64:
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
