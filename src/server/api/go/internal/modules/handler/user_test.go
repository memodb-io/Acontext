package handler

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func setupUserRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func TestUserHandler_DeleteUser(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name           string
		identifier     string
		setup          func(*MockUserService)
		expectedStatus int
		expectedError  string
	}{
		{
			name:       "successful user deletion",
			identifier: "alice@acontext.io",
			setup: func(svc *MockUserService) {
				svc.On("Delete", mock.Anything, projectID, "alice@acontext.io").Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:       "service layer error",
			identifier: "alice@acontext.io",
			setup: func(svc *MockUserService) {
				svc.On("Delete", mock.Anything, projectID, "alice@acontext.io").Return(errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:       "user not found",
			identifier: "nonexistent@example.com",
			setup: func(svc *MockUserService) {
				svc.On("Delete", mock.Anything, projectID, "nonexistent@example.com").Return(errors.New("user not found"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockUserService{}
			tt.setup(mockService)

			handler := NewUserHandler(mockService)
			router := setupUserRouter()
			router.DELETE("/user/:identifier", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.DeleteUser(c)
			})

			req := httptest.NewRequest("DELETE", "/user/"+tt.identifier, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)

			if tt.expectedError != "" && w.Code == http.StatusBadRequest {
				// Verify error message is in response
				assert.Contains(t, w.Body.String(), tt.expectedError)
			}
		})
	}
}
