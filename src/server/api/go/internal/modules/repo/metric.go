package repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type MetricRepo interface {
	ListByDateRange(ctx context.Context, from time.Time, to time.Time) ([]model.Metric, error)
	FindProjectIDsByUpdatedAtRange(ctx context.Context, from time.Time, to time.Time) ([]uuid.UUID, error)
	SumSizeBByProjectID(ctx context.Context, projectID uuid.UUID) (int64, error)
	CreateMetrics(ctx context.Context, metrics []model.Metric) error
	SaveMetrics(ctx context.Context, metrics []model.Metric) error
	DeleteByProjectIDAndTag(ctx context.Context, projectID uuid.UUID, tag string) error
	ReplaceStorageMetrics(ctx context.Context, tag string, metrics []model.Metric) error
}

type metricRepo struct{ db *gorm.DB }

func NewMetricRepo(db *gorm.DB) MetricRepo {
	return &metricRepo{db: db}
}

func (r *metricRepo) ListByDateRange(ctx context.Context, from time.Time, to time.Time) ([]model.Metric, error) {
	var metrics []model.Metric
	q := r.db.WithContext(ctx)

	// Filter by timestamp range (second-level precision)
	q = q.Where("updated_at >= ? AND updated_at <= ?", from, to)

	// Order by updated_at ascending
	q = q.Order("updated_at ASC")

	return metrics, q.Find(&metrics).Error
}

func (r *metricRepo) FindProjectIDsByUpdatedAtRange(ctx context.Context, from time.Time, to time.Time) ([]uuid.UUID, error) {
	var projectIDs []uuid.UUID
	err := r.db.WithContext(ctx).
		Model(&model.AssetReference{}).
		Distinct("project_id").
		Where("updated_at >= ? AND updated_at <= ?", from, to).
		Pluck("project_id", &projectIDs).Error
	return projectIDs, err
}

func (r *metricRepo) SumSizeBByProjectID(ctx context.Context, projectID uuid.UUID) (int64, error) {
	var sum int64
	err := r.db.WithContext(ctx).
		Raw(`
			SELECT COALESCE(SUM((asset_meta -> 'size_b')::bigint), 0)
			FROM asset_references
			WHERE project_id = ?
		`, projectID).
		Scan(&sum).Error
	return sum, err
}

func (r *metricRepo) CreateMetrics(ctx context.Context, metrics []model.Metric) error {
	if len(metrics) == 0 {
		return nil
	}
	// Batch inserts in chunks of 100 to reduce index maintenance overhead and lock contention
	return r.db.WithContext(ctx).CreateInBatches(&metrics, 100).Error
}

// SaveMetrics upserts metrics by project_id and tag.
// If a metric with the same project_id and tag exists, it updates the increment value.
// If not, it creates a new record.
func (r *metricRepo) SaveMetrics(ctx context.Context, metrics []model.Metric) error {
	if len(metrics) == 0 {
		return nil
	}

	for _, metric := range metrics {
		var existing model.Metric
		err := r.db.WithContext(ctx).
			Where("project_id = ? AND tag = ?", metric.ProjectID, metric.Tag).
			Order("created_at DESC").
			First(&existing).Error

		if err == gorm.ErrRecordNotFound {
			// Create new record
			if err := r.db.WithContext(ctx).Create(&metric).Error; err != nil {
				return err
			}
		} else if err != nil {
			return err
		} else {
			// Update existing record
			if err := r.db.WithContext(ctx).
				Model(&existing).
				Update("increment", metric.Increment).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

// DeleteByProjectIDAndTag deletes all metrics with the given project_id and tag.
func (r *metricRepo) DeleteByProjectIDAndTag(ctx context.Context, projectID uuid.UUID, tag string) error {
	return r.db.WithContext(ctx).
		Where("project_id = ? AND tag = ?", projectID, tag).
		Delete(&model.Metric{}).Error
}

// ReplaceStorageMetrics atomically deletes existing metrics for each project in the
// provided slice (matching the given tag) and creates the new metrics in a single transaction.
func (r *metricRepo) ReplaceStorageMetrics(ctx context.Context, tag string, metrics []model.Metric) error {
	if len(metrics) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, m := range metrics {
			if err := tx.Where("project_id = ? AND tag = ?", m.ProjectID, tag).
				Delete(&model.Metric{}).Error; err != nil {
				return err
			}
		}
		return tx.CreateInBatches(&metrics, 100).Error
	})
}
