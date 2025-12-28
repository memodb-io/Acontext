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
	"gorm.io/datatypes"
)

// MockAgentSkillsService is a mock implementation of AgentSkillsService
type MockAgentSkillsService struct {
	mock.Mock
}

func (m *MockAgentSkillsService) Create(ctx context.Context, in service.CreateAgentSkillsInput) (*model.AgentSkills, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	args := m.Called(ctx, projectID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) GetByName(ctx context.Context, projectID uuid.UUID, name string) (*model.AgentSkills, error) {
	args := m.Called(ctx, projectID, name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) Update(ctx context.Context, in service.UpdateAgentSkillsInput) (*model.AgentSkills, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.AgentSkills), args.Error(1)
}

func (m *MockAgentSkillsService) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	args := m.Called(ctx, projectID, id)
	return args.Error(0)
}

func (m *MockAgentSkillsService) List(ctx context.Context, in service.ListAgentSkillsInput) (*service.ListAgentSkillsOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListAgentSkillsOutput), args.Error(1)
}

func (m *MockAgentSkillsService) GetPresignedURL(ctx context.Context, agentSkills *model.AgentSkills, filePath string, expire time.Duration) (string, error) {
	args := m.Called(ctx, agentSkills, filePath, expire)
	return args.String(0), args.Error(1)
}

func setupAgentSkillsRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func createTestAgentSkills() *model.AgentSkills {
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	baseAsset := &model.Asset{
		Bucket: "test-bucket",
		S3Key:  "agent_skills/" + projectID.String() + "/" + agentSkillsID.String() + "/extracted/",
	}

	return &model.AgentSkills{
		ID:          agentSkillsID,
		ProjectID:   projectID,
		Name:        "test-skills",
		Description: "Test description",
		AssetMeta:   datatypes.NewJSONType(*baseAsset),
		FileIndex:   datatypes.NewJSONType([]string{"file1.json", "file2.md"}),
		Meta:        map[string]interface{}{"version": "1.0"},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func TestAgentSkillsHandler_GetAgentSkills(t *testing.T) {
	projectID := uuid.New()
	agentSkills := createTestAgentSkills()
	agentSkills.ProjectID = projectID

	tests := []struct {
		name           string
		id             string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful get by ID",
			id:   agentSkills.ID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByID", mock.Anything, projectID, agentSkills.ID).Return(agentSkills, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid ID",
			id:             "invalid-uuid",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid id",
		},
		{
			name: "not found",
			id:   agentSkills.ID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByID", mock.Anything, projectID, agentSkills.ID).Return(nil, errors.New("not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.GetAgentSkills(c)
			})

			req := httptest.NewRequest("GET", "/agent_skills/"+tt.id, nil)
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

func TestAgentSkillsHandler_GetAgentSkillsByName(t *testing.T) {
	projectID := uuid.New()
	agentSkills := createTestAgentSkills()
	agentSkills.ProjectID = projectID

	tests := []struct {
		name           string
		queryName      string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:      "successful get by name",
			queryName: "test-skills",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByName", mock.Anything, projectID, "test-skills").Return(agentSkills, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "missing name parameter",
			queryName:      "",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "name is required",
		},
		{
			name:      "not found",
			queryName: "non-existent",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByName", mock.Anything, projectID, "non-existent").Return(nil, errors.New("not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills/by_name", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.GetAgentSkillsByName(c)
			})

			url := "/agent_skills/by_name"
			if tt.queryName != "" {
				url += "?name=" + tt.queryName
			}
			req := httptest.NewRequest("GET", url, nil)
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

func TestAgentSkillsHandler_DeleteAgentSkills(t *testing.T) {
	projectID := uuid.New()
	agentSkillsID := uuid.New()

	tests := []struct {
		name           string
		id             string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful deletion",
			id:   agentSkillsID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Delete", mock.Anything, projectID, agentSkillsID).Return(nil)
			},
			expectedStatus: http.StatusNoContent,
		},
		{
			name:           "invalid ID",
			id:             "invalid-uuid",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid id",
		},
		{
			name: "service error",
			id:   agentSkillsID.String(),
			setup: func(svc *MockAgentSkillsService) {
				svc.On("Delete", mock.Anything, projectID, agentSkillsID).Return(errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService)

			router := setupAgentSkillsRouter()
			router.DELETE("/agent_skills/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.DeleteAgentSkills(c)
			})

			req := httptest.NewRequest("DELETE", "/agent_skills/"+tt.id, nil)
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

func TestAgentSkillsHandler_ListAgentSkills(t *testing.T) {
	projectID := uuid.New()
	agentSkills1 := createTestAgentSkills()
	agentSkills1.ProjectID = projectID
	agentSkills2 := createTestAgentSkills()
	agentSkills2.ProjectID = projectID

	tests := []struct {
		name           string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful list with items",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListAgentSkillsOutput{
					Items:   []*model.AgentSkills{agentSkills1, agentSkills2},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "successful list with empty result",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListAgentSkillsOutput{
					Items:   []*model.AgentSkills{},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "service error",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("service error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.ListAgentSkills(c)
			})

			req := httptest.NewRequest("GET", "/agent_skills?limit=20", nil)
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

func TestAgentSkillsHandler_GetAgentSkillsFileURL(t *testing.T) {
	projectID := uuid.New()
	agentSkills := createTestAgentSkills()
	agentSkills.ProjectID = projectID

	tests := []struct {
		name           string
		id             string
		filePath       string
		setup          func(*MockAgentSkillsService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:     "successful get file URL",
			id:       agentSkills.ID.String(),
			filePath: "file1.json",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByID", mock.Anything, projectID, agentSkills.ID).Return(agentSkills, nil)
				svc.On("GetPresignedURL", mock.Anything, agentSkills, "file1.json", mock.Anything).Return("https://s3.example.com/presigned-url", nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid ID",
			id:             "invalid-uuid",
			filePath:       "file1.json",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid id",
		},
		{
			name:           "missing file_path",
			id:             agentSkills.ID.String(),
			filePath:       "",
			setup:          func(svc *MockAgentSkillsService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "file_path is required",
		},
		{
			name:     "file not found",
			id:       agentSkills.ID.String(),
			filePath: "non-existent.json",
			setup: func(svc *MockAgentSkillsService) {
				svc.On("GetByID", mock.Anything, projectID, agentSkills.ID).Return(agentSkills, nil)
				svc.On("GetPresignedURL", mock.Anything, agentSkills, "non-existent.json", mock.Anything).Return("", errors.New("file not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockAgentSkillsService{}
			tt.setup(mockService)
			handler := NewAgentSkillsHandler(mockService)

			router := setupAgentSkillsRouter()
			router.GET("/agent_skills/:id/file", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.GetAgentSkillsFileURL(c)
			})

			url := "/agent_skills/" + tt.id + "/file"
			if tt.filePath != "" {
				url += "?file_path=" + tt.filePath
			}
			req := httptest.NewRequest("GET", url, nil)
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
