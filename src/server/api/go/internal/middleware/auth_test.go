package middleware

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

func TestProjectAuthCache_RoundTrip(t *testing.T) {
	// Simulate what lookupProject does: marshal a projectAuthCache, unmarshal it back,
	// and verify secret fields survive the round-trip.
	original := model.Project{
		ID:                uuid.New(),
		SecretKeyHMAC:     "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
		SecretKeyHashPHC:  "$argon2id$v=19$m=16384,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g",
		EncryptionEnabled: true,
	}

	// Marshal using the cache struct (same as lookupProject write-back)
	cached := projectAuthCache{
		ID:                original.ID.String(),
		SecretKeyHMAC:     original.SecretKeyHMAC,
		SecretKeyHashPHC:  original.SecretKeyHashPHC,
		EncryptionEnabled: original.EncryptionEnabled,
	}
	data, err := json.Marshal(&cached)
	require.NoError(t, err)

	// Unmarshal back (same as lookupProject cache-hit path)
	var restored projectAuthCache
	err = json.Unmarshal(data, &restored)
	require.NoError(t, err)

	assert.Equal(t, original.ID.String(), restored.ID)
	assert.Equal(t, original.SecretKeyHMAC, restored.SecretKeyHMAC)
	assert.Equal(t, original.SecretKeyHashPHC, restored.SecretKeyHashPHC)
	assert.Equal(t, original.EncryptionEnabled, restored.EncryptionEnabled)
}

func TestProjectAuthCache_OldFormatFallsThrough(t *testing.T) {
	// Before the fix, model.Project was cached directly.
	// SecretKeyHMAC/SecretKeyHashPHC have json:"-", so they are missing.
	// Verify that the guard (SecretKeyHMAC != "") rejects this stale entry.
	staleProject := model.Project{
		ID:                uuid.New(),
		SecretKeyHMAC:     "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
		SecretKeyHashPHC:  "$argon2id$v=19$m=16384,t=2,p=1$c29tZXNhbHQ$c29tZWhhc2g",
		EncryptionEnabled: false,
	}

	// Simulate old cache format: json.Marshal(model.Project) drops secret fields
	data, err := json.Marshal(&staleProject)
	require.NoError(t, err)

	var cached projectAuthCache
	err = json.Unmarshal(data, &cached)
	require.NoError(t, err)

	// The guard condition in lookupProject should reject this
	assert.Empty(t, cached.SecretKeyHMAC, "old format should have empty SecretKeyHMAC after unmarshal")
	assert.Empty(t, cached.SecretKeyHashPHC, "old format should have empty SecretKeyHashPHC after unmarshal")
}
