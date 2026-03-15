package repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type SessionEventRepo interface {
	Create(ctx context.Context, event *model.SessionEvent) error
	ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.SessionEvent, error)
	ListBySessionInTimeWindow(ctx context.Context, sessionID uuid.UUID, minTime time.Time, maxTime time.Time) ([]model.SessionEvent, error)
	ListAllBySession(ctx context.Context, sessionID uuid.UUID) ([]model.SessionEvent, error)
}

type sessionEventRepo struct {
	db *gorm.DB
}

func NewSessionEventRepo(db *gorm.DB) SessionEventRepo {
	return &sessionEventRepo{db: db}
}

func (r *sessionEventRepo) Create(ctx context.Context, event *model.SessionEvent) error {
	return r.db.WithContext(ctx).Create(event).Error
}

func (r *sessionEventRepo) ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.SessionEvent, error) {
	q := r.db.WithContext(ctx).Where("session_id = ?", sessionID)

	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(created_at "+comparisonOp+" ?) OR (created_at = ? AND id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	orderBy := "created_at ASC, id ASC"
	if timeDesc {
		orderBy = "created_at DESC, id DESC"
	}

	var items []model.SessionEvent
	return items, q.Order(orderBy).Limit(limit).Find(&items).Error
}

func (r *sessionEventRepo) ListBySessionInTimeWindow(ctx context.Context, sessionID uuid.UUID, minTime time.Time, maxTime time.Time) ([]model.SessionEvent, error) {
	var items []model.SessionEvent
	err := r.db.WithContext(ctx).
		Where("session_id = ? AND created_at >= ? AND created_at <= ?", sessionID, minTime, maxTime).
		Order("created_at ASC, id ASC").
		Find(&items).Error
	return items, err
}

func (r *sessionEventRepo) ListAllBySession(ctx context.Context, sessionID uuid.UUID) ([]model.SessionEvent, error) {
	var items []model.SessionEvent
	err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Order("created_at ASC, id ASC").
		Find(&items).Error
	return items, err
}
