package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"go.uber.org/zap"
)

type TaskService interface {
	GetTasks(ctx context.Context, in GetTasksInput) (*GetTasksOutput, error)
}

type taskService struct {
	r   repo.TaskRepo
	log *zap.Logger
}

func NewTaskService(r repo.TaskRepo, log *zap.Logger) TaskService {
	return &taskService{
		r:   r,
		log: log,
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

func (s *taskService) GetTasks(ctx context.Context, in GetTasksInput) (*GetTasksOutput, error) {
	// Parse cursor (createdAt, id); an empty cursor indicates starting from the latest
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	// Query limit+1 is used to determine has_more
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
