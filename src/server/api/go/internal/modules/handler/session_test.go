package handler

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

// MockSessionService is a mock implementation of SessionService
type MockSessionService struct {
	mock.Mock
}

func (m *MockSessionService) Create(ctx context.Context, s *model.Session) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSessionService) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID) error {
	args := m.Called(ctx, projectID, sessionID)
	return args.Error(0)
}

func (m *MockSessionService) UpdateByID(ctx context.Context, s *model.Session) error {
	args := m.Called(ctx, s)
	return args.Error(0)
}

func (m *MockSessionService) GetByID(ctx context.Context, s *model.Session) (*model.Session, error) {
	args := m.Called(ctx, s)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}

func (m *MockSessionService) StoreMessage(ctx context.Context, in service.StoreMessageInput) (*model.Message, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Message), args.Error(1)
}

func (m *MockSessionService) GetMessages(ctx context.Context, in service.GetMessagesInput) (*service.GetMessagesOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetMessagesOutput), args.Error(1)
}

func (m *MockSessionService) List(ctx context.Context, in service.ListSessionsInput) (*service.ListSessionsOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListSessionsOutput), args.Error(1)
}

func (m *MockSessionService) GetAllMessages(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Message), args.Error(1)
}

func setupSessionRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

// getMockSessionCoreClient returns a mock CoreClient for testing
func getMockSessionCoreClient() *httpclient.CoreClient {
	// Create a minimal CoreClient with invalid URL
	// This will cause network errors when called, which is expected in tests
	return &httpclient.CoreClient{
		BaseURL:    "http://invalid-test-url:99999",
		HTTPClient: &http.Client{},
	}
}

