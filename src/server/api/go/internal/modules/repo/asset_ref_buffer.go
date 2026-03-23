package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const (
	// Redis key prefixes for the asset reference buffer.
	assetRefBufPrefix     = "assetref:buf:"     // Hash: sha256 → delta count
	assetRefMetaPrefix    = "assetref:meta:"     // String: JSON of model.Asset
	assetRefProjectsKey   = "assetref:projects"  // Set: project IDs with pending deltas
	assetRefFlushLockKey  = "assetref:flush:lock" // Distributed flush lock
	assetRefMetaTTL       = time.Hour             // Metadata key TTL
	assetRefFlushLockTTL  = 3 * time.Second       // Flush lock TTL
	assetRefFlushInterval = time.Second            // Flush ticker interval
)

// AssetRefBuffer buffers asset reference increments in Redis and flushes
// them to the database in coalesced batches. This avoids per-request
// INSERT ... ON CONFLICT contention under high concurrency.
type AssetRefBuffer interface {
	Enqueue(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error
	Start()
	Stop()
}

type assetRefBuffer struct {
	redis    *redis.Client
	repo     AssetReferenceRepo
	log      *zap.Logger
	stop     chan struct{}
	done     chan struct{}
	stopped  atomic.Bool
}

// drainScript atomically reads all fields from a hash and deletes it.
var drainScript = redis.NewScript(`
local data = redis.call('HGETALL', KEYS[1])
if #data > 0 then
	redis.call('DEL', KEYS[1])
end
return data
`)

func NewAssetRefBuffer(rdb *redis.Client, repo AssetReferenceRepo, log *zap.Logger) AssetRefBuffer {
	return &assetRefBuffer{
		redis: rdb,
		repo:  repo,
		log:   log,
		stop:  make(chan struct{}),
		done:  make(chan struct{}),
	}
}

// Enqueue buffers asset reference increments in Redis via pipeline.
// Each asset gets HINCRBY +1 on the project's buffer hash, metadata stored (NX),
// and the project ID added to the pending set.
func (b *assetRefBuffer) Enqueue(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	if len(assets) == 0 {
		return nil
	}
	if b.stopped.Load() {
		b.log.Warn("AssetRefBuffer.Enqueue called after Stop, dropping",
			zap.String("project_id", projectID.String()),
			zap.Int("assets", len(assets)))
		return nil
	}

	pid := projectID.String()
	bufKey := assetRefBufPrefix + pid

	pipe := b.redis.Pipeline()
	for _, a := range assets {
		if a.SHA256 == "" {
			continue
		}
		pipe.HIncrBy(ctx, bufKey, a.SHA256, 1)

		metaJSON, err := json.Marshal(a)
		if err != nil {
			b.log.Warn("failed to marshal asset meta", zap.String("sha256", a.SHA256), zap.Error(err))
			continue
		}
		metaKey := assetRefMetaPrefix + pid + ":" + a.SHA256
		pipe.SetNX(ctx, metaKey, metaJSON, assetRefMetaTTL)
	}
	pipe.SAdd(ctx, assetRefProjectsKey, pid)

	_, err := pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("AssetRefBuffer.Enqueue pipeline: %w", err)
	}
	return nil
}

// Start begins the background flusher goroutine.
func (b *assetRefBuffer) Start() {
	go b.run()
}

// Stop signals the flusher to exit, waits for the final flush to complete.
func (b *assetRefBuffer) Stop() {
	b.stopped.Store(true)
	close(b.stop)
	<-b.done
}

func (b *assetRefBuffer) run() {
	defer close(b.done)

	ticker := time.NewTicker(assetRefFlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			b.flushAll()
		case <-b.stop:
			// Final flush before exit.
			b.flushAll()
			return
		}
	}
}

