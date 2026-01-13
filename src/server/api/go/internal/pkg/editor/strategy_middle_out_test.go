package editor

import (
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/require"
)

func TestCreateMiddleOutStrategy(t *testing.T) {
	_, err := createMiddleOutStrategy(map[string]interface{}{})
	require.Error(t, err)
	require.Contains(t, err.Error(), "token_reduce_to")

	_, err = createMiddleOutStrategy(map[string]interface{}{"token_reduce_to": "bad"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "must be an integer")

	_, err = createMiddleOutStrategy(map[string]interface{}{"token_reduce_to": 0})
	require.Error(t, err)
	require.Contains(t, err.Error(), "> 0")

	strategy, err := createMiddleOutStrategy(map[string]interface{}{"token_reduce_to": 123})
	require.NoError(t, err)
	mos, ok := strategy.(*MiddleOutStrategy)
	require.True(t, ok)
	require.Equal(t, 123, mos.TokenReduceTo)
}

func TestMiddleOutStrategy_Apply(t *testing.T) {
	initTokenizer(t)
	messages := []model.Message{
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "Hello"}}},
		{Role: "assistant", Parts: []model.Part{{Type: "text", Text: "World"}}},
	}
	result, err := (&MiddleOutStrategy{TokenReduceTo: 1_000_000}).Apply(messages)
	require.NoError(t, err)
	require.Equal(t, messages, result)
}
