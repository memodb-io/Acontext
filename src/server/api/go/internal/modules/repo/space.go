package repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type SpaceRepo interface {
	Create(ctx context.Context, s *model.Space) error
	Delete(ctx context.Context, s *model.Space) error
	Update(ctx context.Context, s *model.Space) error
	Get(ctx context.Context, s *model.Space) (*model.Space, error)
	ListWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Space, error)
	ListExperienceConfirmationsWithCursor(ctx context.Context, spaceID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.ExperienceConfirmation, error)
	GetExperienceConfirmation(ctx context.Context, spaceID uuid.UUID, experienceID uuid.UUID) (*model.ExperienceConfirmation, error)
	DeleteExperienceConfirmation(ctx context.Context, spaceID uuid.UUID, experienceID uuid.UUID) error
}

type spaceRepo struct{ db *gorm.DB }

func NewSpaceRepo(db *gorm.DB) SpaceRepo {
	return &spaceRepo{db: db}
}

func (r *spaceRepo) Create(ctx context.Context, s *model.Space) error {
	return r.db.WithContext(ctx).Create(s).Error
}

func (r *spaceRepo) Delete(ctx context.Context, s *model.Space) error {
	return r.db.WithContext(ctx).Delete(s).Error
}

func (r *spaceRepo) Update(ctx context.Context, s *model.Space) error {
	return r.db.WithContext(ctx).Where(&model.Space{ID: s.ID}).Updates(s).Error
}

func (r *spaceRepo) Get(ctx context.Context, s *model.Space) (*model.Space, error) {
	return s, r.db.WithContext(ctx).Where(&model.Space{ID: s.ID}).First(s).Error
}

func (r *spaceRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Space, error) {
	q := r.db.WithContext(ctx).Where("project_id = ?", projectID)

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(created_at "+comparisonOp+" ?) OR (created_at = ? AND id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "created_at ASC, id ASC"
	if timeDesc {
		orderBy = "created_at DESC, id DESC"
	}

	var spaces []model.Space
	return spaces, q.Order(orderBy).Limit(limit).Find(&spaces).Error
}

func (r *spaceRepo) ListExperienceConfirmationsWithCursor(ctx context.Context, spaceID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.ExperienceConfirmation, error) {
	q := r.db.WithContext(ctx).Where("space_id = ?", spaceID)

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(created_at "+comparisonOp+" ?) OR (created_at = ? AND id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "created_at ASC, id ASC"
	if timeDesc {
		orderBy = "created_at DESC, id DESC"
	}

	var confirmations []model.ExperienceConfirmation
	return confirmations, q.Order(orderBy).Limit(limit).Find(&confirmations).Error
}

func (r *spaceRepo) GetExperienceConfirmation(ctx context.Context, spaceID uuid.UUID, experienceID uuid.UUID) (*model.ExperienceConfirmation, error) {
	var confirmation model.ExperienceConfirmation
	err := r.db.WithContext(ctx).
		Where("id = ? AND space_id = ?", experienceID, spaceID).
		First(&confirmation).Error
	if err != nil {
		return nil, err
	}
	return &confirmation, nil
}

func (r *spaceRepo) DeleteExperienceConfirmation(ctx context.Context, spaceID uuid.UUID, experienceID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND space_id = ?", experienceID, spaceID).
		Delete(&model.ExperienceConfirmation{}).Error
}
