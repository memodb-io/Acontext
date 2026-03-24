package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/config"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/utils/fileparser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// MockArtifactService is a mock implementation of ArtifactService
type MockArtifactService struct {
	mock.Mock
}

func (m *MockArtifactService) Create(ctx context.Context, in service.CreateArtifactInput) (*model.Artifact, error) {
	args := m.Called(ctx, in)
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) Delete(ctx context.Context, diskID uuid.UUID, artifactID uuid.UUID) error {
	args := m.Called(ctx, diskID, artifactID)
	return args.Error(0)
}

func (m *MockArtifactService) GetByID(ctx context.Context, diskID uuid.UUID, artifactID uuid.UUID) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, artifactID)
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GetPresignedURL(ctx context.Context, artifact *model.Artifact, expire time.Duration) (string, error) {
	args := m.Called(ctx, artifact, expire)
	return args.String(0), args.Error(1)
}

func (m *MockArtifactService) UpdateArtifact(ctx context.Context, diskID uuid.UUID, artifactID uuid.UUID, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, artifactID, fileHeader, newPath, newFilename)
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) ListByPath(ctx context.Context, diskID uuid.UUID, path string) ([]*model.Artifact, error) {
	args := m.Called(ctx, diskID, path)
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GetAllPaths(ctx context.Context, diskID uuid.UUID) ([]string, error) {
	args := m.Called(ctx, diskID)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockArtifactService) GetByDiskID(ctx context.Context, diskID uuid.UUID) ([]*model.Artifact, error) {
	args := m.Called(ctx, diskID)
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) DeleteByPath(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, path string, filename string) error {
	args := m.Called(ctx, projectID, diskID, path, filename)
	return args.Error(0)
}

func (m *MockArtifactService) GetByPath(ctx context.Context, diskID uuid.UUID, path string, filename string) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, path, filename)
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) UpdateArtifactByPath(ctx context.Context, diskID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, path, filename, fileHeader, newPath, newFilename)
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) UpdateArtifactMetaByPath(ctx context.Context, diskID uuid.UUID, path string, filename string, userMeta map[string]interface{}) (*model.Artifact, error) {
	args := m.Called(ctx, diskID, path, filename, userMeta)
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GetFileContent(ctx context.Context, artifact *model.Artifact, userKEK []byte) (*fileparser.FileContent, error) {
	args := m.Called(ctx, artifact, userKEK)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*fileparser.FileContent), args.Error(1)
}

func (m *MockArtifactService) DownloadRawContent(ctx context.Context, artifact *model.Artifact, userKEK []byte) ([]byte, string, error) {
	args := m.Called(ctx, artifact, userKEK)
	if args.Get(0) == nil {
		return nil, args.String(1), args.Error(2)
	}
	return args.Get(0).([]byte), args.String(1), args.Error(2)
}

