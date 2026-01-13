package editor

import (
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
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
	return messages, nil
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
