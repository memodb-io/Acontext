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

	_, err = createMiddleOutStrategy(map[string]interface{}{"token_reduce_to": 12.5})
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
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "Hello"}}},
		{Role: model.RoleAssistant, Parts: []model.Part{{Type: model.PartTypeText, Text: "World"}}},
	}
	result, err := (&MiddleOutStrategy{TokenReduceTo: 1_000_000}).Apply(messages)
	require.NoError(t, err)
	require.Equal(t, messages, result)

	msgs := []model.Message{
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "m0"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "m1"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "m2"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "m3"}}},
	}
	total, err := tokenizer.CountMessagePartsTokens(context.Background(), msgs)
	require.NoError(t, err)
	midTokens, err := tokenizer.CountSingleMessageTokens(context.Background(), msgs[2])
	require.NoError(t, err)
	res, err := (&MiddleOutStrategy{TokenReduceTo: total - midTokens}).Apply(msgs)
	require.NoError(t, err)
	require.Len(t, res, 3)
	require.Equal(t, []string{"m0", "m1", "m3"}, []string{res[0].Parts[0].Text, res[1].Parts[0].Text, res[2].Parts[0].Text})

	odd := []model.Message{
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "first"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "middle"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "last"}}},
	}
	total, err = tokenizer.CountMessagePartsTokens(context.Background(), odd)
	require.NoError(t, err)
	midTokens, err = tokenizer.CountSingleMessageTokens(context.Background(), odd[1])
	require.NoError(t, err)
	resOdd, err := (&MiddleOutStrategy{TokenReduceTo: total - midTokens}).Apply(odd)
	require.NoError(t, err)
	require.Len(t, resOdd, 2)
	require.Equal(t, "first", resOdd[0].Parts[0].Text)
	require.Equal(t, "last", resOdd[1].Parts[0].Text)

	two := []model.Message{
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "old"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "new"}}},
	}
	newTokens, err := tokenizer.CountSingleMessageTokens(context.Background(), two[1])
	require.NoError(t, err)
	res2, err := (&MiddleOutStrategy{TokenReduceTo: newTokens}).Apply(two)
	require.NoError(t, err)
	require.Len(t, res2, 1)
	require.Equal(t, "new", res2[0].Parts[0].Text)

	withToolCall := []model.Message{
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "a"}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "b"}}},
		{Role: model.RoleAssistant, Parts: []model.Part{{Type: model.PartTypeToolCall, Meta: map[string]interface{}{model.MetaKeyID: "call_1", model.MetaKeyName: "t", model.MetaKeyArguments: "{}"}}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeToolResult, Text: "ok", Meta: map[string]interface{}{model.MetaKeyToolCallID: "call_1"}}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "c"}}},
	}
	total, err = tokenizer.CountMessagePartsTokens(context.Background(), withToolCall)
	require.NoError(t, err)
	callTokens, err := tokenizer.CountSingleMessageTokens(context.Background(), withToolCall[2])
	require.NoError(t, err)
	res3, err := (&MiddleOutStrategy{TokenReduceTo: total - callTokens}).Apply(withToolCall)
	require.NoError(t, err)
	require.Len(t, res3, 3)
	require.Equal(t, []string{"a", "b", "c"}, []string{res3[0].Parts[0].Text, res3[1].Parts[0].Text, res3[2].Parts[0].Text})

	cascade := []model.Message{
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "s"}}},
		{Role: model.RoleAssistant, Parts: []model.Part{
			{Type: model.PartTypeToolCall, Meta: map[string]interface{}{model.MetaKeyID: "call_a", model.MetaKeyName: "a", model.MetaKeyArguments: "{}"}},
			{Type: model.PartTypeToolCall, Meta: map[string]interface{}{model.MetaKeyID: "call_b", model.MetaKeyName: "b", model.MetaKeyArguments: "{}"}},
		}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeToolResult, Text: "ra", Meta: map[string]interface{}{model.MetaKeyToolCallID: "call_a"}}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeToolResult, Text: "rb", Meta: map[string]interface{}{model.MetaKeyToolCallID: "call_b"}}}},
		{Role: model.RoleUser, Parts: []model.Part{{Type: model.PartTypeText, Text: "e"}}},
	}
	total, err = tokenizer.CountMessagePartsTokens(context.Background(), cascade)
	require.NoError(t, err)
	callTokens, err = tokenizer.CountSingleMessageTokens(context.Background(), cascade[1])
	require.NoError(t, err)
	res4, err := (&MiddleOutStrategy{TokenReduceTo: total - callTokens}).Apply(cascade)
	require.NoError(t, err)
	require.Len(t, res4, 2)
	require.Equal(t, []string{"s", "e"}, []string{res4[0].Parts[0].Text, res4[1].Parts[0].Text})
}
