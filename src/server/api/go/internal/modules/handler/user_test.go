package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockUserService is a mock implementation of service.UserService
type MockUserService struct {
	mock.Mock
}

func (m *MockUserService) GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error) {
	args := m.Called(ctx, projectID, identifier)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserService) Delete(ctx context.Context, projectID uuid.UUID, identifier string) error {
	args := m.Called(ctx, projectID, identifier)
	return args.Error(0)
}

func (m *MockUserService) List(ctx context.Context, in service.ListUsersInput) (*service.ListUsersOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListUsersOutput), args.Error(1)
}

func (m *MockUserService) GetResourceCounts(ctx context.Context, projectID uuid.UUID, identifier string) (*service.GetUserResourcesOutput, error) {
	args := m.Called(ctx, projectID, identifier)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.GetUserResourcesOutput), args.Error(1)
}

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

func TestUserHandler_ListUsers(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name           string
		queryParams    string
		setup          func(*MockUserService)
		expectedStatus int
	}{
		{
			name:        "successful users list without limit (return all)",
			queryParams: "",
			setup: func(svc *MockUserService) {
				expectedOutput := &service.ListUsersOutput{
					Items: []*model.User{
						{
							ID:         uuid.New(),
							ProjectID:  projectID,
							Identifier: "alice@acontext.io",
							CreatedAt:  time.Now(),
						},
						{
							ID:         uuid.New(),
							ProjectID:  projectID,
							Identifier: "bob@acontext.io",
							CreatedAt:  time.Now(),
						},
					},
					HasMore: false,
				}
				svc.On("List", mock.Anything, mock.MatchedBy(func(in service.ListUsersInput) bool {
					return in.ProjectID == projectID && in.Limit == 0
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful users list with limit",
			queryParams: "?limit=20",
			setup: func(svc *MockUserService) {
				expectedOutput := &service.ListUsersOutput{
					Items: []*model.User{
						{
							ID:         uuid.New(),
							ProjectID:  projectID,
							Identifier: "alice@acontext.io",
							CreatedAt:  time.Now(),
						},
					},
					HasMore: false,
				}
				svc.On("List", mock.Anything, mock.MatchedBy(func(in service.ListUsersInput) bool {
					return in.ProjectID == projectID && in.Limit == 20
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "successful users list with pagination",
			queryParams: "?limit=10&cursor=test_cursor&time_desc=true",
			setup: func(svc *MockUserService) {
				expectedOutput := &service.ListUsersOutput{
					Items: []*model.User{
						{
							ID:         uuid.New(),
							ProjectID:  projectID,
							Identifier: "alice@acontext.io",
							CreatedAt:  time.Now(),
						},
					},
					HasMore:    true,
					NextCursor: "next_cursor_value",
				}
				svc.On("List", mock.Anything, mock.MatchedBy(func(in service.ListUsersInput) bool {
					return in.ProjectID == projectID && in.Limit == 10 && in.Cursor == "test_cursor" && in.TimeDesc == true
				})).Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "empty users list",
			queryParams: "",
			setup: func(svc *MockUserService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListUsersOutput{
					Items:   []*model.User{},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:        "service layer error",
			queryParams: "",
			setup: func(svc *MockUserService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:        "invalid limit parameter (exceeds max)",
			queryParams: "?limit=300",
			setup:       func(svc *MockUserService) {},
			// Gin binding validation should reject limit > 200
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockService := &MockUserService{}
			tt.setup(mockService)

			handler := NewUserHandler(mockService)
			router := setupUserRouter()
			router.GET("/user/ls", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.ListUsers(c)
			})

			req := httptest.NewRequest("GET", "/user/ls"+tt.queryParams, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}

func TestUserHandler_GetUserResources(t *testing.T) {
	projectID := uuid.New()

	tests := []struct {
		name           string
		identifier     string
		setup          func(*MockUserService)
		expectedStatus int
	}{
		{
			name:       "successful resource counts retrieval",
			identifier: "alice@acontext.io",
			setup: func(svc *MockUserService) {
				expectedOutput := &service.GetUserResourcesOutput{
					Counts: &repo.UserResourceCounts{
						SessionsCount: 10,
						DisksCount:    3,
						SkillsCount:   2,
					},
				}
				svc.On("GetResourceCounts", mock.Anything, projectID, "alice@acontext.io").Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:       "user with zero resources",
			identifier: "newuser@acontext.io",
			setup: func(svc *MockUserService) {
				expectedOutput := &service.GetUserResourcesOutput{
					Counts: &repo.UserResourceCounts{
						SessionsCount: 0,
						DisksCount:    0,
						SkillsCount:   0,
					},
				}
				svc.On("GetResourceCounts", mock.Anything, projectID, "newuser@acontext.io").Return(expectedOutput, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:       "user not found",
			identifier: "nonexistent@example.com",
			setup: func(svc *MockUserService) {
				svc.On("GetResourceCounts", mock.Anything, projectID, "nonexistent@example.com").Return(nil, errors.New("user not found"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
		{
			name:       "service layer error",
			identifier: "alice@acontext.io",
			setup: func(svc *MockUserService) {
				svc.On("GetResourceCounts", mock.Anything, projectID, "alice@acontext.io").Return(nil, errors.New("database error"))
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
			router.GET("/user/:identifier/resources", func(c *gin.Context) {
				project := &model.Project{ID: projectID}
				c.Set("project", project)
				handler.GetUserResources(c)
			})

			req := httptest.NewRequest("GET", "/user/"+tt.identifier+"/resources", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockService.AssertExpectations(t)
		})
	}
}
