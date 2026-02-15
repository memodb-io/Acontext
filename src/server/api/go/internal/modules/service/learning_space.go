package service

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
	"github.com/memodb-io/Acontext/internal/pkg/paging"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

type LearningSpaceService interface {
	Create(ctx context.Context, in CreateLearningSpaceInput) (*model.LearningSpace, error)
	GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.LearningSpace, error)
	Update(ctx context.Context, in UpdateLearningSpaceInput) (*model.LearningSpace, error)
	Delete(ctx context.Context, projectID, id uuid.UUID) error
	List(ctx context.Context, in ListLearningSpacesInput) (*ListLearningSpacesOutput, error)
	Learn(ctx context.Context, in LearnInput) (*model.LearningSpaceSession, error)
	IncludeSkill(ctx context.Context, in IncludeSkillInput) (*model.LearningSpaceSkill, error)
	ListSkills(ctx context.Context, projectID, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error)
	ListSessions(ctx context.Context, projectID, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error)
	ExcludeSkill(ctx context.Context, projectID, learningSpaceID, skillID uuid.UUID) error
}

// ---------------------------------------------------------------------------
// Input / Output structs
// ---------------------------------------------------------------------------

type CreateLearningSpaceInput struct {
	ProjectID uuid.UUID
	UserID    *uuid.UUID
	Meta      map[string]interface{}
}

type UpdateLearningSpaceInput struct {
	ProjectID uuid.UUID
	ID        uuid.UUID
	Meta      map[string]interface{}
}

type ListLearningSpacesInput struct {
	ProjectID    uuid.UUID
	User         string
	FilterByMeta map[string]interface{}
	Limit        int
	Cursor       string
	TimeDesc     bool
}

type ListLearningSpacesOutput struct {
	Items      []*model.LearningSpace `json:"items"`
	NextCursor string                 `json:"next_cursor,omitempty"`
	HasMore    bool                   `json:"has_more"`
}

type LearnInput struct {
	ProjectID       uuid.UUID
	LearningSpaceID uuid.UUID
	SessionID       uuid.UUID
}

