package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
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

func (m *MockTaskService) UpdateTaskStatus(ctx context.Context, in service.UpdateTaskStatusInput) (*model.Task, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Task), args.Error(1)
}

func TestTaskHandler_GetTasks(t *testing.T) {
	gin.SetMode(gin.TestMode)
	serializer.SetLogger(zap.NewNop())

	sessionID := uuid.New()

	tests := []struct {
		name           string
		sessionIDParam string
		queryParams    string
		setup          func(*MockTaskService)
		expectedStatus int
		checkResponse  func(*testing.T, *httptest.ResponseRecorder)
	}{
		{
			name:           "success - basic request",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=20",
			setup: func(svc *MockTaskService) {
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
			setup: func(svc *MockTaskService) {
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
			setup: func(svc *MockTaskService) {
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
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - limit too high",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=300",
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - limit too low",
			sessionIDParam: sessionID.String(),
			queryParams:    "?limit=0",
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &MockTaskService{}
			tt.setup(svc)

			handler := NewTaskHandler(svc)

			w := httptest.NewRecorder()
			c, r := gin.CreateTestContext(w)

			r.GET("/session/:session_id/task", handler.GetTasks)

			req := httptest.NewRequest(http.MethodGet, "/session/"+tt.sessionIDParam+"/task"+tt.queryParams, nil)
			c.Request = req

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkResponse != nil {
				tt.checkResponse(t, w)
			}

			svc.AssertExpectations(t)
		})
	}
}

func TestTaskHandler_UpdateTaskStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	serializer.SetLogger(zap.NewNop())

	projectID := uuid.New()
	sessionID := uuid.New()
	taskID := uuid.New()

	project := &model.Project{ID: projectID}

	tests := []struct {
		name           string
		sessionIDParam string
		taskIDParam    string
		body           string
		setProject     bool
		setup          func(*MockTaskService)
		expectedStatus int
		checkResponse  func(*testing.T, *httptest.ResponseRecorder)
	}{
		{
			name:           "success - set status to success",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"success"}`,
			setProject:     true,
			setup: func(svc *MockTaskService) {
				svc.On("UpdateTaskStatus", mock.Anything, mock.MatchedBy(func(in service.UpdateTaskStatusInput) bool {
					return in.ProjectID == projectID && in.SessionID == sessionID && in.TaskID == taskID && in.Status == "success"
				})).Return(&model.Task{
					ID:        taskID,
					SessionID: sessionID,
					ProjectID: projectID,
					Status:    "success",
				}, nil)
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, rec *httptest.ResponseRecorder) {
				var resp serializer.Response
				err := json.Unmarshal(rec.Body.Bytes(), &resp)
				assert.NoError(t, err)
				assert.Equal(t, 0, resp.Code)

				data, ok := resp.Data.(map[string]interface{})
				assert.True(t, ok)
				assert.Equal(t, "success", data["status"])
			},
		},
		{
			name:           "success - set status to failed",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"failed"}`,
			setProject:     true,
			setup: func(svc *MockTaskService) {
				svc.On("UpdateTaskStatus", mock.Anything, mock.MatchedBy(func(in service.UpdateTaskStatusInput) bool {
					return in.Status == "failed"
				})).Return(&model.Task{
					ID:        taskID,
					SessionID: sessionID,
					ProjectID: projectID,
					Status:    "failed",
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "success - set status to running",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"running"}`,
			setProject:     true,
			setup: func(svc *MockTaskService) {
				svc.On("UpdateTaskStatus", mock.Anything, mock.MatchedBy(func(in service.UpdateTaskStatusInput) bool {
					return in.Status == "running"
				})).Return(&model.Task{
					ID:        taskID,
					SessionID: sessionID,
					ProjectID: projectID,
					Status:    "running",
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "success - set status to pending",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"pending"}`,
			setProject:     true,
			setup: func(svc *MockTaskService) {
				svc.On("UpdateTaskStatus", mock.Anything, mock.MatchedBy(func(in service.UpdateTaskStatusInput) bool {
					return in.Status == "pending"
				})).Return(&model.Task{
					ID:        taskID,
					SessionID: sessionID,
					ProjectID: projectID,
					Status:    "pending",
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "error - invalid status value",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"completed"}`,
			setProject:     true,
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - missing status",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{}`,
			setProject:     true,
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - invalid session_id",
			sessionIDParam: "not-a-uuid",
			taskIDParam:    taskID.String(),
			body:           `{"status":"success"}`,
			setProject:     true,
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - invalid task_id",
			sessionIDParam: sessionID.String(),
			taskIDParam:    "not-a-uuid",
			body:           `{"status":"success"}`,
			setProject:     true,
			setup:          func(svc *MockTaskService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - task not found",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"success"}`,
			setProject:     true,
			setup: func(svc *MockTaskService) {
				svc.On("UpdateTaskStatus", mock.Anything, mock.Anything).
					Return(nil, assert.AnError)
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "error - task not found returns 404",
			sessionIDParam: sessionID.String(),
			taskIDParam:    taskID.String(),
			body:           `{"status":"success"}`,
			setProject:     true,
			setup: func(svc *MockTaskService) {
				svc.On("UpdateTaskStatus", mock.Anything, mock.Anything).
					Return(nil, assert.AnError).Run(func(args mock.Arguments) {})
				svc.ExpectedCalls[0].ReturnArguments = mock.Arguments{(*model.Task)(nil), fmt.Errorf("task not found or does not belong to this session")}
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &MockTaskService{}
			tt.setup(svc)

			handler := NewTaskHandler(svc)

			w := httptest.NewRecorder()
			_, r := gin.CreateTestContext(w)

			r.PATCH("/session/:session_id/task/:task_id/status", func(c *gin.Context) {
				if tt.setProject {
					c.Set("project", project)
				}
				handler.UpdateTaskStatus(c)
			})

			req := httptest.NewRequest(http.MethodPatch, "/session/"+tt.sessionIDParam+"/task/"+tt.taskIDParam+"/status",
				strings.NewReader(tt.body))
			req.Header.Set("Content-Type", "application/json")

			r.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkResponse != nil {
				tt.checkResponse(t, w)
			}

			svc.AssertExpectations(t)
		})
	}
}
