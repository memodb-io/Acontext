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
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockProjectService is a mock implementation of ProjectService
type MockProjectService struct {
	mock.Mock
}

func (m *MockProjectService) Create(ctx context.Context, configs map[string]interface{}) (*service.CreateProjectOutput, error) {
	args := m.Called(ctx, configs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.CreateProjectOutput), args.Error(1)
}

func (m *MockProjectService) Delete(ctx context.Context, projectID uuid.UUID) error {
	args := m.Called(ctx, projectID)
	return args.Error(0)
}

func (m *MockProjectService) UpdateSecretKey(ctx context.Context, projectID uuid.UUID) (*service.UpdateSecretKeyOutput, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.UpdateSecretKeyOutput), args.Error(1)
}

func (m *MockProjectService) AnalyzeUsages(ctx context.Context, projectID uuid.UUID, intervalDays int, fields []string) (*service.AnalyzeUsagesOutput, error) {
	args := m.Called(ctx, projectID, intervalDays, fields)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.AnalyzeUsagesOutput), args.Error(1)
}

func (m *MockProjectService) AnalyzeStatistics(ctx context.Context, projectID uuid.UUID) (*service.AnalyzeStatisticsOutput, error) {
	args := m.Called(ctx, projectID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.AnalyzeStatisticsOutput), args.Error(1)
}

func (m *MockProjectService) AnalyzeMetrics(ctx context.Context, projectID uuid.UUID, requestURL string, requestMethod string, requestHeaders http.Header) (*http.Response, error) {
	args := m.Called(ctx, projectID, requestURL, requestMethod, requestHeaders)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*http.Response), args.Error(1)
}

func TestAdminHandler_CreateProject(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()
		secretKey := "test-secret-key-12345"

		mockSvc.On("Create", mock.Anything, mock.Anything).Return(&service.CreateProjectOutput{
			ProjectID: projectID,
			SecretKey: secretKey,
		}, nil)

		reqBody := map[string]interface{}{
			"configs": map[string]interface{}{
				"test_key": "test_value",
			},
		}
		body, _ := sonic.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/admin/v1/project", bytes.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.CreateProject(c)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := sonic.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)

		data := response["data"].(map[string]interface{})
		assert.Equal(t, projectID.String(), data["project_id"])
		assert.Equal(t, secretKey, data["secret_key"])

		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid request body", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/admin/v1/project", bytes.NewReader([]byte("invalid json")))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.CreateProject(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		mockSvc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("service error"))

		reqBody := map[string]interface{}{}
		body, _ := sonic.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/admin/v1/project", bytes.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")

		handler.CreateProject(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockSvc.AssertExpectations(t)
	})
}

