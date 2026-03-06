package editingtrigger

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
)

// Trigger defines trigger configuration for applying edit strategies.
// v0 supports only token_gte.
type Trigger struct {
	// TokenGte triggers edit strategies when token count is >= this value.
	TokenGte *int `json:"token_gte,omitempty"`

	rawKeys map[string]struct{} `json:"-"`
}

var (
	ErrNoSupportedTrigger    = errors.New("at least one supported trigger is required")
	ErrTokenGteMustBeGreater = errors.New("token_gte must be > 0")
)

type UnsupportedTriggerError struct {
	Key string
}

func (e UnsupportedTriggerError) Error() string {
	return fmt.Sprintf("unsupported trigger: %s", e.Key)
}

func (t *Trigger) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	t.TokenGte = nil
	t.rawKeys = make(map[string]struct{}, len(raw))

	for key, value := range raw {
		switch key {
		case "token_gte":
			t.rawKeys[key] = struct{}{}
			if err := json.Unmarshal(value, &t.TokenGte); err != nil {
				return fmt.Errorf("invalid token_gte: %w", err)
			}
		default:
			return UnsupportedTriggerError{Key: key}
		}
	}

	return nil
}

func (t Trigger) Validate() error {
	hasAnySupportedTrigger := len(t.rawKeys) > 0 || t.TokenGte != nil
	if !hasAnySupportedTrigger {
		return ErrNoSupportedTrigger
	}

	_, tokenGteProvided := t.rawKeys["token_gte"]
	if tokenGteProvided && t.TokenGte == nil {
		return ErrTokenGteMustBeGreater
	}
	if t.TokenGte != nil && *t.TokenGte <= 0 {
		return ErrTokenGteMustBeGreater
	}

	return nil
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
	if trigger == nil {
		return nil
	}

	checks := make([]Check, 0, 1)
	if trigger.TokenGte != nil && *trigger.TokenGte > 0 {
		threshold := *trigger.TokenGte
		checks = append(checks, func(ctx context.Context, eval *Eval) (bool, error) {
			tokens, err := eval.Tokens(ctx)
			if err != nil {
				return false, err
			}
			return tokens >= threshold, nil
		})
	}

	return checks
}
