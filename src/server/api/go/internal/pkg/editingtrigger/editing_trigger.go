package editingtrigger

import (
	"context"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
)

// Trigger defines trigger configuration for applying edit strategies.
// v0 supports only token_gte.
type Trigger struct {
	// TokenGte triggers edit strategies when token count is >= this value.
	TokenGte *int `json:"token_gte,omitempty"`
}

// TokenCounter computes token count for a message slice.
type TokenCounter func(ctx context.Context, messages []model.Message) (int, error)

// Eval evaluates trigger checks and memoizes token count.
type Eval struct {
	sessionID uuid.UUID
	messages  []model.Message
	counter   TokenCounter

	tokenCount *int
}

func NewEval(sessionID uuid.UUID, messages []model.Message, counter TokenCounter) *Eval {
	return &Eval{
		sessionID: sessionID,
		messages:  messages,
		counter:   counter,
	}
}

func (e *Eval) Tokens(ctx context.Context) (int, error) {
	if e.tokenCount != nil {
		return *e.tokenCount, nil
	}

	tokens, err := e.counter(ctx, e.messages)
	if err != nil {
		return 0, err
	}

	e.tokenCount = &tokens
	return tokens, nil
}

func (e *Eval) Messages() []model.Message {
	return e.messages
}

func (e *Eval) CachedTokens() (int, bool) {
	if e.tokenCount == nil {
		return 0, false
	}
	return *e.tokenCount, true
}

type Check func(ctx context.Context, eval *Eval) (bool, error)

func BuildChecks(trigger *Trigger) []Check {
	builders := listCheckBuilders()
	checks := make([]Check, 0, len(builders))
	for _, builder := range builders {
		check, ok := builder(trigger)
		if ok {
			checks = append(checks, check)
		}
	}
	return checks
}

func SameMessageOrderByID(a, b []model.Message) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].ID != b[i].ID {
			return false
		}
	}
	return true
}
