package service

import (
	"context"
	"errors"
	"mime/multipart"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// MockArtifactRepo is a mock implementation of ArtifactRepo
type MockArtifactRepo struct {
	mock.Mock
}

func (m *MockArtifactRepo) Create(ctx context.Context, projectID uuid.UUID, f *model.Artifact) error {
	args := m.Called(ctx, projectID, f)
	return args.Error(0)
}

func (m *MockArtifactRepo) DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error {
	args := m.Called(ctx, projectID, diskID, path, filename)
	return args.Error(0)
}

func (m *MockArtifactRepo) Update(ctx context.Context, f *model.Artifact) error {
	args := m.Called(ctx, f)
	return args.Error(0)
}

func (m *MockArtifactRepo) GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, path, filename)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactRepo) ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error) {
	args := m.Called(ctx, diskID, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactRepo) GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error) {
	args := m.Called(ctx, diskID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockArtifactRepo) ExistsByPathAndFilename(ctx context.Context, diskID uuid.UUID, path string, filename string, excludeID *uuid.UUID) (bool, error) {
	args := m.Called(ctx, diskID, path, filename, excludeID)
	return args.Bool(0), args.Error(1)
}

func (m *MockArtifactRepo) GrepArtifacts(ctx context.Context, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	args := m.Called(ctx, diskID, pattern, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactRepo) GlobArtifacts(ctx context.Context, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	args := m.Called(ctx, diskID, pattern, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

// MockArtifactS3Deps is a mock implementation of blob.S3Deps for file service
type MockArtifactS3Deps struct {
	mock.Mock
}

func (m *MockArtifactS3Deps) UploadFormFile(ctx context.Context, s3Key string, fileHeader *multipart.FileHeader) (*model.Asset, error) {
	args := m.Called(ctx, s3Key, fileHeader)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Asset), args.Error(1)
}

func (m *MockArtifactS3Deps) PresignGet(ctx context.Context, s3Key string, expire time.Duration) (string, error) {
	args := m.Called(ctx, s3Key, expire)
	return args.String(0), args.Error(1)
}

func (m *MockArtifactS3Deps) DownloadFile(ctx context.Context, s3Key string) ([]byte, error) {
	args := m.Called(ctx, s3Key)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]byte), args.Error(1)
}

// Helper functions for creating test data
func createTestArtifact() *model.Artifact {
	diskID := uuid.New()
	artifactID := uuid.New()

	return &model.Artifact{
		ID:       artifactID,
		DiskID:   diskID,
		Path:     "/test/path",
		Filename: "test.txt",
		Meta: map[string]interface{}{
			model.ArtifactInfoKey: map[string]interface{}{
				"path":     "/test/path",
				"filename": "test.txt",
				"mime":     "text/plain",
				"size":     int64(1024),
			},
		},
		AssetMeta: datatypes.NewJSONType(model.Asset{
			Bucket: "test-bucket",
			S3Key:  "artifacts/" + diskID.String() + "/test.txt",
			ETag:   "test-etag",
			SHA256: "test-sha256",
			MIME:   "text/plain",
			SizeB:  1024,
		}),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func createTestArtifactHeader() *multipart.FileHeader {
	return &multipart.FileHeader{
		Filename: "test.txt",
		Size:     1024,
	}
}

func createTestAsset() *model.Asset {
	return &model.Asset{
		Bucket: "test-bucket",
		S3Key:  "artifacts/test-artifact/test.txt",
		ETag:   "test-etag",
		SHA256: "test-sha256",
		MIME:   "text/plain",
		SizeB:  1024,
	}
}

// testArtifactService is a test version that uses interfaces
type testArtifactService struct {
	r  *MockArtifactRepo
	s3 *MockArtifactS3Deps
}

func newTestArtifactService(r *MockArtifactRepo, s3 *MockArtifactS3Deps) ArtifactService {
	return &testArtifactService{r: r, s3: s3}
}

func (s *testArtifactService) Create(ctx context.Context, in CreateArtifactInput) (*model.Artifact, error) {
	// Check if artifact with same path and filename already exists in the same disk
	exists, err := s.r.ExistsByPathAndFilename(ctx, in.DiskID, in.Path, in.Filename, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("artifact already exists")
	}

	// Simulate S3 upload
	asset, err := s.s3.UploadFormFile(ctx, "disks/"+in.ProjectID.String(), in.FileHeader)
	if err != nil {
		return nil, err
	}

	// Build artifact metadata
	meta := map[string]interface{}{
		model.ArtifactInfoKey: map[string]interface{}{
			"path":     in.Path,
			"filename": in.FileHeader.Filename,
			"mime":     asset.MIME,
			"size":     asset.SizeB,
		},
	}
	for k, v := range in.UserMeta {
		meta[k] = v
	}

	file := &model.Artifact{
		ID:       uuid.New(),
		DiskID:   in.DiskID,
		Path:     in.Path,
		Filename: in.Filename,
		Meta:     meta,
		AssetMeta: datatypes.NewJSONType(model.Asset{
			Bucket: asset.Bucket,
			S3Key:  asset.S3Key,
			ETag:   asset.ETag,
			SHA256: asset.SHA256,
			MIME:   asset.MIME,
			SizeB:  asset.SizeB,
		}),
	}

	if err := s.r.Create(ctx, in.ProjectID, file); err != nil {
		return nil, err
	}

	return file, nil
}

func (s *testArtifactService) DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error {
	if path == "" || filename == "" {
		return errors.New("path and filename are required")
	}
	return s.r.DeleteByPath(ctx, projectID, diskID, path, filename)
}

func (s *testArtifactService) GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error) {
	if path == "" || filename == "" {
		return nil, errors.New("path and filename are required")
	}
	return s.r.GetByPath(ctx, diskID, path, filename)
}

func (s *testArtifactService) GetPresignedURL(ctx context.Context, artifact *model.Artifact, expire time.Duration) (string, error) {
	if artifact == nil {
		return "", errors.New("artifact is nil")
	}

	assetData := artifact.AssetMeta.Data()
	if assetData.S3Key == "" {
		return "", errors.New("artifact has no S3 key")
	}

	return s.s3.PresignGet(ctx, assetData.S3Key, expire)
}

func (s *testArtifactService) ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error) {
	return s.r.ListByPath(ctx, diskID, path)
}

func (s *testArtifactService) GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error) {
	return s.r.GetAllPaths(ctx, diskID)
}

