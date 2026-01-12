package repo

import (
	"context"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
)

type UserRepo interface {
	Create(ctx context.Context, u *model.User) error
	GetByIdentifier(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error)
	GetOrCreate(ctx context.Context, projectID uuid.UUID, identifier string) (*model.User, error)
	Delete(ctx context.Context, projectID uuid.UUID, identifier string) error
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
