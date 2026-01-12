package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
)

type UserService interface {
	GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error)
	Delete(ctx context.Context, projectID uuid.UUID, identifier string) error
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
	// The cascade deletion of associated resources (Space, Session, Disk, AgentSkills)
	// is handled by the database foreign key constraints (ON DELETE CASCADE)
	return s.r.Delete(ctx, projectID, identifier)
}
