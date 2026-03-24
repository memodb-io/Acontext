package service

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/bytedance/sonic"
	"github.com/memodb-io/Acontext/internal/infra/crypto"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// newTestSessionServiceWithRedis creates a sessionService backed by miniredis.
func newTestSessionServiceWithRedis(t *testing.T) (*sessionService, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	svc := &sessionService{
		redis: rdb,
		log:   zap.NewNop(),
	}
	return svc, mr
}

func testParts() []model.Part {
	return []model.Part{
		{Type: "text", Text: "hello world"},
		{Type: "text", Text: "second part"},
	}
}

func testUserKEK(t *testing.T) []byte {
	t.Helper()
	kek, err := crypto.DeriveKEK([]byte("test-secret"), []byte("salt"), []byte("info"))
	require.NoError(t, err)
	return kek
}

// ---------------------------------------------------------------------------
// Plaintext cache round-trip
// ---------------------------------------------------------------------------

func TestCachePartsInRedis_Plaintext_RoundTrip(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	parts := testParts()
	sha := "abc123plaintext"

	// Write with nil KEK → plaintext
	err := svc.cachePartsInRedis(ctx, sha, parts, nil)
	require.NoError(t, err)

	// Read back
	got, err := svc.getPartsFromRedis(ctx, sha, nil)
	require.NoError(t, err)
	assert.Equal(t, parts, got)
}

func TestCachePartsInRedis_Plaintext_PrefixByte(t *testing.T) {
	svc, mr := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	sha := "abc123prefix"

	err := svc.cachePartsInRedis(ctx, sha, testParts(), nil)
	require.NoError(t, err)

	// Inspect raw Redis value — first byte must be 0x00
	raw, err := mr.Get(redisKeyPrefixParts + sha)
	require.NoError(t, err)
	require.True(t, len(raw) > 0)
	assert.Equal(t, byte(cachePrefixPlaintext), raw[0], "first byte should be 0x00 for plaintext")

	// The rest should be valid JSON
	var parts []model.Part
	err = sonic.Unmarshal([]byte(raw[1:]), &parts)
	require.NoError(t, err)
	assert.Len(t, parts, 2)
}

// ---------------------------------------------------------------------------
// Encrypted cache round-trip
// ---------------------------------------------------------------------------

func TestCachePartsInRedis_Encrypted_RoundTrip(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	parts := testParts()
	kek := testUserKEK(t)
	sha := "abc123encrypted"

	// Write with KEK → encrypted
	err := svc.cachePartsInRedis(ctx, sha, parts, kek)
	require.NoError(t, err)

	// Read back with same KEK
	got, err := svc.getPartsFromRedis(ctx, sha, kek)
	require.NoError(t, err)
	assert.Equal(t, parts, got)
}

func TestCachePartsInRedis_Encrypted_NotPlaintext(t *testing.T) {
	svc, mr := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	kek := testUserKEK(t)
	sha := "abc123notplain"

	err := svc.cachePartsInRedis(ctx, sha, testParts(), kek)
	require.NoError(t, err)

	// Inspect raw Redis value
	raw, err := mr.Get(redisKeyPrefixParts + sha)
	require.NoError(t, err)
	require.True(t, len(raw) > 0)

	// First byte must be 0x01
	assert.Equal(t, byte(cachePrefixEncrypted), raw[0], "first byte should be 0x01 for encrypted")

	// The raw data must NOT contain plaintext
	assert.NotContains(t, raw, "hello world", "encrypted cache must not contain plaintext")
}

func TestCachePartsInRedis_Encrypted_WrongKEK_Fails(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	parts := testParts()
	kek := testUserKEK(t)
	sha := "abc123wrongkek"

	// Write with one KEK
	err := svc.cachePartsInRedis(ctx, sha, parts, kek)
	require.NoError(t, err)

	// Read with different KEK → should fail
	wrongKEK, err := crypto.DeriveKEK([]byte("wrong-secret"), []byte("salt"), []byte("info"))
	require.NoError(t, err)

	_, err = svc.getPartsFromRedis(ctx, sha, wrongKEK)
	assert.Error(t, err, "reading encrypted cache with wrong KEK should fail")
}

