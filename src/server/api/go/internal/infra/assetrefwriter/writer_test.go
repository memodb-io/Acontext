package assetrefwriter

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

// mockAssetReferenceRepo tracks calls to BatchIncrementAssetRefs.
type mockAssetReferenceRepo struct {
	calls     []batchCall
	failNext  bool
	failCount int
}

type batchCall struct {
	ProjectID uuid.UUID
	Assets    []model.Asset
}

func (m *mockAssetReferenceRepo) IncrementAssetRef(_ context.Context, projectID uuid.UUID, asset model.Asset) error {
	return nil
}

func (m *mockAssetReferenceRepo) DecrementAssetRef(_ context.Context, projectID uuid.UUID, asset model.Asset) error {
	return nil
}

func (m *mockAssetReferenceRepo) BatchIncrementAssetRefs(_ context.Context, projectID uuid.UUID, assets []model.Asset) error {
	if m.failNext {
		m.failCount++
		if m.failCount <= 1 {
			return fmt.Errorf("simulated DB error")
		}
		// Succeed on retry
		m.failNext = false
	}
	m.calls = append(m.calls, batchCall{ProjectID: projectID, Assets: append([]model.Asset{}, assets...)})
	return nil
}

func (m *mockAssetReferenceRepo) BatchDecrementAssetRefs(_ context.Context, projectID uuid.UUID, assets []model.Asset) error {
	return nil
}

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	rdb := redis.NewClient(&redis.Options{
		Addr: "127.0.0.1:16379",
		DB:   15, // Use DB 15 for tests to avoid collisions
	})
	ctx := context.Background()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available at 127.0.0.1:16379: %v", err)
	}
	// Clean test keys
	t.Cleanup(func() {
		keys, _ := rdb.Keys(ctx, "assetref:*").Result()
		if len(keys) > 0 {
			rdb.Del(ctx, keys...)
		}
		rdb.Close()
	})
	return rdb
}

func TestEnqueue_WritesToRedis(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour)) // long interval so no auto-flush
	w.Start()
	defer w.Close(ctx)

	projectID := uuid.New()
	assets := []model.Asset{
		{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b", MIME: "application/json", SizeB: 100},
		{SHA256: "bbb", S3Key: "s3/bbb", Bucket: "b", MIME: "application/json", SizeB: 200},
	}

	err := w.Enqueue(ctx, projectID, assets)
	require.NoError(t, err)

	// Verify pending hash
	pendingKey := pendingKeyPrefix + projectID.String()
	val, err := rdb.HGet(ctx, pendingKey, "aaa").Result()
	require.NoError(t, err)
	assert.Equal(t, "1", val)

	val, err = rdb.HGet(ctx, pendingKey, "bbb").Result()
	require.NoError(t, err)
	assert.Equal(t, "1", val)

	// Verify dirty set
	isMember, err := rdb.SIsMember(ctx, dirtySetKey, projectID.String()).Result()
	require.NoError(t, err)
	assert.True(t, isMember)

	// Verify metadata cached
	metaKey := metaKeyPrefix + projectID.String() + ":aaa"
	metaJSON, err := rdb.Get(ctx, metaKey).Bytes()
	require.NoError(t, err)
	var meta model.Asset
	require.NoError(t, json.Unmarshal(metaJSON, &meta))
	assert.Equal(t, "aaa", meta.SHA256)
	assert.Equal(t, "s3/aaa", meta.S3Key)
}

func TestEnqueue_CoalescesDuplicates(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour))
	w.Start()
	defer w.Close(ctx)

	projectID := uuid.New()
	asset := model.Asset{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b"}

	// Enqueue same asset 5 times in one call
	assets := []model.Asset{asset, asset, asset, asset, asset}
	err := w.Enqueue(ctx, projectID, assets)
	require.NoError(t, err)

	pendingKey := pendingKeyPrefix + projectID.String()
	val, err := rdb.HGet(ctx, pendingKey, "aaa").Result()
	require.NoError(t, err)
	assert.Equal(t, "5", val)
}

func TestEnqueue_MultipleCallsAccumulate(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour))
	w.Start()
	defer w.Close(ctx)

	projectID := uuid.New()
	asset := model.Asset{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b"}

	// Multiple separate Enqueue calls
	for i := 0; i < 10; i++ {
		require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset}))
	}

	pendingKey := pendingKeyPrefix + projectID.String()
	val, err := rdb.HGet(ctx, pendingKey, "aaa").Result()
	require.NoError(t, err)
	assert.Equal(t, "10", val)
}

func TestFlush_CoalescesAndWritesToDB(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(100*time.Millisecond))
	w.Start()

	projectID := uuid.New()
	asset := model.Asset{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b", MIME: "application/json", SizeB: 100}

	// Enqueue 100 times
	for i := 0; i < 100; i++ {
		require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset}))
	}

	// Wait for flush
	time.Sleep(300 * time.Millisecond)
	w.Close(ctx)

	// Should have exactly 1 DB call
	require.Len(t, mockRepo.calls, 1)
	assert.Equal(t, projectID, mockRepo.calls[0].ProjectID)

	// The expanded assets should sum to 100
	assert.Len(t, mockRepo.calls[0].Assets, 100)
}

func TestClose_FlushesRemainingData(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour)) // long interval
	w.Start()

	projectID := uuid.New()
	assets := []model.Asset{
		{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b", MIME: "application/json", SizeB: 100},
	}

	require.NoError(t, w.Enqueue(ctx, projectID, assets))

	// Close should trigger final flush
	err := w.Close(ctx)
	require.NoError(t, err)

	require.Len(t, mockRepo.calls, 1)
	assert.Equal(t, projectID, mockRepo.calls[0].ProjectID)
}

