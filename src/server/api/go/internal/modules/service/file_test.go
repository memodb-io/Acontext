package service

import (
	"context"
	"errors"
	"mime/multipart"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// MockFileRepo is a mock implementation of FileRepo
type MockFileRepo struct {
	mock.Mock
}

func (m *MockFileRepo) Create(ctx context.Context, f *model.File) error {
	args := m.Called(ctx, f)
	return args.Error(0)
}

func (m *MockFileRepo) Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error {
	args := m.Called(ctx, artifactID, fileID)
	return args.Error(0)
}

func (m *MockFileRepo) DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error {
	args := m.Called(ctx, artifactID, path, filename)
	return args.Error(0)
}

func (m *MockFileRepo) Update(ctx context.Context, f *model.File) error {
	args := m.Called(ctx, f)
	return args.Error(0)
}

func (m *MockFileRepo) GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error) {
	args := m.Called(ctx, artifactID, fileID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileRepo) GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error) {
	args := m.Called(ctx, artifactID, path, filename)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileRepo) ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error) {
	args := m.Called(ctx, artifactID, path)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.File), args.Error(1)
}

func (m *MockFileRepo) GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error) {
	args := m.Called(ctx, artifactID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockFileRepo) ExistsByPathAndFilename(ctx context.Context, artifactID uuid.UUID, path string, filename string, excludeID *uuid.UUID) (bool, error) {
	args := m.Called(ctx, artifactID, path, filename, excludeID)
	return args.Bool(0), args.Error(1)
}

func (m *MockFileRepo) GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error) {
	args := m.Called(ctx, artifactID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.File), args.Error(1)
}

// MockFileS3Deps is a mock implementation of blob.S3Deps for file service
type MockFileS3Deps struct {
	mock.Mock
}

func (m *MockFileS3Deps) UploadFormFile(ctx context.Context, s3Key string, fileHeader *multipart.FileHeader) (*blob.UploadedMeta, error) {
	args := m.Called(ctx, s3Key, fileHeader)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*blob.UploadedMeta), args.Error(1)
}

func (m *MockFileS3Deps) PresignGet(ctx context.Context, s3Key string, expire time.Duration) (string, error) {
	args := m.Called(ctx, s3Key, expire)
	return args.String(0), args.Error(1)
}

// Helper functions for creating test data
func createTestFile() *model.File {
	artifactID := uuid.New()
	fileID := uuid.New()

	return &model.File{
		ID:         fileID,
		ArtifactID: artifactID,
		Path:       "/test/path",
		Filename:   "test.txt",
		Meta: map[string]interface{}{
			model.FileInfoKey: map[string]interface{}{
				"path":     "/test/path",
				"filename": "test.txt",
				"mime":     "text/plain",
				"size":     int64(1024),
			},
		},
		AssetMeta: datatypes.NewJSONType(model.Asset{
			Bucket: "test-bucket",
			S3Key:  "artifacts/" + artifactID.String() + "/test.txt",
			ETag:   "test-etag",
			SHA256: "test-sha256",
			MIME:   "text/plain",
			SizeB:  1024,
		}),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func createTestFileHeader() *multipart.FileHeader {
	return &multipart.FileHeader{
		Filename: "test.txt",
		Size:     1024,
	}
}

func createTestUploadedMeta() *blob.UploadedMeta {
	return &blob.UploadedMeta{
		Bucket: "test-bucket",
		Key:    "artifacts/test-artifact/test.txt",
		ETag:   "test-etag",
		SHA256: "test-sha256",
		MIME:   "text/plain",
		SizeB:  1024,
	}
}

// testFileService is a test version that uses interfaces
type testFileService struct {
	r  *MockFileRepo
	s3 *MockFileS3Deps
}

func newTestFileService(r *MockFileRepo, s3 *MockFileS3Deps) FileService {
	return &testFileService{r: r, s3: s3}
}

func (s *testFileService) Create(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, userMeta map[string]interface{}) (*model.File, error) {
	// Check if file with same path and filename already exists in the same artifact
	exists, err := s.r.ExistsByPathAndFilename(ctx, artifactID, path, filename, nil)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("file already exists")
	}

	// Generate S3 key
	s3Key := "artifacts/" + artifactID.String() + "/" + filename

	uploadedMeta, err := s.s3.UploadFormFile(ctx, s3Key, fileHeader)
	if err != nil {
		return nil, err
	}

	fileMeta := NewFileMetadataFromUpload(path, fileHeader, uploadedMeta)

	// Create file record with separated metadata
	meta := map[string]interface{}{
		model.FileInfoKey: fileMeta.ToSystemMeta(),
	}

	for k, v := range userMeta {
		meta[k] = v
	}

	file := &model.File{
		ID:         uuid.New(),
		ArtifactID: artifactID,
		Path:       path,
		Filename:   filename,
		Meta:       meta,
		AssetMeta:  datatypes.NewJSONType(fileMeta.ToAsset()),
	}

	if err := s.r.Create(ctx, file); err != nil {
		return nil, err
	}

	return file, nil
}

func (s *testFileService) Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error {
	if fileID == uuid.Nil {
		return errors.New("file id is empty")
	}
	return s.r.Delete(ctx, artifactID, fileID)
}

func (s *testFileService) DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error {
	if path == "" || filename == "" {
		return errors.New("path and filename are required")
	}
	return s.r.DeleteByPath(ctx, artifactID, path, filename)
}

func (s *testFileService) GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error) {
	if fileID == uuid.Nil {
		return nil, errors.New("file id is empty")
	}
	return s.r.GetByID(ctx, artifactID, fileID)
}

