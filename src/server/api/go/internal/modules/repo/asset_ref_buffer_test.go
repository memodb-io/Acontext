package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// mockAssetReferenceRepoForBuffer records calls to BatchIncrementAssetRefsWithCounts.
type mockAssetReferenceRepoForBuffer struct {
	calls []batchIncrCall
}

type batchIncrCall struct {
	ProjectID  uuid.UUID
	Increments []AssetRefIncrement
}

func (m *mockAssetReferenceRepoForBuffer) IncrementAssetRef(_ context.Context, _ uuid.UUID, _ model.Asset) error {
	return nil
}
func (m *mockAssetReferenceRepoForBuffer) DecrementAssetRef(_ context.Context, _ uuid.UUID, _ model.Asset) error {
	return nil
}
func (m *mockAssetReferenceRepoForBuffer) BatchIncrementAssetRefs(_ context.Context, _ uuid.UUID, _ []model.Asset) error {
	return nil
}
func (m *mockAssetReferenceRepoForBuffer) BatchIncrementAssetRefsWithCounts(_ context.Context, projectID uuid.UUID, increments []AssetRefIncrement) error {
	m.calls = append(m.calls, batchIncrCall{ProjectID: projectID, Increments: increments})
	return nil
}
func (m *mockAssetReferenceRepoForBuffer) BatchDecrementAssetRefs(_ context.Context, _ uuid.UUID, _ []model.Asset) error {
	return nil
}

func setupMiniRedis(t *testing.T) (*miniredis.Miniredis, *redis.Client) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	return mr, rdb
}

func TestAssetRefBuffer_Enqueue(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	assets := []model.Asset{
		{SHA256: "abc123", S3Key: "assets/abc123.bin", MIME: "application/octet-stream"},
		{SHA256: "def456", S3Key: "assets/def456.bin", MIME: "text/plain"},
		{SHA256: "abc123", S3Key: "assets/abc123.bin", MIME: "application/octet-stream"}, // duplicate
	}

	err := buf.Enqueue(ctx, pid, assets)
	require.NoError(t, err)

	// Verify Redis state.
	bufKey := assetRefBufPrefix + pid.String()
	val, err := rdb.HGet(ctx, bufKey, "abc123").Int()
	require.NoError(t, err)
	assert.Equal(t, 2, val) // Two HINCRBY for abc123.

	val, err = rdb.HGet(ctx, bufKey, "def456").Int()
	require.NoError(t, err)
	assert.Equal(t, 1, val)

	// Verify project was added to pending set.
	members, err := rdb.SMembers(ctx, assetRefProjectsKey).Result()
	require.NoError(t, err)
	assert.Contains(t, members, pid.String())

	// Verify metadata was stored (NX).
	metaKey := assetRefMetaPrefix + pid.String() + ":abc123"
	metaJSON, err := rdb.Get(ctx, metaKey).Result()
	require.NoError(t, err)
	var stored model.Asset
	require.NoError(t, json.Unmarshal([]byte(metaJSON), &stored))
	assert.Equal(t, "abc123", stored.SHA256)
}

func TestAssetRefBuffer_FlushCoalesces(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	// Enqueue from multiple "requests".
	for i := 0; i < 5; i++ {
		err := buf.Enqueue(ctx, pid, []model.Asset{
			{SHA256: "abc123", S3Key: "assets/abc123.bin"},
		})
		require.NoError(t, err)
	}

	// Trigger flush manually.
	b := buf.(*assetRefBuffer)
	b.flushAll()

	// Should have one call with count=5.
	require.Len(t, mockRepo.calls, 1)
	assert.Equal(t, pid, mockRepo.calls[0].ProjectID)
	require.Len(t, mockRepo.calls[0].Increments, 1)
	assert.Equal(t, 5, mockRepo.calls[0].Increments[0].Count)
	assert.Equal(t, "abc123", mockRepo.calls[0].Increments[0].Asset.SHA256)
}

func TestAssetRefBuffer_FlushMultipleProjects(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid1 := uuid.New()
	pid2 := uuid.New()

	require.NoError(t, buf.Enqueue(ctx, pid1, []model.Asset{{SHA256: "aaa", S3Key: "k1"}}))
	require.NoError(t, buf.Enqueue(ctx, pid2, []model.Asset{{SHA256: "bbb", S3Key: "k2"}}))

	b := buf.(*assetRefBuffer)
	b.flushAll()

	assert.Len(t, mockRepo.calls, 2)
	pids := map[uuid.UUID]bool{}
	for _, c := range mockRepo.calls {
		pids[c.ProjectID] = true
	}
	assert.True(t, pids[pid1])
	assert.True(t, pids[pid2])
}

