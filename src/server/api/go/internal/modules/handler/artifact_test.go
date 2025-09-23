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
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockArtifactService is a mock implementation of ArtifactService
type MockArtifactService struct {
	mock.Mock
}

func (m *MockArtifactService) Create(ctx context.Context, projectID uuid.UUID) (*model.Artifact, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Artifact), args.Error(1)
}

func (m *MockArtifactService) Delete(ctx context.Context, projectID uuid.UUID, artifactID uuid.UUID) error {
	args := m.Called(ctx, projectID, artifactID)
	return args.Error(0)
}

func setupArtifactRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
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

func TestArtifactHandler_CreateArtifact(t *testing.T) {
	projectID := uuid.New()
	artifact := createTestArtifact()
	artifact.ProjectID = projectID

	tests := []struct {
		name           string
		setup          func(*MockArtifactService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful artifact creation",
			setup: func(svc *MockArtifactService) {
				svc.On("Create", mock.Anything, projectID).Return(artifact, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "service error",
			setup: func(svc *MockArtifactService) {
				svc.On("Create", mock.Anything, projectID).Return(nil, errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockArtifactService{}
			tt.setup(mockService)
			handler := NewArtifactHandler(mockService)

			router := setupArtifactRouter()
			router.POST("/artifact", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.CreateArtifact(c)
			})

			req := httptest.NewRequest("POST", "/artifact", nil)
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

func TestArtifactHandler_DeleteArtifact(t *testing.T) {
	projectID := uuid.New()
	artifactID := uuid.New()

	tests := []struct {
		name           string
		artifactID     string
		setup          func(*MockArtifactService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:       "successful deletion",
			artifactID: artifactID.String(),
			setup: func(svc *MockArtifactService) {
				svc.On("Delete", mock.Anything, projectID, artifactID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid artifact ID",
			artifactID:     "invalid-uuid",
			setup:          func(svc *MockArtifactService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid UUID",
		},
		{
			name:       "service error",
			artifactID: artifactID.String(),
			setup: func(svc *MockArtifactService) {
				svc.On("Delete", mock.Anything, projectID, artifactID).Return(errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockArtifactService{}
			tt.setup(mockService)
			handler := NewArtifactHandler(mockService)

			router := setupArtifactRouter()
			router.DELETE("/artifact/:artifact_id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.DeleteArtifact(c)
			})

			req := httptest.NewRequest("DELETE", "/artifact/"+tt.artifactID, nil)
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