func TestSessionHandler_GetSessions(t *testing.T) {
	projectID := uuid.New()
	spaceID := uuid.New()

	tests := []struct {
		name           string
		queryParams    string
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:        "successful sessions retrieval - all sessions",
			queryParams: "",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.ListSessionsOutput{
					Items: []model.Session{
						{
							ID:        uuid.New(),
							ProjectID: projectID,
							Configs:   datatypes.JSONMap{"temperature": 0.7},
						},
						{
							ID:        uuid.New(),
							ProjectID: projectID,
							Configs:   datatypes.JSONMap{"model": "gpt-4"},
						},
					},
					HasMore: false,
				}
				svc.On("List", mock.Anything, mock.Anything).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful sessions retrieval - filter by space_id",
			queryParams: "?space_id=" + spaceID.String(),
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.ListSessionsOutput{
					Items: []model.Session{
						{
							ID:        uuid.New(),
							ProjectID: projectID,
							SpaceID:   &spaceID,
							Configs:   datatypes.JSONMap{},
						},
					},
					HasMore: false,
				}
				svc.On("List", mock.Anything, mock.Anything).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful sessions retrieval - not connected",
			queryParams: "?not_connected=true",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.ListSessionsOutput{
					Items: []model.Session{
						{
							ID:        uuid.New(),
							ProjectID: projectID,
							SpaceID:   nil,
							Configs:   datatypes.JSONMap{},
						},
					},
					HasMore: false,
				}
				svc.On("List", mock.Anything, mock.Anything).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "empty sessions list",
			queryParams: "",
			setup: func(svc *MockSessionService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListSessionsOutput{Items: []model.Session{}, HasMore: false}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "invalid space_id",
			queryParams: "?space_id=invalid-uuid",
			setup: func(svc *MockSessionService) {
				// No service call expected
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:        "service layer error",
			queryParams: "",
			setup: func(svc *MockSessionService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.GET("/session", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.GetSessions(c)
			})

			req := httptest.NewRequest("GET", "/session"+tt.queryParams, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_CreateSession(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name           string
		requestBody    CreateSessionReq
		setup          func(*MockSessionService)
		expectedStatus int
		expectedError  bool
	}{
		{
			name: "successful session creation",
			requestBody: CreateSessionReq{
				Configs: map[string]interface{}{
					"temperature": 0.7,
					"max_tokens":  1000,
				},
			},
			setup: func(svc *MockSessionService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ProjectID == projectID
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "session creation with space ID",
			requestBody: CreateSessionReq{
				SpaceID: uuid.New().String(),
				Configs: map[string]interface{}{
					"model": "gpt-4",
				},
			},
			setup: func(svc *MockSessionService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ProjectID == projectID && s.SpaceID != nil
				})).Return(nil)
			},
			expectedStatus: http.StatusCreated,
			expectedError:  false,
		},
		{
			name: "invalid space ID",
			requestBody: CreateSessionReq{
				SpaceID: "invalid-uuid",
				Configs: map[string]interface{}{},
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
			expectedError:  true,
		},
		{
			name: "service layer error",
			requestBody: CreateSessionReq{
				Configs: map[string]interface{}{},
			},
			setup: func(svc *MockSessionService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
			expectedError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.POST("/session", func(c *gin.Context) {
				// Simulate middleware setting project information
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.CreateSession(c)
			})

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/session", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_DeleteSession(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:           "successful session deletion",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				svc.On("Delete", mock.Anything, projectID, sessionID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "service layer error",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				svc.On("Delete", mock.Anything, projectID, sessionID).Return(errors.New("deletion failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.DELETE("/session/:session_id", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.DeleteSession(c)
			})

			req := httptest.NewRequest("DELETE", "/session/"+tt.sessionIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_UpdateConfigs(t *testing.T) {
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		requestBody    UpdateSessionConfigsReq
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:           "successful config update",
			sessionIDParam: sessionID.String(),
			requestBody: UpdateSessionConfigsReq{
				Configs: map[string]interface{}{
					"temperature": 0.8,
					"max_tokens":  2000,
				},
			},
			setup: func(svc *MockSessionService) {
				svc.On("UpdateByID", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			requestBody: UpdateSessionConfigsReq{
				Configs: map[string]interface{}{},
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "service layer error",
			sessionIDParam: sessionID.String(),
			requestBody: UpdateSessionConfigsReq{
				Configs: map[string]interface{}{},
			},
			setup: func(svc *MockSessionService) {
				svc.On("UpdateByID", mock.Anything, mock.Anything).Return(errors.New("update failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.PUT("/session/:session_id/configs", handler.UpdateConfigs)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("PUT", "/session/"+tt.sessionIDParam+"/configs", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_GetConfigs(t *testing.T) {
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:           "successful config retrieval",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				expectedSession := &model.Session{
					ID:      sessionID,
					Configs: datatypes.JSONMap{"temperature": 0.7},
				}
				svc.On("GetByID", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(expectedSession, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "service layer error",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				svc.On("GetByID", mock.Anything, mock.Anything).Return(nil, errors.New("session not found"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.GET("/session/:session_id/configs", handler.GetConfigs)

			req := httptest.NewRequest("GET", "/session/"+tt.sessionIDParam+"/configs", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_ConnectToSpace(t *testing.T) {
	sessionID := uuid.New()
	spaceID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		requestBody    ConnectToSpaceReq
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:           "successful space connection",
			sessionIDParam: sessionID.String(),
			requestBody: ConnectToSpaceReq{
				SpaceID: spaceID.String(),
			},
			setup: func(svc *MockSessionService) {
				svc.On("UpdateByID", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID && s.SpaceID != nil && *s.SpaceID == spaceID
				})).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			requestBody: ConnectToSpaceReq{
				SpaceID: spaceID.String(),
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid space ID",
			sessionIDParam: sessionID.String(),
			requestBody: ConnectToSpaceReq{
				SpaceID: "invalid-uuid",
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "service layer error",
			sessionIDParam: sessionID.String(),
			requestBody: ConnectToSpaceReq{
				SpaceID: spaceID.String(),
			},
			setup: func(svc *MockSessionService) {
				svc.On("UpdateByID", mock.Anything, mock.Anything).Return(errors.New("connection failed"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.POST("/session/:session_id/connect_to_space", handler.ConnectToSpace)

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/session/"+tt.sessionIDParam+"/connect_to_space", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_StoreMessage(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		requestBody    map[string]interface{}
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		// Acontext format tests
		{
			name:           "acontext format - successful text message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "acontext",
				"blob": map[string]interface{}{
					"role": "user",
					"parts": []map[string]interface{}{
						{
							"type": "text",
							"text": "Hello, world!",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "acontext format - assistant with tool-call",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "acontext",
				"blob": map[string]interface{}{
					"role": "assistant",
					"parts": []map[string]interface{}{
						{
							"type": "tool-call",
							"meta": map[string]interface{}{
								"id":        "call_123",
								"name":      "get_weather",       // UNIFIED FORMAT: was "tool_name", now "name"
								"arguments": "{\"city\":\"SF\"}", // UNIFIED FORMAT: JSON string
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "acontext format - user with tool-result",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "acontext",
				"blob": map[string]interface{}{
					"role": "user",
					"parts": []map[string]interface{}{
						{
							"type": "tool-result",
							"text": "The weather is sunny, 72°F",
							"meta": map[string]interface{}{
								"tool_call_id": "call_123",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},

		// OpenAI format tests
		{
			name:           "openai format - successful text message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role":    "user",
					"content": "Hello from OpenAI format!",
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - multipart content with text and image",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "What's in this image?",
						},
						{
							"type": "image_url",
							"image_url": map[string]interface{}{
								"url":    "https://example.com/image.jpg",
								"detail": "high",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - assistant with tool_calls",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "assistant",
					"tool_calls": []map[string]interface{}{
						{
							"id":   "call_abc123",
							"type": "function",
							"function": map[string]interface{}{
								"name":      "get_weather",
								"arguments": `{"city":"San Francisco"}`,
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - assistant with multiple tool_calls",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "assistant",
					"tool_calls": []map[string]interface{}{
						{
							"id":   "call_1",
							"type": "function",
							"function": map[string]interface{}{
								"name":      "get_weather",
								"arguments": `{"city":"San Francisco"}`,
							},
						},
						{
							"id":   "call_2",
							"type": "function",
							"function": map[string]interface{}{
								"name":      "get_weather",
								"arguments": `{"city":"New York"}`,
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - assistant with content and tool_calls",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role":    "assistant",
					"content": "Let me check the weather for you.",
					"tool_calls": []map[string]interface{}{
						{
							"id":   "call_abc123",
							"type": "function",
							"function": map[string]interface{}{
								"name":      "get_weather",
								"arguments": `{"city":"San Francisco"}`,
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - vision with url source (similar to Anthropic docs)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "image_url",
							"image_url": map[string]interface{}{
								"url": "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg",
							},
						},
						{
							"type": "text",
							"text": "What is in the above image?",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - vision with base64 data (similar to Anthropic docs)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "image_url",
							"image_url": map[string]interface{}{
								"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
							},
						},
						{
							"type": "text",
							"text": "Describe this image",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - function call (legacy, similar to tool_calls)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "assistant",
					"function_call": map[string]interface{}{
						"name":      "get_weather",
						"arguments": `{"city":"Boston"}`,
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - file with base64 data",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "file",
							"file": map[string]interface{}{
								"file_data": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkcyBbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94IFswIDAgMzAgMzBdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDEyIFRmCjEwIDEwIFRkCihUZXN0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMjEgMDAwMDAgbiAKMDAwMDAwMDIzOSAwMDAwMCBuIAowMDAwMDAwMzE5IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDExCiUlRU9G",
								"filename":  "test.pdf",
							},
						},
						{
							"type": "text",
							"text": "What's in this PDF?",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - file with file_id",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "file",
							"file": map[string]interface{}{
								"file_id": "file-abc123",
							},
						},
						{
							"type": "text",
							"text": "Analyze this file",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - user with input_audio",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "What's in this audio?",
						},
						{
							"type": "input_audio",
							"input_audio": map[string]interface{}{
								"data":   "base64_encoded_audio_data",
								"format": "wav",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - user with image detail level",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Describe this image in detail",
						},
						{
							"type": "image_url",
							"image_url": map[string]interface{}{
								"url":    "https://example.com/high-res-image.jpg",
								"detail": "high", // or "low", "auto"
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - function message (legacy)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role":    "function",
					"name":    "get_weather",
					"content": `{"temperature": 72, "condition": "sunny"}`,
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user", // function messages convert to user role
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - assistant with empty content and tool_calls",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "assistant",
					"tool_calls": []map[string]interface{}{
						{
							"id":   "call_123",
							"type": "function",
							"function": map[string]interface{}{
								"name":      "get_weather",
								"arguments": `{"city":"Boston"}`,
							},
						},
					},
					// content is null or empty when only tool_calls present
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - tool message with result",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role":         "tool",
					"content":      "Sunny, 72°F",
					"tool_call_id": "call_abc123",
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user", // tool role converts to user
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - missing content field should fail",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role": "user",
					// missing content field
				},
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},

		// Anthropic format tests
		{
			name:           "anthropic format - successful text message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Hello from Anthropic format!",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - image with url source (similar to docs)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "image",
							"source": map[string]interface{}{
								"type": "url",
								"url":  "https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg",
							},
						},
						{
							"type": "text",
							"text": "What is in the above image?",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - image with base64 source (from docs)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "image",
							"source": map[string]interface{}{
								"type":       "base64",
								"media_type": "image/jpeg",
								"data":       "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
							},
						},
						{
							"type": "text",
							"text": "Describe this image",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - document (PDF) with base64 source",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "document",
							"source": map[string]interface{}{
								"type":       "base64",
								"media_type": "application/pdf",
								"data":       "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3==",
							},
						},
						{
							"type": "text",
							"text": "Summarize this document",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - tool_use message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "assistant",
					"content": []map[string]interface{}{
						{
							"type": "tool_use",
							"id":   "toolu_abc123",
							"name": "get_weather",
							"input": map[string]interface{}{
								"city": "San Francisco",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - multiple tool_use in one message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "assistant",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "I'll check the weather in both cities.",
						},
						{
							"type": "tool_use",
							"id":   "toolu_1",
							"name": "get_weather",
							"input": map[string]interface{}{
								"city": "San Francisco",
							},
						},
						{
							"type": "tool_use",
							"id":   "toolu_2",
							"name": "get_weather",
							"input": map[string]interface{}{
								"city": "New York",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - tool_result message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type":        "tool_result",
							"tool_use_id": "toolu_abc123",
							"content":     "Sunny, 72°F",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - tool_result with text content",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type":        "tool_result",
							"tool_use_id": "toolu_abc123",
							"content": []map[string]interface{}{
								{
									"type": "text",
									"text": "The weather is sunny, 72°F",
								},
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - missing content field should fail",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					// missing content field
				},
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},

		// Anthropic Prompt Caching tests (based on official docs)
		{
			name:           "anthropic format - text with cache_control (from docs)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "You are an AI assistant tasked with analyzing literary works.",
						},
						{
							"type": "text",
							"text": "<the entire contents of Pride and Prejudice>",
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify cache_control is extracted
					if len(in.Parts) >= 2 {
						secondPart := in.Parts[1]
						if secondPart.Meta != nil {
							if cacheControl, ok := secondPart.Meta["cache_control"].(map[string]interface{}); ok {
								return cacheControl["type"] == "ephemeral"
							}
						}
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - image with cache_control",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "What is in this image?",
						},
						{
							"type": "image",
							"source": map[string]interface{}{
								"type":       "base64",
								"media_type": "image/jpeg",
								"data":       "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
							},
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify image with cache_control
					if len(in.Parts) >= 2 {
						imagePart := in.Parts[1]
						if imagePart.Type == "image" && imagePart.Meta != nil {
							if cacheControl, ok := imagePart.Meta["cache_control"].(map[string]interface{}); ok {
								return cacheControl["type"] == "ephemeral"
							}
						}
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - tool_use with cache_control",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "assistant",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Let me check the weather.",
						},
						{
							"type": "tool_use",
							"id":   "toolu_cache_123",
							"name": "get_weather",
							"input": map[string]interface{}{
								"city": "San Francisco",
							},
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "assistant",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify tool-call (unified from tool_use) with cache_control
					if len(in.Parts) >= 2 {
						toolPart := in.Parts[1]
						// UNIFIED FORMAT: Anthropic tool_use is now normalized to "tool-call"
						if toolPart.Type == "tool-call" && toolPart.Meta != nil {
							if cacheControl, ok := toolPart.Meta["cache_control"].(map[string]interface{}); ok {
								return cacheControl["type"] == "ephemeral"
							}
						}
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - tool_result with cache_control",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type":        "tool_result",
							"tool_use_id": "toolu_cache_123",
							"content":     "Temperature: 72°F, Condition: Sunny",
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify tool_result with cache_control
					if len(in.Parts) > 0 {
						toolResultPart := in.Parts[0]
						if toolResultPart.Type == "tool-result" && toolResultPart.Meta != nil {
							if cacheControl, ok := toolResultPart.Meta["cache_control"].(map[string]interface{}); ok {
								return cacheControl["type"] == "ephemeral"
							}
						}
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - document with cache_control",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Please analyze this document.",
						},
						{
							"type": "document",
							"source": map[string]interface{}{
								"type":       "base64",
								"media_type": "application/pdf",
								"data":       "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3==",
							},
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify document with cache_control
					if len(in.Parts) >= 2 {
						docPart := in.Parts[1]
						if docPart.Type == "file" && docPart.Meta != nil {
							if cacheControl, ok := docPart.Meta["cache_control"].(map[string]interface{}); ok {
								return cacheControl["type"] == "ephemeral"
							}
						}
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - multiple cache breakpoints (from docs)",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "System instructions here",
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
						{
							"type": "text",
							"text": "RAG context documents",
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
						{
							"type": "text",
							"text": "Conversation history",
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
						{
							"type": "text",
							"text": "Current user question",
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify multiple cache breakpoints (max 4 according to docs)
					if len(in.Parts) == 4 {
						cacheCount := 0
						for i := 0; i < 3; i++ {
							if in.Parts[i].Meta != nil {
								if _, ok := in.Parts[i].Meta["cache_control"]; ok {
									cacheCount++
								}
							}
						}
						return cacheCount == 3
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "anthropic format - mixed content with selective caching",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "anthropic",
				"blob": map[string]interface{}{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Small instruction (not cached)",
						},
						{
							"type": "text",
							"text": "Large context that should be cached for reuse",
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
						{
							"type": "image",
							"source": map[string]interface{}{
								"type": "url",
								"url":  "https://example.com/large-diagram.png",
							},
							"cache_control": map[string]interface{}{
								"type": "ephemeral",
							},
						},
					},
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					// Verify selective caching: first part no cache, others with cache
					if len(in.Parts) == 3 {
						noCacheFirst := in.Parts[0].Meta == nil || in.Parts[0].Meta["cache_control"] == nil
						hasCacheSecond := in.Parts[1].Meta != nil && in.Parts[1].Meta["cache_control"] != nil
						hasCacheThird := in.Parts[2].Meta != nil && in.Parts[2].Meta["cache_control"] != nil
						return noCacheFirst && hasCacheSecond && hasCacheThird
					}
					return false
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},

		// Default format (OpenAI) test
		{
			name:           "default format (openai) - text message without format specified",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"blob": map[string]interface{}{
					"role":    "user",
					"content": "Hello, default format!",
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},

		// Error cases
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			requestBody: map[string]interface{}{
				"blob": map[string]interface{}{
					"role":    "user",
					"content": "Hello",
				},
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid format",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "invalid_format",
				"blob": map[string]interface{}{
					"role":    "user",
					"content": "Hello",
				},
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "missing blob field",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
			},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "service layer error",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"blob": map[string]interface{}{
					"role":    "user",
					"content": "Hello",
				},
			},
			setup: func(svc *MockSessionService) {
				svc.On("StoreMessage", mock.Anything, mock.Anything).Return(nil, errors.New("store failed"))
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.POST("/session/:session_id/messages", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.StoreMessage(c)
			})

			body, _ := sonic.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/session/"+tt.sessionIDParam+"/messages", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_GetMessages(t *testing.T) {
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		queryParams    string
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:           "successful message retrieval",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			queryParams:    "?limit=20",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "limit=0 retrieves all messages",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=0",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 0
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "service layer error",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			setup: func(svc *MockSessionService) {
				svc.On("GetMessages", mock.Anything, mock.Anything).Return(nil, errors.New("retrieval failed"))
			},
			expectedStatus: http.StatusBadRequest,
		},

		// Additional edge cases and error scenarios for GetMessages
		{
			name:           "limit exceeds maximum (201)",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=201",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "negative limit",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=-1",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "zero limit retrieves all messages",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=0",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 0
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid limit format (non-numeric)",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=abc",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid format parameter",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&format=invalid_format",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "with_asset_public_url with invalid boolean",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&with_asset_public_url=maybe",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "acontext format conversion",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&format=acontext",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "anthropic format conversion",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&format=anthropic",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "pagination with cursor",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&cursor=eyJpZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCJ9",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore:    true,
					NextCursor: "eyJpZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMSJ9",
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.Cursor == "eyJpZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCJ9"
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with_asset_public_url false",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&with_asset_public_url=false",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.WithAssetPublicURL == false
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "with_asset_public_url true (default)",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&with_asset_public_url=true",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.WithAssetPublicURL == true
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "no limit parameter retrieves all messages",
			sessionIDParam: sessionID.String(),
			queryParams:    "",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 0 // no limit means fetch all
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "empty messages list",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items:   []model.Message{},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "time_desc=false (default)",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&time_desc=false",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.TimeDesc == false
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "time_desc=true",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&time_desc=true",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.TimeDesc == true
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "time_desc with cursor",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&cursor=eyJjcmVhdGVkX2F0IjoiMjAyNC0wMS0wMVQwMDowMDowMFoiLCJpZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMCJ9&time_desc=false",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore:    true,
					NextCursor: "eyJjcmVhdGVkX2F0IjoiMjAyNC0wMS0wMVQwMDowMDowMFoiLCJpZCI6IjEyM2U0NTY3LWU4OWItMTJkMy1hNDU2LTQyNjYxNDE3NDAwMSJ9",
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.TimeDesc == false && in.Cursor != ""
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "time_desc with format conversion",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&time_desc=true&format=acontext",
			setup: func(svc *MockSessionService) {
				expectedOutput := &service.GetMessagesOutput{
					Items: []model.Message{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Role:      "user",
						},
					},
					HasMore: false,
				}
				svc.On("GetMessages", mock.Anything, mock.MatchedBy(func(in service.GetMessagesInput) bool {
					return in.SessionID == sessionID && in.Limit == 20 && in.TimeDesc == true
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid time_desc parameter",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20&time_desc=invalid",
			setup: func(svc *MockSessionService) {
				// No service call expected
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.GET("/session/:session_id/messages", handler.GetMessages)

			req := httptest.NewRequest("GET", "/session/"+tt.sessionIDParam+"/messages"+tt.queryParams, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_StoreMessage_Multipart(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		payload        string
		files          map[string]string // field name -> file content
		setup          func(*MockSessionService)
		expectedStatus int
	}{
		{
			name:           "successful multipart message with file",
			sessionIDParam: sessionID.String(),
			payload: `{
				"format": "openai",
				"blob": {
					"role": "user",
					"content": [
						{
							"type": "text",
							"text": "Please analyze this file"
						},
						{
							"type": "image_url",
							"image_url": {
								"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
							},
							"file_field": "image_file"
						}
					]
				}
			}`,
			files: map[string]string{
				"image_file": "fake image content",
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user" && len(in.Parts) > 0
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "multipart with invalid JSON payload",
			sessionIDParam: sessionID.String(),
			payload:        "invalid json",
			files:          map[string]string{},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "multipart with image without file_field (now allowed)",
			sessionIDParam: sessionID.String(),
			payload: `{
				"format": "openai",
				"blob": {
					"role": "user",
					"content": [
						{
							"type": "image_url",
							"image_url": {
								"url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
							}
						}
					]
				}
			}`,
			files: map[string]string{},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "multipart with empty payload",
			sessionIDParam: sessionID.String(),
			payload:        "",
			files:          map[string]string{},
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "multipart with acontext format and file",
			sessionIDParam: sessionID.String(),
			payload: `{
				"format": "acontext",
				"blob": {
					"role": "user",
					"parts": [
						{
							"type": "text",
							"text": "Please analyze this file"
						},
						{
							"type": "image",
							"file_field": "document_file"
						}
					]
				}
			}`,
			files: map[string]string{
				"document_file": "fake document content",
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user" && len(in.Parts) > 0
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "multipart with anthropic format and file",
			sessionIDParam: sessionID.String(),
			payload: `{
				"format": "anthropic",
				"blob": {
					"role": "user",
					"content": [
						{
							"type": "text",
							"text": "Please analyze this file"
						},
						{
							"type": "image",
							"source": {
								"type": "base64",
								"media_type": "image/jpeg",
								"data": "base64data..."
							},
							"file_field": "image_file"
						}
					]
				}
			}`,
			files: map[string]string{
				"image_file": "fake image content",
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "user",
				}
				svc.On("StoreMessage", mock.Anything, mock.MatchedBy(func(in service.StoreMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "user" && len(in.Parts) > 0
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.POST("/session/:session_id/messages", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.StoreMessage(c)
			})

			// Create multipart form data
			var buf bytes.Buffer
			writer := multipart.NewWriter(&buf)

			// Add payload field
			if tt.payload != "" {
				payloadField, _ := writer.CreateFormField("payload")
				payloadField.Write([]byte(tt.payload))
			}

			// Add files
			for fieldName, content := range tt.files {
				fileField, _ := writer.CreateFormFile(fieldName, "test_file.txt")
				fileField.Write([]byte(content))
			}

			writer.Close()

			req := httptest.NewRequest("POST", "/session/"+tt.sessionIDParam+"/messages", &buf)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_StoreMessage_InvalidJSON(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	t.Run("invalid JSON in request body", func(t *testing.T) {
		mockService := &MockSessionService{}
		// No setup needed as the request should fail before reaching the service

		handler := NewSessionHandler(mockService, getMockSessionCoreClient())
		router := setupSessionRouter()
		router.POST("/session/:session_id/messages", func(c *gin.Context) {
			project := &model.Project{ID: projectID}
			c.Set("project", project)
			handler.StoreMessage(c)
		})

		// Post invalid JSON directly
		req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBufferString("invalid json"))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		mockService.AssertExpectations(t)
	})
}

// TestOpenAI_ToolCalls_FieldPreservation 测试OpenAI tool_calls字段是否在往返过程中保留
func TestOpenAI_ToolCalls_FieldPreservation(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 创建包含 tool-call 的消息（内部格式）
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "assistant",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "openai",
			"name":          "assistant_bot",
		}),
		Parts: []model.Part{
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_abc123",
					"name":      "get_weather",
					"arguments": `{"city":"San Francisco"}`,
					"type":      "function",
				},
			},
		},
	}

	// Mock StoreMessage
	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)

	// Mock GetMessages
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store OpenAI format message with name and tool_calls
	storeBody := map[string]interface{}{
		"format": "openai",
		"blob": map[string]interface{}{
			"role": "assistant",
			"name": "assistant_bot",
			"tool_calls": []map[string]interface{}{
				{
					"id":   "call_abc123",
					"type": "function",
					"function": map[string]interface{}{
						"name":      "get_weather",
						"arguments": `{"city":"San Francisco"}`,
					},
				},
			},
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, "Store message should succeed")

	// Step 2: Get messages in OpenAI format
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=openai"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "Get messages should succeed")

	// Step 3: Parse and verify response
	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data, ok := response["data"].(map[string]interface{})
	require.True(t, ok, "Should have data field")

	items, ok := data["items"].([]interface{})
	require.True(t, ok, "Should have items array")
	require.Len(t, items, 1, "Should have 1 message")

	msg := items[0].(map[string]interface{})
	t.Logf("Message fields: %+v", msg)

	// 验证字段
	assert.Equal(t, "assistant", msg["role"], "Role should be preserved")

	// 测试 1: Message-level name 字段
	if name, exists := msg["name"]; exists {
		assert.Equal(t, "assistant_bot", name, "✅ Message name preserved")
	} else {
		t.Error("❌ FIELD LOST: Message-level 'name' field is missing")
	}

	// 测试 2: tool_calls 字段
	if toolCalls, exists := msg["tool_calls"]; exists {
		toolCallsArray, ok := toolCalls.([]interface{})
		require.True(t, ok, "tool_calls should be an array")
		require.Len(t, toolCallsArray, 1, "Should have 1 tool call")

		toolCall := toolCallsArray[0].(map[string]interface{})

		// 测试 3: tool_call.id
		if id, exists := toolCall["id"]; exists {
			assert.Equal(t, "call_abc123", id, "✅ Tool call ID preserved")
		} else {
			t.Error("❌ FIELD LOST: tool_call 'id' field is missing")
		}

		// 测试 4: tool_call.type
		if typ, exists := toolCall["type"]; exists {
			assert.Equal(t, "function", typ, "✅ Tool call type preserved")
		} else {
			t.Error("❌ FIELD LOST: tool_call 'type' field is missing")
		}

		// 测试 5: tool_call.function.name and arguments
		if function, exists := toolCall["function"]; exists {
			funcMap := function.(map[string]interface{})

			if name, exists := funcMap["name"]; exists {
				assert.Equal(t, "get_weather", name, "✅ Function name preserved")
			} else {
				t.Error("❌ FIELD LOST: function 'name' field is missing")
			}

			if args, exists := funcMap["arguments"]; exists {
				assert.Contains(t, args, "San Francisco", "✅ Function arguments preserved")
			} else {
				t.Error("❌ FIELD LOST: function 'arguments' field is missing")
			}
		} else {
			t.Error("❌ FIELD LOST: tool_call 'function' field is missing")
		}
	} else {
		t.Error("❌ FIELD LOST: Message-level 'tool_calls' field is missing")
	}

	mockService.AssertExpectations(t)
}

// TestOpenAIToAnthropic_FieldMapping 测试 OpenAI → Anthropic 转换时的字段映射
func TestOpenAIToAnthropic_FieldMapping(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 创建包含 tool-call 的消息（内部统一格式）
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "assistant",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "openai",
		}),
		Parts: []model.Part{
			{
				Type: "text",
				Text: "I'll help you with that.",
			},
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_def456",
					"name":      "search_database",
					"arguments": `{"query":"users","limit":10}`,
					"type":      "function",
				},
			},
		},
	}

	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store OpenAI format message
	storeBody := map[string]interface{}{
		"format": "openai",
		"blob": map[string]interface{}{
			"role":    "assistant",
			"content": "I'll help you with that.",
			"tool_calls": []map[string]interface{}{
				{
					"id":   "call_def456",
					"type": "function",
					"function": map[string]interface{}{
						"name":      "search_database",
						"arguments": `{"query":"users","limit":10}`,
					},
				},
			},
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Step 2: Get messages in Anthropic format
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=anthropic"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data := response["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	msg := items[0].(map[string]interface{})

	t.Logf("Message fields: %+v", msg)

	// 验证 OpenAI tool_calls 是否正确转换为 Anthropic content blocks
	if content, exists := msg["content"]; exists {
		contentArray := content.([]interface{})
		require.Len(t, contentArray, 2, "Should have text block and tool_use block")

		// 第一个应该是 text block
		textBlock := contentArray[0].(map[string]interface{})
		assert.Equal(t, "text", textBlock["type"], "✅ First block is text")
		assert.Equal(t, "I'll help you with that.", textBlock["text"], "✅ Text content preserved")

		// 第二个应该是 tool_use block
		toolBlock := contentArray[1].(map[string]interface{})
		assert.Equal(t, "tool_use", toolBlock["type"], "✅ OpenAI tool_call → Anthropic tool_use")
		assert.Equal(t, "call_def456", toolBlock["id"], "✅ OpenAI tool_call.id → Anthropic tool_use.id")
		assert.Equal(t, "search_database", toolBlock["name"], "✅ OpenAI function.name → Anthropic tool_use.name")

		// 验证 input 字段
		if input, exists := toolBlock["input"]; exists {
			inputMap := input.(map[string]interface{})
			assert.Equal(t, "users", inputMap["query"], "✅ OpenAI arguments → Anthropic input")
			assert.Equal(t, float64(10), inputMap["limit"], "✅ Arguments fields correctly parsed")
		} else {
			t.Error("❌ FIELD LOST: Anthropic tool_use 'input' field is missing")
		}
	} else {
		t.Error("❌ FIELD LOST: Anthropic 'content' field is missing")
	}

	mockService.AssertExpectations(t)
}

// TestAnthropicToOpenAI_FieldMapping 测试 Anthropic → OpenAI 转换时的字段映射
func TestAnthropicToOpenAI_FieldMapping(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 创建包含 tool-call 的消息（内部统一格式）
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "assistant",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "anthropic",
		}),
		Parts: []model.Part{
			{
				Type: "text",
				Text: "Let me check the weather.",
			},
			{
				Type: "tool-call", // 统一格式：Anthropic tool_use 存储为 tool-call
				Meta: map[string]any{
					"id":        "toolu_xyz789",
					"name":      "get_weather",       // 统一格式：使用 name
					"arguments": `{"city":"Boston"}`, // 统一格式：使用 JSON 字符串
					"type":      "tool_use",          // 存储原始类型
				},
			},
		},
	}

	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store Anthropic format message
	storeBody := map[string]interface{}{
		"format": "anthropic",
		"blob": map[string]interface{}{
			"role": "assistant",
			"content": []map[string]interface{}{
				{
					"type": "text",
					"text": "Let me check the weather.",
				},
				{
					"type":  "tool_use",
					"id":    "toolu_xyz789",
					"name":  "get_weather",
					"input": map[string]interface{}{"city": "Boston"},
				},
			},
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Step 2: Get messages in OpenAI format
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=openai"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data := response["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	msg := items[0].(map[string]interface{})

	t.Logf("Message fields: %+v", msg)

	// 验证 Anthropic tool_use 是否正确转换为 OpenAI tool_calls
	if toolCalls, exists := msg["tool_calls"]; exists {
		toolCallsArray := toolCalls.([]interface{})
		toolCall := toolCallsArray[0].(map[string]interface{})

		assert.Equal(t, "toolu_xyz789", toolCall["id"], "✅ Anthropic tool_use.id → OpenAI tool_call.id")
		assert.Equal(t, "function", toolCall["type"], "✅ OpenAI tool_call.type should be 'function'")

		function := toolCall["function"].(map[string]interface{})
		assert.Equal(t, "get_weather", function["name"], "✅ Anthropic tool_use.name → OpenAI function.name")
		assert.Contains(t, function["arguments"], "Boston", "✅ Anthropic tool_use.input → OpenAI function.arguments")
	} else {
		t.Error("❌ FIELD LOST: Anthropic tool_use not converted to OpenAI tool_calls")
	}

	mockService.AssertExpectations(t)
}

// TestToolResult_OpenAIToAnthropic 测试 OpenAI tool message → Anthropic tool_result 转换
func TestToolResult_OpenAIToAnthropic(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 内部格式：tool-result
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "user",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "openai",
		}),
		Parts: []model.Part{
			{
				Type: "tool-result",
				Text: "Weather: 72°F, Sunny",
				Meta: map[string]any{
					"tool_call_id": "call_weather_123", // 统一格式
				},
			},
		},
	}

	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store OpenAI tool message
	storeBody := map[string]interface{}{
		"format": "openai",
		"blob": map[string]interface{}{
			"role":         "tool",
			"content":      "Weather: 72°F, Sunny",
			"tool_call_id": "call_weather_123",
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Step 2: Get messages in Anthropic format
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=anthropic"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data := response["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	msg := items[0].(map[string]interface{})

	t.Logf("Message fields: %+v", msg)

	// OpenAI tool role 应该转换为 Anthropic user role
	assert.Equal(t, "user", msg["role"], "✅ OpenAI tool role → Anthropic user role")

	// 验证 content 包含 tool_result block
	if content, exists := msg["content"]; exists {
		contentArray := content.([]interface{})
		require.Len(t, contentArray, 1, "Should have 1 tool_result block")

		toolResultBlock := contentArray[0].(map[string]interface{})
		assert.Equal(t, "tool_result", toolResultBlock["type"], "✅ Content type is tool_result")
		assert.Equal(t, "call_weather_123", toolResultBlock["tool_use_id"], "✅ tool_call_id → tool_use_id")

		// Anthropic tool_result content can be string or content blocks array
		if resultContent, exists := toolResultBlock["content"]; exists {
			// Check if it's content blocks array (which is what we get)
			if contentBlocks, ok := resultContent.([]interface{}); ok {
				require.Len(t, contentBlocks, 1, "Should have 1 content block")
				textBlock := contentBlocks[0].(map[string]interface{})
				assert.Equal(t, "text", textBlock["type"], "✅ Content block is text type")
				assert.Equal(t, "Weather: 72°F, Sunny", textBlock["text"], "✅ Content text preserved")
			} else {
				// Or it might be a simple string (also valid)
				assert.Equal(t, "Weather: 72°F, Sunny", resultContent, "✅ Content preserved as string")
			}
		} else {
			t.Error("❌ FIELD LOST: tool_result 'content' field is missing")
		}
	} else {
		t.Error("❌ FIELD LOST: Anthropic 'content' field is missing")
	}

	mockService.AssertExpectations(t)
}

// TestToolResult_AnthropicToOpenAI 测试 Anthropic tool_result → OpenAI tool message 转换
func TestToolResult_AnthropicToOpenAI(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 内部格式：tool-result
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "user",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "anthropic",
		}),
		Parts: []model.Part{
			{
				Type: "tool-result",
				Text: "Database query returned 5 results",
				Meta: map[string]any{
					"tool_call_id": "toolu_result_456", // 统一格式
					"is_error":     false,
				},
			},
		},
	}

	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store Anthropic tool_result
	storeBody := map[string]interface{}{
		"format": "anthropic",
		"blob": map[string]interface{}{
			"role": "user",
			"content": []map[string]interface{}{
				{
					"type":        "tool_result",
					"tool_use_id": "toolu_result_456",
					"content":     "Database query returned 5 results",
				},
			},
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Step 2: Get messages in OpenAI format
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=openai"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data := response["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	msg := items[0].(map[string]interface{})

	t.Logf("Message fields: %+v", msg)

	// Anthropic user role with tool_result 应该转换为 OpenAI tool role
	assert.Equal(t, "tool", msg["role"], "✅ Anthropic user+tool_result → OpenAI tool role")
	assert.Equal(t, "toolu_result_456", msg["tool_call_id"], "✅ tool_use_id → tool_call_id")
	assert.Equal(t, "Database query returned 5 results", msg["content"], "✅ Content preserved")

	mockService.AssertExpectations(t)
}

// TestAnthropic_CacheControl_Preservation 测试 Anthropic cache_control 保留
func TestAnthropic_CacheControl_Preservation(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 内部格式：包含 cache_control 的 parts
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "user",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "anthropic",
		}),
		Parts: []model.Part{
			{
				Type: "text",
				Text: "System instructions here",
				Meta: map[string]any{
					"cache_control": map[string]interface{}{
						"type": "ephemeral",
					},
				},
			},
			{
				Type: "text",
				Text: "User question",
				Meta: map[string]any{}, // No cache_control
			},
		},
	}

	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store Anthropic message with cache_control
	storeBody := map[string]interface{}{
		"format": "anthropic",
		"blob": map[string]interface{}{
			"role": "user",
			"content": []map[string]interface{}{
				{
					"type": "text",
					"text": "System instructions here",
					"cache_control": map[string]interface{}{
						"type": "ephemeral",
					},
				},
				{
					"type": "text",
					"text": "User question",
				},
			},
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Step 2: Get messages in Anthropic format (round-trip)
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=anthropic"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data := response["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	msg := items[0].(map[string]interface{})

	t.Logf("Message fields: %+v", msg)

	// 验证 cache_control 保留
	if content, exists := msg["content"]; exists {
		contentArray := content.([]interface{})
		require.Len(t, contentArray, 2, "Should have 2 content blocks")

		// 第一个 block 应该有 cache_control
		block1 := contentArray[0].(map[string]interface{})
		if cacheControl, exists := block1["cache_control"]; exists {
			ccMap := cacheControl.(map[string]interface{})
			assert.Equal(t, "ephemeral", ccMap["type"], "✅ cache_control preserved in first block")
		} else {
			t.Error("❌ FIELD LOST: cache_control missing in first block")
		}

		// 第二个 block 不应该有 cache_control
		block2 := contentArray[1].(map[string]interface{})
		assert.Nil(t, block2["cache_control"], "✅ Second block correctly has no cache_control")
	}

	mockService.AssertExpectations(t)
}

// TestMultipleToolCalls_Conversion 测试多个 tool_calls 的转换
func TestMultipleToolCalls_Conversion(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	mockService := &MockSessionService{}

	// 内部格式：多个 tool-call
	expectedMessage := &model.Message{
		ID:        uuid.New(),
		SessionID: sessionID,
		Role:      "assistant",
		Meta: datatypes.NewJSONType(map[string]any{
			"source_format": "openai",
		}),
		Parts: []model.Part{
			{
				Type: "text",
				Text: "I'll check both cities.",
			},
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_1",
					"name":      "get_weather",
					"arguments": `{"city":"SF"}`,
					"type":      "function",
				},
			},
			{
				Type: "tool-call",
				Meta: map[string]any{
					"id":        "call_2",
					"name":      "get_weather",
					"arguments": `{"city":"NYC"}`,
					"type":      "function",
				},
			},
		},
	}

	mockService.On("StoreMessage", mock.Anything, mock.Anything).Return(expectedMessage, nil)
	mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
		Items:   []model.Message{*expectedMessage},
		HasMore: false,
	}, nil)

	handler := NewSessionHandler(mockService, getMockSessionCoreClient())
	router := setupSessionRouter()

	router.POST("/session/:session_id/messages", func(c *gin.Context) {
		project := &model.Project{ID: projectID}
		c.Set("project", project)
		handler.StoreMessage(c)
	})
	router.GET("/session/:session_id/messages", handler.GetMessages)

	// Step 1: Store OpenAI message with multiple tool_calls
	storeBody := map[string]interface{}{
		"format": "openai",
		"blob": map[string]interface{}{
			"role":    "assistant",
			"content": "I'll check both cities.",
			"tool_calls": []map[string]interface{}{
				{
					"id":   "call_1",
					"type": "function",
					"function": map[string]interface{}{
						"name":      "get_weather",
						"arguments": `{"city":"SF"}`,
					},
				},
				{
					"id":   "call_2",
					"type": "function",
					"function": map[string]interface{}{
						"name":      "get_weather",
						"arguments": `{"city":"NYC"}`,
					},
				},
			},
		},
	}

	storeBodyBytes, _ := sonic.Marshal(storeBody)
	req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(storeBodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Step 2: Get messages in Anthropic format
	getURL := "/session/" + sessionID.String() + "/messages?limit=20&format=anthropic"
	req = httptest.NewRequest("GET", getURL, nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	t.Log("Response body:", w.Body.String())

	var response map[string]interface{}
	err := sonic.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	data := response["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	msg := items[0].(map[string]interface{})

	t.Logf("Message fields: %+v", msg)

	// 验证多个 tool_calls 转换为多个 tool_use blocks
	if content, exists := msg["content"]; exists {
		contentArray := content.([]interface{})
		require.Len(t, contentArray, 3, "Should have 1 text + 2 tool_use blocks")

		// 第一个是 text
		assert.Equal(t, "text", contentArray[0].(map[string]interface{})["type"], "✅ First block is text")

		// 第二个和第三个是 tool_use
		toolUse1 := contentArray[1].(map[string]interface{})
		assert.Equal(t, "tool_use", toolUse1["type"], "✅ Second block is tool_use")
		assert.Equal(t, "call_1", toolUse1["id"], "✅ First tool_use ID preserved")
		assert.Equal(t, "get_weather", toolUse1["name"], "✅ First tool_use name preserved")

		toolUse2 := contentArray[2].(map[string]interface{})
		assert.Equal(t, "tool_use", toolUse2["type"], "✅ Third block is tool_use")
		assert.Equal(t, "call_2", toolUse2["id"], "✅ Second tool_use ID preserved")
		assert.Equal(t, "get_weather", toolUse2["name"], "✅ Second tool_use name preserved")
	} else {
		t.Error("❌ FIELD LOST: Multiple tool_calls not properly converted")
	}

	mockService.AssertExpectations(t)
}

func TestSessionHandler_GetTokenCounts(t *testing.T) {
	sessionID := uuid.New()

	// Initialize tokenizer for testing with a test logger
	testLogger, _ := zap.NewDevelopment()
	_ = tokenizer.Init(testLogger)

	tests := []struct {
		name           string
		sessionIDParam string
		setup          func(*MockSessionService)
		expectedStatus int
		expectedTokens int
	}{
		{
			name:           "successful token count retrieval",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				messages := []model.Message{
					{
						ID:        uuid.New(),
						SessionID: sessionID,
						Role:      "user",
						Parts: []model.Part{
							{
								Type: "text",
								Text: "Hello, world!",
							},
						},
					},
					{
						ID:        uuid.New(),
						SessionID: sessionID,
						Role:      "assistant",
						Parts: []model.Part{
							{
								Type: "text",
								Text: "How can I help you?",
							},
						},
					},
				}
				svc.On("GetAllMessages", mock.Anything, sessionID).Return(messages, nil)
			},
			expectedStatus: http.StatusOK,
			expectedTokens: 8, // Approximate token count for "Hello, world!\nHow can I help you?\n"
		},
		{
			name:           "token count with tool-call",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				messages := []model.Message{
					{
						ID:        uuid.New(),
						SessionID: sessionID,
						Role:      "assistant",
						Parts: []model.Part{
							{
								Type: "tool-call",
								Meta: map[string]interface{}{
									"name":      "get_weather",
									"arguments": `{"city":"San Francisco"}`,
									"id":        "call_123",
								},
							},
						},
					},
				}
				svc.On("GetAllMessages", mock.Anything, sessionID).Return(messages, nil)
			},
			expectedStatus: http.StatusOK,
			expectedTokens: 20, // Approximate token count for tool-call meta JSON
		},
		{
			name:           "token count with mixed content",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				messages := []model.Message{
					{
						ID:        uuid.New(),
						SessionID: sessionID,
						Role:      "user",
						Parts: []model.Part{
							{
								Type: "text",
								Text: "What's the weather?",
							},
						},
					},
					{
						ID:        uuid.New(),
						SessionID: sessionID,
						Role:      "assistant",
						Parts: []model.Part{
							{
								Type: "text",
								Text: "Let me check.",
							},
							{
								Type: "tool-call",
								Meta: map[string]interface{}{
									"name":      "get_weather",
									"arguments": `{"location":"SF"}`,
								},
							},
						},
					},
				}
				svc.On("GetAllMessages", mock.Anything, sessionID).Return(messages, nil)
			},
			expectedStatus: http.StatusOK,
			expectedTokens: 20, // Approximate token count
		},
		{
			name:           "empty messages",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				svc.On("GetAllMessages", mock.Anything, sessionID).Return([]model.Message{}, nil)
			},
			expectedStatus: http.StatusOK,
			expectedTokens: 0,
		},
		{
			name:           "messages with only non-text parts (images, etc.)",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				messages := []model.Message{
					{
						ID:        uuid.New(),
						SessionID: sessionID,
						Role:      "user",
						Parts: []model.Part{
							{
								Type: "image",
								Asset: &model.Asset{
									SHA256: "abc123",
									S3Key:  "images/test.jpg",
								},
							},
						},
					},
				}
				svc.On("GetAllMessages", mock.Anything, sessionID).Return(messages, nil)
			},
			expectedStatus: http.StatusOK,
			expectedTokens: 0, // Images don't contribute to token count
		},
		{
			name:           "invalid session ID",
			sessionIDParam: "invalid-uuid",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "service layer error - failed to get messages",
			sessionIDParam: sessionID.String(),
			setup: func(svc *MockSessionService) {
				svc.On("GetAllMessages", mock.Anything, sessionID).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService, getMockSessionCoreClient())
			router := setupSessionRouter()
			router.GET("/session/:session_id/token_counts", handler.GetTokenCounts)

			req := httptest.NewRequest("GET", "/session/"+tt.sessionIDParam+"/token_counts", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)

			// If successful, verify token count in response
			if tt.expectedStatus == http.StatusOK {
				var response map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)

				data, ok := response["data"].(map[string]interface{})
				require.True(t, ok, "Should have data field")

				totalTokens, ok := data["total_tokens"].(float64)
				require.True(t, ok, "Should have total_tokens field")

				// Token count may vary slightly, so we check it's a reasonable value
				if tt.expectedTokens > 0 {
					assert.Greater(t, int(totalTokens), 0, "Token count should be greater than 0")
				} else {
					assert.Equal(t, 0, int(totalTokens), "Token count should be 0 for empty messages")
				}
			}
		})
	}
}
