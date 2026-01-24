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

type UserService interface {
	GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error)
	Delete(ctx context.Context, projectID uuid.UUID, identifier string) error
	List(ctx context.Context, in ListUsersInput) (*ListUsersOutput, error)
	GetResourceCounts(ctx context.Context, projectID uuid.UUID, identifier string) (*GetUserResourcesOutput, error)
}

type userService struct {
	r repo.UserRepo
}

func NewUserService(r repo.UserRepo) UserService {
	return &userService{r: r}
}

func (s *userService) GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error) {
	if identifier == "" {
		return nil, errors.New("user identifier is empty")
	}
	return s.r.GetOrCreate(ctx, projectID, identifier)
}

func (s *userService) Delete(ctx context.Context, projectID uuid.UUID, identifier string) error {
	if identifier == "" {
		return errors.New("user identifier is empty")
	}
	// The cascade deletion of associated resources (Session, Disk, AgentSkills)
	// is handled by the database foreign key constraints (ON DELETE CASCADE)
	return s.r.Delete(ctx, projectID, identifier)
}

type ListUsersInput struct {
	ProjectID uuid.UUID `json:"project_id"`
	Limit     int       `json:"limit"` // 0 means no limit (return all)
	Cursor    string    `json:"cursor"`
	TimeDesc  bool      `json:"time_desc"`
}

type ListUsersOutput struct {
	Items      []*model.User `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	HasMore    bool          `json:"has_more"`
}

func (s *userService) List(ctx context.Context, in ListUsersInput) (*ListUsersOutput, error) {
	// If limit is 0, return all users without pagination
	if in.Limit == 0 {
		users, err := s.r.List(ctx, in.ProjectID, time.Time{}, uuid.Nil, 0, in.TimeDesc)
		if err != nil {
			return nil, err
		}
		return &ListUsersOutput{
			Items:   users,
			HasMore: false,
		}, nil
	}

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
	users, err := s.r.List(ctx, in.ProjectID, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	out := &ListUsersOutput{
		Items:   users,
		HasMore: false,
	}
	if len(users) > in.Limit {
		out.HasMore = true
		out.Items = users[:in.Limit]
		last := out.Items[len(out.Items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

type GetUserResourcesOutput struct {
	Counts *repo.UserResourceCounts `json:"counts"`
}

func (s *userService) GetResourceCounts(ctx context.Context, projectID uuid.UUID, identifier string) (*GetUserResourcesOutput, error) {
	if identifier == "" {
		return nil, errors.New("user identifier is empty")
	}

	// First look up user by identifier
	user, err := s.r.GetByIdentifier(ctx, projectID, identifier)
	if err != nil {
		return nil, err
	}

	// Get resource counts
	counts, err := s.r.GetResourceCounts(ctx, projectID, user.ID)
	if err != nil {
		return nil, err
	}

	return &GetUserResourcesOutput{Counts: counts}, nil
}
