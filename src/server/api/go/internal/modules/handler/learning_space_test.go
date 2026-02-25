package handler

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/bytedance/sonic"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// ---------------------------------------------------------------------------
// Mock: LearningSpaceService
// ---------------------------------------------------------------------------

type MockLearningSpaceService struct {
	mock.Mock
}

func (m *MockLearningSpaceService) Create(ctx context.Context, in service.CreateLearningSpaceInput) (*model.LearningSpace, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpace), args.Error(1)
}

func (m *MockLearningSpaceService) GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.LearningSpace, error) {
	args := m.Called(ctx, projectID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpace), args.Error(1)
}

func (m *MockLearningSpaceService) Update(ctx context.Context, in service.UpdateLearningSpaceInput) (*model.LearningSpace, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpace), args.Error(1)
}

func (m *MockLearningSpaceService) Delete(ctx context.Context, projectID, id uuid.UUID) error {
	args := m.Called(ctx, projectID, id)
	return args.Error(0)
}

func (m *MockLearningSpaceService) List(ctx context.Context, in service.ListLearningSpacesInput) (*service.ListLearningSpacesOutput, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*service.ListLearningSpacesOutput), args.Error(1)
}

func (m *MockLearningSpaceService) Learn(ctx context.Context, in service.LearnInput) (*model.LearningSpaceSession, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpaceSession), args.Error(1)
}

func (m *MockLearningSpaceService) IncludeSkill(ctx context.Context, in service.IncludeSkillInput) (*model.LearningSpaceSkill, error) {
	args := m.Called(ctx, in)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpaceSkill), args.Error(1)
}

func (m *MockLearningSpaceService) ListSkills(ctx context.Context, projectID, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error) {
	args := m.Called(ctx, projectID, learningSpaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AgentSkills), args.Error(1)
}

func (m *MockLearningSpaceService) GetSession(ctx context.Context, projectID, learningSpaceID, sessionID uuid.UUID) (*model.LearningSpaceSession, error) {
	args := m.Called(ctx, projectID, learningSpaceID, sessionID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpaceSession), args.Error(1)
}

func (m *MockLearningSpaceService) ListSessions(ctx context.Context, projectID, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error) {
	args := m.Called(ctx, projectID, learningSpaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.LearningSpaceSession), args.Error(1)
}