func TestFlush_DBFailure_RestoresToRedis(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{failNext: true}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(100*time.Millisecond))
	w.Start()

	projectID := uuid.New()
	asset := model.Asset{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b", MIME: "application/json", SizeB: 100}

	require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset, asset, asset}))

	// Wait for first flush attempt (will fail) + retry (will succeed)
	time.Sleep(500 * time.Millisecond)
	w.Close(ctx)

	// After retry, the data should have been written to DB
	require.GreaterOrEqual(t, len(mockRepo.calls), 1)

	// Verify pending hash is cleaned up
	pendingKey := pendingKeyPrefix + projectID.String()
	count, err := rdb.HLen(ctx, pendingKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestEnqueue_EmptyAssets_NoOp(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log)

	projectID := uuid.New()
	err := w.Enqueue(ctx, projectID, []model.Asset{})
	assert.NoError(t, err)

	err = w.Enqueue(ctx, projectID, nil)
	assert.NoError(t, err)

	// No dirty projects
	count, err := rdb.SCard(ctx, dirtySetKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestFlush_MultipleProjects(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour))
	w.Start()

	p1 := uuid.New()
	p2 := uuid.New()
	asset := model.Asset{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b", MIME: "application/json", SizeB: 100}

	require.NoError(t, w.Enqueue(ctx, p1, []model.Asset{asset}))
	require.NoError(t, w.Enqueue(ctx, p2, []model.Asset{asset, asset}))

	// Close triggers final flush
	w.Close(ctx)

	// Should have 2 DB calls (one per project)
	require.Len(t, mockRepo.calls, 2)

	// Verify each project got the right count
	countByProject := make(map[uuid.UUID]int)
	for _, c := range mockRepo.calls {
		countByProject[c.ProjectID] = len(c.Assets)
	}
	assert.Equal(t, 1, countByProject[p1])
	assert.Equal(t, 2, countByProject[p2])
}

func TestFlush_MissingMetadata_DropsOrphanedEntry(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour))
	w.Start()

	projectID := uuid.New()
	pid := projectID.String()
	pendingKey := pendingKeyPrefix + pid

	// Manually create a pending entry WITHOUT metadata (simulates expired meta key)
	rdb.HSet(ctx, pendingKey, "orphan_sha256", "3")
	rdb.SAdd(ctx, dirtySetKey, pid)

	// Also enqueue a valid asset
	validAsset := model.Asset{SHA256: "valid_sha256", S3Key: "s3/valid", Bucket: "b", MIME: "application/json", SizeB: 100}
	require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{validAsset}))

	// Close triggers flush
	w.Close(ctx)

	// The valid asset should have been flushed to DB
	require.Len(t, mockRepo.calls, 1)
	assert.Equal(t, 1, len(mockRepo.calls[0].Assets))
	assert.Equal(t, "valid_sha256", mockRepo.calls[0].Assets[0].SHA256)

	// The orphaned entry should NOT be restored to Redis
	count, err := rdb.HLen(ctx, pendingKey).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), count, "orphaned pending entry should be dropped, not restored")
}

func TestEnqueue_RefreshesMetaTTL(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour))
	w.Start()
	defer w.Close(ctx)

	projectID := uuid.New()
	asset := model.Asset{SHA256: "aaa", S3Key: "s3/aaa", Bucket: "b"}

	// First enqueue
	require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset}))

	metaKey := metaKeyPrefix + projectID.String() + ":aaa"

	// Reduce TTL artificially to simulate time passing
	rdb.Expire(ctx, metaKey, 1*time.Second)

	// Second enqueue should refresh TTL
	require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset}))

	ttl, err := rdb.TTL(ctx, metaKey).Result()
	require.NoError(t, err)
	// TTL should have been refreshed to ~24h, not the 1s we set
	assert.Greater(t, ttl, 1*time.Minute, "meta key TTL should be refreshed on re-enqueue")
}

func TestMetadata_SETNXIdempotent(t *testing.T) {
	rdb := newTestRedis(t)
	ctx := context.Background()
	mockRepo := &mockAssetReferenceRepo{}
	log := zap.NewNop()

	w := New(rdb, mockRepo, log, WithFlushInterval(time.Hour))
	w.Start()
	defer w.Close(ctx)

	projectID := uuid.New()

	// First enqueue with S3Key "first"
	asset1 := model.Asset{SHA256: "aaa", S3Key: "s3/first", Bucket: "b"}
	require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset1}))

	// Second enqueue with different S3Key — metadata should NOT be overwritten
	asset2 := model.Asset{SHA256: "aaa", S3Key: "s3/second", Bucket: "b"}
	require.NoError(t, w.Enqueue(ctx, projectID, []model.Asset{asset2}))

	metaKey := metaKeyPrefix + projectID.String() + ":aaa"
	metaJSON, err := rdb.Get(ctx, metaKey).Bytes()
	require.NoError(t, err)
	var meta model.Asset
	require.NoError(t, json.Unmarshal(metaJSON, &meta))
	assert.Equal(t, "s3/first", meta.S3Key, "SETNX should preserve the first metadata")

	// But the count should be accumulated
	pendingKey := pendingKeyPrefix + projectID.String()
	val, err := rdb.HGet(ctx, pendingKey, "aaa").Result()
	require.NoError(t, err)
	count, _ := strconv.Atoi(val)
	assert.Equal(t, 2, count)
}