func TestAssetRefBuffer_StopFlushesRemaining(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	require.NoError(t, buf.Enqueue(ctx, pid, []model.Asset{{SHA256: "final", S3Key: "k"}}))

	// Start and stop — Stop() blocks until final flush completes.
	buf.Start()
	buf.Stop()

	// The ticker or Stop's final flush should have processed the enqueued asset.
	found := false
	for _, c := range mockRepo.calls {
		for _, inc := range c.Increments {
			if inc.Asset.SHA256 == "final" {
				found = true
			}
		}
	}
	assert.True(t, found, "expected Stop() to flush the remaining enqueued asset")
}

func TestAssetRefBuffer_EnqueueAfterStop(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	buf.Start()
	buf.Stop()

	// Should not panic, just log a warning.
	ctx := context.Background()
	err := buf.Enqueue(ctx, uuid.New(), []model.Asset{{SHA256: "late", S3Key: "k"}})
	assert.NoError(t, err)
}

func TestAssetRefBuffer_DistributedLock(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	require.NoError(t, buf.Enqueue(ctx, pid, []model.Asset{{SHA256: "x", S3Key: "k"}}))

	// Simulate another pod holding the lock.
	rdb.Set(ctx, assetRefFlushLockKey, "other-pod", assetRefFlushLockTTL)

	b := buf.(*assetRefBuffer)
	b.flushAll()

	// Should not have flushed because lock was held.
	assert.Len(t, mockRepo.calls, 0)

	// After lock expires, flush should work.
	rdb.Del(ctx, assetRefFlushLockKey)
	b.flushAll()
	assert.Len(t, mockRepo.calls, 1)
}

func TestAssetRefBuffer_EmptyEnqueue(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()

	err := buf.Enqueue(ctx, uuid.New(), nil)
	assert.NoError(t, err)

	err = buf.Enqueue(ctx, uuid.New(), []model.Asset{})
	assert.NoError(t, err)

	// No Redis writes should have happened for the project set.
	members, _ := rdb.SMembers(ctx, assetRefProjectsKey).Result()
	assert.Empty(t, members)
}

func TestAssetRefBuffer_TickerFlushes(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	require.NoError(t, buf.Enqueue(ctx, pid, []model.Asset{{SHA256: "tick", S3Key: "k"}}))

	buf.Start()
	// Wait for at least one tick.
	time.Sleep(2 * assetRefFlushInterval)
	buf.Stop()

	// Should have flushed at least once (ticker or final flush).
	found := false
	for _, c := range mockRepo.calls {
		for _, inc := range c.Increments {
			if inc.Asset.SHA256 == "tick" {
				found = true
			}
		}
	}
	assert.True(t, found, "expected ticker to flush the enqueued asset")
}

func TestAssetRefBuffer_SkipsEmptySHA256(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	err := buf.Enqueue(ctx, pid, []model.Asset{
		{SHA256: "", S3Key: "empty"},
		{SHA256: "valid", S3Key: "k"},
	})
	require.NoError(t, err)

	b := buf.(*assetRefBuffer)
	b.flushAll()

	require.Len(t, mockRepo.calls, 1)
	require.Len(t, mockRepo.calls[0].Increments, 1)
	assert.Equal(t, "valid", mockRepo.calls[0].Increments[0].Asset.SHA256)
}

func TestAssetRefBuffer_LargeCoalesce(t *testing.T) {
	_, rdb := setupMiniRedis(t)
	logger, _ := zap.NewDevelopment()
	mockRepo := &mockAssetReferenceRepoForBuffer{}

	buf := NewAssetRefBuffer(rdb, mockRepo, logger)
	ctx := context.Background()
	pid := uuid.New()

	// Enqueue 100 assets with 10 distinct SHA256s.
	for i := 0; i < 100; i++ {
		sha := fmt.Sprintf("sha_%d", i%10)
		require.NoError(t, buf.Enqueue(ctx, pid, []model.Asset{{SHA256: sha, S3Key: "k/" + sha}}))
	}

	b := buf.(*assetRefBuffer)
	b.flushAll()

	require.Len(t, mockRepo.calls, 1)
	assert.Len(t, mockRepo.calls[0].Increments, 10) // 10 distinct SHA256s.
	totalCount := 0
	for _, inc := range mockRepo.calls[0].Increments {
		assert.Equal(t, 10, inc.Count) // Each SHA256 was seen 10 times.
		totalCount += inc.Count
	}
	assert.Equal(t, 100, totalCount)
}
