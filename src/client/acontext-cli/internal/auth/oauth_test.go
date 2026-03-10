package auth

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateState(t *testing.T) {
	s1, err := generateState()
	require.NoError(t, err)
	assert.Len(t, s1, 32) // 16 bytes → 32 hex chars

	s2, err := generateState()
	require.NoError(t, err)
	assert.NotEqual(t, s1, s2)
}
