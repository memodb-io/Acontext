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
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
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

func (m *MockSessionService) SendMessage(ctx context.Context, in service.SendMessageInput) (*model.Message, error) {
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

func (m *MockSessionService) List(ctx context.Context, projectID uuid.UUID, spaceID *uuid.UUID, notConnected bool) ([]model.Session, error) {
	args := m.Called(ctx, projectID, spaceID, notConnected)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Session), args.Error(1)
}

func setupSessionRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
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
				expectedSessions := []model.Session{
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
				}
				svc.On("List", mock.Anything, projectID, (*uuid.UUID)(nil), false).Return(expectedSessions, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful sessions retrieval - filter by space_id",
			queryParams: "?space_id=" + spaceID.String(),
			setup: func(svc *MockSessionService) {
				expectedSessions := []model.Session{
					{
						ID:        uuid.New(),
						ProjectID: projectID,
						SpaceID:   &spaceID,
						Configs:   datatypes.JSONMap{},
					},
				}
				svc.On("List", mock.Anything, projectID, &spaceID, false).Return(expectedSessions, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful sessions retrieval - not connected",
			queryParams: "?not_connected=true",
			setup: func(svc *MockSessionService) {
				expectedSessions := []model.Session{
					{
						ID:        uuid.New(),
						ProjectID: projectID,
						SpaceID:   nil,
						Configs:   datatypes.JSONMap{},
					},
				}
				svc.On("List", mock.Anything, projectID, (*uuid.UUID)(nil), true).Return(expectedSessions, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "empty sessions list",
			queryParams: "",
			setup: func(svc *MockSessionService) {
				svc.On("List", mock.Anything, projectID, (*uuid.UUID)(nil), false).Return([]model.Session{}, nil)
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
				svc.On("List", mock.Anything, projectID, (*uuid.UUID)(nil), false).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService)
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

			handler := NewSessionHandler(mockService)
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

			handler := NewSessionHandler(mockService)
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

			handler := NewSessionHandler(mockService)
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

			handler := NewSessionHandler(mockService)
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

			handler := NewSessionHandler(mockService)
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

func TestSessionHandler_SendMessage(t *testing.T) {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
								"tool_name": "get_weather",
								"arguments": map[string]interface{}{"city": "SF"},
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
				})).Return(expectedMessage, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "openai format - system message",
			sessionIDParam: sessionID.String(),
			requestBody: map[string]interface{}{
				"format": "openai",
				"blob": map[string]interface{}{
					"role":    "system",
					"content": "You are a helpful assistant that speaks like a pirate.",
				},
			},
			setup: func(svc *MockSessionService) {
				expectedMessage := &model.Message{
					ID:        uuid.New(),
					SessionID: sessionID,
					Role:      "system",
				}
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "system"
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.Role == "assistant"
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
					// Verify tool_use with cache_control
					if len(in.Parts) >= 2 {
						toolPart := in.Parts[1]
						if toolPart.Type == "tool-use" && toolPart.Meta != nil {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.Anything).Return(nil, errors.New("send failed"))
			},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}
			tt.setup(mockService)

			handler := NewSessionHandler(mockService)
			router := setupSessionRouter()
			router.POST("/session/:session_id/messages", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.SendMessage(c)
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
			name:           "invalid limit parameter",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=0",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
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
			name:           "zero limit",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=0",
			setup:          func(svc *MockSessionService) {},
			expectedStatus: http.StatusBadRequest,
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
			name:           "default limit when not specified",
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
					return in.SessionID == sessionID && in.Limit == 20 // default limit
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

			handler := NewSessionHandler(mockService)
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
func TestSessionHandler_CrossFormatConversion(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sendFormat     string
		sendBody       map[string]interface{}
		getFormat      string
		expectedStatus int
	}{
		// OpenAI → Anthropic conversion
		{
			name:       "send openai text, get anthropic format",
			sendFormat: "openai",
			sendBody: map[string]interface{}{
				"role":    "user",
				"content": "Hello from OpenAI!",
			},
			getFormat:      "anthropic",
			expectedStatus: http.StatusOK,
		},
		{
			name:       "send openai multipart with image, get anthropic format",
			sendFormat: "openai",
			sendBody: map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": "What's in this image?"},
					{
						"type": "image_url",
						"image_url": map[string]interface{}{
							"url": "https://example.com/image.jpg",
						},
					},
				},
			},
			getFormat:      "anthropic",
			expectedStatus: http.StatusOK,
		},

		// Anthropic → OpenAI conversion
		{
			name:       "send anthropic text, get openai format",
			sendFormat: "anthropic",
			sendBody: map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{"type": "text", "text": "Hello from Anthropic!"},
				},
			},
			getFormat:      "openai",
			expectedStatus: http.StatusOK,
		},
		{
			name:       "send anthropic with cache_control, get openai format",
			sendFormat: "anthropic",
			sendBody: map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": "Large cached content",
						"cache_control": map[string]interface{}{
							"type": "ephemeral",
						},
					},
				},
			},
			getFormat:      "openai",
			expectedStatus: http.StatusOK,
		},

		// Acontext → OpenAI conversion
		{
			name:       "send acontext format, get openai format",
			sendFormat: "acontext",
			sendBody: map[string]interface{}{
				"role": "user",
				"parts": []map[string]interface{}{
					{"type": "text", "text": "Hello from Acontext!"},
				},
			},
			getFormat:      "openai",
			expectedStatus: http.StatusOK,
		},

		// Acontext → Anthropic conversion
		{
			name:       "send acontext format, get anthropic format",
			sendFormat: "acontext",
			sendBody: map[string]interface{}{
				"role": "assistant",
				"parts": []map[string]interface{}{
					{
						"type": "tool-call",
						"meta": map[string]interface{}{
							"id":        "call_123",
							"tool_name": "get_weather",
							"arguments": map[string]interface{}{"city": "SF"},
						},
					},
				},
			},
			getFormat:      "anthropic",
			expectedStatus: http.StatusOK,
		},

		// OpenAI → Acontext conversion
		{
			name:       "send openai assistant with tool_calls, get acontext format",
			sendFormat: "openai",
			sendBody: map[string]interface{}{
				"role": "assistant",
				"tool_calls": []map[string]interface{}{
					{
						"id":   "call_abc",
						"type": "function",
						"function": map[string]interface{}{
							"name":      "get_weather",
							"arguments": `{"city":"NYC"}`,
						},
					},
				},
			},
			getFormat:      "acontext",
			expectedStatus: http.StatusOK,
		},

		// Anthropic → Acontext conversion
		{
			name:       "send anthropic with cache_control, get acontext format",
			sendFormat: "anthropic",
			sendBody: map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": "System instructions",
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
			getFormat:      "acontext",
			expectedStatus: http.StatusOK,
		},

		// Tool use cross-format tests
		{
			name:       "send anthropic tool_use, get openai format",
			sendFormat: "anthropic",
			sendBody: map[string]interface{}{
				"role": "assistant",
				"content": []map[string]interface{}{
					{
						"type": "tool_use",
						"id":   "toolu_123",
						"name": "get_weather",
						"input": map[string]interface{}{
							"city": "Boston",
						},
					},
				},
			},
			getFormat:      "openai",
			expectedStatus: http.StatusOK,
		},
		{
			name:       "send openai tool message, get anthropic format",
			sendFormat: "openai",
			sendBody: map[string]interface{}{
				"role":         "tool",
				"content":      "Weather: 72°F",
				"tool_call_id": "call_123",
			},
			getFormat:      "anthropic",
			expectedStatus: http.StatusOK,
		},

		// Vision content cross-format tests
		{
			name:       "send anthropic image, get openai format",
			sendFormat: "anthropic",
			sendBody: map[string]interface{}{
				"role": "user",
				"content": []map[string]interface{}{
					{
						"type": "image",
						"source": map[string]interface{}{
							"type":       "base64",
							"media_type": "image/jpeg",
							"data":       "base64data...",
						},
					},
					{"type": "text", "text": "Describe this"},
				},
			},
			getFormat:      "openai",
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockSessionService{}

			// Create a realistic message with parts based on the send body
			expectedMessage := &model.Message{
				ID:        uuid.New(),
				SessionID: sessionID,
				Role:      "user",
				Parts: []model.Part{
					{
						Type: "text",
						Text: "Hello test message",
					},
				},
			}

			// Adjust parts based on send format and body
			if role, ok := tt.sendBody["role"].(string); ok {
				expectedMessage.Role = role
			}

			// Mock SendMessage - capture the actual parts
			mockService.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
				if in.ProjectID == projectID && in.SessionID == sessionID {
					// Update expectedMessage parts with what was actually sent
					if len(in.Parts) > 0 {
						expectedMessage.Parts = []model.Part{}
						for _, part := range in.Parts {
							expectedMessage.Parts = append(expectedMessage.Parts, model.Part{
								Type: part.Type,
								Text: part.Text,
								Meta: part.Meta,
							})
						}
					}
					return true
				}
				return false
			})).Return(expectedMessage, nil)

			// Mock GetMessages
			mockService.On("GetMessages", mock.Anything, mock.Anything).Return(&service.GetMessagesOutput{
				Items:   []model.Message{*expectedMessage},
				HasMore: false,
			}, nil)

			handler := NewSessionHandler(mockService)
			router := setupSessionRouter()

			// Setup routes
			router.POST("/session/:session_id/messages", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.SendMessage(c)
			})
			router.GET("/session/:session_id/messages", handler.GetMessages)

			// Step 1: Send message
			sendReq := map[string]interface{}{
				"format": tt.sendFormat,
				"blob":   tt.sendBody,
			}
			if tt.sendFormat == "" {
				sendReq = map[string]interface{}{"blob": tt.sendBody}
			}

			sendBody, _ := sonic.Marshal(sendReq)
			req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBuffer(sendBody))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusCreated, w.Code)

			// Step 2: Get messages with different format
			getURL := "/session/" + sessionID.String() + "/messages?limit=20"
			if tt.getFormat != "" {
				getURL += "&format=" + tt.getFormat
			}
			req = httptest.NewRequest("GET", getURL, nil)
			w = httptest.NewRecorder()
			router.ServeHTTP(w, req)
			assert.Equal(t, tt.expectedStatus, w.Code, "Get request should succeed with cross-format conversion")

			mockService.AssertExpectations(t)
		})
	}
}

func TestSessionHandler_SendMessage_Multipart(t *testing.T) {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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
				svc.On("SendMessage", mock.Anything, mock.MatchedBy(func(in service.SendMessageInput) bool {
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

			handler := NewSessionHandler(mockService)
			router := setupSessionRouter()
			router.POST("/session/:session_id/messages", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.SendMessage(c)
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

func TestSessionHandler_SendMessage_InvalidJSON(t *testing.T) {
	projectID := uuid.New()
	sessionID := uuid.New()

	t.Run("invalid JSON in request body", func(t *testing.T) {
		mockService := &MockSessionService{}
		// No setup needed as the request should fail before reaching the service

		handler := NewSessionHandler(mockService)
		router := setupSessionRouter()
		router.POST("/session/:session_id/messages", func(c *gin.Context) {
			project := &model.Project{ID: projectID}
			c.Set("project", project)
			handler.SendMessage(c)
		})

		// Send invalid JSON directly
		req := httptest.NewRequest("POST", "/session/"+sessionID.String()+"/messages", bytes.NewBufferString("invalid json"))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		mockService.AssertExpectations(t)
	})
}
