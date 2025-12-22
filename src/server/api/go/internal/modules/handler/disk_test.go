package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockDiskService is a mock implementation of DiskService
type MockDiskService struct {
	mock.Mock
}

func (m *MockDiskService) Create(ctx context.Context, projectID uuid.UUID) (*model.Disk, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Disk), args.Error(1)
}

func (m *MockDiskService) Delete(ctx context.Context, projectID uuid.UUID, diskID uuid.UUID) error {
	args := m.Called(ctx, projectID, diskID)
	return args.Error(0)
}

func (m *MockDiskService) List(ctx context.Context, in service.ListDisksInput) (*service.ListDisksOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListDisksOutput), args.Error(1)
}

func setupDiskRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
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

func TestDiskHandler_CreateDisk(t *testing.T) {
	projectID := uuid.New()
	disk := createTestDisk()
	disk.ProjectID = projectID

	tests := []struct {
		name           string
		setup          func(*MockDiskService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful disk creation",
			setup: func(svc *MockDiskService) {
				svc.On("Create", mock.Anything, projectID).Return(disk, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "service error",
			setup: func(svc *MockDiskService) {
				svc.On("Create", mock.Anything, projectID).Return(nil, errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockDiskService{}
			tt.setup(mockService)
			handler := NewDiskHandler(mockService)

			router := setupDiskRouter()
			router.POST("/disk", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.CreateDisk(c)
			})

			req := httptest.NewRequest("POST", "/disk", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			} else if tt.expectedStatus == http.StatusCreated {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response["data"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestDiskHandler_ListDisks(t *testing.T) {
	projectID := uuid.New()
	disk1 := createTestDisk()
	disk1.ProjectID = projectID
	disk2 := createTestDisk()
	disk2.ProjectID = projectID

	tests := []struct {
		name           string
		setup          func(*MockDiskService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful list with disks",
			setup: func(svc *MockDiskService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListDisksOutput{
					Items:   []*model.Disk{disk1, disk2},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "successful list with empty result",
			setup: func(svc *MockDiskService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListDisksOutput{
					Items:   []*model.Disk{},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "service error",
			setup: func(svc *MockDiskService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockDiskService{}
			tt.setup(mockService)
			handler := NewDiskHandler(mockService)

			router := setupDiskRouter()
			router.GET("/disk", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.ListDisks(c)
			})

			req := httptest.NewRequest("GET", "/disk", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			} else if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				assert.NotNil(t, response["data"])
			}

			mockService.AssertExpectations(t)
		})
	}
}

func TestDiskHandler_DeleteDisk(t *testing.T) {
	projectID := uuid.New()
	diskID := uuid.New()

	tests := []struct {
		name           string
		diskID         string
		setup          func(*MockDiskService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:   "successful deletion",
			diskID: diskID.String(),
			setup: func(svc *MockDiskService) {
				svc.On("Delete", mock.Anything, projectID, diskID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid disk ID",
			diskID:         "invalid-uuid",
			setup:          func(svc *MockDiskService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid UUID",
		},
		{
			name:   "service error",
			diskID: diskID.String(),
			setup: func(svc *MockDiskService) {
				svc.On("Delete", mock.Anything, projectID, diskID).Return(errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockDiskService{}
			tt.setup(mockService)
			handler := NewDiskHandler(mockService)

			router := setupDiskRouter()
			router.DELETE("/disk/:disk_id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.DeleteDisk(c)
			})

			req := httptest.NewRequest("DELETE", "/disk/"+tt.diskID, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				assert.NoError(t, err)
				if response["message"] != nil {
					assert.Contains(t, response["message"], tt.expectedError)
				}
			}

			mockService.AssertExpectations(t)
		})
	}
}
