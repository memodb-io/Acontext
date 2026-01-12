package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type DiskRepo interface {
	Create(ctx context.Context, d *model.Disk) error
	Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error
	ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.Disk, error)
}

type diskRepo struct {
	db                 *gorm.DB
	assetReferenceRepo AssetReferenceRepo
}

func NewDiskRepo(db *gorm.DB, assetReferenceRepo AssetReferenceRepo) DiskRepo {
	return &diskRepo{db: db, assetReferenceRepo: assetReferenceRepo}
}

func (r *diskRepo) Create(ctx context.Context, d *model.Disk) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *diskRepo) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	// Use transaction to ensure atomicity
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Verify disk exists and belongs to project
		var disk model.Disk
		if err := tx.Where("id = ? AND project_id = ?", diskID, projectID).First(&disk).Error; err != nil {
			return err
		}

		// Query all artifacts before deletion to collect asset meta for reference decrement
		// Artifacts will be automatically deleted by CASCADE when disk is deleted
		var artifacts []model.Artifact
		if err := tx.Where("disk_id = ?", diskID).Find(&artifacts).Error; err != nil {
			return fmt.Errorf("query artifacts: %w", err)
		}

		// Collect asset meta from all artifacts for batch decrement
		assets := make([]model.Asset, 0, len(artifacts))
		for _, artifact := range artifacts {
			asset := artifact.AssetMeta.Data()
			if asset.SHA256 != "" {
				assets = append(assets, asset)
			}
		}

		// Delete the disk (artifacts will be deleted automatically by CASCADE)
		if err := tx.Delete(&disk).Error; err != nil {
			return fmt.Errorf("delete disk: %w", err)
		}

		// Batch decrement asset references
		// Note: BatchDecrementAssetRefs uses its own DB connection and may involve S3 operations
		// The database operations within BatchDecrementAssetRefs will not be part of this transaction,
		// but the disk and artifacts deletion will be atomic
		if len(assets) > 0 {
			if err := r.assetReferenceRepo.BatchDecrementAssetRefs(ctx, projectID, assets); err != nil {
				return fmt.Errorf("decrement asset references: %w", err)
			}
		}

		return nil
	})
}

func (r *diskRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.Disk, error) {
	q := r.db.WithContext(ctx).Where("disks.project_id = ?", projectID)

	// Filter by user identifier if provided
	if userIdentifier != "" {
		q = q.Joins("JOIN users ON users.id = disks.user_id").
			Where("users.identifier = ?", userIdentifier)
	}

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(disks.created_at "+comparisonOp+" ?) OR (disks.created_at = ? AND disks.id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "disks.created_at ASC, disks.id ASC"
	if timeDesc {
		orderBy = "disks.created_at DESC, disks.id DESC"
	}

	var disks []*model.Disk
	return disks, q.Order(orderBy).Limit(limit).Find(&disks).Error
}
