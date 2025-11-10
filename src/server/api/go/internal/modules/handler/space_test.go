package handler

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/datatypes"
)

// MockSpaceService is a mock implementation of SpaceService
type MockSpaceService struct {
	mock.Mock
}

func (m *MockSpaceService) Create(ctx context.Context, s *model.Space) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSpaceService) Delete(ctx context.Context, projectID uuid.UUID, spaceID uuid.UUID) error {
	args := m.Called(ctx, projectID, spaceID)
	return args.Error(0)
}

func (m *MockSpaceService) UpdateByID(ctx context.Context, s *model.Space) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSpaceService) GetByID(ctx context.Context, s *model.Space) (*model.Space, error) {
	args := m.Called(ctx, s)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Space), args.Error(1)
}

func (m *MockSpaceService) List(ctx context.Context, in service.ListSpacesInput) (*service.ListSpacesOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListSpacesOutput), args.Error(1)
}

func setupSpaceRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func TestSpaceHandler_GetSpaces(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name           string
		setup          func(*MockSpaceService)
		expectedStatus int
	}{
		{
			name: "successful spaces retrieval",
			setup: func(svc *MockSpaceService) {
				expectedOutput := &service.ListSpacesOutput{
					Items: []model.Space{
						{
							ID:        uuid.New(),
							ProjectID: projectID,
							Configs:   datatypes.JSONMap{"theme": "dark"},
						},
						{
							ID:        uuid.New(),
							ProjectID: projectID,
							Configs:   datatypes.JSONMap{"language": "zh-CN"},
						},
					},
					HasMore: false,
				}
				svc.On("List", mock.Anything, mock.Anything).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "empty spaces list",
			setup: func(svc *MockSpaceService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListSpacesOutput{Items: []model.Space{}, HasMore: false}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "service layer error",
			setup: func(svc *MockSpaceService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSpaceService{}
			tt.setup(mockService)

			handler := NewSpaceHandler(mockService)
			router := setupSpaceRouter()
			router.GET("/space", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.GetSpaces(c)
			})

			req := httptest.NewRequest("GET", "/space", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSpaceHandler_CreateSpace(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name           string
		requestBody    CreateSpaceReq
		setup          func(*MockSpaceService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "successful space creation",
			requestBody: CreateSpaceReq{
				Configs: map[string]interface{}{
					"theme":    "dark",
					"language": "zh-CN",
				},
			},
			setup: func(svc *MockSpaceService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(s *model.Space) bool {
					return s.ProjectID == projectID
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "empty config space creation",
			requestBody: CreateSpaceReq{
				Configs: map[string]interface{}{},
			},
			setup: func(svc *MockSpaceService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(s *model.Space) bool {
					return s.ProjectID == projectID
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "service layer error",
			requestBody: CreateSpaceReq{
				Configs: map[string]interface{}{},
			},
			setup: func(svc *MockSpaceService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSpaceService{}
			tt.setup(mockService)

			handler := NewSpaceHandler(mockService)
			router := setupSpaceRouter()
			router.POST("/space", func(c *gin.Context) {
				// Simulate middleware setting project information
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.CreateSpace(c)
			})

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSpaceHandler_DeleteSpace(t *testing.T) {
	projectID := uuid.New()
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		setup          func(*MockSpaceService)
		expectedStatus int
	}{
		{
			name:         "successful space deletion",
			spaceIDParam: spaceID.String(),
			setup: func(svc *MockSpaceService) {
				svc.On("Delete", mock.Anything, projectID, spaceID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			setup:          func(svc *MockSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			setup: func(svc *MockSpaceService) {
				svc.On("Delete", mock.Anything, projectID, spaceID).Return(errors.New("deletion failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSpaceService{}
			tt.setup(mockService)

			handler := NewSpaceHandler(mockService)
			router := setupSpaceRouter()
			router.DELETE("/space/:space_id", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.DeleteSpace(c)
			})

			req := httptest.NewRequest("DELETE", "/space/"+tt.spaceIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSpaceHandler_UpdateConfigs(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    UpdateSpaceConfigsReq
		setup          func(*MockSpaceService)
		expectedStatus int
	}{
		{
			name:         "successful config update",
			spaceIDParam: spaceID.String(),
			requestBody: UpdateSpaceConfigsReq{
				Configs: map[string]interface{}{
					"theme":     "light",
					"font_size": 14,
				},
			},
			setup: func(svc *MockSpaceService) {
				svc.On("UpdateByID", mock.Anything, mock.MatchedBy(func(s *model.Space) bool {
					return s.ID == spaceID
				})).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			requestBody:    UpdateSpaceConfigsReq{Configs: map[string]interface{}{}},
			setup:          func(svc *MockSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			requestBody:  UpdateSpaceConfigsReq{Configs: map[string]interface{}{}},
			setup: func(svc *MockSpaceService) {
				svc.On("UpdateByID", mock.Anything, mock.Anything).Return(errors.New("update failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSpaceService{}
			tt.setup(mockService)

			handler := NewSpaceHandler(mockService)
			router := setupSpaceRouter()
			router.PUT("/space/:space_id/configs", handler.UpdateConfigs)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", "/space/"+tt.spaceIDParam+"/configs", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSpaceHandler_GetConfigs(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		setup          func(*MockSpaceService)
		expectedStatus int
	}{
		{
			name:         "successful config retrieval",
			spaceIDParam: spaceID.String(),
			setup: func(svc *MockSpaceService) {
				expectedSpace := &model.Space{
					ID:      spaceID,
					Configs: datatypes.JSONMap{"theme": "dark"},
				}
				svc.On("GetByID", mock.Anything, mock.MatchedBy(func(s *model.Space) bool {
					return s.ID == spaceID
				})).Return(expectedSpace, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			setup:          func(svc *MockSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "service layer error",
			spaceIDParam: spaceID.String(),
			setup: func(svc *MockSpaceService) {
				svc.On("GetByID", mock.Anything, mock.Anything).Return(nil, errors.New("space not found"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSpaceService{}
			tt.setup(mockService)

			handler := NewSpaceHandler(mockService)
			router := setupSpaceRouter()
			router.GET("/space/:space_id/configs", handler.GetConfigs)

			req := httptest.NewRequest("GET", "/space/"+tt.spaceIDParam+"/configs", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSpaceHandler_GetSemanticAnswer(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    GetSemanticAnswerReq
		expectedStatus int
	}{
		{
			name:         "successful semantic answer retrieval",
			spaceIDParam: spaceID.String(),
			requestBody: GetSemanticAnswerReq{
				Query: "What is artificial intelligence?",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			requestBody:    GetSemanticAnswerReq{Query: "test"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty query",
			spaceIDParam:   spaceID.String(),
			requestBody:    GetSemanticAnswerReq{Query: ""},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewSpaceHandler(&MockSpaceService{})
			router := setupSpaceRouter()
			router.POST("/space/:space_id/semantic_answer", handler.GetSemanticAnswer)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/semantic_answer", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestSpaceHandler_GetSemanticGlobal(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    GetSemanticGlobalReq
		expectedStatus int
	}{
		{
			name:         "successful global semantic retrieval",
			spaceIDParam: spaceID.String(),
			requestBody: GetSemanticGlobalReq{
				Query: "global search test",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			requestBody:    GetSemanticGlobalReq{Query: "test"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty query",
			spaceIDParam:   spaceID.String(),
			requestBody:    GetSemanticGlobalReq{Query: ""},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewSpaceHandler(&MockSpaceService{})
			router := setupSpaceRouter()
			router.POST("/space/:space_id/semantic_global", handler.GetSemanticGlobal)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/semantic_global", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}

func TestSpaceHandler_GetSemanticGrep(t *testing.T) {
	spaceID := uuid.New()

	tests := []struct {
		name           string
		spaceIDParam   string
		requestBody    GetSemanticGrepReq
		expectedStatus int
	}{
		{
			name:         "successful semantic grep retrieval",
			spaceIDParam: spaceID.String(),
			requestBody: GetSemanticGrepReq{
				Query: "grep search test",
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space ID",
			spaceIDParam:   "invalid-uuid",
			requestBody:    GetSemanticGrepReq{Query: "test"},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "empty query",
			spaceIDParam:   spaceID.String(),
			requestBody:    GetSemanticGrepReq{Query: ""},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := NewSpaceHandler(&MockSpaceService{})
			router := setupSpaceRouter()
			router.POST("/space/:space_id/semantic_grep", handler.GetSemanticGrep)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/space/"+tt.spaceIDParam+"/semantic_grep", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}
