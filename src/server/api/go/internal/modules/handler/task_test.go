package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type MockTaskService struct {
	mock.Mock
}

func (m *MockTaskService) GetTasks(ctx context.Context, in service.GetTasksInput) (*service.GetTasksOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetTasksOutput), args.Error(1)
}

// MockSessionRepo implements repo.SessionRepo for testing
type MockSessionRepo struct {
	mock.Mock
}

var _ repo.SessionRepo = (*MockSessionRepo)(nil)

func (m *MockSessionRepo) Create(ctx context.Context, s *model.Session) error {
	return m.Called(ctx, s).Error(0)
}
func (m *MockSessionRepo) Delete(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, userKEK []byte) error {
	return m.Called(ctx, projectID, sessionID, userKEK).Error(0)
}
func (m *MockSessionRepo) Update(ctx context.Context, s *model.Session) error {
	return m.Called(ctx, s).Error(0)
}
func (m *MockSessionRepo) Get(ctx context.Context, s *model.Session) (*model.Session, error) {
	args := m.Called(ctx, s)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Session), args.Error(1)
}
func (m *MockSessionRepo) GetDisableTaskTracking(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
}
func (m *MockSessionRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByConfigs map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Session, error) {
	args := m.Called(ctx, projectID, userIdentifier, filterByConfigs, afterCreatedAt, afterID, limit, timeDesc)
	return args.Get(0).([]model.Session), args.Error(1)
}
func (m *MockSessionRepo) CreateMessageWithAssets(ctx context.Context, msg *model.Message) error {
	return m.Called(ctx, msg).Error(0)
}
func (m *MockSessionRepo) ListBySessionWithCursor(ctx context.Context, sessionID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]model.Message, error) {
	args := m.Called(ctx, sessionID, afterCreatedAt, afterID, limit, timeDesc)
	return args.Get(0).([]model.Message), args.Error(1)
}
func (m *MockSessionRepo) ListAllMessagesBySession(ctx context.Context, sessionID uuid.UUID) ([]model.Message, error) {
	args := m.Called(ctx, sessionID)
	return args.Get(0).([]model.Message), args.Error(1)
}
func (m *MockSessionRepo) ListMessageBranchPath(ctx context.Context, sessionID uuid.UUID, messageID uuid.UUID) ([]model.Message, error) {
	args := m.Called(ctx, sessionID, messageID)
	return args.Get(0).([]model.Message), args.Error(1)
}
func (m *MockSessionRepo) GetObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.MessageObservingStatus), args.Error(1)
}
func (m *MockSessionRepo) PopGeminiCallIDAndName(ctx context.Context, sessionID uuid.UUID) (string, string, error) {
	args := m.Called(ctx, sessionID)
	return args.String(0), args.String(1), args.Error(2)
}
func (m *MockSessionRepo) GetMessageByID(ctx context.Context, sessionID uuid.UUID, messageID uuid.UUID) (*model.Message, error) {
	args := m.Called(ctx, sessionID, messageID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Message), args.Error(1)
}
func (m *MockSessionRepo) GetMessageByIDAnySession(ctx context.Context, messageID uuid.UUID) (*model.Message, error) {
	args := m.Called(ctx, messageID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Message), args.Error(1)
}
func (m *MockSessionRepo) UpdateMessageMeta(ctx context.Context, messageID uuid.UUID, meta datatypes.JSONType[map[string]interface{}]) error {
	return m.Called(ctx, messageID, meta).Error(0)
}
func (m *MockSessionRepo) CopySession(ctx context.Context, sessionID uuid.UUID, userKEK []byte) (*repo.CopySessionResult, error) {
	args := m.Called(ctx, sessionID, userKEK)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*repo.CopySessionResult), args.Error(1)
}
func (m *MockSessionRepo) HasUnfinishedMessages(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
}
func (m *MockSessionRepo) HasFailedMessages(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
}

