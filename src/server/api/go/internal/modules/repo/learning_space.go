package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// LearningSpaceRepo
// ---------------------------------------------------------------------------

type LearningSpaceRepo interface {
	Create(ctx context.Context, ls *model.LearningSpace) error
	GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.LearningSpace, error)
	Update(ctx context.Context, ls *model.LearningSpace) error
	Delete(ctx context.Context, projectID, id uuid.UUID) error
	ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByMeta map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.LearningSpace, error)
}

type learningSpaceRepo struct {
	db *gorm.DB
}

func NewLearningSpaceRepo(db *gorm.DB) LearningSpaceRepo {
	return &learningSpaceRepo{db: db}
}

func (r *learningSpaceRepo) Create(ctx context.Context, ls *model.LearningSpace) error {
	return r.db.WithContext(ctx).Create(ls).Error
}

func (r *learningSpaceRepo) GetByID(ctx context.Context, projectID, id uuid.UUID) (*model.LearningSpace, error) {
	var ls model.LearningSpace
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", id, projectID).
		First(&ls).Error
	if err != nil {
		return nil, err
	}
	return &ls, nil
}

func (r *learningSpaceRepo) Update(ctx context.Context, ls *model.LearningSpace) error {
	return r.db.WithContext(ctx).Save(ls).Error
}

func (r *learningSpaceRepo) Delete(ctx context.Context, projectID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ls model.LearningSpace
		if err := tx.Where("id = ? AND project_id = ?", id, projectID).First(&ls).Error; err != nil {
			return err
		}
		if err := tx.Delete(&ls).Error; err != nil {
			return fmt.Errorf("delete learning_space: %w", err)
		}
		return nil
	})
}

func (r *learningSpaceRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, filterByMeta map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.LearningSpace, error) {
	q := r.db.WithContext(ctx).Where("learning_spaces.project_id = ?", projectID)

	// Filter by user identifier if provided
	if userIdentifier != "" {
		q = q.Joins("JOIN users ON users.id = learning_spaces.user_id").
			Where("users.identifier = ?", userIdentifier)
	}

	// Apply meta filter if provided (non-nil and non-empty)
	// Uses PostgreSQL JSONB containment operator @> for efficient filtering
	if filterByMeta != nil && len(filterByMeta) > 0 {
		jsonBytes, err := json.Marshal(filterByMeta)
		if err != nil {
			return nil, fmt.Errorf("marshal filter_by_meta: %w", err)
		}
		q = q.Where("learning_spaces.meta @> ?", string(jsonBytes))
	}

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(learning_spaces.created_at "+comparisonOp+" ?) OR (learning_spaces.created_at = ? AND learning_spaces.id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "learning_spaces.created_at ASC, learning_spaces.id ASC"
	if timeDesc {
		orderBy = "learning_spaces.created_at DESC, learning_spaces.id DESC"
	}

	var items []*model.LearningSpace
	return items, q.Order(orderBy).Limit(limit).Find(&items).Error
}

// ---------------------------------------------------------------------------
// LearningSpaceSkillRepo
// ---------------------------------------------------------------------------

type LearningSpaceSkillRepo interface {
	Create(ctx context.Context, lss *model.LearningSpaceSkill) error
	Delete(ctx context.Context, learningSpaceID, skillID uuid.UUID) error
	ListBySpaceID(ctx context.Context, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error)
	Exists(ctx context.Context, learningSpaceID, skillID uuid.UUID) (bool, error)
	ExistsByName(ctx context.Context, learningSpaceID uuid.UUID, skillName string) (bool, error)
}

type learningSpaceSkillRepo struct {
	db *gorm.DB
}

func NewLearningSpaceSkillRepo(db *gorm.DB) LearningSpaceSkillRepo {
	return &learningSpaceSkillRepo{db: db}
}

func (r *learningSpaceSkillRepo) Create(ctx context.Context, lss *model.LearningSpaceSkill) error {
	return r.db.WithContext(ctx).Create(lss).Error
}

func (r *learningSpaceSkillRepo) Delete(ctx context.Context, learningSpaceID, skillID uuid.UUID) error {
	// Idempotent: no error if the junction record does not exist
	return r.db.WithContext(ctx).
		Where("learning_space_id = ? AND skill_id = ?", learningSpaceID, skillID).
		Delete(&model.LearningSpaceSkill{}).Error
}

func (r *learningSpaceSkillRepo) ListBySpaceID(ctx context.Context, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error) {
	var skills []*model.AgentSkills
	err := r.db.WithContext(ctx).
		Joins("JOIN learning_space_skills lss ON lss.skill_id = agent_skills.id").
		Where("lss.learning_space_id = ?", learningSpaceID).
		Find(&skills).Error
	return skills, err
}

func (r *learningSpaceSkillRepo) Exists(ctx context.Context, learningSpaceID, skillID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.LearningSpaceSkill{}).
		Where("learning_space_id = ? AND skill_id = ?", learningSpaceID, skillID).
		Count(&count).Error
	return count > 0, err
}

func (r *learningSpaceSkillRepo) ExistsByName(ctx context.Context, learningSpaceID uuid.UUID, skillName string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.LearningSpaceSkill{}).
		Joins("JOIN agent_skills ON agent_skills.id = learning_space_skills.skill_id").
		Where("learning_space_skills.learning_space_id = ? AND agent_skills.name = ?", learningSpaceID, skillName).
		Count(&count).Error
	return count > 0, err
}

// ---------------------------------------------------------------------------
// LearningSpaceSessionRepo
// ---------------------------------------------------------------------------

type LearningSpaceSessionRepo interface {
	Create(ctx context.Context, lss *model.LearningSpaceSession) error
	ExistsBySessionID(ctx context.Context, sessionID uuid.UUID) (bool, error)
	ListBySpaceID(ctx context.Context, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error)
}

type learningSpaceSessionRepo struct {
	db *gorm.DB
}

func NewLearningSpaceSessionRepo(db *gorm.DB) LearningSpaceSessionRepo {
	return &learningSpaceSessionRepo{db: db}
}

func (r *learningSpaceSessionRepo) Create(ctx context.Context, lss *model.LearningSpaceSession) error {
	return r.db.WithContext(ctx).Create(lss).Error
}

func (r *learningSpaceSessionRepo) ExistsBySessionID(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&model.LearningSpaceSession{}).
		Where("session_id = ?", sessionID).
		Count(&count).Error
	return count > 0, err
}

func (r *learningSpaceSessionRepo) ListBySpaceID(ctx context.Context, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error) {
	var items []*model.LearningSpaceSession
	err := r.db.WithContext(ctx).
		Where("learning_space_id = ?", learningSpaceID).
		Order("created_at ASC").
		Find(&items).Error
	return items, err
}
