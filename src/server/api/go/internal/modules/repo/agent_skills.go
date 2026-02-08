package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type AgentSkillsRepo interface {
	Create(ctx context.Context, as *model.AgentSkills) error
	GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error)
	Update(ctx context.Context, as *model.AgentSkills) error
	Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
	ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.AgentSkills, error)
}

type agentSkillsRepo struct {
	db *gorm.DB
}

func NewAgentSkillsRepo(db *gorm.DB) AgentSkillsRepo {
	return &agentSkillsRepo{
		db: db,
	}
}

func (r *agentSkillsRepo) Create(ctx context.Context, as *model.AgentSkills) error {
	return r.db.WithContext(ctx).Create(as).Error
}

func (r *agentSkillsRepo) GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error) {
	var as model.AgentSkills
	err := r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", id, projectID).
		First(&as).Error
	if err != nil {
		return nil, err
	}
	return &as, nil
}

func (r *agentSkillsRepo) Update(ctx context.Context, as *model.AgentSkills) error {
	return r.db.WithContext(ctx).
		Where("id = ? AND project_id = ?", as.ID, as.ProjectID).
		Updates(as).Error
}

func (r *agentSkillsRepo) Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var as model.AgentSkills
		if err := tx.Where("id = ? AND project_id = ?", id, projectID).First(&as).Error; err != nil {
			return err
		}

		if err := tx.Delete(&as).Error; err != nil {
			return fmt.Errorf("delete agent_skills: %w", err)
		}

		return nil
	})
}

func (r *agentSkillsRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, userIdentifier string, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.AgentSkills, error) {
	q := r.db.WithContext(ctx).Where("agent_skills.project_id = ?", projectID)

	// Filter by user identifier if provided
	if userIdentifier != "" {
		q = q.Joins("JOIN users ON users.id = agent_skills.user_id").
			Where("users.identifier = ?", userIdentifier)
	}

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(agent_skills.created_at "+comparisonOp+" ?) OR (agent_skills.created_at = ? AND agent_skills.id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "agent_skills.created_at ASC, agent_skills.id ASC"
	if timeDesc {
		orderBy = "agent_skills.created_at DESC, agent_skills.id DESC"
	}

	var agentSkills []*model.AgentSkills
	return agentSkills, q.Order(orderBy).Limit(limit).Find(&agentSkills).Error
}
