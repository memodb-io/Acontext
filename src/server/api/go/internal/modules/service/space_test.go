package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockSpaceRepo is a mock implementation of SpaceRepo
type MockSpaceRepo struct {
	mock.Mock
}

func (m *MockSpaceRepo) Create(ctx context.Context, s *model.Space) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSpaceRepo) Delete(ctx context.Context, s *model.Space) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSpaceRepo) Update(ctx context.Context, s *model.Space) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSpaceRepo) Get(ctx context.Context, s *model.Space) (*model.Space, error) {
	args := m.Called(ctx, s)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Space), args.Error(1)
}

func (m *MockSpaceRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Space, error) {
	args := m.Called(ctx, projectID, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Space), args.Error(1)
}

func TestSpaceService_Create(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name    string
		space   *model.Space
		setup   func(*MockSpaceRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful space creation",
			space: &model.Space{
				ID:        uuid.New(),
				ProjectID: projectID,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("Create", ctx, mock.AnythingOfType("*model.Space")).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "creation failed",
			space: &model.Space{
				ID:        uuid.New(),
				ProjectID: projectID,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("Create", ctx, mock.AnythingOfType("*model.Space")).Return(errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSpaceRepo{}
			tt.setup(repo)

			service := NewSpaceService(repo)
			err := service.Create(ctx, tt.space)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSpaceService_Delete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	spaceID := uuid.New()

	tests := []struct {
		name      string
		projectID uuid.UUID
		spaceID   uuid.UUID
		setup     func(*MockSpaceRepo)
		wantErr   bool
		errMsg    string
	}{
		{
			name:      "successful space deletion",
			projectID: projectID,
			spaceID:   spaceID,
			setup: func(repo *MockSpaceRepo) {
				repo.On("Delete", ctx, mock.MatchedBy(func(s *model.Space) bool {
					return s.ID == spaceID && s.ProjectID == projectID
				})).Return(nil)
			},
			wantErr: false,
		},
		{
			name:      "empty space ID",
			projectID: projectID,
			spaceID:   uuid.UUID{},
			setup: func(repo *MockSpaceRepo) {
				// Empty UUID will call Delete, because len(uuid.UUID{}) != 0
				repo.On("Delete", ctx, mock.AnythingOfType("*model.Space")).Return(nil)
			},
			wantErr: false, // Actually won't error
		},
		{
			name:      "deletion failed",
			projectID: projectID,
			spaceID:   spaceID,
			setup: func(repo *MockSpaceRepo) {
				repo.On("Delete", ctx, mock.AnythingOfType("*model.Space")).Return(errors.New("deletion failed"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSpaceRepo{}
			tt.setup(repo)

			service := NewSpaceService(repo)
			err := service.Delete(ctx, tt.projectID, tt.spaceID)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSpaceService_UpdateByID(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()

	tests := []struct {
		name    string
		space   *model.Space
		setup   func(*MockSpaceRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful space update",
			space: &model.Space{
				ID: spaceID,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("Update", ctx, mock.MatchedBy(func(s *model.Space) bool {
					return s.ID == spaceID
				})).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "empty space ID",
			space: &model.Space{
				ID: uuid.UUID{},
			},
			setup: func(repo *MockSpaceRepo) {
				// Empty UUID will call Update, because len(uuid.UUID{}) != 0
				repo.On("Update", ctx, mock.AnythingOfType("*model.Space")).Return(nil)
			},
			wantErr: false, // Actually won't error
		},
		{
			name: "update failed",
			space: &model.Space{
				ID: spaceID,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("Update", ctx, mock.AnythingOfType("*model.Space")).Return(errors.New("update failed"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSpaceRepo{}
			tt.setup(repo)

			service := NewSpaceService(repo)
			err := service.UpdateByID(ctx, tt.space)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestSpaceService_GetByID(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()

	tests := []struct {
		name    string
		space   *model.Space
		setup   func(*MockSpaceRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful space retrieval",
			space: &model.Space{
				ID: spaceID,
			},
			setup: func(repo *MockSpaceRepo) {
				expectedSpace := &model.Space{
					ID:        spaceID,
					ProjectID: uuid.New(),
				}
				repo.On("Get", ctx, mock.MatchedBy(func(s *model.Space) bool {
					return s.ID == spaceID
				})).Return(expectedSpace, nil)
			},
			wantErr: false,
		},
		{
			name: "empty space ID",
			space: &model.Space{
				ID: uuid.UUID{},
			},
			setup: func(repo *MockSpaceRepo) {
				// Empty UUID will call Get, because len(uuid.UUID{}) != 0
				repo.On("Get", ctx, mock.AnythingOfType("*model.Space")).Return(&model.Space{}, nil)
			},
			wantErr: false,
		},
		{
			name: "retrieval failed",
			space: &model.Space{
				ID: spaceID,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("Get", ctx, mock.AnythingOfType("*model.Space")).Return(nil, errors.New("space not found"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSpaceRepo{}
			tt.setup(repo)

			service := NewSpaceService(repo)
			result, err := service.GetByID(ctx, tt.space)

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

			repo.AssertExpectations(t)
		})
	}
}

func TestSpaceService_List(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	tests := []struct {
		name    string
		input   ListSpacesInput
		setup   func(*MockSpaceRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful spaces retrieval",
			input: ListSpacesInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockSpaceRepo) {
				expectedSpaces := []model.Space{
					{
						ID:        uuid.New(),
						ProjectID: projectID,
					},
					{
						ID:        uuid.New(),
						ProjectID: projectID,
					},
				}
				repo.On("ListWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return(expectedSpaces, nil)
			},
			wantErr: false,
		},
		{
			name: "empty spaces list",
			input: ListSpacesInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("ListWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return([]model.Space{}, nil)
			},
			wantErr: false,
		},
		{
			name: "list failure",
			input: ListSpacesInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockSpaceRepo) {
				repo.On("ListWithCursor", ctx, projectID, time.Time{}, uuid.UUID{}, 11, false).Return(nil, errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockSpaceRepo{}
			tt.setup(repo)

			service := NewSpaceService(repo)
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

			repo.AssertExpectations(t)
		})
	}
}