func (s *testArtifactService) UpdateArtifactMetaByPath(ctx context.Context, diskID uuid.UUID, path string, filename string, userMeta map[string]interface{}) (*model.Artifact, error) {
	// Get existing artifact
	artifact, err := s.GetByPath(ctx, diskID, path, filename)
	if err != nil {
		return nil, err
	}

	// Validate that user meta doesn't contain system reserved keys
	reservedKeys := model.Artifact{}.GetReservedKeys()
	for _, reservedKey := range reservedKeys {
		if _, exists := userMeta[reservedKey]; exists {
			return nil, errors.New("reserved key '" + reservedKey + "' is not allowed in user meta")
		}
	}

	// Get current system meta
	systemMeta, ok := artifact.Meta[model.ArtifactInfoKey].(map[string]interface{})
	if !ok {
		systemMeta = make(map[string]interface{})
	}

	// Create new meta combining system meta and user meta
	newMeta := make(map[string]interface{})
	newMeta[model.ArtifactInfoKey] = systemMeta
	for k, v := range userMeta {
		newMeta[k] = v
	}

	// Update artifact meta
	artifact.Meta = newMeta

	if err := s.r.Update(ctx, artifact); err != nil {
		return nil, err
	}

	return artifact, nil
}

func (s *testArtifactService) GetFileContent(ctx context.Context, artifact *model.Artifact) (*fileparser.FileContent, error) {
	// This is a test implementation that doesn't actually download from S3
	// In real tests, you would mock the S3 download and file parsing
	if artifact == nil {
		return nil, errors.New("artifact is nil")
	}

	return &fileparser.FileContent{
		Type: "text",
		Raw:  "test content",
	}, nil
}

func (s *testArtifactService) GrepArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	// Test implementation - return empty list for now
	return []*model.Artifact{}, nil
}

func (s *testArtifactService) GlobArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	// Test implementation - return empty list for now
	return []*model.Artifact{}, nil
}

// Test cases for Create method
func TestArtifactService_Create(t *testing.T) {
	projectID := uuid.New()
	diskID := uuid.New()
	path := "/test/path"
	filename := "test.txt"
	fileHeader := createTestArtifactHeader()
	userMeta := map[string]interface{}{
		"custom_key": "custom_value",
	}

	tests := []struct {
		name        string
		setup       func(*MockArtifactRepo, *MockArtifactS3Deps)
		expectError bool
		errorMsg    string
	}{
		{
			name: "successful creation",
			setup: func(repo *MockArtifactRepo, s3 *MockArtifactS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, diskID, path, filename, (*uuid.UUID)(nil)).Return(false, nil)
				s3.On("UploadFormFile", mock.Anything, mock.AnythingOfType("string"), fileHeader).Return(createTestAsset(), nil)
				repo.On("Create", mock.Anything, projectID, mock.MatchedBy(func(f *model.Artifact) bool {
					return f.DiskID == diskID && f.Path == path && f.Filename == filename
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name: "artifact already exists",
			setup: func(repo *MockArtifactRepo, s3 *MockArtifactS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, diskID, path, filename, (*uuid.UUID)(nil)).Return(true, nil)
			},
			expectError: true,
			errorMsg:    "already exists",
		},
		{
			name: "upload error",
			setup: func(repo *MockArtifactRepo, s3 *MockArtifactS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, diskID, path, filename, (*uuid.UUID)(nil)).Return(false, nil)
				s3.On("UploadFormFile", mock.Anything, mock.AnythingOfType("string"), fileHeader).Return(nil, errors.New("upload error"))
			},
			expectError: true,
			errorMsg:    "upload error",
		},
		{
			name: "create record error",
			setup: func(repo *MockArtifactRepo, s3 *MockArtifactS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, diskID, path, filename, (*uuid.UUID)(nil)).Return(false, nil)
				s3.On("UploadFormFile", mock.Anything, mock.AnythingOfType("string"), fileHeader).Return(createTestAsset(), nil)
				repo.On("Create", mock.Anything, projectID, mock.Anything).Return(errors.New("create error"))
			},
			expectError: true,
			errorMsg:    "create error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockArtifactRepo{}
			mockS3 := &MockArtifactS3Deps{}
			tt.setup(mockRepo, mockS3)

			service := newTestArtifactService(mockRepo, mockS3)

			file, err := service.Create(context.Background(), CreateArtifactInput{
				ProjectID:  projectID,
				DiskID:     diskID,
				Path:       path,
				Filename:   filename,
				FileHeader: fileHeader,
				UserMeta:   userMeta,
			})

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, file)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, file)
				assert.Equal(t, diskID, file.DiskID)
				assert.Equal(t, path, file.Path)
				assert.Equal(t, filename, file.Filename)
				assert.Contains(t, file.Meta, model.ArtifactInfoKey)
				assert.Contains(t, file.Meta, "custom_key")
			}

			mockRepo.AssertExpectations(t)
			mockS3.AssertExpectations(t)
		})
	}
}

