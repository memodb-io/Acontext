package editingtrigger

import (
	"context"
	"errors"
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

func TestSameMessageOrderByID_Branches(t *testing.T) {
	id1 := uuid.MustParse("00000000-0000-0000-0000-000000000201")
	id2 := uuid.MustParse("00000000-0000-0000-0000-000000000202")
	id3 := uuid.MustParse("00000000-0000-0000-0000-000000000203")

	t.Run("length mismatch returns false", func(t *testing.T) {
		a := []model.Message{{ID: id1}}
		b := []model.Message{{ID: id1}, {ID: id2}}
		assert.False(t, SameMessageOrderByID(a, b))
	})

	t.Run("id mismatch returns false", func(t *testing.T) {
		a := []model.Message{{ID: id1}, {ID: id2}}
		b := []model.Message{{ID: id1}, {ID: id3}}
		assert.False(t, SameMessageOrderByID(a, b))
	})

	t.Run("same order returns true", func(t *testing.T) {
		a := []model.Message{{ID: id1}, {ID: id2}}
		b := []model.Message{{ID: id1}, {ID: id2}}
		assert.True(t, SameMessageOrderByID(a, b))
	})
}
