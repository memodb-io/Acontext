package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Mock: LearningSpaceRepo
// ---------------------------------------------------------------------------

type MockLearningSpaceRepo struct {
	mock.Mock
}

func (m *MockLearningSpaceRepo) Create(ctx context.Context, ls *model.LearningSpace) error {
	args := m.Called(ctx, ls)
	if args.Error(0) == nil {
		ls.ID = uuid.New()
		ls.CreatedAt = time.Now()
		ls.UpdatedAt = time.Now()
	}
	return args.Error(0)
}

func (m *MockLearningSpaceRepo) GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.LearningSpace, error) {
	args := m.Called(ctx, projectID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.LearningSpace), args.Error(1)
}

func (m *MockLearningSpaceRepo) Update(ctx context.Context, ls *model.LearningSpace) error {
	args := m.Called(ctx, ls)
	return args.Error(0)
}

func (m *MockLearningSpaceRepo) Delete(ctx context.Context, projectID, id uuid.UUID) error {
	args := m.Called(ctx, projectID, id)
	return args.Error(0)
}

func (m *MockLearningSpaceRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByMeta map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.LearningSpace, error) {
	args := m.Called(ctx, projectID, userIdentifier, filterByMeta, afterCreatedAt, afterID, limit, timeDesc)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.LearningSpace), args.Error(1)
}

// ---------------------------------------------------------------------------
// Mock: LearningSpaceSkillRepo
// ---------------------------------------------------------------------------

type MockLearningSpaceSkillRepo struct {
	mock.Mock
}

func (m *MockLearningSpaceSkillRepo) Create(ctx context.Context, lss *model.LearningSpaceSkill) error {
	args := m.Called(ctx, lss)
	if args.Error(0) == nil {
		lss.ID = uuid.New()
		lss.CreatedAt = time.Now()
	}
	return args.Error(0)
}

func (m *MockLearningSpaceSkillRepo) Delete(ctx context.Context, learningSpaceID, skillID uuid.UUID) error {
	args := m.Called(ctx, learningSpaceID, skillID)
	return args.Error(0)
}

func (m *MockLearningSpaceSkillRepo) ListBySpaceID(ctx context.Context, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error) {
	args := m.Called(ctx, learningSpaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.AgentSkills), args.Error(1)
}

func (m *MockLearningSpaceSkillRepo) Exists(ctx context.Context, learningSpaceID, skillID uuid.UUID) (bool, error) {
	args := m.Called(ctx, learningSpaceID, skillID)
	return args.Bool(0), args.Error(1)
}

// ---------------------------------------------------------------------------
// Mock: LearningSpaceSessionRepo
// ---------------------------------------------------------------------------

type MockLearningSpaceSessionRepo struct {
	mock.Mock
}

func (m *MockLearningSpaceSessionRepo) Create(ctx context.Context, lss *model.LearningSpaceSession) error {
	args := m.Called(ctx, lss)
	if args.Error(0) == nil {
		lss.ID = uuid.New()
		lss.CreatedAt = time.Now()
		lss.UpdatedAt = time.Now()
	}
	return args.Error(0)
}

func (m *MockLearningSpaceSessionRepo) ExistsBySessionID(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	args := m.Called(ctx, sessionID)
	return args.Bool(0), args.Error(1)
}

func (m *MockLearningSpaceSessionRepo) ListBySpaceID(ctx context.Context, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error) {
	args := m.Called(ctx, learningSpaceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*model.LearningSpaceSession), args.Error(1)
}

// NOTE: MockSessionRepo and MockAgentSkillsRepo are already declared in
// session_test.go and agent_skills_test.go respectively (same package).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type lsMocks struct {
	lsRepo      *MockLearningSpaceRepo
	lsSkillRepo *MockLearningSpaceSkillRepo
	lsSessRepo  *MockLearningSpaceSessionRepo
	skillsRepo  *MockAgentSkillsRepo
	sessionRepo *MockSessionRepo
}

