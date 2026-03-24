package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return rdb, mr
}

func newTestMaterialService(t *testing.T, cfg *config.Config) (MaterialService, *redis.Client, *miniredis.Miniredis) {
	t.Helper()
	rdb, mr := newTestRedis(t)
	svc := NewMaterialService(rdb, nil, cfg) // S3 is nil for unit tests
	return svc, rdb, mr
}

func TestMaterialService_CreateMaterialURL_NonEncrypted(t *testing.T) {
	cfg := &config.Config{
		App: config.AppCfg{Host: "localhost", Port: 8029},
	}
	svc, rdb, _ := newTestMaterialService(t, cfg)
	ctx := context.Background()

	url, expireAt, err := svc.CreateMaterialURL(ctx, "assets/proj1/2024/01/01/abc123.txt", "", 5*time.Minute, "text/plain", "test.txt")
	require.NoError(t, err)

	// URL should contain /api/v1/material/ and a 64-char hex token
	assert.Contains(t, url, "/api/v1/material/")
	assert.True(t, expireAt.After(time.Now()))

	// Extract token from URL
	parts := strings.Split(url, "/api/v1/material/")
	require.Len(t, parts, 2)
	token := parts[1]
	assert.Len(t, token, 64) // 32 bytes hex = 64 chars

	// Verify Redis contains the token
	redisKey := redisKeyPrefixMaterial + token
	val, err := rdb.Get(ctx, redisKey).Bytes()
	require.NoError(t, err)

	var meta MaterialMeta
	require.NoError(t, json.Unmarshal(val, &meta))
	assert.Equal(t, "assets/proj1/2024/01/01/abc123.txt", meta.S3Key)
	assert.Empty(t, meta.UserKEK) // no encryption
	assert.Equal(t, "text/plain", meta.MIMEType)
	assert.Equal(t, "test.txt", meta.FileName)
}

func TestMaterialService_CreateMaterialURL_Encrypted(t *testing.T) {
	cfg := &config.Config{
		App: config.AppCfg{Host: "localhost", Port: 8029},
	}
	svc, rdb, _ := newTestMaterialService(t, cfg)
	ctx := context.Background()

	fakeKEK := base64.StdEncoding.EncodeToString([]byte("fake-kek-32-bytes-for-testing!!!"))
	url, _, err := svc.CreateMaterialURL(ctx, "assets/proj1/2024/01/01/enc.bin", fakeKEK, 10*time.Minute, "application/octet-stream", "enc.bin")
	require.NoError(t, err)

	// Extract token and verify Redis meta
	token := url[strings.LastIndex(url, "/")+1:]
	val, err := rdb.Get(ctx, redisKeyPrefixMaterial+token).Bytes()
	require.NoError(t, err)

	var meta MaterialMeta
	require.NoError(t, json.Unmarshal(val, &meta))
	assert.Equal(t, fakeKEK, meta.UserKEK)
}

func TestMaterialService_CreateMaterialURL_CustomExternalURL(t *testing.T) {
	cfg := &config.Config{
		App: config.AppCfg{ExternalURL: "https://api.example.com"},
	}
	svc, _, _ := newTestMaterialService(t, cfg)
	ctx := context.Background()

	url, _, err := svc.CreateMaterialURL(ctx, "key", "", time.Minute, "", "")
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(url, "https://api.example.com/api/v1/material/"))
}

func TestMaterialService_ServeMaterial_NotFound(t *testing.T) {
	cfg := &config.Config{}
	svc, _, _ := newTestMaterialService(t, cfg)
	ctx := context.Background()

	_, _, _, err := svc.ServeMaterial(ctx, "nonexistent-token")
	assert.ErrorIs(t, err, ErrMaterialNotFound)
}

func TestMaterialService_ServeMaterial_ExpiredToken(t *testing.T) {
	cfg := &config.Config{
		App: config.AppCfg{Host: "localhost", Port: 8029},
	}
	svc, _, mr := newTestMaterialService(t, cfg)
	ctx := context.Background()

	// Create with 1s TTL
	url, _, err := svc.CreateMaterialURL(ctx, "key", "", time.Second, "", "")
	require.NoError(t, err)
	token := url[strings.LastIndex(url, "/")+1:]

	// Fast-forward miniredis past TTL
	mr.FastForward(2 * time.Second)

	_, _, _, err = svc.ServeMaterial(ctx, token)
	assert.ErrorIs(t, err, ErrMaterialNotFound)
}