func (m *MockArtifactService) GrepArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	args := m.Called(ctx, projectID, diskID, pattern, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) GlobArtifacts(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID, pattern string, limit int) ([]*model.Artifact, error) {
	args := m.Called(ctx, projectID, diskID, pattern, limit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) CreateFromBytes(ctx context.Context, in service.CreateArtifactFromBytesInput) (*model.Artifact, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

// MockDiskRepo is a mock implementation of DiskRepo
type MockDiskRepo struct {
	mock.Mock
}

func (m *MockDiskRepo) Create(ctx context.Context, d *model.Disk) error {
	args := m.Called(ctx, d)
	return args.Error(0)
}

func (m *MockDiskRepo) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	args := m.Called(ctx, projectID, diskID)
	return args.Error(0)
}

func (m *MockDiskRepo) GetByProjectAndID(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) (*model.Disk, error) {
	args := m.Called(ctx, projectID, diskID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Disk), args.Error(1)
}

func (m *MockDiskRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.Disk, error) {
	args := m.Called(ctx, projectID, userIdentifier, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.Disk), args.Error(1)
}

// Verify MockDiskRepo implements repo.DiskRepo
var _ repo.DiskRepo = (*MockDiskRepo)(nil)

// createTestConfig creates a test config with default artifact settings
func createTestConfig(maxUploadSizeBytes int64) *config.Config {
	return &config.Config{
		Artifact: config.ArtifactCfg{
			MaxUploadSizeBytes: maxUploadSizeBytes,
		},
	}
}

// createDefaultTestConfig creates a test config with default 16MB limit
func createDefaultTestConfig() *config.Config {
	return createTestConfig(16777216) // 16MB
}

func TestArtifactHandler_UpsertArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		diskID         string
		filePath       string
		meta           string
		fileContent    string
		fileName       string
		maxUploadSize  int64
		mockSetup      func(*MockArtifactService, string, uuid.UUID)
		expectedStatus int
	}{
		{
			name:          "successful file upsert",
			diskID:        uuid.New().String(),
			filePath:      "/test/test.txt",
			meta:          `{"description": "test file"}`,
			fileContent:   "test content",
			fileName:      "test.txt",
			maxUploadSize: 16777216, // 16MB default
			mockSetup: func(m *MockArtifactService, diskIDStr string, projectID uuid.UUID) {
				diskID := uuid.MustParse(diskIDStr)
				expectedFile := &model.Artifact{
					ID:       uuid.New(),
					DiskID:   diskID,
					Path:     "/test/",
					Filename: "test.txt",
					Meta: map[string]interface{}{
						model.ArtifactInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "test.txt",
							"mime":     "text/plain",
							"size":     12,
						},
						"description": "test file",
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "text/plain",
						SizeB:  12,
					}),
				}
				m.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateArtifactInput) bool {
					return in.ProjectID == projectID && in.DiskID == diskID && in.Path == "/test/" && in.Filename == "test.txt" && in.FileHeader != nil
				})).Return(expectedFile, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:          "file size exceeds limit",
			diskID:        uuid.New().String(),
			filePath:      "/test/large.txt",
			meta:          "",
			fileContent:   "", // Will be set in test to avoid large string allocation
			fileName:      "large.txt",
			maxUploadSize: 5242880, // 5MB limit
			mockSetup: func(m *MockArtifactService, diskIDStr string, projectID uuid.UUID) {
				// No mock setup needed, should fail before service call
			},
			expectedStatus: http.StatusRequestEntityTooLarge,
		},
		{
			name:          "file size at limit boundary",
			diskID:        uuid.New().String(),
			filePath:      "/test/boundary.txt",
			meta:          "",
			fileContent:   "", // Will be set in test to avoid large string allocation
			fileName:      "boundary.txt",
			maxUploadSize: 16777216, // 16MB limit
			mockSetup: func(m *MockArtifactService, diskIDStr string, projectID uuid.UUID) {
				diskID := uuid.MustParse(diskIDStr)
				expectedFile := &model.Artifact{
					ID:       uuid.New(),
					DiskID:   diskID,
					Path:     "/test/",
					Filename: "boundary.txt",
					Meta: map[string]interface{}{
						model.ArtifactInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "boundary.txt",
							"mime":     "text/plain",
							"size":     16777216,
						},
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "text/plain",
						SizeB:  16777216,
					}),
				}
				m.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateArtifactInput) bool {
					return in.ProjectID == projectID && in.DiskID == diskID && in.Path == "/test/" && in.Filename == "boundary.txt" && in.FileHeader != nil
				})).Return(expectedFile, nil)
			},
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockArtifactService)
			mockDiskRepo := new(MockDiskRepo)
			projectID := uuid.New()
			tt.mockSetup(mockService, tt.diskID, projectID)

			// Mock disk ownership check - allow valid disk IDs
			diskUUID, diskParseErr := uuid.Parse(tt.diskID)
			if diskParseErr == nil {
				mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskUUID).Return(&model.Disk{ID: diskUUID, ProjectID: projectID}, nil)
			}

			testConfig := createTestConfig(tt.maxUploadSize)
			handler := NewArtifactHandler(mockService, mockDiskRepo, testConfig, nil, nil, nil)

			// Create multipart form data
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)

			// Add file
			fileWriter, err := writer.CreateFormFile("file", tt.fileName)
			assert.NoError(t, err)

			// Handle large file content for size limit tests
			var fileData []byte
			switch tt.name {
			case "file size exceeds limit":
				fileData = make([]byte, 6*1024*1024) // 6MB file (exceeds 5MB limit in test)
			case "file size at limit boundary":
				fileData = make([]byte, 16777216) // Exactly 16MB
			default:
				fileData = []byte(tt.fileContent)
			}
			_, err = fileWriter.Write(fileData)
			assert.NoError(t, err)

			// Add form fields
			if tt.filePath != "" {
				writer.WriteField("file_path", tt.filePath)
			}
			if tt.meta != "" {
				writer.WriteField("meta", tt.meta)
			}

			writer.Close()

			// Create request
			req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/disk/%s/artifact", tt.diskID), body)
			req.Header.Set("Content-Type", writer.FormDataContentType())

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "disk_id", Value: tt.diskID},
			}
			// Inject project into context
			c.Set("project", &model.Project{ID: projectID})

			// Call handler
			handler.UpsertArtifact(c)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusCreated {
				var response serializer.Response
				err = json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response.Data)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestArtifactHandler_DeleteArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		diskID         string
		filePath       string
		mockSetup      func(*MockArtifactService, string, string, uuid.UUID)
		expectedStatus int
	}{
		{
			name:     "successful file deletion",
			diskID:   uuid.New().String(),
			filePath: "/test/test.txt",
			mockSetup: func(m *MockArtifactService, diskIDStr string, filePath string, projectID uuid.UUID) {
				diskID := uuid.MustParse(diskIDStr)
				m.On("DeleteByPath", mock.Anything, projectID, diskID, "/test/", "test.txt").Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockArtifactService)
			mockDiskRepo := new(MockDiskRepo)
			projectID := uuid.New()
			tt.mockSetup(mockService, tt.diskID, tt.filePath, projectID)

			// Set up disk ownership check for valid disk IDs
			if diskID, err := uuid.Parse(tt.diskID); err == nil {
				mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
			}

			testConfig := createDefaultTestConfig() // Default 16MB
			handler := NewArtifactHandler(mockService, mockDiskRepo, testConfig, nil, nil, nil)

			// Create request with query parameters
			req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/disk/%s/artifact?file_path=%s", tt.diskID, tt.filePath), nil)

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "disk_id", Value: tt.diskID},
			}
			// Inject project into context
			c.Set("project", &model.Project{ID: projectID})

			// Call handler
			handler.DeleteArtifact(c)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			mockService.AssertExpectations(t)
		})
	}
}