func (s *testFileService) GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error) {
	if path == "" || filename == "" {
		return nil, errors.New("path and filename are required")
	}
	return s.r.GetByPath(ctx, artifactID, path, filename)
}

func (s *testFileService) GetPresignedURL(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, expire time.Duration) (string, error) {
	file, err := s.GetByID(ctx, artifactID, fileID)
	if err != nil {
		return "", err
	}

	assetData := file.AssetMeta.Data()
	if assetData.S3Key == "" {
		return "", errors.New("file has no S3 key")
	}

	return s.s3.PresignGet(ctx, assetData.S3Key, expire)
}

func (s *testFileService) GetPresignedURLByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, expire time.Duration) (string, error) {
	file, err := s.GetByPath(ctx, artifactID, path, filename)
	if err != nil {
		return "", err
	}

	assetData := file.AssetMeta.Data()
	if assetData.S3Key == "" {
		return "", errors.New("file has no S3 key")
	}

	return s.s3.PresignGet(ctx, assetData.S3Key, expire)
}

func (s *testFileService) UpdateFile(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error) {
	// Get existing file
	file, err := s.GetByID(ctx, artifactID, fileID)
	if err != nil {
		return nil, err
	}

	// Determine the target path and filename
	var path, filename string
	if newPath != nil && *newPath != "" {
		path = *newPath
	} else {
		path = file.Path
	}

	if newFilename != nil && *newFilename != "" {
		filename = *newFilename
	} else {
		filename = file.Filename
	}

	// Check if file with same path and filename already exists for another file in the same artifact
	exists, err := s.r.ExistsByPathAndFilename(ctx, artifactID, path, filename, &fileID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("file already exists")
	}

	// Generate new S3 key
	s3Key := "artifacts/" + artifactID.String() + "/" + filename

	uploadedMeta, err := s.s3.UploadFormFile(ctx, s3Key, fileHeader)
	if err != nil {
		return nil, err
	}

	fileMeta := NewFileMetadataFromUpload(path, fileHeader, uploadedMeta)

	// Update file record
	file.Path = path
	file.Filename = filename
	file.AssetMeta = datatypes.NewJSONType(fileMeta.ToAsset())

	// Update system meta with new file info
	systemMeta, ok := file.Meta[model.FileInfoKey].(map[string]interface{})
	if !ok {
		systemMeta = make(map[string]interface{})
		file.Meta[model.FileInfoKey] = systemMeta
	}

	// Update system metadata
	for k, v := range fileMeta.ToSystemMeta() {
		systemMeta[k] = v
	}

	if err := s.r.Update(ctx, file); err != nil {
		return nil, err
	}

	return file, nil
}

