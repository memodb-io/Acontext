package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	mq "github.com/memodb-io/Acontext/internal/infra/queue"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type TaskService interface {
	GetTasks(ctx context.Context, in GetTasksInput) (*GetTasksOutput, error)
	UpdateTaskStatus(ctx context.Context, in UpdateTaskStatusInput) (*model.Task, error)
}

type taskService struct {
	r         repo.TaskRepo
	lssRepo   repo.LearningSpaceSessionRepo
	publisher *mq.Publisher
	cfg       *config.Config
	log       *zap.Logger
}

func NewTaskService(r repo.TaskRepo, lssRepo repo.LearningSpaceSessionRepo, publisher *mq.Publisher, cfg *config.Config, log *zap.Logger) TaskService {
	return &taskService{
		r:         r,
		lssRepo:   lssRepo,
		publisher: publisher,
		cfg:       cfg,
		log:       log,
	}
}

type GetTasksInput struct {
	SessionID uuid.UUID `json:"session_id"`
	Limit     int       `json:"limit"`
	Cursor    string    `json:"cursor"`
	TimeDesc  bool      `json:"time_desc"`
}

type GetTasksOutput struct {
	Items      []model.Task `json:"items"`
	NextCursor string       `json:"next_cursor,omitempty"`
	HasMore    bool         `json:"has_more"`
}

type UpdateTaskStatusInput struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	TaskID    uuid.UUID `json:"task_id"`
	Status    string    `json:"status"`
}

type SkillLearnTaskMQ struct {
	ProjectID uuid.UUID `json:"project_id"`
	SessionID uuid.UUID `json:"session_id"`
	TaskID    uuid.UUID `json:"task_id"`
}

func (s *taskService) GetTasks(ctx context.Context, in GetTasksInput) (*GetTasksOutput, error) {
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	tasks, err := s.r.ListBySessionWithCursor(ctx, in.SessionID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &GetTasksOutput{
		Items:   tasks,
		HasMore: false,
	}
	if len(tasks) > in.Limit {
		out.HasMore = true
		out.Items = tasks[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

func (s *taskService) UpdateTaskStatus(ctx context.Context, in UpdateTaskStatusInput) (*model.Task, error) {
	task, err := s.r.UpdateStatus(ctx, in.ProjectID, in.SessionID, in.TaskID, in.Status)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("task not found or does not belong to this session")
		}
		return nil, fmt.Errorf("failed to update task status: %w", err)
	}

	if in.Status == "success" || in.Status == "failed" {
		exists, err := s.lssRepo.ExistsBySessionID(ctx, in.SessionID)
		if err != nil {
			s.log.Warn("failed to check learning space for session, skipping skill learning publish", zap.Error(err), zap.String("session_id", in.SessionID.String()))
		} else if !exists {
			s.log.Debug("no learning space found for session, skipping skill learning publish", zap.String("session_id", in.SessionID.String()))
		} else if s.publisher != nil {
			if pubErr := s.publisher.PublishJSON(ctx, s.cfg.RabbitMQ.ExchangeName.LearningSkill, s.cfg.RabbitMQ.RoutingKey.LearningSkillDistill, SkillLearnTaskMQ{
				ProjectID: task.ProjectID,
				SessionID: in.SessionID,
				TaskID:    in.TaskID,
			}); pubErr != nil {
				s.log.Error("failed to publish skill learning task", zap.Error(pubErr), zap.String("session_id", in.SessionID.String()))
			}
		}
	}

	return task, nil
}
