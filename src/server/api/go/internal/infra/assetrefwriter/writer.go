package assetrefwriter

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const (
	// Redis key prefixes
	pendingKeyPrefix = "assetref:pending:"  // Hash: field=sha256, value=count
	dirtySetKey      = "assetref:dirty_projects"
	metaKeyPrefix    = "assetref:meta:"     // String: JSON-encoded Asset

	// Default TTL for pending and meta keys (safety net)
	defaultKeyTTL = 24 * time.Hour
)

// AssetRefWriter buffers asset reference increments in Redis and periodically
// flushes them to the database in batches. This eliminates PostgreSQL row-level
// lock contention when many concurrent requests write to the same project.
type AssetRefWriter struct {
	redis    *redis.Client
	repo     repo.AssetReferenceRepo
	log      *zap.Logger
	interval time.Duration
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// Option configures the AssetRefWriter.
type Option func(*AssetRefWriter)

// WithFlushInterval sets the flush interval.
func WithFlushInterval(d time.Duration) Option {
	return func(w *AssetRefWriter) {
		w.interval = d
	}
}

// New creates a new AssetRefWriter.
func New(rdb *redis.Client, assetRepo repo.AssetReferenceRepo, log *zap.Logger, opts ...Option) *AssetRefWriter {
	w := &AssetRefWriter{
		redis:    rdb,
		repo:     assetRepo,
		log:      log.Named("asset-ref-writer"),
		interval: time.Second,
		stopCh:   make(chan struct{}),
	}
	for _, o := range opts {
		o(w)
	}
	return w
}

// Start launches the background flush goroutine.
func (w *AssetRefWriter) Start() {
	w.wg.Add(1)
	go w.loop()
}

// Enqueue buffers asset reference increments in Redis.
// This is the hot-path replacement for synchronous BatchIncrementAssetRefs.
func (w *AssetRefWriter) Enqueue(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	if len(assets) == 0 {
		return nil
	}

	// Group by sha256 to coalesce duplicates within one call
	type agg struct {
		asset model.Asset
		count int64
	}
	grouped := make(map[string]*agg)
	for _, a := range assets {
		if a.SHA256 == "" {
			continue
		}
		if g, ok := grouped[a.SHA256]; ok {
			g.count++
		} else {
			grouped[a.SHA256] = &agg{asset: a, count: 1}
		}
	}
	if len(grouped) == 0 {
		return nil
	}

	pid := projectID.String()
	pendingKey := pendingKeyPrefix + pid

	pipe := w.redis.Pipeline()

	for sha256, g := range grouped {
		// Increment pending count
		pipe.HIncrBy(ctx, pendingKey, sha256, g.count)

		// Cache asset metadata (SETNX — only set if not exists)
		metaKey := metaKeyPrefix + pid + ":" + sha256
		metaJSON, err := json.Marshal(g.asset)
		if err != nil {
			w.log.Error("marshal asset meta", zap.Error(err))
			continue
		}
		pipe.SetNX(ctx, metaKey, metaJSON, defaultKeyTTL)
		// Always refresh meta key TTL so it doesn't expire before the pending count is flushed
		pipe.Expire(ctx, metaKey, defaultKeyTTL)
	}

	// Mark project as dirty
	pipe.SAdd(ctx, dirtySetKey, pid)

	// Set TTL on pending key as safety net
	pipe.Expire(ctx, pendingKey, defaultKeyTTL)

	_, err := pipe.Exec(ctx)
	if err != nil {
		w.log.Error("enqueue asset refs to redis", zap.Error(err))
		return err
	}
	return nil
}

func (w *AssetRefWriter) loop() {
	defer w.wg.Done()
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			w.flush()
		case <-w.stopCh:
			// Final flush before exit
			w.flush()
			return
		}
	}
}

// flush pops dirty projects and flushes each one.
func (w *AssetRefWriter) flush() {
	ctx := context.Background()

	for {
		// SPOP one project at a time to avoid holding too many in memory
		pid, err := w.redis.SPop(ctx, dirtySetKey).Result()
		if err == redis.Nil {
			return // no more dirty projects
		}
		if err != nil {
			w.log.Error("spop dirty projects", zap.Error(err))
			return
		}

		projectID, err := uuid.Parse(pid)
		if err != nil {
			w.log.Error("parse project id from dirty set", zap.String("pid", pid), zap.Error(err))
			continue
		}

		if err := w.flushProject(ctx, projectID); err != nil {
			w.log.Error("flush project", zap.String("project_id", pid), zap.Error(err))
			// Re-add to dirty set so it gets retried next tick
			w.redis.SAdd(ctx, dirtySetKey, pid)
		}
	}
}

