package auth

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadKeyStore_NoFile(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	ks, err := LoadKeyStore()
	require.NoError(t, err)
	assert.NotNil(t, ks)
	assert.Empty(t, ks.Keys)
	assert.Empty(t, ks.DefaultProject)
}

func TestSaveAndLoadKeyStore_Roundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	ks := &KeyStore{
		DefaultProject: "proj-1",
		Keys: map[string]string{
			"proj-1": "sk-ac-key1",
			"proj-2": "sk-ac-key2",
		},
	}
	err := SaveKeyStore(ks)
	require.NoError(t, err)

	loaded, err := LoadKeyStore()
	require.NoError(t, err)
	assert.Equal(t, "proj-1", loaded.DefaultProject)
	assert.Equal(t, "sk-ac-key1", loaded.Keys["proj-1"])
	assert.Equal(t, "sk-ac-key2", loaded.Keys["proj-2"])
}

func TestSetAndGetProjectKey(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	err := SetProjectKey("proj-1", "sk-ac-abc")
	require.NoError(t, err)

	key := GetProjectKey("proj-1")
	assert.Equal(t, "sk-ac-abc", key)
}

func TestSetDefaultProject(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	err := SetDefaultProject("proj-1")
	require.NoError(t, err)

	ks, err := LoadKeyStore()
	require.NoError(t, err)
	assert.Equal(t, "proj-1", ks.DefaultProject)
}

func TestRemoveProjectKey_ClearsDefaultIfMatched(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	_ = SetProjectKey("proj-1", "sk-ac-abc")
	_ = SetDefaultProject("proj-1")

	err := RemoveProjectKey("proj-1")
	require.NoError(t, err)

	ks, err := LoadKeyStore()
	require.NoError(t, err)
	assert.Empty(t, ks.Keys["proj-1"])
	assert.Empty(t, ks.DefaultProject)
}

func TestRemoveProjectKey_KeepsDefaultIfDifferent(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	_ = SetProjectKey("proj-1", "sk-ac-abc")
	_ = SetProjectKey("proj-2", "sk-ac-def")
	_ = SetDefaultProject("proj-1")

	err := RemoveProjectKey("proj-2")
	require.NoError(t, err)

	ks, err := LoadKeyStore()
	require.NoError(t, err)
	assert.Empty(t, ks.Keys["proj-2"])
	assert.Equal(t, "proj-1", ks.DefaultProject)
}

func TestGetProjectKey_Missing(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	key := GetProjectKey("nonexistent")
	assert.Equal(t, "", key)
}

func TestKeyStoreFilePermissions(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("HOME", tmpDir)

	err := SetProjectKey("proj-1", "sk-ac-test")
	require.NoError(t, err)

	path := filepath.Join(tmpDir, ".acontext", credentialsFileName)
	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0600), info.Mode().Perm())
}
