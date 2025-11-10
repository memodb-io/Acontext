package repo

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type ArtifactRepo interface {
	Create(ctx context.Context, projectID uuid.UUID, a *model.Artifact) error
	DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error
	Update(ctx context.Context, a *model.Artifact) error
	GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error)
	ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error)
	GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error)
	ExistsByPathAndFilename(ctx context.Context, diskID uuid.UUID, path string, filename string, excludeID *uuid.UUID) (bool, error)
}

type artifactRepo struct {
	db                 *gorm.DB
	assetReferenceRepo AssetReferenceRepo
}

func NewArtifactRepo(db *gorm.DB, assetReferenceRepo AssetReferenceRepo) ArtifactRepo {
	return &artifactRepo{db: db, assetReferenceRepo: assetReferenceRepo}
}

func (r *artifactRepo) Create(ctx context.Context, projectID uuid.UUID, a *model.Artifact) error {
	// Save asset meta before creation for reference increment
	asset := a.AssetMeta.Data()

	// Use transaction to ensure atomicity: create artifact and increment reference
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(a).Error; err != nil {
			return err
		}

		if err := r.assetReferenceRepo.IncrementAssetRef(ctx, projectID, asset); err != nil {
			return fmt.Errorf("increment asset reference: %w", err)
		}

		return nil
	})
}

func (r *artifactRepo) DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error {
	var a model.Artifact
	err := r.db.WithContext(ctx).Where("disk_id = ? AND path = ? AND filename = ?", diskID, path, filename).First(&a).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return err
		}
		return err
	}

	// Save asset meta before deletion for reference decrement
	asset := a.AssetMeta.Data()

	// Use transaction to ensure atomicity: delete artifact and decrement reference
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&a).Error; err != nil {
			return err
		}

		if err := r.assetReferenceRepo.DecrementAssetRef(ctx, projectID, asset); err != nil {
			return fmt.Errorf("decrement asset reference: %w", err)
		}

		return nil
	})
}

func (r *artifactRepo) Update(ctx context.Context, a *model.Artifact) error {
	return r.db.WithContext(ctx).Where("id = ? AND disk_id = ?", a.ID, a.DiskID).Updates(a).Error
}

func (r *artifactRepo) GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error) {
	var artifact model.Artifact
	err := r.db.WithContext(ctx).Where("disk_id = ? AND path = ? AND filename = ?", diskID, path, filename).First(&artifact).Error
	if err != nil {
		return nil, err
	}
	return &artifact, nil
}

func (r *artifactRepo) ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error) {
	var artifacts []*model.Artifact
	query := r.db.WithContext(ctx).Where("disk_id = ?", diskID)

	// If path is specified, filter by path
	if path != "" {
		query = query.Where("path = ?", path)
	}

	err := query.Find(&artifacts).Error
	if err != nil {
		return nil, err
	}
	return artifacts, nil
}

func (r *artifactRepo) GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error) {
	var paths []string
	err := r.db.WithContext(ctx).
		Model(&model.Artifact{}).
		Where("disk_id = ?", diskID).
		Distinct("path").
		Pluck("path", &paths).Error
	if err != nil {
		return nil, err
	}
	return paths, nil
}

func (r *artifactRepo) ExistsByPathAndFilename(ctx context.Context, diskID uuid.UUID, path string, filename string, excludeID *uuid.UUID) (bool, error) {
	query := r.db.WithContext(ctx).Model(&model.Artifact{}).
		Where("disk_id = ? AND path = ? AND filename = ?",
			diskID, path, filename)

	// Exclude specific artifact ID (useful for update operations)
	if excludeID != nil {
		query = query.Where("id != ?", *excludeID)
	}

	var count int64
	err := query.Count(&count).Error
	if err != nil {
		return false, err
	}

	return count > 0, nil
}
