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
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// MockFileService is a mock implementation of FileService
type MockFileService struct {
	mock.Mock
}

func (m *MockFileService) Create(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, userMeta map[string]interface{}) (*model.File, error) {
	args := m.Called(ctx, artifactID, path, filename, fileHeader, userMeta)
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileService) Delete(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) error {
	args := m.Called(ctx, artifactID, fileID)
	return args.Error(0)
}

func (m *MockFileService) GetByID(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID) (*model.File, error) {
	args := m.Called(ctx, artifactID, fileID)
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileService) GetPresignedURL(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, expire time.Duration) (string, error) {
	args := m.Called(ctx, artifactID, fileID, expire)
	return args.String(0), args.Error(1)
}

func (m *MockFileService) UpdateFile(ctx context.Context, artifactID uuid.UUID, fileID uuid.UUID, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error) {
	args := m.Called(ctx, artifactID, fileID, fileHeader, newPath, newFilename)
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileService) ListByPath(ctx context.Context, artifactID uuid.UUID, path string) ([]*model.File, error) {
	args := m.Called(ctx, artifactID, path)
	return args.Get(0).([]*model.File), args.Error(1)
}

func (m *MockFileService) GetAllPaths(ctx context.Context, artifactID uuid.UUID) ([]string, error) {
	args := m.Called(ctx, artifactID)
	return args.Get(0).([]string), args.Error(1)
}

func (m *MockFileService) GetByArtifactID(ctx context.Context, artifactID uuid.UUID) ([]*model.File, error) {
	args := m.Called(ctx, artifactID)
	return args.Get(0).([]*model.File), args.Error(1)
}

func (m *MockFileService) DeleteByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) error {
	args := m.Called(ctx, artifactID, path, filename)
	return args.Error(0)
}

func (m *MockFileService) GetByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string) (*model.File, error) {
	args := m.Called(ctx, artifactID, path, filename)
	return args.Get(0).(*model.File), args.Error(1)
}

func (m *MockFileService) GetPresignedURLByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, expire time.Duration) (string, error) {
	args := m.Called(ctx, artifactID, path, filename, expire)
	return args.String(0), args.Error(1)
}

func (m *MockFileService) UpdateFileByPath(ctx context.Context, artifactID uuid.UUID, path string, filename string, fileHeader *multipart.FileHeader, newPath *string, newFilename *string) (*model.File, error) {
	args := m.Called(ctx, artifactID, path, filename, fileHeader, newPath, newFilename)
	return args.Get(0).(*model.File), args.Error(1)
}

func TestFileHandler_CreateFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		artifactID     string
		filePath       string
		meta           string
		fileContent    string
		fileName       string
		mockSetup      func(*MockFileService, string)
		expectedStatus int
	}{
		{
			name:        "successful file creation",
			artifactID:  uuid.New().String(),
			filePath:    "/test/test.txt",
			meta:        `{"description": "test file"}`,
			fileContent: "test content",
			fileName:    "test.txt",
			mockSetup: func(m *MockFileService, artifactIDStr string) {
				artifactID := uuid.MustParse(artifactIDStr)
				expectedFile := &model.File{
					ID:         uuid.New(),
					ArtifactID: artifactID,
					Path:       "/test",
					Filename:   "test.txt",
					Meta: map[string]interface{}{
						model.FileInfoKey: map[string]interface{}{
							"path":     "/test",
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
				m.On("Create", mock.Anything, artifactID, "/test/", "test.txt", mock.Anything, mock.Anything).Return(expectedFile, nil)
			},
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockFileService)
			tt.mockSetup(mockService, tt.artifactID)

			handler := NewFileHandler(mockService)

			// Create multipart form data
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)

			// Add file
			fileWriter, err := writer.CreateFormFile("file", tt.fileName)
			assert.NoError(t, err)
			_, err = fileWriter.Write([]byte(tt.fileContent))
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
			req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/artifact/%s/file", tt.artifactID), body)
			req.Header.Set("Content-Type", writer.FormDataContentType())

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "artifact_id", Value: tt.artifactID},
			}

			// Call handler
			handler.CreateFile(c)

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

func TestFileHandler_DeleteFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		artifactID     string
		filePath       string
		mockSetup      func(*MockFileService, string, string)
		expectedStatus int
	}{
		{
			name:       "successful file deletion",
			artifactID: uuid.New().String(),
			filePath:   "/test/test.txt",
			mockSetup: func(m *MockFileService, artifactIDStr string, filePath string) {
				artifactID := uuid.MustParse(artifactIDStr)
				m.On("DeleteByPath", mock.Anything, artifactID, "/test/", "test.txt").Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockFileService)
			tt.mockSetup(mockService, tt.artifactID, tt.filePath)

			handler := NewFileHandler(mockService)

			// Create request with query parameters
			req := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/artifact/%s/file?file_path=%s", tt.artifactID, tt.filePath), nil)

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "artifact_id", Value: tt.artifactID},
			}

			// Call handler
			handler.DeleteFile(c)

			// Assertions
			assert.Equal(t, tt.expectedStatus, w.Code)

			mockService.AssertExpectations(t)
		})
	}
}