func TestArtifactHandler_UpdateArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		diskID         string
		filePath       string
		meta           string
		mockSetup      func(m *MockArtifactService, diskIDStr string)
		expectedStatus int
	}{
		{
			name:     "successful meta update",
			diskID:   uuid.New().String(),
			filePath: "/test/report.pdf",
			meta:     `{"description": "Updated report", "version": "2.0"}`,
			mockSetup: func(m *MockArtifactService, diskIDStr string) {
				diskID := uuid.MustParse(diskIDStr)
				expectedFile := &model.Artifact{
					ID:       uuid.New(),
					DiskID:   diskID,
					Path:     "/test/",
					Filename: "report.pdf",
					Meta: map[string]interface{}{
						model.ArtifactInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "report.pdf",
							"mime":     "application/pdf",
							"size":     1024,
						},
						"description": "Updated report",
						"version":     "2.0",
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "application/pdf",
						SizeB:  1024,
					}),
				}
				expectedMeta := map[string]interface{}{
					"description": "Updated report",
					"version":     "2.0",
				}
				m.On("UpdateArtifactMetaByPath", mock.Anything, diskID, "/test/", "report.pdf", expectedMeta).Return(expectedFile, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:     "meta update with invalid disk ID",
			diskID:   "invalid-uuid",
			filePath: "/test/report.pdf",
			meta:     `{"description": "test"}`,
			mockSetup: func(m *MockArtifactService, diskIDStr string) {
				// No mock setup needed for invalid UUID
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "meta update with invalid path",
			diskID:   uuid.New().String(),
			filePath: "/test/../../../report.pdf", // Path traversal attempt
			meta:     `{"description": "test"}`,
			mockSetup: func(m *MockArtifactService, diskIDStr string) {
				// No mock setup needed for invalid path
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "meta update with invalid JSON",
			diskID:   uuid.New().String(),
			filePath: "/test/report.pdf",
			meta:     `{invalid json}`,
			mockSetup: func(m *MockArtifactService, diskIDStr string) {
				// No mock setup needed for invalid JSON
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:     "meta update with reserved key",
			diskID:   uuid.New().String(),
			filePath: "/test/report.pdf",
			meta:     `{"__artifact_info__": {"test": "value"}}`,
			mockSetup: func(m *MockArtifactService, diskIDStr string) {
				// No mock setup needed for reserved key
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockArtifactService)
			mockDiskRepo := new(MockDiskRepo)
			projectID := uuid.New()
			tt.mockSetup(mockService, tt.diskID)

			// Set up disk ownership check for valid disk IDs
			if diskID, err := uuid.Parse(tt.diskID); err == nil {
				mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
			}

			testConfig := createDefaultTestConfig() // Default 16MB
			handler := NewArtifactHandler(mockService, mockDiskRepo, testConfig, nil, nil, nil)

			// Create JSON request body
			requestBody := map[string]string{
				"file_path": tt.filePath,
				"meta":      tt.meta,
			}
			bodyBytes, err := json.Marshal(requestBody)
			assert.NoError(t, err)

			// Create request
			req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/disk/%s/artifact", tt.diskID), bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "disk_id", Value: tt.diskID},
			}
			// Inject project into context
			c.Set("project", &model.Project{ID: projectID})

			// Call handler
			handler.UpdateArtifact(c)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response serializer.Response
				err = json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response.Data)
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestArtifactHandler_GetArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		diskID         string
		filePath       string
		withContent    bool
		withPublicURL  bool
		mockSetup      func(*MockArtifactService, string, string)
		expectedStatus int
	}{
		{
			name:          "successful artifact retrieval with content",
			diskID:        uuid.New().String(),
			filePath:      "/test/data.csv",
			withContent:   true,
			withPublicURL: true,
			mockSetup: func(m *MockArtifactService, diskIDStr string, filePath string) {
				diskID := uuid.MustParse(diskIDStr)
				expectedFile := &model.Artifact{
					ID:       uuid.New(),
					DiskID:   diskID,
					Path:     "/test/",
					Filename: "data.csv",
					Meta: map[string]interface{}{
						model.ArtifactInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "data.csv",
							"mime":     "text/csv",
							"size":     1024,
						},
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "text/csv",
						SizeB:  1024,
					}),
				}
				expectedContent := &fileparser.FileContent{
					Type: "csv",
					Raw:  "name,age\nJohn,25",
				}
				m.On("GetByPath", mock.Anything, diskID, "/test/", "data.csv").Return(expectedFile, nil)
				m.On("GetFileContent", mock.Anything, expectedFile, mock.Anything).Return(expectedContent, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:          "successful artifact retrieval without content",
			diskID:        uuid.New().String(),
			filePath:      "/test/data.csv",
			withContent:   false,
			withPublicURL: false,
			mockSetup: func(m *MockArtifactService, diskIDStr string, filePath string) {
				diskID := uuid.MustParse(diskIDStr)
				expectedFile := &model.Artifact{
					ID:       uuid.New(),
					DiskID:   diskID,
					Path:     "/test/",
					Filename: "data.csv",
					Meta: map[string]interface{}{
						model.ArtifactInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "data.csv",
							"mime":     "text/csv",
							"size":     1024,
						},
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "text/csv",
						SizeB:  1024,
					}),
				}
				m.On("GetByPath", mock.Anything, diskID, "/test/", "data.csv").Return(expectedFile, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:          "invalid disk ID",
			diskID:        "invalid-uuid",
			filePath:      "/test/data.csv",
			withContent:   true,
			withPublicURL: true,
			mockSetup: func(m *MockArtifactService, diskIDStr string, filePath string) {
				// No mock setup needed for invalid UUID
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockArtifactService)
			mockDiskRepo := new(MockDiskRepo)
			mockMaterialSvc := new(MockMaterialService)
			tt.mockSetup(mockService, tt.diskID, tt.filePath)

			// Mock materialSvc for any test that requests public URL
			if tt.withPublicURL {
				mockMaterialSvc.On("CreateMaterialURL", mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything, mock.Anything).
					Return("http://localhost:8029/api/v1/material/test-token", time.Now().Add(time.Hour), nil).Maybe()
			}

			testConfig := createDefaultTestConfig() // Default 16MB
			handler := NewArtifactHandler(mockService, mockDiskRepo, testConfig, nil, nil, mockMaterialSvc)

			// Set up mock disk repo to allow ownership check for valid disk IDs
			projectID := uuid.New()
			if parsedDiskID, err := uuid.Parse(tt.diskID); err == nil {
				mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, parsedDiskID).
					Return(&model.Disk{ID: parsedDiskID, ProjectID: projectID}, nil)
			}

			// Create request with query parameters
			url := fmt.Sprintf("/disk/%s/artifact?file_path=%s", tt.diskID, tt.filePath)
			if tt.withContent {
				url += "&with_content=true"
			} else {
				url += "&with_content=false"
			}
			if tt.withPublicURL {
				url += "&with_public_url=true"
			} else {
				url += "&with_public_url=false"
			}

			req := httptest.NewRequest(http.MethodGet, url, nil)

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "disk_id", Value: tt.diskID},
			}
			c.Set("project", &model.Project{ID: projectID})

			// Call handler
			handler.GetArtifact(c)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var response serializer.Response
				err := json.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response.Data)

				// Check if content is included when requested
				if tt.withContent {
					// Parse the response data to check content field
					dataBytes, _ := json.Marshal(response.Data)
					var respData map[string]interface{}
					json.Unmarshal(dataBytes, &respData)
					assert.Contains(t, respData, "content")
				}
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestArtifactHandler_GetArtifact_MaterialURL(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("public_url contains material URL path", func(t *testing.T) {
		mockService := new(MockArtifactService)
		mockDiskRepo := new(MockDiskRepo)
		mockMaterialSvc := new(MockMaterialService)

		diskID := uuid.New()
		projectID := uuid.New()

		expectedFile := &model.Artifact{
			ID:       uuid.New(),
			DiskID:   diskID,
			Path:     "/",
			Filename: "test.bin",
			AssetMeta: datatypes.NewJSONType(model.Asset{
				S3Key: "assets/proj/test.bin",
				MIME:  "application/octet-stream",
			}),
		}
		mockService.On("GetByPath", mock.Anything, diskID, "/", "test.bin").Return(expectedFile, nil)
		mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).
			Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
		mockMaterialSvc.On("CreateMaterialURL", mock.Anything, "assets/proj/test.bin", "", mock.AnythingOfType("time.Duration"), "application/octet-stream", "test.bin").
			Return("http://localhost:8029/api/v1/material/aabbcc", time.Now().Add(time.Hour), nil)

		handler := NewArtifactHandler(mockService, mockDiskRepo, createDefaultTestConfig(), nil, nil, mockMaterialSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/disk/"+diskID.String()+"/artifact?file_path=/test.bin&with_public_url=true&with_content=false", nil)
		c.Params = []gin.Param{{Key: "disk_id", Value: diskID.String()}}
		c.Set("project", &model.Project{ID: projectID})

		handler.GetArtifact(c)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp serializer.Response
		err := json.Unmarshal(w.Body.Bytes(), &resp)
		assert.NoError(t, err)

		dataBytes, _ := json.Marshal(resp.Data)
		var respData map[string]interface{}
		json.Unmarshal(dataBytes, &respData)
		publicURL, ok := respData["public_url"].(string)
		assert.True(t, ok, "public_url should be a string")
		assert.Contains(t, publicURL, "/api/v1/material/")

		mockMaterialSvc.AssertExpectations(t)
	})

	t.Run("encrypted project also gets material URL", func(t *testing.T) {
		mockService := new(MockArtifactService)
		mockDiskRepo := new(MockDiskRepo)
		mockMaterialSvc := new(MockMaterialService)

		diskID := uuid.New()
		projectID := uuid.New()

		expectedFile := &model.Artifact{
			ID:       uuid.New(),
			DiskID:   diskID,
			Path:     "/",
			Filename: "secret.bin",
			AssetMeta: datatypes.NewJSONType(model.Asset{
				S3Key: "assets/proj/secret.bin",
				MIME:  "application/octet-stream",
			}),
		}
		mockService.On("GetByPath", mock.Anything, diskID, "/", "secret.bin").Return(expectedFile, nil)
		mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).
			Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)
		mockMaterialSvc.On("CreateMaterialURL", mock.Anything, "assets/proj/secret.bin", mock.Anything, mock.AnythingOfType("time.Duration"), "application/octet-stream", "secret.bin").
			Return("http://localhost:8029/api/v1/material/encrypted-token", time.Now().Add(time.Hour), nil)

		handler := NewArtifactHandler(mockService, mockDiskRepo, createDefaultTestConfig(), nil, nil, mockMaterialSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/disk/"+diskID.String()+"/artifact?file_path=/secret.bin&with_public_url=true&with_content=false", nil)
		c.Params = []gin.Param{{Key: "disk_id", Value: diskID.String()}}
		c.Set("project", &model.Project{ID: projectID, EncryptionEnabled: true})

		handler.GetArtifact(c)

		assert.Equal(t, http.StatusOK, w.Code)

		var resp serializer.Response
		json.Unmarshal(w.Body.Bytes(), &resp)
		dataBytes, _ := json.Marshal(resp.Data)
		var respData map[string]interface{}
		json.Unmarshal(dataBytes, &respData)
		assert.NotNil(t, respData["public_url"], "encrypted project should also get a material URL")

		mockMaterialSvc.AssertExpectations(t)
	})
}

