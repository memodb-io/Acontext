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
	if len(result) > 2 {
		mid := len(result) / 2
		result = append(result[:mid], result[mid+1:]...)
	}
	return result, nil
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