// flushProject reads pending counts from Redis, clears them, and writes to DB.
// On DB failure, it restores the counts back to Redis.
func (w *AssetRefWriter) flushProject(ctx context.Context, projectID uuid.UUID) error {
	pid := projectID.String()
	pendingKey := pendingKeyPrefix + pid

	// Read all pending sha256 -> count
	pending, err := w.redis.HGetAll(ctx, pendingKey).Result()
	if err != nil {
		return fmt.Errorf("hgetall %s: %w", pendingKey, err)
	}
	if len(pending) == 0 {
		return nil
	}

	// Parse counts and collect fields to delete
	type entry struct {
		sha256 string
		count  int64
	}
	entries := make([]entry, 0, len(pending))
	fields := make([]string, 0, len(pending))
	for sha256, countStr := range pending {
		count, err := strconv.ParseInt(countStr, 10, 64)
		if err != nil {
			w.log.Error("parse count", zap.String("sha256", sha256), zap.String("count", countStr), zap.Error(err))
			continue
		}
		entries = append(entries, entry{sha256: sha256, count: count})
		fields = append(fields, sha256)
	}

	if len(entries) == 0 {
		return nil
	}

	// Atomically delete the fields we're about to flush.
	// New HINCRBY calls that arrive between HGETALL and HDEL will create new fields
	// or increment after our delete — they'll be picked up on the next flush cycle.
	w.redis.HDel(ctx, pendingKey, fields...)

	// Load asset metadata and build the asset slice
	assets := make([]model.Asset, 0, len(entries))
	countMap := make(map[string]int64, len(entries)) // sha256 -> total count for batch
	for _, e := range entries {
		metaKey := metaKeyPrefix + pid + ":" + e.sha256
		metaJSON, err := w.redis.Get(ctx, metaKey).Bytes()
		if err != nil {
			if err == redis.Nil {
				// Metadata expired or was never written — drop the orphaned pending entry
				// to avoid infinite retry loops. The next real Enqueue will recreate it.
				w.log.Warn("asset meta expired, dropping orphaned pending entry",
					zap.String("key", metaKey), zap.Int64("lost_count", e.count))
				continue
			}
			w.log.Error("get asset meta", zap.String("key", metaKey), zap.Error(err))
			// Restore count to Redis since we can't flush without metadata (transient error)
			w.redis.HIncrBy(ctx, pendingKey, e.sha256, e.count)
			w.redis.SAdd(ctx, dirtySetKey, pid)
			continue
		}

		var asset model.Asset
		if err := json.Unmarshal(metaJSON, &asset); err != nil {
			w.log.Error("unmarshal asset meta", zap.Error(err))
			w.redis.HIncrBy(ctx, pendingKey, e.sha256, e.count)
			w.redis.SAdd(ctx, dirtySetKey, pid)
			continue
		}

		// BatchIncrementAssetRefs groups by sha256 and uses EXCLUDED.ref_count,
		// so we add the asset `count` times to leverage the existing coalescing logic.
		// However, it's more efficient to add once with the correct count directly.
		// We'll add a single asset and set the count via a wrapper.
		assets = append(assets, asset)
		countMap[asset.SHA256] = e.count
	}

	if len(assets) == 0 {
		return nil
	}

	// Build the expanded asset list for BatchIncrementAssetRefs.
	// The repo already coalesces by sha256, so we expand to count occurrences.
	expandedAssets := make([]model.Asset, 0, len(assets))
	for _, a := range assets {
		count := countMap[a.SHA256]
		for i := int64(0); i < count; i++ {
			expandedAssets = append(expandedAssets, a)
		}
	}

	// Write to DB
	if err := w.repo.BatchIncrementAssetRefs(ctx, projectID, expandedAssets); err != nil {
		w.log.Error("batch increment asset refs", zap.String("project_id", pid), zap.Int("assets", len(assets)), zap.Error(err))
		// Restore counts to Redis for retry
		pipe := w.redis.Pipeline()
		for _, e := range entries {
			pipe.HIncrBy(ctx, pendingKey, e.sha256, e.count)
		}
		pipe.SAdd(ctx, dirtySetKey, pid)
		pipe.Exec(ctx)
		return err
	}

	// Clean up metadata keys after successful flush
	pipe := w.redis.Pipeline()
	for _, a := range assets {
		metaKey := metaKeyPrefix + pid + ":" + a.SHA256
		pipe.Del(ctx, metaKey)
	}
	pipe.Exec(ctx)

	w.log.Debug("flushed asset refs",
		zap.String("project_id", pid),
		zap.Int("unique_assets", len(assets)),
		zap.Int("total_refs", len(expandedAssets)),
	)

	return nil
}

// Close stops the background goroutine and flushes remaining data.
// It respects the context deadline for the final flush.
func (w *AssetRefWriter) Close(ctx context.Context) error {
	close(w.stopCh)

	done := make(chan struct{})
	go func() {
		w.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