func newLSMocks() lsMocks {
	return lsMocks{
		lsRepo:      &MockLearningSpaceRepo{},
		lsSkillRepo: &MockLearningSpaceSkillRepo{},
		lsSessRepo:  &MockLearningSpaceSessionRepo{},
		skillsRepo:  &MockAgentSkillsRepo{},
		sessionRepo: &MockSessionRepo{},
	}
}

func (m lsMocks) service() LearningSpaceService {
	return NewLearningSpaceService(m.lsRepo, m.lsSkillRepo, m.lsSessRepo, m.skillsRepo, m.sessionRepo)
}

// ---------------------------------------------------------------------------
// Service: Create
// ---------------------------------------------------------------------------

func TestLearningSpaceService_Create(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("Create", mock.Anything, mock.MatchedBy(func(ls *model.LearningSpace) bool {
			return ls.ProjectID == projectID
		})).Return(nil)

		result, err := m.service().Create(ctx, CreateLearningSpaceInput{
			ProjectID: projectID,
			Meta:      map[string]interface{}{"version": "1.0"},
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, projectID, result.ProjectID)
		m.lsRepo.AssertExpectations(t)
	})

	t.Run("with user_id", func(t *testing.T) {
		m := newLSMocks()
		userID := uuid.New()
		m.lsRepo.On("Create", mock.Anything, mock.MatchedBy(func(ls *model.LearningSpace) bool {
			return ls.UserID != nil && *ls.UserID == userID
		})).Return(nil)

		result, err := m.service().Create(ctx, CreateLearningSpaceInput{
			ProjectID: projectID,
			UserID:    &userID,
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		m.lsRepo.AssertExpectations(t)
	})

	t.Run("repo error", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("Create", mock.Anything, mock.Anything).Return(errors.New("db error"))

		result, err := m.service().Create(ctx, CreateLearningSpaceInput{ProjectID: projectID})

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// Service: Update (meta merge)
// ---------------------------------------------------------------------------

func TestLearningSpaceService_Update(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()

	t.Run("success — merges meta preserving existing keys", func(t *testing.T) {
		m := newLSMocks()
		existingLS := &model.LearningSpace{
			ID:        lsID,
			ProjectID: projectID,
			Meta:      map[string]interface{}{"existing_key": "keep", "version": "1.0"},
		}
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(existingLS, nil)
		m.lsRepo.On("Update", ctx, mock.MatchedBy(func(ls *model.LearningSpace) bool {
			return ls.Meta["existing_key"] == "keep" && ls.Meta["version"] == "2.0"
		})).Return(nil)

		result, err := m.service().Update(ctx, UpdateLearningSpaceInput{
			ProjectID: projectID,
			ID:        lsID,
			Meta:      map[string]interface{}{"version": "2.0"},
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "keep", result.Meta["existing_key"])
		assert.Equal(t, "2.0", result.Meta["version"])
		m.lsRepo.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(nil, gorm.ErrRecordNotFound)

		result, err := m.service().Update(ctx, UpdateLearningSpaceInput{
			ProjectID: projectID, ID: lsID, Meta: map[string]interface{}{},
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not found")
	})
}

// ---------------------------------------------------------------------------
// Service: Delete
// ---------------------------------------------------------------------------

func TestLearningSpaceService_Delete(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("Delete", ctx, projectID, lsID).Return(nil)

		err := m.service().Delete(ctx, projectID, lsID)

		assert.NoError(t, err)
		m.lsRepo.AssertExpectations(t)
	})

	t.Run("not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("Delete", ctx, projectID, lsID).Return(gorm.ErrRecordNotFound)

		err := m.service().Delete(ctx, projectID, lsID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})
}

// ---------------------------------------------------------------------------
// Service: Learn
// ---------------------------------------------------------------------------

func TestLearningSpaceService_Learn(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()
	sessionID := uuid.New()

	t.Run("success — creates pending record", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.sessionRepo.On("Get", ctx, mock.MatchedBy(func(s *model.Session) bool {
			return s.ID == sessionID
		})).Return(&model.Session{ID: sessionID, ProjectID: projectID}, nil)
		m.lsSessRepo.On("ExistsBySessionID", ctx, sessionID).Return(false, nil)
		m.lsSessRepo.On("Create", ctx, mock.MatchedBy(func(lss *model.LearningSpaceSession) bool {
			return lss.LearningSpaceID == lsID && lss.SessionID == sessionID && lss.Status == "pending"
		})).Return(nil)

		result, err := m.service().Learn(ctx, LearnInput{
			ProjectID:       projectID,
			LearningSpaceID: lsID,
			SessionID:       sessionID,
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "pending", result.Status)
		m.lsRepo.AssertExpectations(t)
		m.sessionRepo.AssertExpectations(t)
		m.lsSessRepo.AssertExpectations(t)
	})

	t.Run("session already learned — conflict", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.sessionRepo.On("Get", ctx, mock.Anything).Return(&model.Session{ID: sessionID, ProjectID: projectID}, nil)
		m.lsSessRepo.On("ExistsBySessionID", ctx, sessionID).Return(true, nil)

		result, err := m.service().Learn(ctx, LearnInput{
			ProjectID: projectID, LearningSpaceID: lsID, SessionID: sessionID,
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "already learned")
	})

	t.Run("space not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(nil, gorm.ErrRecordNotFound)

		result, err := m.service().Learn(ctx, LearnInput{
			ProjectID: projectID, LearningSpaceID: lsID, SessionID: sessionID,
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("session not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.sessionRepo.On("Get", ctx, mock.Anything).Return(nil, gorm.ErrRecordNotFound)

		result, err := m.service().Learn(ctx, LearnInput{
			ProjectID: projectID, LearningSpaceID: lsID, SessionID: sessionID,
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not found")
	})
}

// ---------------------------------------------------------------------------
// Service: IncludeSkill
// ---------------------------------------------------------------------------

func TestLearningSpaceService_IncludeSkill(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()
	skillID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.skillsRepo.On("GetByID", ctx, projectID, skillID).Return(&model.AgentSkills{ID: skillID}, nil)
		m.lsSkillRepo.On("Exists", ctx, lsID, skillID).Return(false, nil)
		m.lsSkillRepo.On("Create", ctx, mock.MatchedBy(func(lss *model.LearningSpaceSkill) bool {
			return lss.LearningSpaceID == lsID && lss.SkillID == skillID
		})).Return(nil)

		result, err := m.service().IncludeSkill(ctx, IncludeSkillInput{
			ProjectID: projectID, LearningSpaceID: lsID, SkillID: skillID,
		})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		m.lsRepo.AssertExpectations(t)
		m.skillsRepo.AssertExpectations(t)
		m.lsSkillRepo.AssertExpectations(t)
	})

	t.Run("duplicate — conflict", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.skillsRepo.On("GetByID", ctx, projectID, skillID).Return(&model.AgentSkills{ID: skillID}, nil)
		m.lsSkillRepo.On("Exists", ctx, lsID, skillID).Return(true, nil)

		result, err := m.service().IncludeSkill(ctx, IncludeSkillInput{
			ProjectID: projectID, LearningSpaceID: lsID, SkillID: skillID,
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "already included")
	})

	t.Run("skill not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.skillsRepo.On("GetByID", ctx, projectID, skillID).Return(nil, gorm.ErrRecordNotFound)

		result, err := m.service().IncludeSkill(ctx, IncludeSkillInput{
			ProjectID: projectID, LearningSpaceID: lsID, SkillID: skillID,
		})

		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not found")
	})
}

// ---------------------------------------------------------------------------
// Service: ExcludeSkill (idempotent)
// ---------------------------------------------------------------------------

func TestLearningSpaceService_ExcludeSkill(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()
	skillID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.lsSkillRepo.On("Delete", ctx, lsID, skillID).Return(nil)

		err := m.service().ExcludeSkill(ctx, projectID, lsID, skillID)

		assert.NoError(t, err)
		m.lsRepo.AssertExpectations(t)
		m.lsSkillRepo.AssertExpectations(t)
	})

	t.Run("space not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(nil, gorm.ErrRecordNotFound)

		err := m.service().ExcludeSkill(ctx, projectID, lsID, skillID)

		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
		m.lsSkillRepo.AssertNotCalled(t, "Delete")
	})
}

// ---------------------------------------------------------------------------
// Service: List
// ---------------------------------------------------------------------------

func TestLearningSpaceService_List(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()

	t.Run("success with items", func(t *testing.T) {
		m := newLSMocks()
		items := []*model.LearningSpace{
			{ID: uuid.New(), ProjectID: projectID, CreatedAt: time.Now()},
			{ID: uuid.New(), ProjectID: projectID, CreatedAt: time.Now()},
		}
		m.lsRepo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, mock.Anything, 21, false).
			Return(items, nil)

		result, err := m.service().List(ctx, ListLearningSpacesInput{ProjectID: projectID, Limit: 20})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 2)
		assert.False(t, result.HasMore)
	})

	t.Run("has_more when limit+1 returned", func(t *testing.T) {
		m := newLSMocks()
		items := make([]*model.LearningSpace, 21)
		for i := range items {
			items[i] = &model.LearningSpace{ID: uuid.New(), ProjectID: projectID, CreatedAt: time.Now()}
		}
		m.lsRepo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, mock.Anything, 21, false).
			Return(items, nil)

		result, err := m.service().List(ctx, ListLearningSpacesInput{ProjectID: projectID, Limit: 20})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Len(t, result.Items, 20)
		assert.True(t, result.HasMore)
		assert.NotEmpty(t, result.NextCursor)
	})

	t.Run("empty result", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("ListWithCursor", mock.Anything, projectID, "", mock.Anything, mock.Anything, mock.Anything, 21, false).
			Return([]*model.LearningSpace{}, nil)

		result, err := m.service().List(ctx, ListLearningSpacesInput{ProjectID: projectID, Limit: 20})

		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Empty(t, result.Items)
		assert.False(t, result.HasMore)
	})
}