type IncludeSkillInput struct {
	ProjectID       uuid.UUID
	LearningSpaceID uuid.UUID
	SkillID         uuid.UUID
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

type learningSpaceService struct {
	lsRepo         repo.LearningSpaceRepo
	lsSkillRepo    repo.LearningSpaceSkillRepo
	lsSessRepo     repo.LearningSpaceSessionRepo
	skillsRepo     repo.AgentSkillsRepo
	sessionRepo    repo.SessionRepo
	agentSkillsSvc AgentSkillsService
	templateFS     fs.ReadFileFS
}

// DefaultSkillTemplatePaths lists the embedded template paths created alongside
// every new learning space. Exported so bootstrap validation can reference the
// same list without duplication.
var DefaultSkillTemplatePaths = []string{
	"skill_templates/daily-logs/SKILL.md",
	"skill_templates/user-general-facts/SKILL.md",
}

func NewLearningSpaceService(
	lsRepo repo.LearningSpaceRepo,
	lsSkillRepo repo.LearningSpaceSkillRepo,
	lsSessRepo repo.LearningSpaceSessionRepo,
	skillsRepo repo.AgentSkillsRepo,
	sessionRepo repo.SessionRepo,
	agentSkillsSvc AgentSkillsService,
	templateFS fs.ReadFileFS,
) LearningSpaceService {
	return &learningSpaceService{
		lsRepo:         lsRepo,
		lsSkillRepo:    lsSkillRepo,
		lsSessRepo:     lsSessRepo,
		skillsRepo:     skillsRepo,
		sessionRepo:    sessionRepo,
		agentSkillsSvc: agentSkillsSvc,
		templateFS:     templateFS,
	}
}

func (s *learningSpaceService) Create(ctx context.Context, in CreateLearningSpaceInput) (*model.LearningSpace, error) {
	ls := &model.LearningSpace{
		ProjectID: in.ProjectID,
		UserID:    in.UserID,
		Meta:      in.Meta,
	}
	if err := s.lsRepo.Create(ctx, ls); err != nil {
		return nil, fmt.Errorf("create learning space: %w", err)
	}
	if err := s.initDefaultSkills(ctx, ls); err != nil {
		return nil, err
	}
	return ls, nil
}

// initDefaultSkills creates the default skills from embedded templates and
// links them to the given learning space. On failure it performs best-effort
// cleanup of any resources already created (skills, disks, the space itself).
func (s *learningSpaceService) initDefaultSkills(ctx context.Context, ls *model.LearningSpace) (retErr error) {
	var createdSkills []*model.AgentSkills
	defer func() {
		if retErr == nil {
			return
		}
		// Use context.Background() — the original ctx may be cancelled
		cleanupCtx := context.Background()
		var cleanupErrs []error
		for _, skill := range createdSkills {
			if err := s.agentSkillsSvc.Delete(cleanupCtx, ls.ProjectID, skill.ID); err != nil {
				cleanupErrs = append(cleanupErrs, fmt.Errorf("delete skill %s: %w", skill.ID, err))
			}
		}
		if err := s.lsRepo.Delete(cleanupCtx, ls.ProjectID, ls.ID); err != nil {
			cleanupErrs = append(cleanupErrs, fmt.Errorf("delete learning space %s: %w", ls.ID, err))
		}
		if len(cleanupErrs) > 0 {
			retErr = fmt.Errorf("%w (cleanup errors: %v)", retErr, errors.Join(cleanupErrs...))
		}
	}()

	for _, tmplPath := range DefaultSkillTemplatePaths {
		content, err := s.templateFS.ReadFile(tmplPath)
		if err != nil {
			return fmt.Errorf("read template %s: %w", tmplPath, err)
		}
		skill, err := s.agentSkillsSvc.CreateFromTemplate(ctx, CreateFromTemplateInput{
			ProjectID: ls.ProjectID,
			UserID:    ls.UserID,
			Content:   content,
		})
		if err != nil {
			return fmt.Errorf("create skill from template %s: %w", tmplPath, err)
		}
		createdSkills = append(createdSkills, skill)
		if err := s.lsSkillRepo.Create(ctx, &model.LearningSpaceSkill{
			LearningSpaceID: ls.ID,
			SkillID:         skill.ID,
		}); err != nil {
			return fmt.Errorf("link skill %s to space: %w", skill.ID, err)
		}
	}
	return nil
}

func (s *learningSpaceService) GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.LearningSpace, error) {
	ls, err := s.lsRepo.GetByID(ctx, projectID, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("learning space not found")
		}
		return nil, err
	}
	return ls, nil
}

func (s *learningSpaceService) Update(ctx context.Context, in UpdateLearningSpaceInput) (*model.LearningSpace, error) {
	ls, err := s.lsRepo.GetByID(ctx, in.ProjectID, in.ID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("learning space not found")
		}
		return nil, err
	}

	// Merge meta: existing keys not in the request are preserved
	if ls.Meta == nil {
		ls.Meta = make(map[string]interface{})
	}
	for k, v := range in.Meta {
		ls.Meta[k] = v
	}

	if err := s.lsRepo.Update(ctx, ls); err != nil {
		return nil, fmt.Errorf("update learning space: %w", err)
	}
	return ls, nil
}

func (s *learningSpaceService) Delete(ctx context.Context, projectID, id uuid.UUID) error {
	if err := s.lsRepo.Delete(ctx, projectID, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("learning space not found")
		}
		return err
	}
	return nil
}

