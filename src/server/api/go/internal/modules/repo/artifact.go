package repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type ArtifactRepo interface {
	Create(ctx context.Context, a *model.Artifact) error
	Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error
}

type artifactRepo struct{ db *gorm.DB }

func NewArtifactRepo(db *gorm.DB) ArtifactRepo {
	return &artifactRepo{db: db}
}

func (r *artifactRepo) Create(ctx context.Context, a *model.Artifact) error {
	return r.db.WithContext(ctx).Create(a).Error
}

func (r *artifactRepo) Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ? AND project_id = ?", artifactID, projectID).Delete(&model.Artifact{}).Error
}
