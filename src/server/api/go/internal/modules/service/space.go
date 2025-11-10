package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
)

type SpaceService interface {
	Create(ctx context.Context, m *model.Space) error
	Delete(ctx context.Context, projectID uuid.UUID, spaceID uuid.UUID) error
	UpdateByID(ctx context.Context, m *model.Space) error
	GetByID(ctx context.Context, m *model.Space) (*model.Space, error)
	List(ctx context.Context, in ListSpacesInput) (*ListSpacesOutput, error)
}

type spaceService struct{ r repo.SpaceRepo }

func NewSpaceService(r repo.SpaceRepo) SpaceService {
	return &spaceService{r: r}
}

func (s *spaceService) Create(ctx context.Context, m *model.Space) error {
	return s.r.Create(ctx, m)
}

func (s *spaceService) Delete(ctx context.Context, projectID uuid.UUID, spaceID uuid.UUID) error {
	if len(spaceID) == 0 {
		return errors.New("space id is empty")
	}
	return s.r.Delete(ctx, &model.Space{ID: spaceID, ProjectID: projectID})
}

func (s *spaceService) UpdateByID(ctx context.Context, m *model.Space) error {
	if len(m.ID) == 0 {
		return errors.New("space id is empty")
	}
	return s.r.Update(ctx, m)
}

func (s *spaceService) GetByID(ctx context.Context, m *model.Space) (*model.Space, error) {
	if len(m.ID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.r.Get(ctx, m)
}

type ListSpacesInput struct {
	ProjectID uuid.UUID `json:"project_id"`
	Limit     int       `json:"limit"`
	Cursor    string    `json:"cursor"`
	TimeDesc  bool      `json:"time_desc"`
}

type ListSpacesOutput struct {
	Items      []model.Space `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	HasMore    bool          `json:"has_more"`
}

func (s *spaceService) List(ctx context.Context, in ListSpacesInput) (*ListSpacesOutput, error) {
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
	spaces, err := s.r.ListWithCursor(ctx, in.ProjectID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListSpacesOutput{
		Items:   spaces,
		HasMore: false,
	}
	if len(spaces) > in.Limit {
		out.HasMore = true
		out.Items = spaces[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}