func (s *testFileService) UpdateFileByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error) {
	// Get existing file
	file, err := s.GetByPath(ctx, artifactID, path, filename)
	if err != nil {
		return nil, err
	}

	// Determine the target path and filename
	var targetPath, targetFilename string
	if newPath != nil && *newPath != "" {
		targetPath = *newPath
	} else {
		targetPath = file.Path
	}

	if newFilename != nil && *newFilename != "" {
		targetFilename = *newFilename
	} else {
		targetFilename = file.Filename
	}

	// Check if file with same path and filename already exists for another file in the same artifact
	exists, err := s.r.ExistsByPathAndFilename(ctx, artifactID, targetPath, targetFilename, &file.ID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("file already exists")
	}

	// Generate new S3 key
	s3Key := "artifacts/" + artifactID.String() + "/" + targetFilename

	uploadedMeta, err := s.s3.UploadFormFile(ctx, s3Key, fileHeader)
	if err != nil {
		return nil, err
	}

	fileMeta := NewFileMetadataFromUpload(targetPath, fileHeader, uploadedMeta)

	// Update file record
	file.Path = targetPath
	file.Filename = targetFilename
	file.AssetMeta = datatypes.NewJSONType(fileMeta.ToAsset())

	// Update system meta with new file info
	systemMeta, ok := file.Meta[model.FileInfoKey].(map[string]interface{})
	if !ok {
		systemMeta = make(map[string]interface{})
		file.Meta[model.FileInfoKey] = systemMeta
	}

	// Update system metadata
	for k, v := range fileMeta.ToSystemMeta() {
		systemMeta[k] = v
	}

	if err := s.r.Update(ctx, file); err != nil {
		return nil, err
	}

	return file, nil
}

func (s *testFileService) ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error) {
	return s.r.ListByPath(ctx, artifactID, path)
}

func (s *testFileService) GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error) {
	return s.r.GetAllPaths(ctx, artifactID)
}

func (s *testFileService) GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error) {
	return s.r.GetByArtifactID(ctx, artifactID)
}

// Test cases for Create method
func TestFileService_Create(t *testing.T) {
	artifactID := uuid.New()
	path := "/test/path"
	filename := "test.txt"
	fileHeader := createTestFileHeader()
	userMeta := map[string]interface{}{
		"custom_key": "custom_value",
	}

	tests := []struct {
		name        string
		setup       func(*MockFileRepo, *MockFileS3Deps)
		expectError bool
		errorMsg    string
	}{
		{
			name: "successful creation",
			setup: func(repo *MockFileRepo, s3 *MockFileS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, artifactID, path, filename, (*uuid.UUID)(nil)).Return(false, nil)
				s3.On("UploadFormFile", mock.Anything, mock.AnythingOfType("string"), fileHeader).Return(createTestUploadedMeta(), nil)
				repo.On("Create", mock.Anything, mock.MatchedBy(func(f *model.File) bool {
					return f.ArtifactID == artifactID && f.Path == path && f.Filename == filename
				})).Return(nil)
			},
			expectError: false,
		},
		{
			name: "file already exists",
			setup: func(repo *MockFileRepo, s3 *MockFileS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, artifactID, path, filename, (*uuid.UUID)(nil)).Return(true, nil)
			},
			expectError: true,
			errorMsg:    "file already exists",
		},
		{
			name: "upload error",
			setup: func(repo *MockFileRepo, s3 *MockFileS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, artifactID, path, filename, (*uuid.UUID)(nil)).Return(false, nil)
				s3.On("UploadFormFile", mock.Anything, mock.AnythingOfType("string"), fileHeader).Return(nil, errors.New("upload error"))
			},
			expectError: true,
			errorMsg:    "upload error",
		},
		{
			name: "create record error",
			setup: func(repo *MockFileRepo, s3 *MockFileS3Deps) {
				repo.On("ExistsByPathAndFilename", mock.Anything, artifactID, path, filename, (*uuid.UUID)(nil)).Return(false, nil)
				s3.On("UploadFormFile", mock.Anything, mock.AnythingOfType("string"), fileHeader).Return(createTestUploadedMeta(), nil)
				repo.On("Create", mock.Anything, mock.Anything).Return(errors.New("create error"))
			},
			expectError: true,
			errorMsg:    "create error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockFileRepo{}
			mockS3 := &MockFileS3Deps{}
			tt.setup(mockRepo, mockS3)

			service := newTestFileService(mockRepo, mockS3)

			file, err := service.Create(context.Background(), artifactID, path, filename, fileHeader, userMeta)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, file)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, file)
				assert.Equal(t, artifactID, file.ArtifactID)
				assert.Equal(t, path, file.Path)
				assert.Equal(t, filename, file.Filename)
				assert.Contains(t, file.Meta, model.FileInfoKey)
				assert.Contains(t, file.Meta, "custom_key")
			}

			mockRepo.AssertExpectations(t)
			mockS3.AssertExpectations(t)
		})
	}
}