func TestArtifactHandler_GrepArtifacts(t *testing.T) {
	tests := []struct {
		name           string
		diskID         string
		query          string
		limit          string
		setupMock      func(*MockArtifactService)
		expectedStatus int
		checkBody      func(*testing.T, string)
	}{
		{
			name:   "successful grep search",
			diskID: "123e4567-e89b-12d3-a456-426614174000",
			query:  "TODO",
			limit:  "10",
			setupMock: func(svc *MockArtifactService) {
				svc.On("GrepArtifacts", mock.Anything, mock.Anything, mock.Anything, "TODO", 10).
					Return([]*model.Artifact{
						{
							ID:       uuid.New(),
							Filename: "test.py",
							Path:     "/",
						},
					}, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body string) {
				assert.Contains(t, body, "test.py")
			},
		},
		{
			name:   "no matches found",
			diskID: "123e4567-e89b-12d3-a456-426614174000",
			query:  "NOTFOUND",
			limit:  "50",
			setupMock: func(svc *MockArtifactService) {
				svc.On("GrepArtifacts", mock.Anything, mock.Anything, mock.Anything, "NOTFOUND", 50).
					Return([]*model.Artifact{}, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body string) {
				assert.Contains(t, body, "data")
			},
		},
		{
			name:           "invalid disk ID",
			diskID:         "invalid-uuid",
			query:          "TODO",
			limit:          "10",
			setupMock:      func(svc *MockArtifactService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "missing query parameter",
			diskID:         "123e4567-e89b-12d3-a456-426614174000",
			query:          "",
			limit:          "10",
			setupMock:      func(svc *MockArtifactService) {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := new(MockArtifactService)
			mockDiskRepo := new(MockDiskRepo)
			tt.setupMock(mockSvc)

			project := &model.Project{ID: uuid.New()}

			// Mock disk ownership check for valid disk IDs
			if diskUUID, err := uuid.Parse(tt.diskID); err == nil {
				mockDiskRepo.On("GetByProjectAndID", mock.Anything, project.ID, diskUUID).
					Return(&model.Disk{ID: diskUUID, ProjectID: project.ID}, nil)
			}

			handler := NewArtifactHandler(mockSvc, mockDiskRepo, createTestConfig(10*1024*1024), nil, nil, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			c.Set("project", project)

			req := httptest.NewRequest("GET", "/disk/"+tt.diskID+"/artifact/grep?query="+tt.query+"&limit="+tt.limit, nil)
			c.Request = req
			c.Params = gin.Params{{Key: "disk_id", Value: tt.diskID}}

			handler.GrepArtifacts(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkBody != nil {
				tt.checkBody(t, w.Body.String())
			}
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestArtifactHandler_GlobArtifacts(t *testing.T) {
	tests := []struct {
		name           string
		diskID         string
		query          string
		limit          string
		setupMock      func(*MockArtifactService)
		expectedStatus int
		checkBody      func(*testing.T, string)
	}{
		{
			name:   "successful glob with wildcard",
			diskID: "123e4567-e89b-12d3-a456-426614174000",
			query:  "*.py",
			limit:  "20",
			setupMock: func(svc *MockArtifactService) {
				svc.On("GlobArtifacts", mock.Anything, mock.Anything, mock.Anything, "*.py", 20).
					Return([]*model.Artifact{
						{
							ID:       uuid.New(),
							Filename: "test.py",
							Path:     "/",
						},
						{
							ID:       uuid.New(),
							Filename: "main.py",
							Path:     "/",
						},
					}, nil)
			},
			expectedStatus: http.StatusOK,
			checkBody: func(t *testing.T, body string) {
				assert.Contains(t, body, "test.py")
				assert.Contains(t, body, "main.py")
			},
		},
		{
			name:   "no matches",
			diskID: "123e4567-e89b-12d3-a456-426614174000",
			query:  "*.xyz",
			limit:  "10",
			setupMock: func(svc *MockArtifactService) {
				svc.On("GlobArtifacts", mock.Anything, mock.Anything, mock.Anything, "*.xyz", 10).
					Return([]*model.Artifact{}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid disk ID",
			diskID:         "not-a-uuid",
			query:          "*.txt",
			limit:          "10",
			setupMock:      func(svc *MockArtifactService) {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := new(MockArtifactService)
			mockDiskRepo := new(MockDiskRepo)
			tt.setupMock(mockSvc)

			project := &model.Project{ID: uuid.New()}

			// Mock disk ownership check for valid disk IDs
			if diskUUID, err := uuid.Parse(tt.diskID); err == nil {
				mockDiskRepo.On("GetByProjectAndID", mock.Anything, project.ID, diskUUID).
					Return(&model.Disk{ID: diskUUID, ProjectID: project.ID}, nil)
			}

			handler := NewArtifactHandler(mockSvc, mockDiskRepo, createTestConfig(10*1024*1024), nil, nil, nil)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			c.Set("project", project)

			req := httptest.NewRequest("GET", "/disk/"+tt.diskID+"/artifact/glob?query="+tt.query+"&limit="+tt.limit, nil)
			c.Request = req
			c.Params = gin.Params{{Key: "disk_id", Value: tt.diskID}}

			handler.GlobArtifacts(c)

			assert.Equal(t, tt.expectedStatus, w.Code)
			if tt.checkBody != nil {
				tt.checkBody(t, w.Body.String())
			}
			mockSvc.AssertExpectations(t)
		})
	}
}

func TestArtifactHandler_UploadFromSandbox(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("returns 404 when disk belongs to different project", func(t *testing.T) {
		mockService := new(MockArtifactService)
		mockDiskRepo := new(MockDiskRepo)

		projectID := uuid.New()
		diskID := uuid.New()

		// Disk not found for this project (IDOR check)
		mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).
			Return(nil, fmt.Errorf("record not found"))

		handler := NewArtifactHandler(mockService, mockDiskRepo, createDefaultTestConfig(), nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("project", &model.Project{ID: projectID})

		body := `{"sandbox_id":"` + uuid.New().String() + `","sandbox_path":"/tmp","sandbox_filename":"test.txt","file_path":"/"}`
		c.Request = httptest.NewRequest("POST", "/disk/"+diskID.String()+"/artifact/upload_from_sandbox", bytes.NewBufferString(body))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Params = gin.Params{{Key: "disk_id", Value: diskID.String()}}

		handler.UploadFromSandbox(c)

		assert.Equal(t, http.StatusNotFound, w.Code)
		mockService.AssertNotCalled(t, "Create")
		mockDiskRepo.AssertExpectations(t)
	})

	t.Run("returns 400 for invalid request body", func(t *testing.T) {
		mockService := new(MockArtifactService)
		mockDiskRepo := new(MockDiskRepo)

		projectID := uuid.New()
		diskID := uuid.New()

		// Disk found for this project
		mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).
			Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)

		handler := NewArtifactHandler(mockService, mockDiskRepo, createDefaultTestConfig(), nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("project", &model.Project{ID: projectID})

		// Empty JSON body — missing required fields
		c.Request = httptest.NewRequest("POST", "/disk/"+diskID.String()+"/artifact/upload_from_sandbox", bytes.NewBufferString(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Params = gin.Params{{Key: "disk_id", Value: diskID.String()}}

		handler.UploadFromSandbox(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		mockService.AssertNotCalled(t, "Create")
		mockDiskRepo.AssertExpectations(t)
	})
}

func TestArtifactHandler_DownloadArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("returns 403 when disk belongs to different project", func(t *testing.T) {
		mockService := new(MockArtifactService)
		mockDiskRepo := new(MockDiskRepo)

		projectID := uuid.New()
		diskID := uuid.New()

		// Disk not found for this project
		mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).
			Return(nil, fmt.Errorf("record not found"))

		handler := NewArtifactHandler(mockService, mockDiskRepo, createDefaultTestConfig(), nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("project", &model.Project{ID: projectID})
		c.Request = httptest.NewRequest("GET", "/disk/"+diskID.String()+"/artifact/download?file_path=/test/file.txt", nil)
		c.Params = gin.Params{{Key: "disk_id", Value: diskID.String()}}

		handler.DownloadArtifact(c)

		assert.Equal(t, http.StatusForbidden, w.Code)
		mockService.AssertNotCalled(t, "GetByPath")
		mockDiskRepo.AssertExpectations(t)
	})

	t.Run("succeeds when disk belongs to authenticated project", func(t *testing.T) {
		mockService := new(MockArtifactService)
		mockDiskRepo := new(MockDiskRepo)

		projectID := uuid.New()
		diskID := uuid.New()

		// Disk found for this project
		mockDiskRepo.On("GetByProjectAndID", mock.Anything, projectID, diskID).
			Return(&model.Disk{ID: diskID, ProjectID: projectID}, nil)

		artifact := &model.Artifact{
			ID:       uuid.New(),
			DiskID:   diskID,
			Path:     "/test/",
			Filename: "file.txt",
			AssetMeta: datatypes.NewJSONType(model.Asset{
				Bucket: "test-bucket",
				S3Key:  "test-key",
				MIME:   "text/plain",
			}),
		}
		mockService.On("GetByPath", mock.Anything, diskID, "/test/", "file.txt").Return(artifact, nil)
		mockService.On("DownloadRawContent", mock.Anything, artifact, mock.Anything).Return([]byte("content"), "text/plain", nil)

		handler := NewArtifactHandler(mockService, mockDiskRepo, createDefaultTestConfig(), nil, nil, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("project", &model.Project{ID: projectID})
		c.Request = httptest.NewRequest("GET", "/disk/"+diskID.String()+"/artifact/download?file_path=/test/file.txt", nil)
		c.Params = gin.Params{{Key: "disk_id", Value: diskID.String()}}

		handler.DownloadArtifact(c)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, "content", w.Body.String())
		mockDiskRepo.AssertExpectations(t)
		mockService.AssertExpectations(t)
	})
}
