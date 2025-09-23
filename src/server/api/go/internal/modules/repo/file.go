package repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type FileRepo interface {
	Create(ctx context.Context, f *model.File) error
	Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error
	DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error
	Update(ctx context.Context, f *model.File) error
	GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error)
	GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error)
	ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error)
	GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error)
	ExistsByPathAndFilename(ctx context.Context, artifactID uuid.UUID, path string, filename string, excludeID *uuid.UUID) (bool, error)
	GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error)
}

type fileRepo struct{ db *gorm.DB }

func NewFileRepo(db *gorm.DB) FileRepo {
	return &fileRepo{db: db}
}

func (r *fileRepo) Create(ctx context.Context, f *model.File) error {
	return r.db.WithContext(ctx).Create(f).Error
}

func (r *fileRepo) Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ? AND artifact_id = ?", fileID, artifactID).Delete(&model.File{}).Error
}

func (r *fileRepo) DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error {
	return r.db.WithContext(ctx).Where("artifact_id = ? AND path = ? AND filename = ?", artifactID, path, filename).Delete(&model.File{}).Error
}

func (r *fileRepo) Update(ctx context.Context, f *model.File) error {
	return r.db.WithContext(ctx).Where("id = ? AND artifact_id = ?", f.ID, f.ArtifactID).Updates(f).Error
}

func (r *fileRepo) GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error) {
	var file model.File
	err := r.db.WithContext(ctx).Where("id = ? AND artifact_id = ?", fileID, artifactID).First(&file).Error
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *fileRepo) GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error) {
	var file model.File
	err := r.db.WithContext(ctx).Where("artifact_id = ? AND path = ? AND filename = ?", artifactID, path, filename).First(&file).Error
	if err != nil {
		return nil, err
	}
	return &file, nil
}

func (r *fileRepo) ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error) {
	var files []*model.File
	query := r.db.WithContext(ctx).Where("artifact_id = ?", artifactID)

	// If path is specified, filter by path
	if path != "" {
		query = query.Where("path = ?", path)
	}

	err := query.Find(&files).Error
	if err != nil {
		return nil, err
	}
	return files, nil
}

func (r *fileRepo) GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error) {
	var paths []string
	err := r.db.WithContext(ctx).
		Model(&model.File{}).
		Where("artifact_id = ?", artifactID).
		Distinct("path").
		Pluck("path", &paths).Error
	if err != nil {
		return nil, err
	}
	return paths, nil
}

func (r *fileRepo) ExistsByPathAndFilename(ctx context.Context, artifactID uuid.UUID, path string, filename string, excludeID *uuid.UUID) (bool, error) {
	query := r.db.WithContext(ctx).Model(&model.File{}).
		Where("artifact_id = ? AND path = ? AND filename = ?",
			artifactID, path, filename)

	// Exclude specific file ID (useful for update operations)
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

func (r *fileRepo) GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error) {
	var files []*model.File
	err := r.db.WithContext(ctx).Where("artifact_id = ?", artifactID).Find(&files).Error
	if err != nil {
		return nil, err
	}
	return files, nil
}