// flushAll acquires a distributed lock and flushes all pending projects.
func (b *assetRefBuffer) flushAll() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Distributed lock so only one pod flushes at a time.
	ok, err := b.redis.SetNX(ctx, assetRefFlushLockKey, "1", assetRefFlushLockTTL).Result()
	if err != nil {
		b.log.Error("AssetRefBuffer: failed to acquire flush lock", zap.Error(err))
		return
	}
	if !ok {
		return // Another pod is flushing.
	}
	defer b.redis.Del(ctx, assetRefFlushLockKey)

	// Get all project IDs with pending deltas.
	pids, err := b.redis.SMembers(ctx, assetRefProjectsKey).Result()
	if err != nil {
		b.log.Error("AssetRefBuffer: SMEMBERS failed", zap.Error(err))
		return
	}

	for _, pid := range pids {
		b.flushProject(ctx, pid)
	}
}

// flushProject atomically drains the buffer hash for one project and upserts to the DB.
func (b *assetRefBuffer) flushProject(ctx context.Context, pid string) {
	bufKey := assetRefBufPrefix + pid

	// Atomically HGETALL + DEL via Lua.
	result, err := drainScript.Run(ctx, b.redis, []string{bufKey}).StringSlice()
	if err != nil {
		if err == redis.Nil {
			// Empty hash, remove from set and return.
			b.redis.SRem(ctx, assetRefProjectsKey, pid)
			return
		}
		b.log.Error("AssetRefBuffer: drain script failed", zap.String("project_id", pid), zap.Error(err))
		return
	}
	if len(result) == 0 {
		b.redis.SRem(ctx, assetRefProjectsKey, pid)
		return
	}

	projectID, err := uuid.Parse(pid)
	if err != nil {
		b.log.Error("AssetRefBuffer: invalid project_id", zap.String("project_id", pid), zap.Error(err))
		b.redis.SRem(ctx, assetRefProjectsKey, pid)
		return
	}

	// result is [field1, value1, field2, value2, ...]
	increments := make([]AssetRefIncrement, 0, len(result)/2)
	metaKeysToDelete := make([]string, 0, len(result)/2)

	for i := 0; i < len(result)-1; i += 2 {
		sha256 := result[i]
		var count int
		if _, err := fmt.Sscanf(result[i+1], "%d", &count); err != nil || count <= 0 {
			continue
		}

		// Fetch asset metadata.
		metaKey := assetRefMetaPrefix + pid + ":" + sha256
		metaJSON, err := b.redis.Get(ctx, metaKey).Result()
		if err != nil {
			b.log.Warn("AssetRefBuffer: missing meta for asset, using minimal",
				zap.String("sha256", sha256), zap.Error(err))
			// Fallback: create minimal asset with just SHA256.
			increments = append(increments, AssetRefIncrement{
				Asset: model.Asset{SHA256: sha256},
				Count: count,
			})
			continue
		}
		metaKeysToDelete = append(metaKeysToDelete, metaKey)

		var asset model.Asset
		if err := json.Unmarshal([]byte(metaJSON), &asset); err != nil {
			b.log.Warn("AssetRefBuffer: failed to unmarshal meta",
				zap.String("sha256", sha256), zap.Error(err))
			increments = append(increments, AssetRefIncrement{
				Asset: model.Asset{SHA256: sha256},
				Count: count,
			})
			continue
		}
		increments = append(increments, AssetRefIncrement{
			Asset: asset,
			Count: count,
		})
	}

	if len(increments) > 0 {
		if err := b.repo.BatchIncrementAssetRefsWithCounts(ctx, projectID, increments); err != nil {
			b.log.Error("AssetRefBuffer: DB flush failed",
				zap.String("project_id", pid),
				zap.Int("increments", len(increments)),
				zap.Error(err))
			// Don't remove from project set — will retry on next tick.
			return
		}
	}

	// Clean up: remove project from set and delete meta keys.
	b.redis.SRem(ctx, assetRefProjectsKey, pid)
	if len(metaKeysToDelete) > 0 {
		b.redis.Del(ctx, metaKeysToDelete...)
	}
}
