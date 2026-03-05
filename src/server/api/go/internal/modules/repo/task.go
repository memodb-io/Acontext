package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type TaskRepo interface {
	ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Task, error)
	UpdateStatus(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, taskID uuid.UUID, status string) (*model.Task, error)
}

type taskRepo struct{ db *gorm.DB }

func NewTaskRepo(db *gorm.DB) TaskRepo {
	return &taskRepo{db: db}
}

func (r *taskRepo) ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Task, error) {
	q := r.db.WithContext(ctx).Where("session_id = ? AND is_planning = false", sessionID)

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

	var items []model.Task
	return items, q.Order(orderBy).Limit(limit).Find(&items).Error
}

func (r *taskRepo) UpdateStatus(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, taskID uuid.UUID, status string) (*model.Task, error) {
	validStatuses := map[string]bool{"success": true, "failed": true, "running": true, "pending": true}
	if !validStatuses[status] {
		return nil, fmt.Errorf("invalid status: %s", status)
	}

	var task model.Task
	result := r.db.WithContext(ctx).
		Where("id = ? AND session_id = ? AND project_id = ?", taskID, sessionID, projectID).
		First(&task)
	if result.Error != nil {
		return nil, result.Error
	}

	task.Status = status
	if err := r.db.WithContext(ctx).Save(&task).Error; err != nil {
		return nil, err
	}
	return &task, nil
}
