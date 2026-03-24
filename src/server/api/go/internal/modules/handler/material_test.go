package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockMaterialService is a mock implementation of MaterialService
type MockMaterialService struct {
	mock.Mock
}

func (m *MockMaterialService) CreateMaterialURL(ctx context.Context, s3Key string, userKEK string, expire time.Duration, mimeType string, fileName string) (string, time.Time, error) {
	args := m.Called(ctx, s3Key, userKEK, expire, mimeType, fileName)
	return args.String(0), args.Get(1).(time.Time), args.Error(2)
}

func (m *MockMaterialService) ServeMaterial(ctx context.Context, token string) ([]byte, string, string, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.String(1), args.String(2), args.Error(3)
	}
	return args.Get(0).([]byte), args.String(1), args.String(2), args.Error(3)
}

var _ service.MaterialService = (*MockMaterialService)(nil)

func TestMaterialHandler_Serve_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := new(MockMaterialService)
	handler := NewMaterialHandler(mockSvc)

	content := []byte("hello world")
	mockSvc.On("ServeMaterial", mock.Anything, "abc123").Return(content, "text/plain", "test.txt", nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "token", Value: "abc123"}}
	c.Request, _ = http.NewRequest("GET", "/api/v1/material/abc123", nil)

	handler.Serve(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "text/plain", w.Header().Get("Content-Type"))
	assert.Contains(t, w.Header().Get("Content-Disposition"), "test.txt")
	assert.Equal(t, "hello world", w.Body.String())
	mockSvc.AssertExpectations(t)
}

func TestMaterialHandler_Serve_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := new(MockMaterialService)
	handler := NewMaterialHandler(mockSvc)

	mockSvc.On("ServeMaterial", mock.Anything, "expired-token").Return(nil, "", "", service.ErrMaterialNotFound)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "token", Value: "expired-token"}}
	c.Request, _ = http.NewRequest("GET", "/api/v1/material/expired-token", nil)

	handler.Serve(c)

	assert.Equal(t, http.StatusNotFound, w.Code)
	mockSvc.AssertExpectations(t)
}

func TestMaterialHandler_Serve_WithFileName(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := new(MockMaterialService)
	handler := NewMaterialHandler(mockSvc)

	content := []byte{0x89, 0x50, 0x4E, 0x47} // PNG magic bytes
	mockSvc.On("ServeMaterial", mock.Anything, "img-token").Return(content, "image/png", "photo.png", nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "token", Value: "img-token"}}
	c.Request, _ = http.NewRequest("GET", "/api/v1/material/img-token", nil)

	handler.Serve(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "image/png", w.Header().Get("Content-Type"))
	assert.Contains(t, w.Header().Get("Content-Disposition"), "photo.png")
	mockSvc.AssertExpectations(t)
}

func TestMaterialHandler_Serve_InternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := new(MockMaterialService)
	handler := NewMaterialHandler(mockSvc)

	mockSvc.On("ServeMaterial", mock.Anything, "err-token").Return(nil, "", "", errors.New("S3 unavailable"))

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "token", Value: "err-token"}}
	c.Request, _ = http.NewRequest("GET", "/api/v1/material/err-token", nil)

	handler.Serve(c)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	mockSvc.AssertExpectations(t)
}

func TestMaterialHandler_Serve_NoFileName(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockSvc := new(MockMaterialService)
	handler := NewMaterialHandler(mockSvc)

	content := []byte("data")
	mockSvc.On("ServeMaterial", mock.Anything, "noname-token").Return(content, "application/octet-stream", "", nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "token", Value: "noname-token"}}
	c.Request, _ = http.NewRequest("GET", "/api/v1/material/noname-token", nil)

	handler.Serve(c)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Empty(t, w.Header().Get("Content-Disposition"))
	mockSvc.AssertExpectations(t)
}
