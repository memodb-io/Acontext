package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockMessageObservingService is a mock implementation of MessageObservingService
type MockMessageObservingService struct {
	mock.Mock
}

func (m *MockMessageObservingService) GetSessionObservingStatus(ctx context.Context, sessionID string) (*model.MessageObservingStatus, error) {
	args := m.Called(ctx, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.MessageObservingStatus), args.Error(1)
}

func TestMessageObservingHandler_GetSessionObservingStatus_Success(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockService := new(MockMessageObservingService)
	handler := NewMessageObservingHandler(mockService)

	sessionID := "550e8400-e29b-41d4-a716-446655440000"
	expectedStatus := &model.MessageObservingStatus{
		Observed:  10,
		InProcess: 5,
		Pending:   3,
		UpdatedAt: time.Now(),
	}

	mockService.On("GetSessionObservingStatus", mock.Anything, sessionID).
		Return(expectedStatus, nil)

	// Create test request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{
		{Key: "session_id", Value: sessionID},
	}
	req, _ := http.NewRequest("GET", "/session/"+sessionID+"/observing-status", nil)
	c.Request = req

	// Execute
	handler.GetSessionObservingStatus(c)

	// Assert
	assert.Equal(t, http.StatusOK, w.Code)
	mockService.AssertExpectations(t)

	// Check response body contains expected values
	assert.Contains(t, w.Body.String(), `"observed":10`)
	assert.Contains(t, w.Body.String(), `"in_process":5`)
	assert.Contains(t, w.Body.String(), `"pending":3`)
}

func TestMessageObservingHandler_GetSessionObservingStatus_EmptySessionID(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockService := new(MockMessageObservingService)
	handler := NewMessageObservingHandler(mockService)

	// Create test request with empty session_id
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{
		{Key: "session_id", Value: ""},
	}
	req, _ := http.NewRequest("GET", "/session//observing-status", nil)
	c.Request = req

	// Execute
	handler.GetSessionObservingStatus(c)

	// Assert
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "session_id is required")
	mockService.AssertNotCalled(t, "GetSessionObservingStatus")
}

func TestMessageObservingHandler_GetSessionObservingStatus_ServiceError(t *testing.T) {
	// Setup
	gin.SetMode(gin.TestMode)

	mockService := new(MockMessageObservingService)
	handler := NewMessageObservingHandler(mockService)

	sessionID := "550e8400-e29b-41d4-a716-446655440000"
	expectedError := errors.New("database connection failed")

	mockService.On("GetSessionObservingStatus", mock.Anything, sessionID).
		Return(nil, expectedError)

	// Create test request
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{
		{Key: "session_id", Value: sessionID},
	}
	req, _ := http.NewRequest("GET", "/session/"+sessionID+"/observing-status", nil)
	c.Request = req

	// Execute
	handler.GetSessionObservingStatus(c)

	// Assert
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "database connection failed")
	mockService.AssertExpectations(t)
}

func TestNewMessageObservingHandler_NilService(t *testing.T) {
	// Should panic when service is nil
	assert.Panics(t, func() {
		NewMessageObservingHandler(nil)
	})
}
