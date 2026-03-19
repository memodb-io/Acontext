package service

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	pathutil "github.com/memodb-io/Acontext/internal/pkg/utils/path"
	"github.com/redis/go-redis/v9"
)

type MetricService interface {
	GetMetrics(ctx context.Context, in GetMetricsInput) (*GetMetricsOutput, error)
	CreateStorageUsageMetrics(ctx context.Context, in CreateStorageUsageMetricsInput) (*CreateStorageUsageMetricsOutput, error)
	ProcessQuotaItems(ctx context.Context, items []QuotaItem) error
	CheckQuota(ctx context.Context, in CheckQuotaInput) (*CheckQuotaOutput, error)
}

type metricService struct {
	r     repo.MetricRepo
	redis *redis.Client
}

func NewMetricService(r repo.MetricRepo, rdb *redis.Client) MetricService {
	return &metricService{r: r, redis: rdb}
}

type GetMetricsInput struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

type GetMetricsOutput struct {
	Metrics []model.Metric `json:"metrics"`
}

func (s *metricService) GetMetrics(ctx context.Context, in GetMetricsInput) (*GetMetricsOutput, error) {
	metrics, err := s.r.ListByDateRange(ctx, in.From, in.To)
	if err != nil {
		return nil, err
	}

	return &GetMetricsOutput{
		Metrics: metrics,
	}, nil
}

type CreateStorageUsageMetricsInput struct {
	From time.Time `json:"from"`
	To   time.Time `json:"to"`
}

type CreateStorageUsageMetricsOutput struct {
	CreatedCount int `json:"created_count"`
}

func (s *metricService) CreateStorageUsageMetrics(ctx context.Context, in CreateStorageUsageMetricsInput) (*CreateStorageUsageMetricsOutput, error) {
	// Find distinct project_ids from asset_references where updated_at is in the time range
	projectIDs, err := s.r.FindProjectIDsByUpdatedAtRange(ctx, in.From, in.To)
	if err != nil {
		return nil, err
	}

	if len(projectIDs) == 0 {
		return &CreateStorageUsageMetricsOutput{CreatedCount: 0}, nil
	}

	// For each project_id, sum size_b from asset_meta across ALL asset_references records
	metrics := make([]model.Metric, 0, len(projectIDs))
	for _, projectID := range projectIDs {
		sumSizeB, err := s.r.SumSizeBByProjectID(ctx, projectID)
		if err != nil {
			return nil, err
		}

		metrics = append(metrics, model.Metric{
			ProjectID: projectID,
			Tag:       model.MetricTagStorageUsage,
			Increment: sumSizeB,
		})
	}

	// Atomically delete old and create new storage usage metrics
	if err := s.r.ReplaceStorageMetrics(ctx, model.MetricTagStorageUsage, metrics); err != nil {
		return nil, err
	}

	return &CreateStorageUsageMetricsOutput{
		CreatedCount: len(metrics),
	}, nil
}

// QuotaItem represents a single quota status item
type QuotaItem struct {
	ProjectID string `json:"project_id"`
	Tag       string `json:"tag"`
	Excess    bool   `json:"excess"`
}

const (
	QuotaKeyPrefix = "quota"
	QuotaTagPrefix = "excess"
)

// ProcessQuotaItems processes quota items, updates Redis and DB accordingly.
func (s *metricService) ProcessQuotaItems(ctx context.Context, items []QuotaItem) error {
	metricsToSave := make([]model.Metric, 0)

	for _, item := range items {
		projectID, err := uuid.Parse(item.ProjectID)
		if err != nil {
			return fmt.Errorf("invalid project_id: %s: %w", item.ProjectID, err)
		}

		key := fmt.Sprintf("%s:%s:%s", QuotaKeyPrefix, item.ProjectID, item.Tag)
		tag := fmt.Sprintf("%s.%s", QuotaTagPrefix, item.Tag)

		if item.Excess {
			// Excess = true: set Redis key and save metric
			if err := s.redis.Set(ctx, key, "1", 0).Err(); err != nil {
				return fmt.Errorf("failed to set Redis key %s: %w", key, err)
			}
			metricsToSave = append(metricsToSave, model.Metric{
				ProjectID: projectID,
				Tag:       tag,
				Increment: 1,
				// Set created_at and updated_at to the start of Unix epoch to ensure they are not retrieved
				CreatedAt: time.Unix(0, 0),
				UpdatedAt: time.Unix(0, 0),
			})
		} else {
			// Excess = false: only process if Redis key exists
			exists, err := s.redis.Exists(ctx, key).Result()
			if err != nil {
				return fmt.Errorf("failed to check Redis key %s: %w", key, err)
			}

			if exists > 0 {
				// Delete Redis key
				if err := s.redis.Del(ctx, key).Err(); err != nil {
					return fmt.Errorf("failed to delete Redis key %s: %w", key, err)
				}
				// Delete metric from DB
				if err := s.r.DeleteByProjectIDAndTag(ctx, projectID, tag); err != nil {
					return fmt.Errorf("failed to delete metric for project %s tag %s: %w", projectID, tag, err)
				}
			}
		}
	}

	// Batch save metrics for excess = true cases
	if len(metricsToSave) > 0 {
		if err := s.r.SaveMetrics(ctx, metricsToSave); err != nil {
			return fmt.Errorf("failed to save metrics: %w", err)
		}
	}

	return nil
}

// Quota path patterns
const (
	PathSessionMessages = "/api/v1/session/:session_id/messages"
	PathDiskArtifacts   = "/api/v1/disk/:disk_id/artifact"
)

// CheckQuotaInput is the input for CheckQuota
type CheckQuotaInput struct {
	ProjectID uuid.UUID
	Path      string
	Method    string
}

// CheckQuotaOutput is the output for CheckQuota
type CheckQuotaOutput struct {
	Allowed bool
	Reason  string
}

// quotaPathMatcher is a pre-configured path matcher for quota routes
var quotaPathMatcher = pathutil.NewPathMatcher(
	PathSessionMessages,
	PathDiskArtifacts,
)

// CheckQuota checks if the request is allowed based on quota rules
func (s *metricService) CheckQuota(ctx context.Context, in CheckQuotaInput) (*CheckQuotaOutput, error) {
	pattern, _ := quotaPathMatcher.MatchWithParams(in.Path)

	switch pattern {
	case PathSessionMessages, PathDiskArtifacts:
		key := fmt.Sprintf("%s:%s:%s", QuotaKeyPrefix, in.ProjectID.String(), model.MetricTagStorageUsage)

		switch in.Method {
		case http.MethodPost:
			exists, err := s.redis.Exists(ctx, key).Result()
			if err != nil {
				return nil, fmt.Errorf("failed to check Redis key %s: %w", key, err)
			}
			if exists > 0 {
				return &CheckQuotaOutput{Allowed: false, Reason: "quota exceeded"}, nil
			}

			return &CheckQuotaOutput{Allowed: true}, nil
		}
	}

	// Default: allow
	return &CheckQuotaOutput{Allowed: true}, nil
}