// Test cases for Delete method
func TestFileService_Delete(t *testing.T) {
	artifactID := uuid.New()
	fileID := uuid.New()

	tests := []struct {
		name        string
		fileID      uuid.UUID
		setup       func(*MockFileRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name:   "successful deletion",
			fileID: fileID,
			setup: func(repo *MockFileRepo) {
				repo.On("Delete", mock.Anything, artifactID, fileID).Return(nil)
			},
			expectError: false,
		},
		{
			name:        "empty file ID",
			fileID:      uuid.UUID{},
			setup:       func(repo *MockFileRepo) {},
			expectError: true,
			errorMsg:    "file id is empty",
		},
		{
			name:   "repo error",
			fileID: fileID,
			setup: func(repo *MockFileRepo) {
				repo.On("Delete", mock.Anything, artifactID, fileID).Return(errors.New("delete error"))
			},
			expectError: true,
			errorMsg:    "delete error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockFileRepo{}
			tt.setup(mockRepo)

			service := newTestFileService(mockRepo, &MockFileS3Deps{})

			err := service.Delete(context.Background(), artifactID, tt.fileID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}

			if tt.errorMsg != "file id is empty" {
				mockRepo.AssertExpectations(t)
			}
		})
	}
}

// Test cases for GetByID method
func TestFileService_GetByID(t *testing.T) {
	artifactID := uuid.New()
	fileID := uuid.New()
	testFile := createTestFile()
	testFile.ID = fileID
	testFile.ArtifactID = artifactID

	tests := []struct {
		name        string
		fileID      uuid.UUID
		setup       func(*MockFileRepo)
		expectError bool
		errorMsg    string
	}{
		{
			name:   "successful retrieval",
			fileID: fileID,
			setup: func(repo *MockFileRepo) {
				repo.On("GetByID", mock.Anything, artifactID, fileID).Return(testFile, nil)
			},
			expectError: false,
		},
		{
			name:        "empty file ID",
			fileID:      uuid.UUID{},
			setup:       func(repo *MockFileRepo) {},
			expectError: true,
			errorMsg:    "file id is empty",
		},
		{
			name:   "file not found",
			fileID: fileID,
			setup: func(repo *MockFileRepo) {
				repo.On("GetByID", mock.Anything, artifactID, fileID).Return(nil, errors.New("file not found"))
			},
			expectError: true,
			errorMsg:    "file not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRepo := &MockFileRepo{}
			tt.setup(mockRepo)

			service := newTestFileService(mockRepo, &MockFileS3Deps{})

			file, err := service.GetByID(context.Background(), artifactID, tt.fileID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, file)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, file)
				assert.Equal(t, fileID, file.ID)
				assert.Equal(t, artifactID, file.ArtifactID)
			}

			if tt.errorMsg != "file id is empty" {
				mockRepo.AssertExpectations(t)
			}
		})
	}
}
