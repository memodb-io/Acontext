package editor

import (
	"context"
	"testing"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
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

	msgs := []model.Message{
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "m0"}}},
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "m1"}}},
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "m2"}}},
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "m3"}}},
	}
	total, err := tokenizer.CountMessagePartsTokens(context.Background(), msgs)
	require.NoError(t, err)
	midTokens, err := tokenizer.CountSingleMessageTokens(context.Background(), msgs[2])
	require.NoError(t, err)
	res, err := (&MiddleOutStrategy{TokenReduceTo: total - midTokens}).Apply(msgs)
	require.NoError(t, err)
	require.Len(t, res, 3)
	require.Equal(t, []string{"m0", "m1", "m3"}, []string{res[0].Parts[0].Text, res[1].Parts[0].Text, res[2].Parts[0].Text})

	two := []model.Message{
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "old"}}},
		{Role: "user", Parts: []model.Part{{Type: "text", Text: "new"}}},
	}
	newTokens, err := tokenizer.CountSingleMessageTokens(context.Background(), two[1])
	require.NoError(t, err)
	res2, err := (&MiddleOutStrategy{TokenReduceTo: newTokens}).Apply(two)
	require.NoError(t, err)
	require.Len(t, res2, 1)
	require.Equal(t, "new", res2[0].Parts[0].Text)
}