func TestTaskHandler_GetTasks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	serializer.SetLogger(zap.NewNop())

	projectID := uuid.New()
	otherProjectID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		queryParams    string
		projectID      uuid.UUID
		setup          func(*MockTaskService, *MockSessionRepo)
		expectedStatus int
		checkResponse  func(*testing.T, *httptest.ResponseRecorder)
	}{
		{
			name:           "success - basic request",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			projectID:      projectID,
			setup: func(svc *MockTaskService, sessRepo *MockSessionRepo) {
				sessRepo.On("Get", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{ID: sessionID, ProjectID: projectID}, nil)

				expectedOutput := &service.GetTasksOutput{
					Items: []model.Task{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Status:    "pending",
						},
					},
					HasMore: false,
				}
				svc.On("GetTasks", mock.Anything, mock.MatchedBy(func(in service.GetTasksInput) bool {
					return in.SessionID == sessionID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, rec *httptest.ResponseRecorder) {
				var resp serializer.Response
				err := json.Unmarshal(rec.Body.Bytes(), &resp)
				assert.NoError(t, err)
				assert.Equal(t, 0, resp.Code)

				data, ok := resp.Data.(map[string]interface{})
				assert.True(t, ok)
				assert.False(t, data["has_more"].(bool))
				items := data["items"].([]interface{})
				assert.Len(t, items, 1)
			},
		},
		{
			name:           "success - with cursor",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=10&cursor=MTIzNDU2Nzg5MHxhYmNkZWZnaC1pamts",
			projectID:      projectID,
			setup: func(svc *MockTaskService, sessRepo *MockSessionRepo) {
				sessRepo.On("Get", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{ID: sessionID, ProjectID: projectID}, nil)

				expectedOutput := &service.GetTasksOutput{
					Items: []model.Task{
						{
							ID:        uuid.New(),
							SessionID: sessionID,
							Status:    "success",
						},
					},
					NextCursor: "OTg3NjU0MzIxMHxtbm9wcXJzdC11dnd4",
					HasMore:    true,
				}
				svc.On("GetTasks", mock.Anything, mock.MatchedBy(func(in service.GetTasksInput) bool {
					return in.SessionID == sessionID && in.Limit == 10 && in.Cursor == "MTIzNDU2Nzg5MHxhYmNkZWZnaC1pamts"
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, rec *httptest.ResponseRecorder) {
				var resp serializer.Response
				err := json.Unmarshal(rec.Body.Bytes(), &resp)
				assert.NoError(t, err)

				data, ok := resp.Data.(map[string]interface{})
				assert.True(t, ok)
				assert.True(t, data["has_more"].(bool))
				assert.NotEmpty(t, data["next_cursor"])
			},
		},
		{
			name:           "success - using default limit",
			sessionIDParam: sessionID.String(),
			queryParams:    "",
			projectID:      projectID,
			setup: func(svc *MockTaskService, sessRepo *MockSessionRepo) {
				sessRepo.On("Get", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{ID: sessionID, ProjectID: projectID}, nil)

				expectedOutput := &service.GetTasksOutput{
					Items:   []model.Task{},
					HasMore: false,
				}
				svc.On("GetTasks", mock.Anything, mock.MatchedBy(func(in service.GetTasksInput) bool {
					return in.SessionID == sessionID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "error - invalid session id",
			sessionIDParam: "invalid-uuid",
			queryParams:    "?limit=20",
			projectID:      projectID,
			setup:          func(svc *MockTaskService, sessRepo *MockSessionRepo) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - limit too high",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=300",
			projectID:      projectID,
			setup:          func(svc *MockTaskService, sessRepo *MockSessionRepo) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - limit too low",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=0",
			projectID:      projectID,
			setup:          func(svc *MockTaskService, sessRepo *MockSessionRepo) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - session not found",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			projectID:      projectID,
			setup: func(svc *MockTaskService, sessRepo *MockSessionRepo) {
				sessRepo.On("Get", mock.Anything, mock.Anything).Return(nil, gorm.ErrRecordNotFound)
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "error - IDOR: session belongs to different project",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			projectID:      otherProjectID,
			setup: func(svc *MockTaskService, sessRepo *MockSessionRepo) {
				sessRepo.On("Get", mock.Anything, mock.MatchedBy(func(s *model.Session) bool {
					return s.ID == sessionID
				})).Return(&model.Session{ID: sessionID, ProjectID: projectID}, nil)
			},
			expectedStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &MockTaskService{}
			sessRepo := &MockSessionRepo{}
			tt.setup(svc, sessRepo)

			handler := NewTaskHandler(svc, sessRepo)

			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			// Set project in context via middleware
			r.Use(func(c *gin.Context) {
				c.Set("project", &model.Project{ID: tt.projectID})
				c.Next()
			})
			r.GET("/session/:session_id/task", handler.GetTasks)

			req := httptest.NewRequest(http.MethodGet, "/session/"+tt.sessionIDParam+"/task"+tt.queryParams, nil)
			c.Request = req

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkResponse != nil {
				tt.checkResponse(t, w)
			}

			svc.AssertExpectations(t)
			sessRepo.AssertExpectations(t)
		})
	}
}