func (s *learningSpaceService) List(ctx context.Context, in ListLearningSpacesInput) (*ListLearningSpacesOutput, error) {
	// Parse cursor
	var afterT time.Time
	var afterID uuid.UUID
	var err error
	if in.Cursor != "" {
		afterT, afterID, err = paging.DecodeCursor(in.Cursor)
		if err != nil {
			return nil, err
		}
	}

	// Query limit+1 to determine has_more
	items, err := s.lsRepo.ListWithCursor(ctx, in.ProjectID, in.User, in.FilterByMeta, afterT, afterID, in.Limit+1, in.TimeDesc)
	if err != nil {
		return nil, err
	}

	// Determine pagination
	hasMore := len(items) > in.Limit
	if hasMore {
		items = items[:in.Limit]
	}

	out := &ListLearningSpacesOutput{
		Items:   items,
		HasMore: hasMore,
	}
	if hasMore && len(items) > 0 {
		last := items[len(items)-1]
		out.NextCursor = paging.EncodeCursor(last.CreatedAt, last.ID)
	}

	return out, nil
}

func (s *learningSpaceService) Learn(ctx context.Context, in LearnInput) (*model.LearningSpaceSession, error) {
	// Validate space exists
	if _, err := s.GetByID(ctx, in.ProjectID, in.LearningSpaceID); err != nil {
		return nil, err
	}

	// Validate session exists and belongs to the same project
	sess := &model.Session{ID: in.SessionID}
	foundSess, err := s.sessionRepo.Get(ctx, sess)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("session not found")
		}
		return nil, err
	}
	if foundSess.ProjectID != in.ProjectID {
		return nil, fmt.Errorf("session not found")
	}

	// Check session not already learned by any space
	exists, err := s.lsSessRepo.ExistsBySessionID(ctx, in.SessionID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("session already learned by another space")
	}

	// Create learn record with pending status
	record := &model.LearningSpaceSession{
		LearningSpaceID: in.LearningSpaceID,
		SessionID:       in.SessionID,
		Status:          "pending",
	}
	if err := s.lsSessRepo.Create(ctx, record); err != nil {
		return nil, fmt.Errorf("create learn record: %w", err)
	}

	return record, nil
}

func (s *learningSpaceService) IncludeSkill(ctx context.Context, in IncludeSkillInput) (*model.LearningSpaceSkill, error) {
	// Validate space exists
	if _, err := s.GetByID(ctx, in.ProjectID, in.LearningSpaceID); err != nil {
		return nil, err
	}

	// Validate skill exists
	skill, err := s.skillsRepo.GetByID(ctx, in.ProjectID, in.SkillID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("skill not found")
		}
		return nil, err
	}

	// Check no duplicate by skill ID
	exists, err := s.lsSkillRepo.Exists(ctx, in.LearningSpaceID, in.SkillID)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("skill already included in this space")
	}

	// Check no duplicate by skill name
	nameExists, err := s.lsSkillRepo.ExistsByName(ctx, in.LearningSpaceID, skill.Name)
	if err != nil {
		return nil, err
	}
	if nameExists {
		return nil, fmt.Errorf("skill with name '%s' already exists in this space", skill.Name)
	}

	// Create junction
	record := &model.LearningSpaceSkill{
		LearningSpaceID: in.LearningSpaceID,
		SkillID:         in.SkillID,
	}
	if err := s.lsSkillRepo.Create(ctx, record); err != nil {
		return nil, fmt.Errorf("include skill: %w", err)
	}

	return record, nil
}

func (s *learningSpaceService) ListSkills(ctx context.Context, projectID, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error) {
	// Validate space exists
	if _, err := s.GetByID(ctx, projectID, learningSpaceID); err != nil {
		return nil, err
	}

	return s.lsSkillRepo.ListBySpaceID(ctx, learningSpaceID)
}

func (s *learningSpaceService) ListSessions(ctx context.Context, projectID, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error) {
	// Validate space exists
	if _, err := s.GetByID(ctx, projectID, learningSpaceID); err != nil {
		return nil, err
	}

	return s.lsSessRepo.ListBySpaceID(ctx, learningSpaceID)
}

func (s *learningSpaceService) ExcludeSkill(ctx context.Context, projectID, learningSpaceID, skillID uuid.UUID) error {
	// Validate space exists
	if _, err := s.GetByID(ctx, projectID, learningSpaceID); err != nil {
		return err
	}

	// Idempotent: delete junction record (no error if not found)
	return s.lsSkillRepo.Delete(ctx, learningSpaceID, skillID)
}
