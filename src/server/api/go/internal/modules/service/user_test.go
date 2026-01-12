package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserRepo is a mock implementation of UserRepo
type MockUserRepo struct {
	mock.Mock
}

func (m *MockUserRepo) Create(ctx context.Context, u *model.User) error {
	args := m.Called(ctx, u)
	return args.Error(0)
}

func (m *MockUserRepo) GetByIdentifier(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error) {
	args := m.Called(ctx, projectID, identifier)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepo) GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error) {
	args := m.Called(ctx, projectID, identifier)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepo) Delete(ctx context.Context, projectID uuid.UUID, identifier string) error {
	args := m.Called(ctx, projectID, identifier)
	return args.Error(0)
}

func (m *MockUserRepo) List(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.User, error) {
	args := m.Called(ctx, projectID, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.User), args.Error(1)
}

func (m *MockUserRepo) GetResourceCounts(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) (*repo.UserResourceCounts, error) {
	args := m.Called(ctx, projectID, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repo.UserResourceCounts), args.Error(1)
}

func TestUserService_GetOrCreate(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name       string
		identifier string
		setup      func(*MockUserRepo)
		wantErr    bool
		errMsg     string
	}{
		{
			name:       "successful get existing user",
			identifier: "alice@acontext.io",
			setup: func(repo *MockUserRepo) {
				expectedUser := &model.User{
					ID:         uuid.New(),
					ProjectID:  projectID,
					Identifier: "alice@acontext.io",
				}
				repo.On("GetOrCreate", ctx, projectID, "alice@acontext.io").Return(expectedUser, nil)
			},
			wantErr: false,
		},
		{
			name:       "successful create new user",
			identifier: "newuser@acontext.io",
			setup: func(repo *MockUserRepo) {
				expectedUser := &model.User{
					ID:         uuid.New(),
					ProjectID:  projectID,
					Identifier: "newuser@acontext.io",
				}
				repo.On("GetOrCreate", ctx, projectID, "newuser@acontext.io").Return(expectedUser, nil)
			},
			wantErr: false,
		},
		{
			name:       "empty identifier",
			identifier: "",
			setup:      func(repo *MockUserRepo) {},
			wantErr:    true,
			errMsg:     "user identifier is empty",
		},
		{
			name:       "repository error",
			identifier: "alice@acontext.io",
			setup: func(repo *MockUserRepo) {
				repo.On("GetOrCreate", ctx, projectID, "alice@acontext.io").Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockUserRepo{}
			tt.setup(mockRepo)

			service := NewUserService(mockRepo)
			result, err := service.GetOrCreate(ctx, projectID, tt.identifier)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestUserService_Delete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name       string
		identifier string
		setup      func(*MockUserRepo)
		wantErr    bool
		errMsg     string
	}{
		{
			name:       "successful user deletion",
			identifier: "alice@acontext.io",
			setup: func(repo *MockUserRepo) {
				repo.On("Delete", ctx, projectID, "alice@acontext.io").Return(nil)
			},
			wantErr: false,
		},
		{
			name:       "empty identifier",
			identifier: "",
			setup:      func(repo *MockUserRepo) {},
			wantErr:    true,
			errMsg:     "user identifier is empty",
		},
		{
			name:       "repository error",
			identifier: "alice@acontext.io",
			setup: func(repo *MockUserRepo) {
				repo.On("Delete", ctx, projectID, "alice@acontext.io").Return(errors.New("deletion failed"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockUserRepo{}
			tt.setup(mockRepo)

			service := NewUserService(mockRepo)
			err := service.Delete(ctx, projectID, tt.identifier)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestUserService_List(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name    string
		input   ListUsersInput
		setup   func(*MockUserRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful list all users (no limit)",
			input: ListUsersInput{
				ProjectID: projectID,
				Limit:     0,
			},
			setup: func(repo *MockUserRepo) {
				expectedUsers := []*model.User{
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "alice@acontext.io",
					},
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "bob@acontext.io",
					},
				}
				repo.On("List", ctx, projectID, time.Time{}, uuid.Nil, 0, false).Return(expectedUsers, nil)
			},
			wantErr: false,
		},
		{
			name: "successful list with limit",
			input: ListUsersInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockUserRepo) {
				expectedUsers := []*model.User{
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "alice@acontext.io",
					},
				}
				repo.On("List", ctx, projectID, time.Time{}, uuid.Nil, 11, false).Return(expectedUsers, nil)
			},
			wantErr: false,
		},
		{
			name: "successful list with time_desc",
			input: ListUsersInput{
				ProjectID: projectID,
				Limit:     10,
				TimeDesc:  true,
			},
			setup: func(repo *MockUserRepo) {
				expectedUsers := []*model.User{
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "alice@acontext.io",
					},
				}
				repo.On("List", ctx, projectID, time.Time{}, uuid.Nil, 11, true).Return(expectedUsers, nil)
			},
			wantErr: false,
		},
		{
			name: "has more results",
			input: ListUsersInput{
				ProjectID: projectID,
				Limit:     2,
			},
			setup: func(repo *MockUserRepo) {
				// Return limit+1 users to trigger HasMore
				expectedUsers := []*model.User{
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "alice@acontext.io",
						CreatedAt:  time.Now(),
					},
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "bob@acontext.io",
						CreatedAt:  time.Now(),
					},
					{
						ID:         uuid.New(),
						ProjectID:  projectID,
						Identifier: "charlie@acontext.io",
						CreatedAt:  time.Now(),
					},
				}
				repo.On("List", ctx, projectID, time.Time{}, uuid.Nil, 3, false).Return(expectedUsers, nil)
			},
			wantErr: false,
		},
		{
			name: "empty users list",
			input: ListUsersInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockUserRepo) {
				repo.On("List", ctx, projectID, time.Time{}, uuid.Nil, 11, false).Return([]*model.User{}, nil)
			},
			wantErr: false,
		},
		{
			name: "repository error",
			input: ListUsersInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockUserRepo) {
				repo.On("List", ctx, projectID, time.Time{}, uuid.Nil, 11, false).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockUserRepo{}
			tt.setup(mockRepo)

			service := NewUserService(mockRepo)
			result, err := service.List(ctx, tt.input)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestUserService_GetResourceCounts(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name       string
		identifier string
		setup      func(*MockUserRepo)
		wantErr    bool
		errMsg     string
	}{
		{
			name:       "successful resource counts retrieval",
			identifier: "alice@acontext.io",
			setup: func(mockRepo *MockUserRepo) {
				expectedUser := &model.User{
					ID:         userID,
					ProjectID:  projectID,
					Identifier: "alice@acontext.io",
				}
				mockRepo.On("GetByIdentifier", ctx, projectID, "alice@acontext.io").Return(expectedUser, nil)

				expectedCounts := &repo.UserResourceCounts{
					SpacesCount:   5,
					SessionsCount: 10,
					DisksCount:    3,
					SkillsCount:   2,
				}
				mockRepo.On("GetResourceCounts", ctx, projectID, userID).Return(expectedCounts, nil)
			},
			wantErr: false,
		},
		{
			name:       "user with zero resources",
			identifier: "newuser@acontext.io",
			setup: func(mockRepo *MockUserRepo) {
				expectedUser := &model.User{
					ID:         userID,
					ProjectID:  projectID,
					Identifier: "newuser@acontext.io",
				}
				mockRepo.On("GetByIdentifier", ctx, projectID, "newuser@acontext.io").Return(expectedUser, nil)

				expectedCounts := &repo.UserResourceCounts{
					SpacesCount:   0,
					SessionsCount: 0,
					DisksCount:    0,
					SkillsCount:   0,
				}
				mockRepo.On("GetResourceCounts", ctx, projectID, userID).Return(expectedCounts, nil)
			},
			wantErr: false,
		},
		{
			name:       "empty identifier",
			identifier: "",
			setup:      func(mockRepo *MockUserRepo) {},
			wantErr:    true,
			errMsg:     "user identifier is empty",
		},
		{
			name:       "user not found",
			identifier: "nonexistent@example.com",
			setup: func(mockRepo *MockUserRepo) {
				mockRepo.On("GetByIdentifier", ctx, projectID, "nonexistent@example.com").Return(nil, errors.New("user not found"))
			},
			wantErr: true,
		},
		{
			name:       "get resource counts error",
			identifier: "alice@acontext.io",
			setup: func(mockRepo *MockUserRepo) {
				expectedUser := &model.User{
					ID:         userID,
					ProjectID:  projectID,
					Identifier: "alice@acontext.io",
				}
				mockRepo.On("GetByIdentifier", ctx, projectID, "alice@acontext.io").Return(expectedUser, nil)
				mockRepo.On("GetResourceCounts", ctx, projectID, userID).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockUserRepo{}
			tt.setup(mockRepo)

			service := NewUserService(mockRepo)
			result, err := service.GetResourceCounts(ctx, projectID, tt.identifier)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
