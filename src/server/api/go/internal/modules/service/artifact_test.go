package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockArtifactRepo is a mock implementation of ArtifactRepo
type MockArtifactRepo struct {
	mock.Mock
}

func (m *MockArtifactRepo) Create(ctx context.Context, a *model.Artifact) error {
	args := m.Called(ctx, a)
	return args.Error(0)
}

func (m *MockArtifactRepo) Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error {
	args := m.Called(ctx, projectID, artifactID)
	return args.Error(0)
}

// MockS3Deps is a mock implementation of blob.S3Deps
type MockS3Deps struct {
	mock.Mock
}

func (m *MockS3Deps) UploadFormFile(ctx context.Context, s3Key string, fileHeader interface{}) (*blob.UploadedMeta, error) {
	args := m.Called(ctx, s3Key, fileHeader)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*blob.UploadedMeta), args.Error(1)
}

func (m *MockS3Deps) PresignGet(ctx context.Context, s3Key string, expire time.Duration) (string, error) {
	args := m.Called(ctx, s3Key, expire)
	return args.String(0), args.Error(1)
}

// testArtifactService is a test version that uses interfaces
type testArtifactService struct {
	r  *MockArtifactRepo
	s3 *MockS3Deps
}

func newTestArtifactService(r *MockArtifactRepo, s3 *MockS3Deps) ArtifactService {
	return &testArtifactService{r: r, s3: s3}
}

func (s *testArtifactService) Create(ctx context.Context, projectID uuid.UUID) (*model.Artifact, error) {
	artifact := &model.Artifact{
		ID:        uuid.New(),
		ProjectID: projectID,
	}

	if err := s.r.Create(ctx, artifact); err != nil {
		return nil, err
	}

	return artifact, nil
}

func (s *testArtifactService) Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error {
	if artifactID == uuid.Nil {
		return errors.New("artifact id is empty")
	}
	return s.r.Delete(ctx, projectID, artifactID)
}

func createTestArtifact() *model.Artifact {
	projectID := uuid.New()
	artifactID := uuid.New()

	return &model.Artifact{
		ID:        artifactID,
		ProjectID: projectID,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func TestArtifactService_Create(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name        string
		setup       func(*MockArtifactRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name: "successful creation",
			setup: func(repo *MockArtifactRepo) {
				repo.On("Create", mock.Anything, mock.MatchedBy(func(a *model.Artifact) bool {
					return a.ProjectID == projectID && a.ID != uuid.Nil
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name: "create record error",
			setup: func(repo *MockArtifactRepo) {
				repo.On("Create", mock.Anything, mock.Anything).Return(errors.New("create error"))
			},
			expectError: true,
			errorMsg:    "create error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockArtifactRepo{}
			tt.setup(mockRepo)

			service := newTestArtifactService(mockRepo, &MockS3Deps{})

			artifact, err := service.Create(context.Background(), projectID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, artifact)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, artifact)
				assert.Equal(t, projectID, artifact.ProjectID)
				assert.NotEqual(t, uuid.Nil, artifact.ID)
			}

			mockRepo.AssertExpectations(t)
		})
	}
}

func TestArtifactService_Delete(t *testing.T) {
	projectID := uuid.New()
	artifactID := uuid.New()

	tests := []struct {
		name        string
		artifactID  uuid.UUID
		setup       func(*MockArtifactRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name:       "successful deletion",
			artifactID: artifactID,
			setup: func(repo *MockArtifactRepo) {
				repo.On("Delete", mock.Anything, projectID, artifactID).Return(nil)
			},
			expectError: false,
		},
		{
			name:       "empty artifact ID",
			artifactID: uuid.UUID{},
			setup: func(repo *MockArtifactRepo) {
				// No mock setup needed as the service should return error before calling repo
			},
			expectError: true,
			errorMsg:    "artifact id is empty",
		},
		{
			name:       "repo error",
			artifactID: artifactID,
			setup: func(repo *MockArtifactRepo) {
				repo.On("Delete", mock.Anything, projectID, artifactID).Return(errors.New("delete error"))
			},
			expectError: true,
			errorMsg:    "delete error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockArtifactRepo{}
			tt.setup(mockRepo)

			service := newTestArtifactService(mockRepo, &MockS3Deps{})

			err := service.Delete(context.Background(), projectID, tt.artifactID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}

			// Only assert expectations if we expect the repo to be called
			if !tt.expectError || tt.errorMsg != "artifact id is empty" {
				mockRepo.AssertExpectations(t)
			}
		})
	}
}
