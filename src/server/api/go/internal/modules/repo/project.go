package repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

type ProjectRepo interface {
	Create(ctx context.Context, p *model.Project) error
	Delete(ctx context.Context, projectID uuid.UUID) error
	GetByID(ctx context.Context, projectID uuid.UUID) (*model.Project, error)
	Update(ctx context.Context, p *model.Project) error
	AnalyzeUsages(ctx context.Context, projectID uuid.UUID, intervalDays int, fields []string) (*AnalyzeUsagesResult, error)
	AnalyzeStatistics(ctx context.Context, projectID uuid.UUID) (*AnalyzeStatisticsResult, error)
}

// AnalyzeStatisticsResult contains statistics data
type AnalyzeStatisticsResult struct {
	TaskCount    int64 `json:"taskCount"`
	SkillCount   int64 `json:"skillCount"`
	SessionCount int64 `json:"sessionCount"`
}

// AnalyzeUsagesResult contains all usage analysis data
type AnalyzeUsagesResult struct {
	TaskSuccess    []TaskSuccessRow    `json:"task_success"`
	TaskStatus     []TaskStatusRow     `json:"task_status"`
	SessionMessage []SessionMessageRow `json:"session_message"`
	SessionTask    []SessionTaskRow    `json:"session_task"`
	TaskMessage    []TaskMessageRow    `json:"task_message"`
	Storage        []StorageRow        `json:"storage"`
	TaskStats      []TaskStatsRow      `json:"task_stats"`
	NewSessions    []CountRow          `json:"new_sessions"`
	NewDisks       []CountRow          `json:"new_disks"`
	NewSpaces      []CountRow          `json:"new_spaces"`
}

type TaskSuccessRow struct {
	Date        string  `json:"date"`
	SuccessRate float64 `json:"success_rate"`
}

type TaskStatusRow struct {
	Date       string `json:"date"`
	Completed  int64  `json:"completed"`
	InProgress int64  `json:"in_progress"`
	Pending    int64  `json:"pending"`
	Failed     int64  `json:"failed"`
}

type SessionMessageRow struct {
	Date            string  `json:"date"`
	AvgMessageTurns float64 `json:"avg_message_turns"`
}

type SessionTaskRow struct {
	Date     string  `json:"date"`
	AvgTasks float64 `json:"avg_tasks"`
}

type TaskMessageRow struct {
	Date     string  `json:"date"`
	AvgTurns float64 `json:"avg_turns"`
}

type StorageRow struct {
	Date       string `json:"date"`
	UsageBytes int64  `json:"usage_bytes"`
}

type TaskStatsRow struct {
	Status     string   `json:"status"`
	Count      int64    `json:"count"`
	Percentage float64  `json:"percentage"`
	AvgTime    *float64 `json:"avg_time"`
}

type CountRow struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// shouldFetch returns true if fields is empty (fetch all) or contains the given key.
func shouldFetch(fields []string, key string) bool {
	if len(fields) == 0 {
		return true
	}
	for _, f := range fields {
		if f == key {
			return true
		}
	}
	return false
}

type projectRepo struct {
	db *gorm.DB
}

func NewProjectRepo(db *gorm.DB) ProjectRepo {
	return &projectRepo{db: db}
}

func (r *projectRepo) Create(ctx context.Context, p *model.Project) error {
	return r.db.WithContext(ctx).Create(p).Error
}

func (r *projectRepo) Delete(ctx context.Context, projectID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&model.Project{}, "id = ?", projectID).Error
}

func (r *projectRepo) GetByID(ctx context.Context, projectID uuid.UUID) (*model.Project, error) {
	var p model.Project
	err := r.db.WithContext(ctx).Where("id = ?", projectID).First(&p).Error
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *projectRepo) Update(ctx context.Context, p *model.Project) error {
	return r.db.WithContext(ctx).Model(&model.Project{}).Where("id = ?", p.ID).Updates(p).Error
}

