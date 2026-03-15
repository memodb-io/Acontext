package auth

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthLoadSaveClear(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	// Load non-existent → nil
	af, err := Load()
	require.NoError(t, err)
	assert.Nil(t, af)

	// Not logged in
	assert.False(t, IsLoggedIn())

	// Save
	af = &AuthFile{
		AccessToken:  "test-token",
		RefreshToken: "test-refresh",
		ExpiresAt:    time.Now().Add(1 * time.Hour).Unix(),
		User: AuthUser{
			ID:    "user-123",
			Email: "test@example.com",
		},
	}
	err = Save(af)
	require.NoError(t, err)

	// Now logged in
	assert.True(t, IsLoggedIn())

	// Load back
	af2, err := Load()
	require.NoError(t, err)
	assert.Equal(t, "test-token", af2.AccessToken)
	assert.Equal(t, "test@example.com", af2.User.Email)

	// Save a credential key so we can verify Clear removes it
	err = SetProjectKey("proj-1", "sk-ac-test")
	require.NoError(t, err)
	assert.Equal(t, "sk-ac-test", GetProjectKey("proj-1"))

	// Clear
	err = Clear()
	require.NoError(t, err)
	assert.False(t, IsLoggedIn())

	// Verify credentials.json is also removed
	assert.Equal(t, "", GetProjectKey("proj-1"))
	ks, ksErr := LoadKeyStore()
	require.NoError(t, ksErr)
	assert.Empty(t, ks.Keys)

	// Clear again (idempotent)
	err = Clear()
	require.NoError(t, err)
}

func TestIsExpired(t *testing.T) {
	af := &AuthFile{ExpiresAt: time.Now().Add(-1 * time.Minute).Unix()}
	assert.True(t, af.IsExpired())

	af = &AuthFile{ExpiresAt: time.Now().Add(1 * time.Hour).Unix()}
	assert.False(t, af.IsExpired())
}

func TestExpiresWithin(t *testing.T) {
	af := &AuthFile{ExpiresAt: time.Now().Add(3 * time.Minute).Unix()}
	assert.True(t, af.ExpiresWithin(5*time.Minute))
	assert.False(t, af.ExpiresWithin(1*time.Minute))
}

func TestMustLoad(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	// Not logged in
	_, err := MustLoad()
	assert.Error(t, err)

	// Save a token
	_ = Save(&AuthFile{
		AccessToken: "token",
		User:        AuthUser{ID: "u1", Email: "a@b.com"},
	})

	af, err := MustLoad()
	require.NoError(t, err)
	assert.Equal(t, "token", af.AccessToken)

	_ = os.Setenv("HOME", tmpDir) // ensure cleanup
}
