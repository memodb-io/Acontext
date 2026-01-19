package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
)

type SandboxLogService interface {
	GetSandboxLogs(ctx context.Context, in GetSandboxLogsInput) (*GetSandboxLogsOutput, error)
}

type sandboxLogService struct {
	r repo.SandboxLogRepo
}

func NewSandboxLogService(r repo.SandboxLogRepo) SandboxLogService {
	return &sandboxLogService{
		r: r,
	}
}

type GetSandboxLogsInput struct {
	ProjectID uuid.UUID `json:"project_id"`
	Limit     int       `json:"limit"`
	Cursor    string    `json:"cursor"`
	TimeDesc  bool      `json:"time_desc"`
}

type GetSandboxLogsOutput struct {
	Items      []model.SandboxLog `json:"items"`
	NextCursor string             `json:"next_cursor,omitempty"`
	HasMore    bool               `json:"has_more"`
}

func (s *sandboxLogService) GetSandboxLogs(ctx context.Context, in GetSandboxLogsInput) (*GetSandboxLogsOutput, error) {
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
	logs, err := s.r.ListByProjectWithCursor(ctx, in.ProjectID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &GetSandboxLogsOutput{
		Items:   logs,
		HasMore: false,
	}
	if len(logs) > in.Limit {
		out.HasMore = true
		out.Items = logs[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}
