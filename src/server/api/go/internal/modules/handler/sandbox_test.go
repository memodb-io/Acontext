package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/httpclient"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/serializer"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

type MockSandboxLogService struct {
	mock.Mock
}

func (m *MockSandboxLogService) GetSandboxLogs(ctx context.Context, in service.GetSandboxLogsInput) (*service.GetSandboxLogsOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetSandboxLogsOutput), args.Error(1)
}

func TestSandboxHandler_GetSandboxLogs(t *testing.T) {
	gin.SetMode(gin.TestMode)
	serializer.SetLogger(zap.NewNop())

	projectID := uuid.New()
	project := &model.Project{
		ID: projectID,
	}

	tests := []struct {
		name           string
		queryParams    string
		setup          func(*MockSandboxLogService)
		setupContext   func(*gin.Context)
		expectedStatus int
		checkResponse  func(*testing.T, *httptest.ResponseRecorder)
	}{
		{
			name:        "success - basic request",
			queryParams: "?limit=20",
			setup: func(svc *MockSandboxLogService) {
				expectedOutput := &service.GetSandboxLogsOutput{
					Items: []model.SandboxLog{
						{
							ID:              uuid.New(),
							ProjectID:       projectID,
							BackendType:     "e2b",
							HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
							GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
						},
					},
					HasMore: false,
				}
				svc.On("GetSandboxLogs", mock.Anything, mock.MatchedBy(func(in service.GetSandboxLogsInput) bool {
					return in.ProjectID == projectID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
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
			name:        "success - with cursor",
			queryParams: "?limit=10&cursor=MTIzNDU2Nzg5MHxhYmNkZWZnaC1pamts",
			setup: func(svc *MockSandboxLogService) {
				expectedOutput := &service.GetSandboxLogsOutput{
					Items: []model.SandboxLog{
						{
							ID:              uuid.New(),
							ProjectID:       projectID,
							BackendType:     "cloudflare",
							HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
							GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
						},
					},
					NextCursor: "OTg3NjU0MzIxMHxtbm9wcXJzdC11dnd4",
					HasMore:    true,
				}
				svc.On("GetSandboxLogs", mock.Anything, mock.MatchedBy(func(in service.GetSandboxLogsInput) bool {
					return in.ProjectID == projectID && in.Limit == 10 && in.Cursor == "MTIzNDU2Nzg5MHxhYmNkZWZnaC1pamts"
				})).Return(expectedOutput, nil)
			},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
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
			name:        "success - with time_desc=true",
			queryParams: "?limit=20&time_desc=true",
			setup: func(svc *MockSandboxLogService) {
				expectedOutput := &service.GetSandboxLogsOutput{
					Items: []model.SandboxLog{
						{
							ID:              uuid.New(),
							ProjectID:       projectID,
							BackendType:     "e2b",
							HistoryCommands: datatypes.NewJSONType([]model.HistoryCommand{}),
							GeneratedFiles:  datatypes.NewJSONType([]model.GeneratedFile{}),
						},
					},
					HasMore: false,
				}
				svc.On("GetSandboxLogs", mock.Anything, mock.MatchedBy(func(in service.GetSandboxLogsInput) bool {
					return in.ProjectID == projectID && in.Limit == 20 && in.TimeDesc == true
				})).Return(expectedOutput, nil)
			},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "success - using default limit",
			queryParams: "",
			setup: func(svc *MockSandboxLogService) {
				expectedOutput := &service.GetSandboxLogsOutput{
					Items:   []model.SandboxLog{},
					HasMore: false,
				}
				svc.On("GetSandboxLogs", mock.Anything, mock.MatchedBy(func(in service.GetSandboxLogsInput) bool {
					return in.ProjectID == projectID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "error - limit too high",
			queryParams: "?limit=300",
			setup:       func(svc *MockSandboxLogService) {},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:        "error - limit too low",
			queryParams: "?limit=0",
			setup:       func(svc *MockSandboxLogService) {},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
			},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:        "error - service error",
			queryParams: "?limit=20",
			setup: func(svc *MockSandboxLogService) {
				svc.On("GetSandboxLogs", mock.Anything, mock.MatchedBy(func(in service.GetSandboxLogsInput) bool {
					return in.ProjectID == projectID && in.Limit == 20
				})).Return(nil, assert.AnError)
			},
			setupContext: func(c *gin.Context) {
				c.Set("project", project)
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &MockSandboxLogService{}
			tt.setup(svc)

			coreClient := &httpclient.CoreClient{} // Not used in this test
			handler := NewSandboxHandler(coreClient, svc)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			req := httptest.NewRequest(http.MethodGet, "/sandbox/logs"+tt.queryParams, nil)
			c.Request = req
			tt.setupContext(c)

			handler.GetSandboxLogs(c)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.checkResponse != nil {
				tt.checkResponse(t, w)
			}

			svc.AssertExpectations(t)
		})
	}
}
