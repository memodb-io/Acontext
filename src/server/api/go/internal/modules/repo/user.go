package repo

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type UserRepo interface {
	Create(ctx context.Context, u *model.User) error
	GetByIdentifier(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error)
	GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error)
	Delete(ctx context.Context, projectID uuid.UUID, identifier string) error
	List(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.User, error)
	GetResourceCounts(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) (*UserResourceCounts, error)
}

type UserResourceCounts struct {
	SpacesCount   int64 `json:"spaces_count"`
	SessionsCount int64 `json:"sessions_count"`
	DisksCount    int64 `json:"disks_count"`
	SkillsCount   int64 `json:"skills_count"`
}

type userRepo struct{ db *gorm.DB }

func NewUserRepo(db *gorm.DB) UserRepo {
	return &userRepo{db: db}
}

func (r *userRepo) Create(ctx context.Context, u *model.User) error {
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *userRepo) GetByIdentifier(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND identifier = ?", projectID, identifier).
		First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *userRepo) GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).
		Where("project_id = ? AND identifier = ?", projectID, identifier).
		First(&u).Error

	if err == nil {
		return &u, nil
	}

	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	// User not found, create new one
	u = model.User{
		ProjectID:  projectID,
		Identifier: identifier,
	}
	if err := r.db.WithContext(ctx).Create(&u).Error; err != nil {
		// Handle race condition: another request might have created the user
		// Try to get it again
		var existing model.User
		if getErr := r.db.WithContext(ctx).
			Where("project_id = ? AND identifier = ?", projectID, identifier).
			First(&existing).Error; getErr == nil {
			return &existing, nil
		}
		return nil, err
	}

	return &u, nil
}

func (r *userRepo) Delete(ctx context.Context, projectID uuid.UUID, identifier string) error {
	return r.db.WithContext(ctx).
		Where("project_id = ? AND identifier = ?", projectID, identifier).
		Delete(&model.User{}).Error
}

func (r *userRepo) List(ctx context.Context, projectID uuid.UUID, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.User, error) {
	q := r.db.WithContext(ctx).Where("users.project_id = ?", projectID)

	// Apply cursor-based pagination filter if cursor is provided
	if !afterCreatedAt.IsZero() && afterID != uuid.Nil {
		// Determine comparison operator based on sort direction
		comparisonOp := ">"
		if timeDesc {
			comparisonOp = "<"
		}
		q = q.Where(
			"(users.created_at "+comparisonOp+" ?) OR (users.created_at = ? AND users.id "+comparisonOp+" ?)",
			afterCreatedAt, afterCreatedAt, afterID,
		)
	}

	// Apply ordering based on sort direction
	orderBy := "users.created_at ASC, users.id ASC"
	if timeDesc {
		orderBy = "users.created_at DESC, users.id DESC"
	}

	var users []*model.User
	query := q.Order(orderBy)
	// Only apply limit if limit > 0
	if limit > 0 {
		query = query.Limit(limit)
	}
	return users, query.Find(&users).Error
}

func (r *userRepo) GetResourceCounts(ctx context.Context, projectID uuid.UUID, userID uuid.UUID) (*UserResourceCounts, error) {
	counts := &UserResourceCounts{}

	// Count spaces
	var spacesCount int64
	err := r.db.WithContext(ctx).
		Model(&model.Space{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&spacesCount).Error
	if err != nil {
		return nil, err
	}
	counts.SpacesCount = spacesCount

	// Count sessions
	var sessionsCount int64
	err = r.db.WithContext(ctx).
		Model(&model.Session{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&sessionsCount).Error
	if err != nil {
		return nil, err
	}
	counts.SessionsCount = sessionsCount

	// Count disks
	var disksCount int64
	err = r.db.WithContext(ctx).
		Model(&model.Disk{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&disksCount).Error
	if err != nil {
		return nil, err
	}
	counts.DisksCount = disksCount

	// Count agent skills
	var skillsCount int64
	err = r.db.WithContext(ctx).
		Model(&model.AgentSkills{}).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Count(&skillsCount).Error
	if err != nil {
		return nil, err
	}
	counts.SkillsCount = skillsCount

	return counts, nil
}