func TestFileHandler_UpdateFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name           string
		artifactID     string
		filePath       string
		fileContent    string
		fileName       string
		mockSetup      func(m *MockFileService, artifactIDStr string)
		expectedStatus int
	}{
		{
			name:        "successful file update with same filename",
			artifactID:  uuid.New().String(),
			filePath:    "/test/report.pdf",
			fileContent: "updated content",
			fileName:    "report.pdf", // Same filename as in filePath
			mockSetup: func(m *MockFileService, artifactIDStr string) {
				artifactID := uuid.MustParse(artifactIDStr)
				expectedFile := &model.File{
					ID:         uuid.New(),
					ArtifactID: artifactID,
					Path:       "/test/",
					Filename:   "report.pdf",
					Meta: map[string]interface{}{
						model.FileInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "report.pdf",
							"mime":     "application/pdf",
							"size":     15,
						},
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "application/pdf",
						SizeB:  15,
					}),
				}
				m.On("UpdateFileByPath", mock.Anything, artifactID, "/test/", "report.pdf", mock.Anything, (*string)(nil), (*string)(nil)).Return(expectedFile, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful file update with different filename",
			artifactID:  uuid.New().String(),
			filePath:    "/test/report.pdf",
			fileContent: "updated content",
			fileName:    "new-report.pdf", // Different filename
			mockSetup: func(m *MockFileService, artifactIDStr string) {
				artifactID := uuid.MustParse(artifactIDStr)
				expectedFile := &model.File{
					ID:         uuid.New(),
					ArtifactID: artifactID,
					Path:       "/test/",
					Filename:   "new-report.pdf",
					Meta: map[string]interface{}{
						model.FileInfoKey: map[string]interface{}{
							"path":     "/test/",
							"filename": "new-report.pdf",
							"mime":     "application/pdf",
							"size":     15,
						},
					},
					AssetMeta: datatypes.NewJSONType(model.Asset{
						Bucket: "test-bucket",
						S3Key:  "test-key",
						ETag:   "test-etag",
						SHA256: "test-sha256",
						MIME:   "application/pdf",
						SizeB:  15,
					}),
				}
				newFilename := "new-report.pdf"
				m.On("UpdateFileByPath", mock.Anything, artifactID, "/test/", "report.pdf", mock.Anything, (*string)(nil), &newFilename).Return(expectedFile, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "file update with invalid artifact ID",
			artifactID:  "invalid-uuid",
			filePath:    "/test/report.pdf",
			fileContent: "updated content",
			fileName:    "report.pdf",
			mockSetup: func(m *MockFileService, artifactIDStr string) {
				// No mock setup needed for invalid UUID
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:        "file update with invalid path",
			artifactID:  uuid.New().String(),
			filePath:    "/test/../../../report.pdf", // Path traversal attempt
			fileContent: "updated content",
			fileName:    "report.pdf",
			mockSetup: func(m *MockFileService, artifactIDStr string) {
				// No mock setup needed for invalid path
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := new(MockFileService)
			tt.mockSetup(mockService, tt.artifactID)

			handler := NewFileHandler(mockService)

			// Create multipart form data
			body := &bytes.Buffer{}
			writer := multipart.NewWriter(body)

			// Add file
			fileWriter, err := writer.CreateFormFile("file", tt.fileName)
			assert.NoError(t, err)
			_, err = fileWriter.Write([]byte(tt.fileContent))
			assert.NoError(t, err)

			// Add form fields
			if tt.filePath != "" {
				writer.WriteField("file_path", tt.filePath)
			}

			writer.Close()

			// Create request
			req := httptest.NewRequest(http.MethodPut, fmt.Sprintf("/artifact/%s/file", tt.artifactID), body)
			req.Header.Set("Content-Type", writer.FormDataContentType())

			// Create response recorder
			w := httptest.NewRecorder()

			// Create gin context
			c, _ := gin.CreateTestContext(w)
			c.Request = req
			c.Params = []gin.Param{
				{Key: "artifact_id", Value: tt.artifactID},
			}

			// Call handler
			handler.UpdateFile(c)

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