// Test cases for UpdateArtifactMetaByPath method
func TestArtifactService_UpdateArtifactMetaByPath(t *testing.T) {
	diskID := uuid.New()
	path := "/test/path/"
	filename := "test.txt"
	artifactID := uuid.New()

	tests := []struct {
		name        string
		userMeta    map[string]interface{}
		setup       func(*MockArtifactRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name: "successful meta update",
			userMeta: map[string]interface{}{
				"description": "Test artifact",
				"version":     "1.0",
			},
			setup: func(repo *MockArtifactRepo) {
				existingArtifact := createTestArtifact()
				existingArtifact.ID = artifactID
				existingArtifact.DiskID = diskID
				existingArtifact.Path = path
				existingArtifact.Filename = filename

				repo.On("GetByPath", mock.Anything, diskID, path, filename).Return(existingArtifact, nil)
				repo.On("Update", mock.Anything, mock.MatchedBy(func(f *model.Artifact) bool {
					// Verify that meta contains both system meta and user meta
					if _, hasSystemMeta := f.Meta[model.ArtifactInfoKey]; !hasSystemMeta {
						return false
					}
					if f.Meta["description"] != "Test artifact" {
						return false
					}
					if f.Meta["version"] != "1.0" {
						return false
					}
					return true
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name: "artifact not found",
			userMeta: map[string]interface{}{
				"description": "Test artifact",
			},
			setup: func(repo *MockArtifactRepo) {
				repo.On("GetByPath", mock.Anything, diskID, path, filename).Return(nil, errors.New("artifact not found"))
			},
			expectError: true,
			errorMsg:    "artifact not found",
		},
		{
			name: "reserved key in user meta",
			userMeta: map[string]interface{}{
				"__artifact_info__": map[string]interface{}{"test": "value"},
			},
			setup: func(repo *MockArtifactRepo) {
				existingArtifact := createTestArtifact()
				existingArtifact.ID = artifactID
				existingArtifact.DiskID = diskID
				existingArtifact.Path = path
				existingArtifact.Filename = filename

				repo.On("GetByPath", mock.Anything, diskID, path, filename).Return(existingArtifact, nil)
			},
			expectError: true,
			errorMsg:    "reserved key",
		},
		{
			name: "update record error",
			userMeta: map[string]interface{}{
				"description": "Test artifact",
			},
			setup: func(repo *MockArtifactRepo) {
				existingArtifact := createTestArtifact()
				existingArtifact.ID = artifactID
				existingArtifact.DiskID = diskID
				existingArtifact.Path = path
				existingArtifact.Filename = filename

				repo.On("GetByPath", mock.Anything, diskID, path, filename).Return(existingArtifact, nil)
				repo.On("Update", mock.Anything, mock.Anything).Return(errors.New("update error"))
			},
			expectError: true,
			errorMsg:    "update error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockArtifactRepo{}
			tt.setup(mockRepo)

			service := newTestArtifactService(mockRepo, &MockArtifactS3Deps{})

			artifact, err := service.UpdateArtifactMetaByPath(context.Background(), diskID, path, filename, tt.userMeta)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, artifact)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, artifact)
				assert.Equal(t, diskID, artifact.DiskID)
				assert.Equal(t, path, artifact.Path)
				assert.Equal(t, filename, artifact.Filename)
				assert.Contains(t, artifact.Meta, model.ArtifactInfoKey)
				// Verify user meta is present
				for k, v := range tt.userMeta {
					assert.Equal(t, v, artifact.Meta[k])
				}
			}

			mockRepo.AssertExpectations(t)
		})
	}
}
