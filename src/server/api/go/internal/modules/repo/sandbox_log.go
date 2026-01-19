package repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type SandboxLogRepo interface {
	ListByProjectWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.SandboxLog, error)
}

type sandboxLogRepo struct{ db *gorm.DB }

func NewSandboxLogRepo(db *gorm.DB) SandboxLogRepo {
	return &sandboxLogRepo{db: db}
}

func (r *sandboxLogRepo) ListByProjectWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.SandboxLog, error) {
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

	var items []model.SandboxLog
	return items, q.Order(orderBy).Limit(limit).Find(&items).Error
}