func (r *projectRepo) AnalyzeUsages(ctx context.Context, projectID uuid.UUID, intervalDays int, fields []string) (*AnalyzeUsagesResult, error) {
	result := &AnalyzeUsagesResult{}
	g, ctx := errgroup.WithContext(ctx)

	// Query 1 & 2 merged: Task status counts (includes success/failed for TaskSuccess)
	if shouldFetch(fields, "task_success") || shouldFetch(fields, "task_status") {
		g.Go(func() error {
			type taskStatusQueryRow struct {
				Date         string `json:"date"`
				SuccessCount int64  `json:"success_count"`
				RunningCount int64  `json:"running_count"`
				PendingCount int64  `json:"pending_count"`
				FailedCount  int64  `json:"failed_count"`
			}
			var rows []taskStatusQueryRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'success'), 0) AS success_count,
					COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'running'), 0) AS running_count,
					COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'pending'), 0) AS pending_count,
					COALESCE(COUNT(t.id) FILTER (WHERE t.status = 'failed'), 0) AS failed_count
				FROM date_series ds
				LEFT JOIN tasks t ON DATE(t.created_at) = ds.date
					AND t.is_planning = false
					AND t.project_id = ?
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			// Populate both TaskSuccess and TaskStatus from the same query result
			result.TaskStatus = make([]TaskStatusRow, len(rows))
			result.TaskSuccess = make([]TaskSuccessRow, len(rows))
			for i, row := range rows {
				result.TaskStatus[i] = TaskStatusRow{
					Date:       row.Date,
					Completed:  row.SuccessCount,
					InProgress: row.RunningCount,
					Pending:    row.PendingCount,
					Failed:     row.FailedCount,
				}
				totalCompleted := row.SuccessCount + row.FailedCount
				var successRate float64
				if totalCompleted > 0 {
					successRate = float64(row.SuccessCount) / float64(totalCompleted) * 100
					successRate = float64(int(successRate*10)) / 10
				}
				result.TaskSuccess[i] = TaskSuccessRow{
					Date:        row.Date,
					SuccessRate: successRate,
				}
			}
			return nil
		})
	}

	// Query 3: Average message count per session
	if shouldFetch(fields, "session_message") {
		g.Go(func() error {
			var rows []SessionMessageRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				),
				session_message_counts AS (
					SELECT
						DATE(s.created_at) AS session_date,
						COUNT(m.id) AS message_count
					FROM sessions s
					LEFT JOIN messages m ON m.session_id = s.id
					WHERE s.created_at >= CURRENT_DATE - (?::int) * INTERVAL '1 day'
						AND s.project_id = ?
					GROUP BY s.id, DATE(s.created_at)
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COALESCE(AVG(smc.message_count), 0) AS avg_message_turns
				FROM date_series ds
				LEFT JOIN session_message_counts smc ON smc.session_date = ds.date
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.SessionMessage = rows
			return nil
		})
	}

	// Query 4: Average task count per session
	if shouldFetch(fields, "session_task") {
		g.Go(func() error {
			var rows []SessionTaskRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				),
				session_task_counts AS (
					SELECT
						DATE(s.created_at) AS session_date,
						COUNT(t.id) AS task_count
					FROM sessions s
					LEFT JOIN tasks t ON t.session_id = s.id AND t.is_planning = false
					WHERE s.created_at >= CURRENT_DATE - (?::int) * INTERVAL '1 day'
						AND s.project_id = ?
					GROUP BY s.id, DATE(s.created_at)
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COALESCE(AVG(stc.task_count), 0) AS avg_tasks
				FROM date_series ds
				LEFT JOIN session_task_counts stc ON stc.session_date = ds.date
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.SessionTask = rows
			return nil
		})
	}

	// Query 5: Average message count per task
	if shouldFetch(fields, "task_message") {
		g.Go(func() error {
			var rows []TaskMessageRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				),
				task_message_counts AS (
					SELECT
						DATE(t.created_at) AS task_date,
						COUNT(m.id) AS message_count
					FROM tasks t
					LEFT JOIN messages m ON m.task_id = t.id
					WHERE t.created_at >= CURRENT_DATE - (?::int) * INTERVAL '1 day'
						AND t.is_planning = false
						AND t.project_id = ?
					GROUP BY t.id, DATE(t.created_at)
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COALESCE(AVG(tmc.message_count), 0) AS avg_turns
				FROM date_series ds
				LEFT JOIN task_message_counts tmc ON tmc.task_date = ds.date
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.TaskMessage = rows
			return nil
		})
	}

	// Query 6: Storage usage (optimized with window function for O(n) complexity)
	if shouldFetch(fields, "storage") {
		g.Go(func() error {
			var rows []StorageRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				),
				daily_usage AS (
					SELECT
						DATE(created_at) AS date,
						SUM((asset_meta -> 'size_b')::bigint) AS daily_bytes
					FROM asset_references
					WHERE project_id = ?
					GROUP BY DATE(created_at)
				),
				merged AS (
					SELECT
						ds.date,
						COALESCE(du.daily_bytes, 0) AS daily_bytes
					FROM date_series ds
					LEFT JOIN daily_usage du ON du.date = ds.date
				)
				SELECT
					TO_CHAR(date, 'YYYY-MM-DD') AS date,
					SUM(daily_bytes) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) AS usage_bytes
				FROM merged
				ORDER BY date ASC
			`, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.Storage = rows
			return nil
		})
	}

	// Query 7: Task stats by status
	if shouldFetch(fields, "task_stats") {
		g.Go(func() error {
			type taskStatsQueryRow struct {
				Status             string   `json:"status"`
				Count              int64    `json:"count"`
				AvgDurationSeconds *float64 `json:"avg_duration_seconds"`
			}
			var rows []taskStatsQueryRow
			if err := r.db.WithContext(ctx).Raw(`
				SELECT
					status,
					COUNT(*) AS count,
					CASE
						WHEN status IN ('success', 'failed') THEN
							AVG(EXTRACT(EPOCH FROM (updated_at - created_at)))
						ELSE NULL
					END AS avg_duration_seconds
				FROM tasks
				WHERE created_at >= CURRENT_DATE - (?::int) * INTERVAL '1 day'
					AND is_planning = false
					AND project_id = ?
				GROUP BY status
				ORDER BY
					CASE status
						WHEN 'success' THEN 1
						WHEN 'running' THEN 2
						WHEN 'pending' THEN 3
						WHEN 'failed' THEN 4
						ELSE 5
					END
			`, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			var totalCount int64
			for _, row := range rows {
				totalCount += row.Count
			}
			result.TaskStats = make([]TaskStatsRow, len(rows))
			for i, row := range rows {
				var percentage float64
				if totalCount > 0 {
					percentage = float64(row.Count) / float64(totalCount) * 100
					percentage = float64(int(percentage*10)) / 10
				}
				var avgTime *float64
				if row.AvgDurationSeconds != nil {
					minutes := *row.AvgDurationSeconds / 60
					minutes = float64(int(minutes*10)) / 10
					avgTime = &minutes
				}
				result.TaskStats[i] = TaskStatsRow{
					Status:     row.Status,
					Count:      row.Count,
					Percentage: percentage,
					AvgTime:    avgTime,
				}
			}
			return nil
		})
	}

	// Query 8: New sessions count
	if shouldFetch(fields, "new_sessions") {
		g.Go(func() error {
			var rows []CountRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COUNT(s.id) AS count
				FROM date_series ds
				LEFT JOIN sessions s ON DATE(s.created_at) = ds.date AND s.project_id = ?
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.NewSessions = rows
			return nil
		})
	}

	// Query 9: New disks count
	if shouldFetch(fields, "new_disks") {
		g.Go(func() error {
			var rows []CountRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COUNT(d.id) AS count
				FROM date_series ds
				LEFT JOIN disks d ON DATE(d.created_at) = ds.date AND d.project_id = ?
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.NewDisks = rows
			return nil
		})
	}

	// Query 10: New spaces count
	if shouldFetch(fields, "new_spaces") {
		g.Go(func() error {
			var rows []CountRow
			if err := r.db.WithContext(ctx).Raw(`
				WITH date_series AS (
					SELECT generate_series(
						CURRENT_DATE - (?::int) * INTERVAL '1 day',
						CURRENT_DATE,
						'1 day'::interval
					)::date AS date
				)
				SELECT
					TO_CHAR(ds.date, 'YYYY-MM-DD') AS date,
					COUNT(ls.id) AS count
				FROM date_series ds
				LEFT JOIN learning_spaces ls ON DATE(ls.created_at) = ds.date AND ls.project_id = ?
				GROUP BY ds.date
				ORDER BY ds.date ASC
			`, intervalDays, projectID).Scan(&rows).Error; err != nil {
				return err
			}
			result.NewSpaces = rows
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}

	return result, nil
}

func (r *projectRepo) AnalyzeStatistics(ctx context.Context, projectID uuid.UUID) (*AnalyzeStatisticsResult, error) {
	result := &AnalyzeStatisticsResult{}

	var taskCount int64
	if err := r.db.WithContext(ctx).Model(&struct {
		ID uuid.UUID `gorm:"type:uuid"`
	}{}).
		Table("tasks").
		Where("project_id = ? AND is_planning = false", projectID).
		Count(&taskCount).Error; err != nil {
		return nil, err
	}

	var skillCount int64
	if err := r.db.WithContext(ctx).Model(&struct {
		ID uuid.UUID `gorm:"type:uuid"`
	}{}).
		Table("agent_skills").
		Where("project_id = ?", projectID).
		Count(&skillCount).Error; err != nil {
		return nil, err
	}

	var sessionCount int64
	if err := r.db.WithContext(ctx).Model(&model.Session{}).
		Where("project_id = ?", projectID).
		Count(&sessionCount).Error; err != nil {
		return nil, err
	}

	result.TaskCount = taskCount
	result.SkillCount = skillCount
	result.SessionCount = sessionCount

	return result, nil
}
