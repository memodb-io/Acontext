package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
)

type DiskService interface {
	Create(ctx context.Context, projectID uuid.UUID) (*model.Disk, error)
	Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error
	List(ctx context.Context, in ListDisksInput) (*ListDisksOutput, error)
}

type diskService struct{ r repo.DiskRepo }

func NewDiskService(r repo.DiskRepo) DiskService {
	return &diskService{r: r}
}

func (s *diskService) Create(ctx context.Context, projectID uuid.UUID) (*model.Disk, error) {
	disk := &model.Disk{
		ProjectID: projectID,
	}

	if err := s.r.Create(ctx, disk); err != nil {
		return nil, fmt.Errorf("create disk record: %w", err)
	}

	return disk, nil
}

func (s *diskService) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	if len(diskID) == 0 {
		return errors.New("disk id is empty")
	}
	return s.r.Delete(ctx, projectID, diskID)
}

type ListDisksInput struct {
	ProjectID uuid.UUID `json:"project_id"`
	Limit     int       `json:"limit"`
	Cursor    string    `json:"cursor"`
	TimeDesc  bool      `json:"time_desc"`
}

type ListDisksOutput struct {
	Items      []*model.Disk `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	HasMore    bool          `json:"has_more"`
}

func (s *diskService) List(ctx context.Context, in ListDisksInput) (*ListDisksOutput, error) {
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
	disks, err := s.r.ListWithCursor(ctx, in.ProjectID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListDisksOutput{
		Items:   disks,
		HasMore: false,
	}
	if len(disks) > in.Limit {
		out.HasMore = true
		out.Items = disks[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}
