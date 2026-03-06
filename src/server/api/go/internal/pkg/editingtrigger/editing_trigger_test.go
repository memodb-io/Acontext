package editingtrigger

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildChecks_Branches(t *testing.T) {
	ctx := context.Background()

	positive := 1
	zero := 0

	msg := model.Message{
		ID:   uuid.New(),
		Role: model.RoleUser,
		Parts: []model.Part{
			model.NewTextPart("hello world"),
		},
	}

	t.Run("nil trigger returns no checks", func(t *testing.T) {
		checks := BuildChecks(nil)
		assert.Len(t, checks, 0)
	})

	t.Run("nil token_gte returns no checks", func(t *testing.T) {
		checks := BuildChecks(&Trigger{})
		assert.Len(t, checks, 0)
	})

	t.Run("non-positive token_gte returns no checks", func(t *testing.T) {
		checks := BuildChecks(&Trigger{TokenGte: &zero})
		assert.Len(t, checks, 0)
	})

	t.Run("positive token_gte adds a check and evaluates", func(t *testing.T) {
		calls := 0
		checks := BuildChecks(&Trigger{TokenGte: &positive})
		assert.Len(t, checks, 1)

		eval := NewEval(uuid.New(), []model.Message{msg}, func(context.Context, []model.Message) (int, error) {
			calls++
			return 5, nil
		})

		ok, err := checks[0](ctx, eval)
		assert.NoError(t, err)
		assert.True(t, ok)
		assert.Equal(t, 1, calls)

		tokens, cached := eval.CachedTokens()
		require.True(t, cached)
		assert.Equal(t, 5, tokens)
	})
}

func TestTriggerValidate_Branches(t *testing.T) {
	positive := 10
	zero := 0

	t.Run("empty trigger returns ErrNoSupportedTrigger", func(t *testing.T) {
		err := (Trigger{}).Validate()
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrNoSupportedTrigger)
	})

	t.Run("positive token_gte is valid", func(t *testing.T) {
		err := (Trigger{TokenGte: &positive}).Validate()
		assert.NoError(t, err)
	})

	t.Run("non-positive token_gte returns ErrTokenGteMustBeGreater", func(t *testing.T) {
		err := (Trigger{TokenGte: &zero}).Validate()
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrTokenGteMustBeGreater)
	})
}

func TestTriggerUnmarshalJSON_Branches(t *testing.T) {
	t.Run("unknown trigger key returns UnsupportedTriggerError", func(t *testing.T) {
		var trig Trigger
		err := json.Unmarshal([]byte(`{"unknown":1}`), &trig)
		require.Error(t, err)
		var unsupportedErr UnsupportedTriggerError
		assert.ErrorAs(t, err, &unsupportedErr)
		assert.Equal(t, "unknown", unsupportedErr.Key)
	})

	t.Run("token_gte null fails Validate", func(t *testing.T) {
		var trig Trigger
		err := json.Unmarshal([]byte(`{"token_gte":null}`), &trig)
		require.NoError(t, err)
		err = trig.Validate()
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrTokenGteMustBeGreater)
	})

	t.Run("invalid token_gte type returns parse error", func(t *testing.T) {
		var trig Trigger
		err := json.Unmarshal([]byte(`{"token_gte":"bad"}`), &trig)
		require.Error(t, err)
		assert.True(t, strings.Contains(err.Error(), "invalid token_gte"))
	})
}

func TestEvalTokens_UsesCachedValue(t *testing.T) {
	calls := 0
	eval := NewEval(uuid.New(), nil, func(context.Context, []model.Message) (int, error) {
		calls++
		return 123, nil
	})

	first, err := eval.Tokens(context.Background())
	require.NoError(t, err)
	second, err := eval.Tokens(context.Background())
	require.NoError(t, err)

	assert.Equal(t, 123, first)
	assert.Equal(t, 123, second)
	assert.Equal(t, 1, calls)
}

func TestEvalTokens_PropagatesCounterError(t *testing.T) {
	expectedErr := errors.New("counter failed")
	eval := NewEval(uuid.New(), nil, func(context.Context, []model.Message) (int, error) {
		return 0, expectedErr
	})

	_, err := eval.Tokens(context.Background())
	require.Error(t, err)
	assert.ErrorIs(t, err, expectedErr)
}