func TestGetPartsFromRedis_Encrypted_NilKEK_Fails(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	kek := testUserKEK(t)
	sha := "abc123nilkek"

	// Write encrypted
	err := svc.cachePartsInRedis(ctx, sha, testParts(), kek)
	require.NoError(t, err)

	// Read with nil KEK → should fail
	_, err = svc.getPartsFromRedis(ctx, sha, nil)
	assert.Error(t, err, "reading encrypted cache without KEK should fail")
	assert.Contains(t, err.Error(), "no user KEK provided")
}

// ---------------------------------------------------------------------------
// Legacy / backward compatibility
// ---------------------------------------------------------------------------

func TestGetPartsFromRedis_LegacyFormat(t *testing.T) {
	svc, mr := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	sha := "abc123legacy"

	// Simulate legacy cache entry: raw JSON without any prefix byte
	parts := testParts()
	jsonData, err := sonic.Marshal(parts)
	require.NoError(t, err)

	// Write raw JSON directly (no 0x00 prefix — this is the pre-encryption format)
	// JSON always starts with '[' (0x5B) or '{' (0x7B), neither matches 0x00 or 0x01
	err = mr.Set(redisKeyPrefixParts+sha, string(jsonData))
	require.NoError(t, err)

	// Read should work via the "default" branch
	got, err := svc.getPartsFromRedis(ctx, sha, nil)
	require.NoError(t, err)
	assert.Equal(t, parts, got)
}

// ---------------------------------------------------------------------------
// Cache miss
// ---------------------------------------------------------------------------

func TestGetPartsFromRedis_CacheMiss(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()

	_, err := svc.getPartsFromRedis(ctx, "nonexistent", nil)
	assert.ErrorIs(t, err, redis.Nil)
}

// ---------------------------------------------------------------------------
// loadPartsForMessage — cache hit path (no S3 needed)
// ---------------------------------------------------------------------------

func TestLoadPartsForMessage_CacheHit_Plaintext(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	parts := testParts()
	sha := "loadparts-plain"

	// Pre-populate cache
	err := svc.cachePartsInRedis(ctx, sha, parts, nil)
	require.NoError(t, err)

	meta := model.Asset{SHA256: sha, S3Key: "some/key.json"}
	got, ok := svc.loadPartsForMessage(ctx, meta, nil)
	assert.True(t, ok)
	assert.Equal(t, parts, got)
}

func TestLoadPartsForMessage_CacheHit_Encrypted(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()
	parts := testParts()
	kek := testUserKEK(t)
	sha := "loadparts-enc"

	// Pre-populate cache with encrypted data
	err := svc.cachePartsInRedis(ctx, sha, parts, kek)
	require.NoError(t, err)

	meta := model.Asset{SHA256: sha, S3Key: "some/key.json"}
	got, ok := svc.loadPartsForMessage(ctx, meta, kek)
	assert.True(t, ok)
	assert.Equal(t, parts, got)
}

func TestLoadPartsForMessage_CacheMiss_NoS3_ReturnsEmpty(t *testing.T) {
	svc, _ := newTestSessionServiceWithRedis(t)
	ctx := context.Background()

	// No cache entry, no S3 configured → returns empty parts (ok=true)
	meta := model.Asset{SHA256: "nonexistent", S3Key: "some/key.json"}
	got, ok := svc.loadPartsForMessage(ctx, meta, nil)
	assert.True(t, ok, "should return ok=true when cache miss with no S3")
	assert.Empty(t, got)
}

func TestLoadPartsForMessage_NilRedis_NilS3_ReturnsEmpty(t *testing.T) {
	// Service with neither Redis nor S3
	svc := &sessionService{
		redis: nil,
		s3:    nil,
		log:   zap.NewNop(),
	}
	ctx := context.Background()

	meta := model.Asset{SHA256: "anything", S3Key: "some/key.json"}
	got, ok := svc.loadPartsForMessage(ctx, meta, nil)
	assert.True(t, ok)
	assert.Empty(t, got)
}