// ---------------------------------------------------------------------------
// Service: ListSkills / ListSessions
// ---------------------------------------------------------------------------

func TestLearningSpaceService_ListSkills(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.lsSkillRepo.On("ListBySpaceID", ctx, lsID).Return([]*model.AgentSkills{
			{ID: uuid.New(), Name: "skill-1"},
		}, nil)

		result, err := m.service().ListSkills(ctx, projectID, lsID)

		assert.NoError(t, err)
		assert.Len(t, result, 1)
	})

	t.Run("space not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(nil, gorm.ErrRecordNotFound)

		result, err := m.service().ListSkills(ctx, projectID, lsID)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestLearningSpaceService_ListSessions(t *testing.T) {
	ctx := context.Background()
	projectID := uuid.New()
	lsID := uuid.New()

	t.Run("success", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(&model.LearningSpace{ID: lsID, ProjectID: projectID}, nil)
		m.lsSessRepo.On("ListBySpaceID", ctx, lsID).Return([]*model.LearningSpaceSession{
			{ID: uuid.New(), Status: "pending"},
		}, nil)

		result, err := m.service().ListSessions(ctx, projectID, lsID)

		assert.NoError(t, err)
		assert.Len(t, result, 1)
	})

	t.Run("space not found", func(t *testing.T) {
		m := newLSMocks()
		m.lsRepo.On("GetByID", ctx, projectID, lsID).Return(nil, gorm.ErrRecordNotFound)

		result, err := m.service().ListSessions(ctx, projectID, lsID)

		assert.Error(t, err)
		assert.Nil(t, result)
	})
}