func (m *MockLearningSpaceService) ExcludeSkill(ctx context.Context, projectID, learningSpaceID, skillID uuid.UUID) error {
	args := m.Called(ctx, projectID, learningSpaceID, skillID)
	return args.Error(0)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func setupLearningSpaceRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func createTestLearningSpace(projectID uuid.UUID) *model.LearningSpace {
	return &model.LearningSpace{
		ID:        uuid.New(),
		ProjectID: projectID,
		Meta:      map[string]interface{}{"version": "1.0"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// ---------------------------------------------------------------------------
// Tests: Create
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_Create(t *testing.T) {
	projectID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name           string
		body           string
		setup          func(*MockLearningSpaceService, *MockUserService)
		expectedStatus int
	}{
		{
			name: "successful creation without user",
			body: `{"meta":{"version":"1.0"}}`,
			setup: func(svc *MockLearningSpaceService, uSvc *MockUserService) {
				svc.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateLearningSpaceInput) bool {
					return in.ProjectID == projectID && in.UserID == nil
				})).Return(createTestLearningSpace(projectID), nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "successful creation with user",
			body: `{"user":"alice@test.com","meta":{"version":"1.0"}}`,
			setup: func(svc *MockLearningSpaceService, uSvc *MockUserService) {
				uSvc.On("GetOrCreate", mock.Anything, projectID, "alice@test.com").
					Return(&model.User{ID: userID, ProjectID: projectID, Identifier: "alice@test.com"}, nil)
				svc.On("Create", mock.Anything, mock.MatchedBy(func(in service.CreateLearningSpaceInput) bool {
					return in.ProjectID == projectID && in.UserID != nil && *in.UserID == userID
				})).Return(&model.LearningSpace{
					ID:        uuid.New(),
					ProjectID: projectID,
					UserID:    &userID,
					Meta:      map[string]interface{}{"version": "1.0"},
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name: "service error",
			body: `{"meta":{}}`,
			setup: func(svc *MockLearningSpaceService, uSvc *MockUserService) {
				svc.On("Create", mock.Anything, mock.Anything).Return(nil, errors.New("db error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			mockUserSvc := &MockUserService{}
			tt.setup(mockSvc, mockUserSvc)
			handler := NewLearningSpaceHandler(mockSvc, mockUserSvc)

			router := setupLearningSpaceRouter()
			router.POST("/learning_spaces", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.Create(c)
			})

			req := httptest.NewRequest("POST", "/learning_spaces", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusCreated {
				var resp map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)
				assert.NotNil(t, resp["data"])
			}

			mockSvc.AssertExpectations(t)
			mockUserSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: Get
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_Get(t *testing.T) {
	projectID := uuid.New()
	ls := createTestLearningSpace(projectID)

	tests := []struct {
		name           string
		id             string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name: "successful get",
			id:   ls.ID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("GetByID", mock.Anything, projectID, ls.ID).Return(ls, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid UUID",
			id:             "invalid-uuid",
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "not found",
			id:   ls.ID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("GetByID", mock.Anything, projectID, ls.ID).Return(nil, errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.GET("/learning_spaces/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.Get(c)
			})

			req := httptest.NewRequest("GET", "/learning_spaces/"+tt.id, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: Update (patch meta)
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_Update(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()

	tests := []struct {
		name           string
		id             string
		body           string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name: "successful update",
			id:   lsID.String(),
			body: `{"meta":{"version":"2.0","new_key":"value"}}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Update", mock.Anything, mock.MatchedBy(func(in service.UpdateLearningSpaceInput) bool {
					return in.ProjectID == projectID && in.ID == lsID && in.Meta["version"] == "2.0"
				})).Return(&model.LearningSpace{
					ID:        lsID,
					ProjectID: projectID,
					Meta:      map[string]interface{}{"version": "2.0", "new_key": "value"},
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid UUID",
			id:             "invalid-uuid",
			body:           `{"meta":{"version":"2.0"}}`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "not found",
			id:   lsID.String(),
			body: `{"meta":{"version":"2.0"}}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Update", mock.Anything, mock.Anything).Return(nil, errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "missing meta (binding required)",
			id:             lsID.String(),
			body:           `{}`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.PATCH("/learning_spaces/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.Update(c)
			})

			req := httptest.NewRequest("PATCH", "/learning_spaces/"+tt.id, bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: Delete
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_Delete(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()

	tests := []struct {
		name           string
		id             string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name: "successful deletion",
			id:   lsID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Delete", mock.Anything, projectID, lsID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid UUID",
			id:             "invalid-uuid",
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "not found",
			id:   lsID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Delete", mock.Anything, projectID, lsID).Return(errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.DELETE("/learning_spaces/:id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.Delete(c)
			})

			req := httptest.NewRequest("DELETE", "/learning_spaces/"+tt.id, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: List
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_List(t *testing.T) {
	projectID := uuid.New()
	ls1 := createTestLearningSpace(projectID)
	ls2 := createTestLearningSpace(projectID)

	tests := []struct {
		name           string
		query          string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name:  "successful list",
			query: "?limit=20",
			setup: func(svc *MockLearningSpaceService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListLearningSpacesOutput{
					Items:   []*model.LearningSpace{ls1, ls2},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:  "empty result",
			query: "?limit=20",
			setup: func(svc *MockLearningSpaceService) {
				svc.On("List", mock.Anything, mock.Anything).Return(&service.ListLearningSpacesOutput{
					Items:   []*model.LearningSpace{},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:  "list with user filter",
			query: "?user=alice&limit=20",
			setup: func(svc *MockLearningSpaceService) {
				svc.On("List", mock.Anything, mock.MatchedBy(func(in service.ListLearningSpacesInput) bool {
					return in.User == "alice"
				})).Return(&service.ListLearningSpacesOutput{
					Items:   []*model.LearningSpace{ls1},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:  "list with meta filter",
			query: `?limit=20&filter_by_meta={"version":"1.0"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("List", mock.Anything, mock.MatchedBy(func(in service.ListLearningSpacesInput) bool {
					return in.FilterByMeta != nil && in.FilterByMeta["version"] == "1.0"
				})).Return(&service.ListLearningSpacesOutput{
					Items:   []*model.LearningSpace{ls1},
					HasMore: false,
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid meta filter JSON",
			query:          `?limit=20&filter_by_meta=invalid`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:  "service error",
			query: "?limit=20",
			setup: func(svc *MockLearningSpaceService) {
				svc.On("List", mock.Anything, mock.Anything).Return(nil, errors.New("database error"))
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.GET("/learning_spaces", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.List(c)
			})

			req := httptest.NewRequest("GET", "/learning_spaces"+tt.query, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				var resp map[string]interface{}
				err := sonic.Unmarshal(w.Body.Bytes(), &resp)
				assert.NoError(t, err)
				assert.NotNil(t, resp["data"])
			}

			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: Learn
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_Learn(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		id             string
		body           string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
		checkError     string
	}{
		{
			name: "successful learn",
			id:   lsID.String(),
			body: `{"session_id":"` + sessionID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Learn", mock.Anything, mock.MatchedBy(func(in service.LearnInput) bool {
					return in.ProjectID == projectID && in.LearningSpaceID == lsID && in.SessionID == sessionID
				})).Return(&model.LearningSpaceSession{
					ID:              uuid.New(),
					LearningSpaceID: lsID,
					SessionID:       sessionID,
					Status:          "pending",
					CreatedAt:       time.Now(),
					UpdatedAt:       time.Now(),
				}, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "invalid space UUID",
			id:             "invalid-uuid",
			body:           `{"session_id":"` + sessionID.String() + `"}`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid session_id UUID",
			id:             lsID.String(),
			body:           `{"session_id":"invalid-uuid"}`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "space not found",
			id:   lsID.String(),
			body: `{"session_id":"` + sessionID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Learn", mock.Anything, mock.Anything).Return(nil, errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name: "session not found",
			id:   lsID.String(),
			body: `{"session_id":"` + sessionID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Learn", mock.Anything, mock.Anything).Return(nil, errors.New("session not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name: "session already learned — conflict",
			id:   lsID.String(),
			body: `{"session_id":"` + sessionID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("Learn", mock.Anything, mock.Anything).Return(nil, errors.New("session already learned by another space"))
			},
			expectedStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.POST("/learning_spaces/:id/learn", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.Learn(c)
			})

			req := httptest.NewRequest("POST", "/learning_spaces/"+tt.id+"/learn", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: IncludeSkill
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_IncludeSkill(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()
	skillID := uuid.New()

	tests := []struct {
		name           string
		id             string
		body           string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name: "successful include",
			id:   lsID.String(),
			body: `{"skill_id":"` + skillID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("IncludeSkill", mock.Anything, mock.MatchedBy(func(in service.IncludeSkillInput) bool {
					return in.LearningSpaceID == lsID && in.SkillID == skillID
				})).Return(&model.LearningSpaceSkill{
					ID:              uuid.New(),
					LearningSpaceID: lsID,
					SkillID:         skillID,
					CreatedAt:       time.Now(),
				}, nil)
			},
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "invalid space UUID",
			id:             "invalid-uuid",
			body:           `{"skill_id":"` + skillID.String() + `"}`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid skill_id UUID",
			id:             lsID.String(),
			body:           `{"skill_id":"invalid-uuid"}`,
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "space not found",
			id:   lsID.String(),
			body: `{"skill_id":"` + skillID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("IncludeSkill", mock.Anything, mock.Anything).Return(nil, errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name: "skill not found",
			id:   lsID.String(),
			body: `{"skill_id":"` + skillID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("IncludeSkill", mock.Anything, mock.Anything).Return(nil, errors.New("skill not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
		{
			name: "duplicate — conflict",
			id:   lsID.String(),
			body: `{"skill_id":"` + skillID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("IncludeSkill", mock.Anything, mock.Anything).Return(nil, errors.New("skill already included in this space"))
			},
			expectedStatus: http.StatusConflict,
		},
		{
			name: "duplicate name — conflict",
			id:   lsID.String(),
			body: `{"skill_id":"` + skillID.String() + `"}`,
			setup: func(svc *MockLearningSpaceService) {
				svc.On("IncludeSkill", mock.Anything, mock.Anything).Return(nil, errors.New("skill with name 'daily-logs' already exists in this space"))
			},
			expectedStatus: http.StatusConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.POST("/learning_spaces/:id/skills", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.IncludeSkill(c)
			})

			req := httptest.NewRequest("POST", "/learning_spaces/"+tt.id+"/skills", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: ListSkills
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_ListSkills(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()

	tests := []struct {
		name           string
		id             string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name: "successful list skills",
			id:   lsID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("ListSkills", mock.Anything, projectID, lsID).Return([]*model.AgentSkills{
					{ID: uuid.New(), Name: "skill-1", Description: "First skill"},
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid UUID",
			id:             "invalid-uuid",
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "space not found",
			id:   lsID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("ListSkills", mock.Anything, projectID, lsID).Return(nil, errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.GET("/learning_spaces/:id/skills", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.ListSkills(c)
			})

			req := httptest.NewRequest("GET", "/learning_spaces/"+tt.id+"/skills", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: ExcludeSkill
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_ExcludeSkill(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()
	skillID := uuid.New()

	tests := []struct {
		name           string
		id             string
		skillIDParam   string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name:         "successful exclude",
			id:           lsID.String(),
			skillIDParam: skillID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("ExcludeSkill", mock.Anything, projectID, lsID, skillID).Return(nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space UUID",
			id:             "invalid-uuid",
			skillIDParam:   skillID.String(),
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid skill UUID",
			id:             lsID.String(),
			skillIDParam:   "invalid-uuid",
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:         "space not found",
			id:           lsID.String(),
			skillIDParam: skillID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("ExcludeSkill", mock.Anything, projectID, lsID, skillID).Return(errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.DELETE("/learning_spaces/:id/skills/:skill_id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.ExcludeSkill(c)
			})

			req := httptest.NewRequest("DELETE", "/learning_spaces/"+tt.id+"/skills/"+tt.skillIDParam, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: GetSession
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_GetSession(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()
	sessionID := uuid.New()

	tests := []struct {
		name           string
		id             string
		sessionID      string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name:      "successful get session",
			id:        lsID.String(),
			sessionID: sessionID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("GetSession", mock.Anything, projectID, lsID, sessionID).Return(&model.LearningSpaceSession{
					ID:              uuid.New(),
					LearningSpaceID: lsID,
					SessionID:       sessionID,
					Status:          "completed",
					CreatedAt:       time.Now(),
					UpdatedAt:       time.Now(),
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid space UUID",
			id:             "invalid-uuid",
			sessionID:      sessionID.String(),
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "invalid session UUID",
			id:             lsID.String(),
			sessionID:      "invalid-uuid",
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:      "not found",
			id:        lsID.String(),
			sessionID: sessionID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("GetSession", mock.Anything, projectID, lsID, sessionID).Return(nil, errors.New("learning space session not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.GET("/learning_spaces/:id/sessions/:session_id", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.GetSession(c)
			})

			req := httptest.NewRequest("GET", "/learning_spaces/"+tt.id+"/sessions/"+tt.sessionID, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}

// ---------------------------------------------------------------------------
// Tests: ListSessions
// ---------------------------------------------------------------------------

func TestLearningSpaceHandler_ListSessions(t *testing.T) {
	projectID := uuid.New()
	lsID := uuid.New()

	tests := []struct {
		name           string
		id             string
		setup          func(*MockLearningSpaceService)
		expectedStatus int
	}{
		{
			name: "successful list sessions",
			id:   lsID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("ListSessions", mock.Anything, projectID, lsID).Return([]*model.LearningSpaceSession{
					{
						ID:              uuid.New(),
						LearningSpaceID: lsID,
						SessionID:       uuid.New(),
						Status:          "pending",
						CreatedAt:       time.Now(),
						UpdatedAt:       time.Now(),
					},
				}, nil)
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid UUID",
			id:             "invalid-uuid",
			setup:          func(svc *MockLearningSpaceService) {},
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "space not found",
			id:   lsID.String(),
			setup: func(svc *MockLearningSpaceService) {
				svc.On("ListSessions", mock.Anything, projectID, lsID).Return(nil, errors.New("learning space not found"))
			},
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &MockLearningSpaceService{}
			tt.setup(mockSvc)
			handler := NewLearningSpaceHandler(mockSvc, &MockUserService{})

			router := setupLearningSpaceRouter()
			router.GET("/learning_spaces/:id/sessions", func(c *gin.Context) {
				c.Set("project", &model.Project{ID: projectID})
				handler.ListSessions(c)
			})

			req := httptest.NewRequest("GET", "/learning_spaces/"+tt.id+"/sessions", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
			mockSvc.AssertExpectations(t)
		})
	}
}
