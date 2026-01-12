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

// MockDiskRepo is a mock implementation of DiskRepo
type MockDiskRepo struct {
	mock.Mock
}

func (m *MockDiskRepo) Create(ctx context.Context, a *model.Disk) error {
	args := m.Called(ctx, a)
	return args.Error(0)
}

func (m *MockDiskRepo) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	args := m.Called(ctx, projectID, diskID)
	return args.Error(0)
}

func (m *MockDiskRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.Disk, error) {
	args := m.Called(ctx, projectID, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Disk), args.Error(1)
}

// MockS3Deps is a mock implementation of blob.S3Deps
type MockS3Deps struct {
	mock.Mock
}

func (m *MockS3Deps) UploadFormFile(ctx context.Context, s3Key string, fileHeader interface{}) (*model.Asset, error) {
	args := m.Called(ctx, s3Key, fileHeader)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockS3Deps) PresignGet(ctx context.Context, s3Key string, expire time.Duration) (string, error) {
	args := m.Called(ctx, s3Key, expire)
	return args.String(0), args.Error(1)
}

// testDiskService is a test version that uses interfaces
type testDiskService struct {
	r  *MockDiskRepo
	s3 *MockS3Deps
}

func newTestDiskService(r *MockDiskRepo, s3 *MockS3Deps) DiskService {
	return &testDiskService{r: r, s3: s3}
}

func (s *testDiskService) Create(ctx context.Context, projectID uuid.UUID, userID *uuid.UUID) (*model.Disk, error) {
	disk := &model.Disk{
		ID:        uuid.New(),
		ProjectID: projectID,
		UserID:    userID,
	}

	if err := s.r.Create(ctx, disk); err != nil {
		return nil, err
	}

	return disk, nil
}

func (s *testDiskService) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	if diskID == uuid.Nil {
		return errors.New("disk id is empty")
	}
	return s.r.Delete(ctx, projectID, diskID)
}

func (s *testDiskService) List(ctx context.Context, in ListDisksInput) (*ListDisksOutput, error) {
	disks, err := s.r.ListWithCursor(ctx, in.ProjectID, time.Time{}, uuid.UUID{}, in.Limit, in.TimeDesc)
	if err != nil {
		return nil, err
	}
	return &ListDisksOutput{Items: disks, HasMore: false}, nil
}

func createTestDisk() *model.Disk {
	projectID := uuid.New()
	diskID := uuid.New()

	return &model.Disk{
		ID:        diskID,
		ProjectID: projectID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestDiskService_Create(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name        string
		setup       func(*MockDiskRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name: "successful creation",
			setup: func(repo *MockDiskRepo) {
				repo.On("Create", mock.Anything, mock.MatchedBy(func(a *model.Disk) bool {
					return a.ProjectID == projectID && a.ID != uuid.Nil
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name: "create record error",
			setup: func(repo *MockDiskRepo) {
				repo.On("Create", mock.Anything, mock.Anything).Return(errors.New("create error"))
			},
			expectError: true,
			errorMsg:    "create error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockDiskRepo{}
			tt.setup(mockRepo)

			service := newTestDiskService(mockRepo, &MockS3Deps{})

			disk, err := service.Create(context.Background(), projectID, nil)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, disk)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, disk)
				assert.Equal(t, projectID, disk.ProjectID)
				assert.NotEqual(t, uuid.Nil, disk.ID)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestDiskService_List(t *testing.T) {
	projectID := uuid.New()
	disk1 := createTestDisk()
	disk1.ProjectID = projectID
	disk2 := createTestDisk()
	disk2.ProjectID = projectID

	tests := []struct {
		name        string
		input       ListDisksInput
		setup       func(*MockDiskRepo)
		expectError bool
		errorMsg    string
		expectCount int
	}{
		{
			name: "successful list with disks",
			input: ListDisksInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockDiskRepo) {
				repo.On("ListWithCursor", mock.Anything, projectID, time.Time{}, uuid.UUID{}, 10, false).Return([]*model.Disk{disk1, disk2}, nil)
			},
			expectError: false,
			expectCount: 2,
		},
		{
			name: "successful list with empty result",
			input: ListDisksInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockDiskRepo) {
				repo.On("ListWithCursor", mock.Anything, projectID, time.Time{}, uuid.UUID{}, 10, false).Return([]*model.Disk{}, nil)
			},
			expectError: false,
			expectCount: 0,
		},
		{
			name: "repo error",
			input: ListDisksInput{
				ProjectID: projectID,
				Limit:     10,
			},
			setup: func(repo *MockDiskRepo) {
				repo.On("ListWithCursor", mock.Anything, projectID, time.Time{}, uuid.UUID{}, 10, false).Return(nil, errors.New("list error"))
			},
			expectError: true,
			errorMsg:    "list error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockDiskRepo{}
			tt.setup(mockRepo)

			service := newTestDiskService(mockRepo, &MockS3Deps{})

			result, err := service.List(context.Background(), tt.input)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Len(t, result.Items, tt.expectCount)
				for _, disk := range result.Items {
					assert.Equal(t, projectID, disk.ProjectID)
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestDiskService_Delete(t *testing.T) {
	projectID := uuid.New()
	diskID := uuid.New()

	tests := []struct {
		name        string
		diskID      uuid.UUID
		setup       func(*MockDiskRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name:   "successful deletion",
			diskID: diskID,
			setup: func(repo *MockDiskRepo) {
				repo.On("Delete", mock.Anything, projectID, diskID).Return(nil)
			},
			expectError: false,
		},
		{
			name:   "empty disk ID",
			diskID: uuid.UUID{},
			setup: func(repo *MockDiskRepo) {
				// No mock setup needed as the service should return error before calling repo
			},
			expectError: true,
			errorMsg:    "disk id is empty",
		},
		{
			name:   "repo error",
			diskID: diskID,
			setup: func(repo *MockDiskRepo) {
				repo.On("Delete", mock.Anything, projectID, diskID).Return(errors.New("delete error"))
			},
			expectError: true,
			errorMsg:    "delete error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockDiskRepo{}
			tt.setup(mockRepo)

			service := newTestDiskService(mockRepo, &MockS3Deps{})

			err := service.Delete(context.Background(), projectID, tt.diskID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}

			// Only assert expectations if we expect the repo to be called
			if !tt.expectError || tt.errorMsg != "disk id is empty" {
				mockRepo.AssertExpectations(t)
			}
		})
	}
}