func TestAdminHandler_DeleteProject(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("Delete", mock.Anything, projectID).Return(nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodDelete, "/admin/v1/project/"+projectID.String(), nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.DeleteProject(c)

		assert.Equal(t, http.StatusOK, w.Code)

		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid project id", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodDelete, "/admin/v1/project/invalid-uuid", nil)
		c.Params = gin.Params{{Key: "project_id", Value: "invalid-uuid"}}

		handler.DeleteProject(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("Delete", mock.Anything, projectID).Return(errors.New("service error"))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodDelete, "/admin/v1/project/"+projectID.String(), nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.DeleteProject(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockSvc.AssertExpectations(t)
	})
}

func TestAdminHandler_UpdateProjectSecretKey(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()
		newSecretKey := "new-secret-key-67890"

		mockSvc.On("UpdateSecretKey", mock.Anything, projectID).Return(&service.UpdateSecretKeyOutput{
			SecretKey: newSecretKey,
		}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPut, "/admin/v1/project/"+projectID.String()+"/secret_key", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.UpdateProjectSecretKey(c)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := sonic.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)

		data := response["data"].(map[string]interface{})
		assert.Equal(t, newSecretKey, data["secret_key"])

		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid project id", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPut, "/admin/v1/project/invalid-uuid/secret_key", nil)
		c.Params = gin.Params{{Key: "project_id", Value: "invalid-uuid"}}

		handler.UpdateProjectSecretKey(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("UpdateSecretKey", mock.Anything, projectID).Return(nil, errors.New("service error"))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPut, "/admin/v1/project/"+projectID.String()+"/secret_key", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.UpdateProjectSecretKey(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockSvc.AssertExpectations(t)
	})
}

func TestAdminHandler_AnalyzeProjectUsages(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()
		intervalDays := 30

		mockSvc.On("AnalyzeUsages", mock.Anything, projectID, intervalDays, []string(nil)).Return(&service.AnalyzeUsagesOutput{
			TaskSuccess:    []repo.TaskSuccessRow{},
			TaskStatus:     []repo.TaskStatusRow{},
			SessionMessage: []repo.SessionMessageRow{},
			SessionTask:    []repo.SessionTaskRow{},
			TaskMessage:    []repo.TaskMessageRow{},
			Storage:        []repo.StorageRow{},
			TaskStats:      []repo.TaskStatsRow{},
			NewSessions:    []repo.CountRow{},
			NewDisks:       []repo.CountRow{},
			NewSpaces:      []repo.CountRow{},
		}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/usages?interval_days=30", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := sonic.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.NotNil(t, response["data"])

		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid project id", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/invalid-uuid/usages", nil)
		c.Params = gin.Params{{Key: "project_id", Value: "invalid-uuid"}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("default interval_days", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("AnalyzeUsages", mock.Anything, projectID, 30, []string(nil)).Return(&service.AnalyzeUsagesOutput{}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/usages", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusOK, w.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("AnalyzeUsages", mock.Anything, projectID, 30, []string(nil)).Return(nil, errors.New("service error"))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/usages", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockSvc.AssertExpectations(t)
	})

	t.Run("with fields param", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()
		expectedFields := []string{"storage"}

		mockSvc.On("AnalyzeUsages", mock.Anything, projectID, 7, expectedFields).Return(&service.AnalyzeUsagesOutput{
			Storage: []repo.StorageRow{{Date: "2026-03-18", UsageBytes: 1024}},
		}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/usages?interval_days=7&fields=storage", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusOK, w.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("with multiple fields param", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()
		expectedFields := []string{"task_success", "task_status", "task_stats"}

		mockSvc.On("AnalyzeUsages", mock.Anything, projectID, 30, expectedFields).Return(&service.AnalyzeUsagesOutput{}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/usages?fields=task_success,task_status,task_stats", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusOK, w.Code)
		mockSvc.AssertExpectations(t)
	})

	t.Run("empty fields param fetches all", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		// Empty fields should pass nil slice
		mockSvc.On("AnalyzeUsages", mock.Anything, projectID, 30, []string(nil)).Return(&service.AnalyzeUsagesOutput{}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/usages?interval_days=30", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectUsages(c)

		assert.Equal(t, http.StatusOK, w.Code)
		mockSvc.AssertExpectations(t)
	})
}

func TestAdminHandler_AnalyzeProjectStatistics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("AnalyzeStatistics", mock.Anything, projectID).Return(&service.AnalyzeStatisticsOutput{
			TaskCount:    100,
			SkillCount:   50,
			SessionCount: 20,
		}, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/statistics", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectStatistics(c)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := sonic.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)

		data := response["data"].(map[string]interface{})
		assert.Equal(t, int64(100), int64(data["taskCount"].(float64)))
		assert.Equal(t, int64(50), int64(data["skillCount"].(float64)))
		assert.Equal(t, int64(20), int64(data["sessionCount"].(float64)))

		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid project id", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/invalid-uuid/statistics", nil)
		c.Params = gin.Params{{Key: "project_id", Value: "invalid-uuid"}}

		handler.AnalyzeProjectStatistics(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("AnalyzeStatistics", mock.Anything, projectID).Return(nil, errors.New("service error"))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/statistics", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectStatistics(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockSvc.AssertExpectations(t)
	})
}

func TestAdminHandler_AnalyzeProjectMetrics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("success", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		// Create a mock HTTP response
		mockResp := &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       http.NoBody,
		}
		mockResp.Header.Set("Content-Type", "application/json")

		mockSvc.On("AnalyzeMetrics", mock.Anything, projectID, mock.Anything, mock.Anything, mock.Anything).Return(mockResp, nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/metrics", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectMetrics(c)

		assert.Equal(t, http.StatusOK, w.Code)

		mockSvc.AssertExpectations(t)
	})

	t.Run("invalid project id", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/invalid-uuid/metrics", nil)
		c.Params = gin.Params{{Key: "project_id", Value: "invalid-uuid"}}

		handler.AnalyzeProjectMetrics(c)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("service error", func(t *testing.T) {
		mockSvc := new(MockProjectService)
		handler := NewAdminHandler(mockSvc)

		projectID := uuid.New()

		mockSvc.On("AnalyzeMetrics", mock.Anything, projectID, mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("service error"))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/admin/v1/project/"+projectID.String()+"/metrics", nil)
		c.Params = gin.Params{{Key: "project_id", Value: projectID.String()}}

		handler.AnalyzeProjectMetrics(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)

		mockSvc.AssertExpectations(t)
	})
}
