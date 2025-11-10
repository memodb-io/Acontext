package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AssetReferenceRepo interface {
	IncrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error
	DecrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error
	BatchIncrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error
	BatchDecrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error
}

type assetReferenceRepo struct {
	db *gorm.DB
	s3 *blob.S3Deps
}

func NewAssetReferenceRepo(db *gorm.DB, s3 *blob.S3Deps) AssetReferenceRepo {
	return &assetReferenceRepo{db: db, s3: s3}
}

// IncrementAssetRef finds or creates an asset reference and increments its RefCount.
// It upserts by (project_id, sha256) and updates canonical fields.
// Uses SkipHooks to prevent recursive hook triggers when called from other hooks.
func (r *assetReferenceRepo) IncrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error {
	if projectID == uuid.Nil {
		return fmt.Errorf("IncrementAssetRef: project_id is required")
	}
	if asset.SHA256 == "" {
		return fmt.Errorf("IncrementAssetRef: asset.sha256 is required")
	}

	now := time.Now()

	// Prepare row for insert
	row := model.AssetReference{
		ProjectID:        projectID,
		SHA256:           asset.SHA256,
		S3Key:            asset.S3Key,
		RefCount:         1,
		AssetMeta:        datatypes.NewJSONType(asset),
		LastReferencedAt: now,
	}

	// Upsert by (project_id, sha256), incrementing ref_count and refreshing metadata/s3_key
	// Use SkipHooks to prevent recursive hook triggers when called from Artifact hooks
	return r.db.WithContext(ctx).Session(&gorm.Session{SkipHooks: true}).Clauses(
		clause.OnConflict{
			Columns: []clause.Column{{Name: "project_id"}, {Name: "sha256"}},
			DoUpdates: clause.Assignments(map[string]any{
				// increment
				"ref_count": gorm.Expr("asset_references.ref_count + 1"),
				// keep canonical s3 key if not set yet; otherwise preserve existing
				"s3_key":             gorm.Expr("COALESCE(NULLIF(asset_references.s3_key, ''), EXCLUDED.s3_key)"),
				"asset_meta":         row.AssetMeta,
				"last_referenced_at": now,
				"updated_at":         now,
			}),
		},
	).Omit(clause.Associations).Create(&row).Error
}

// DecrementAssetRef decrements RefCount and deletes the row if it reaches zero.
// Uses SkipHooks to prevent recursive hook triggers when called from other hooks.
func (r *assetReferenceRepo) DecrementAssetRef(ctx context.Context, projectID uuid.UUID, asset model.Asset) error {
	if projectID == uuid.Nil {
		return fmt.Errorf("DecrementAssetRef: project_id is required")
	}
	if asset.SHA256 == "" {
		return fmt.Errorf("DecrementAssetRef: asset.sha256 is required")
	}

	var ref model.AssetReference
	err := r.db.WithContext(ctx).Session(&gorm.Session{SkipHooks: true}).Where("project_id = ? AND sha256 = ?", projectID, asset.SHA256).First(&ref).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}

	if ref.RefCount <= 1 {
		if err := r.s3.DeleteObject(ctx, ref.S3Key); err != nil {
			return err
		}
		return r.db.WithContext(ctx).Session(&gorm.Session{SkipHooks: true}).Delete(&ref).Error
	}

	return r.db.WithContext(ctx).Session(&gorm.Session{SkipHooks: true}).Model(&model.AssetReference{}).
		Where("project_id = ? AND sha256 = ?", projectID, asset.SHA256).
		UpdateColumn("ref_count", gorm.Expr("ref_count - 1")).Error
}

// BatchIncrementAssetRefs increments reference counts for a slice of assets.
// Duplicated assets (by sha256) in the slice are coalesced and counted.
// Uses SkipHooks to prevent recursive hook triggers when called from other hooks.
func (r *assetReferenceRepo) BatchIncrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	if projectID == uuid.Nil {
		return fmt.Errorf("BatchIncrementAssetRefs: project_id is required")
	}
	if len(assets) == 0 {
		return nil
	}

	// group by sha256
	type agg struct {
		asset model.Asset
		count int
	}
	grouped := make(map[string]*agg)
	for _, a := range assets {
		if a.SHA256 == "" {
			continue
		}
		g, ok := grouped[a.SHA256]
		if !ok {
			grouped[a.SHA256] = &agg{asset: a, count: 1}
		} else {
			g.count++
		}
	}
	if len(grouped) == 0 {
		return nil
	}

	now := time.Now()
	rows := make([]model.AssetReference, 0, len(grouped))
	for _, g := range grouped {
		rows = append(rows, model.AssetReference{
			ProjectID:        projectID,
			SHA256:           g.asset.SHA256,
			S3Key:            g.asset.S3Key,
			RefCount:         g.count,
			AssetMeta:        datatypes.NewJSONType(g.asset),
			LastReferencedAt: now,
		})
	}

	// Use SkipHooks to prevent recursive hook triggers when called from other hooks
	return r.db.WithContext(ctx).Session(&gorm.Session{SkipHooks: true}).Clauses(
		clause.OnConflict{
			Columns: []clause.Column{{Name: "project_id"}, {Name: "sha256"}},
			DoUpdates: clause.Assignments(map[string]any{
				"ref_count":          gorm.Expr("asset_references.ref_count + EXCLUDED.ref_count"),
				"s3_key":             gorm.Expr("COALESCE(NULLIF(asset_references.s3_key, ''), EXCLUDED.s3_key)"),
				"last_referenced_at": now,
				"updated_at":         now,
			}),
		},
	).Omit(clause.Associations).Create(&rows).Error
}

// BatchDecrementAssetRefs decrements reference counts for a slice of assets.
// When count reaches zero or below, the asset reference row is deleted.
// Uses SkipHooks to prevent recursive hook triggers when called from other hooks.
func (r *assetReferenceRepo) BatchDecrementAssetRefs(ctx context.Context, projectID uuid.UUID, assets []model.Asset) error {
	if projectID == uuid.Nil {
		return fmt.Errorf("BatchDecrementAssetRefs: project_id is required")
	}
	if len(assets) == 0 {
		return nil
	}

	// group by sha256
	grouped := make(map[string]int)
	for _, a := range assets {
		if a.SHA256 == "" {
			continue
		}
		grouped[a.SHA256]++
	}
	if len(grouped) == 0 {
		return nil
	}

	// For each sha, decrement or delete
	// Use SkipHooks to prevent recursive hook triggers when called from other hooks
	sessionTx := r.db.WithContext(ctx).Session(&gorm.Session{SkipHooks: true})
	for sha, dec := range grouped {
		var ref model.AssetReference
		err := sessionTx.Where("project_id = ? AND sha256 = ?", projectID, sha).First(&ref).Error
		if err != nil {
			if err == gorm.ErrRecordNotFound {
				continue
			}
			return err
		}
		if ref.RefCount <= dec {
			if err := r.s3.DeleteObject(ctx, ref.S3Key); err != nil {
				return err
			}
			if err := sessionTx.Delete(&ref).Error; err != nil {
				return err
			}
			continue
		}
		if err := sessionTx.Model(&model.AssetReference{}).
			Where("project_id = ? AND sha256 = ?", projectID, sha).
			UpdateColumn("ref_count", gorm.Expr("ref_count - ?", dec)).Error; err != nil {
			return err
		}
	}
	return nil
}
