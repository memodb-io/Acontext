package editor

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateMiddleOutStrategy(t *testing.T) {
	_, err := createMiddleOutStrategy(map[string]interface{}{})
	require.Error(t, err)
	require.Contains(t, err.Error(), "token_reduce_to")

	_, err = createMiddleOutStrategy(map[string]interface{}{"token_reduce_to": "bad"})
	require.Error(t, err)
	require.Contains(t, err.Error(), "must be an integer")
}
