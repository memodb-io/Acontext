package repo

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/infra/blob"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type AgentSkillsRepo interface {
	Create(ctx context.Context, as *model.AgentSkills) error
	GetByID(ctx context.Context, projectID uuid.UUID, id uuid.UUID) (*model.AgentSkills, error)
	GetByName(ctx context.Context, projectID uuid.UUID, name string) (*model.AgentSkills, error)
	Update(ctx context.Context, as *model.AgentSkills) error
	Delete(ctx context.Context, projectID uuid.UUID, id uuid.UUID) error
	ListWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.AgentSkills, error)
}

type agentSkillsRepo struct {
	db *gorm.DB
	s3 *blob.S3Deps
}

func NewAgentSkillsRepo(db *gorm.DB, s3 *blob.S3Deps) AgentSkillsRepo {
	return &agentSkillsRepo{
		db: db,
		s3: s3,
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

func (r *agentSkillsRepo) GetByName(ctx context.Context, projectID uuid.UUID, name string) (*model.AgentSkills, error) {
	var as model.AgentSkills
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND name = ?", projectID, name).
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
	// Use transaction to ensure atomicity
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Verify agent_skills exists and belongs to project
		var as model.AgentSkills
		if err := tx.Where("id = ? AND project_id = ?", id, projectID).First(&as).Error; err != nil {
			return err
		}

		// Collect all file S3 keys for batch deletion
		baseAsset := as.AssetMeta.Data()
		fileIndex := as.FileIndex.Data()
		s3Keys := make([]string, 0, len(fileIndex))
		for _, path := range fileIndex {
			fullS3Key := baseAsset.S3Key + "/" + path
			s3Keys = append(s3Keys, fullS3Key)
		}

		// Delete the agent_skills record
		if err := tx.Delete(&as).Error; err != nil {
			return fmt.Errorf("delete agent_skills: %w", err)
		}

		// Delete all files from S3
		if len(s3Keys) > 0 {
			if err := r.s3.DeleteObjects(ctx, s3Keys); err != nil {
				return fmt.Errorf("delete files from S3: %w", err)
			}
		}

		return nil
	})
}

func (r *agentSkillsRepo) ListWithCursor(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.AgentSkills, error) {
	q := r.db.WithContext(ctx).Where("project_id = ?", projectID)

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(created_at "+comparisonOp+" ?) OR (created_at = ? AND id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "created_at ASC, id ASC"
	if timeDesc {
		orderBy = "created_at DESC, id DESC"
	}

	var agentSkills []*model.AgentSkills
	return agentSkills, q.Order(orderBy).Limit(limit).Find(&agentSkills).Error
}
