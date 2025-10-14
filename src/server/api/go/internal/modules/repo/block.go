package repo

import (
	"context"
	"math"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BlockRepo interface {
	Create(ctx context.Context, b *model.Block) error
	Delete(ctx context.Context, spaceID uuid.UUID, id uuid.UUID) error
	Get(ctx context.Context, id uuid.UUID) (*model.Block, error)
	Update(ctx context.Context, b *model.Block) error
	ListChildren(ctx context.Context, parentID uuid.UUID) ([]model.Block, error)
	ListBySpace(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error)
	ListBlocksExcludingPages(ctx context.Context, spaceID uuid.UUID, parentID uuid.UUID) ([]model.Block, error)
	BulkUpdateSort(ctx context.Context, items map[uuid.UUID]int64) error
	UpdateParent(ctx context.Context, id uuid.UUID, parentID *uuid.UUID) error
	UpdateSort(ctx context.Context, id uuid.UUID, sort int64) error
	NextSort(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) (int64, error)
	MoveToParentAppend(ctx context.Context, id uuid.UUID, newParentID *uuid.UUID) error
	ReorderWithinGroup(ctx context.Context, id uuid.UUID, newSort int64) error
	MoveToParentAtSort(ctx context.Context, id uuid.UUID, newParentID *uuid.UUID, targetSort int64) error
}

type blockRepo struct{ db *gorm.DB }

func NewBlockRepo(db *gorm.DB) BlockRepo { return &blockRepo{db: db} }

func (r *blockRepo) Create(ctx context.Context, b *model.Block) error {
	return r.db.WithContext(ctx).Create(b).Error
}

func (r *blockRepo) Delete(ctx context.Context, spaceID uuid.UUID, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where(&model.Block{ID: id, SpaceID: spaceID}).Delete(&model.Block{}).Error
}

func (r *blockRepo) Get(ctx context.Context, id uuid.UUID) (*model.Block, error) {
	var b model.Block
	return &b, r.db.WithContext(ctx).Where(&model.Block{ID: id}).First(&b).Error
}

func (r *blockRepo) Update(ctx context.Context, b *model.Block) error {
	return r.db.WithContext(ctx).Where(&model.Block{ID: b.ID}).Updates(b).Error
}

func (r *blockRepo) ListChildren(ctx context.Context, parentID uuid.UUID) ([]model.Block, error) {
	var list []model.Block
	err := r.db.WithContext(ctx).Where(&model.Block{ParentID: &parentID}).Order("sort ASC").Find(&list).Error
	return list, err
}

func (r *blockRepo) ListBySpace(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error) {
	var list []model.Block
	query := r.db.WithContext(ctx).Where(&model.Block{SpaceID: spaceID})

	if blockType != "" {
		query = query.Where("type = ?", blockType)
	}

	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}

	err := query.Order("sort ASC").Find(&list).Error
	return list, err
}

func (r *blockRepo) ListBlocksExcludingPages(ctx context.Context, spaceID uuid.UUID, parentID uuid.UUID) ([]model.Block, error) {
	var list []model.Block
	err := r.db.WithContext(ctx).
		Where(&model.Block{SpaceID: spaceID, ParentID: &parentID}).
		Where("type != ?", model.BlockTypePage).
		Order("sort ASC").
		Find(&list).Error
	return list, err
}

func (r *blockRepo) BulkUpdateSort(ctx context.Context, items map[uuid.UUID]int64) error {
	tx := r.db.WithContext(ctx).Begin()
	for id, sort := range items {
		if err := tx.Model(&model.Block{}).Where(&model.Block{ID: id}).Update("sort", sort).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit().Error
}

func (r *blockRepo) UpdateParent(ctx context.Context, id uuid.UUID, parentID *uuid.UUID) error {
	return r.db.WithContext(ctx).Model(&model.Block{}).Where(&model.Block{ID: id}).Update("parent_id", parentID).Error
}

func (r *blockRepo) UpdateSort(ctx context.Context, id uuid.UUID, sort int64) error {
	return r.db.WithContext(ctx).Model(&model.Block{}).Where(&model.Block{ID: id}).Update("sort", sort).Error
}

// NextSort returns max(sort)+1 within group (space_id, parent_id)
func (r *blockRepo) NextSort(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) (int64, error) {
	type result struct{ Next int64 }
	var res result
	db := r.db.WithContext(ctx).Model(&model.Block{}).Select("COALESCE(MAX(sort), -1) + 1 AS next").Where(&model.Block{SpaceID: spaceID})
	if parentID == nil {
		db = db.Where("parent_id IS NULL")
	} else {
		db = db.Where("parent_id = ?", *parentID)
	}
	if err := db.Take(&res).Error; err != nil {
		return 0, err
	}
	return res.Next, nil
}

// MoveToParentAppend moves the block to new parent and sets sort to tail in a single transaction.
func (r *blockRepo) MoveToParentAppend(ctx context.Context, id uuid.UUID, newParentID *uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var b model.Block
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(&model.Block{ID: id}).First(&b).Error; err != nil {
			return err
		}
		// compute next sort in target group
		var next int64
		q := tx.Model(&model.Block{}).Select("COALESCE(MAX(sort), -1) + 1")
		q = q.Where(&model.Block{SpaceID: b.SpaceID})
		if newParentID == nil {
			q = q.Where("parent_id IS NULL")
		} else {
			q = q.Where("parent_id = ?", *newParentID)
		}
		if err := q.Take(&next).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.Block{}).Where(&model.Block{ID: id}).Updates(map[string]any{
			"parent_id": newParentID,
			"sort":      next,
		}).Error; err != nil {
			return err
		}
		return nil
	})
}

// ReorderWithinGroup safely reorders an item to newSort within its current (space_id, parent_id) group.
func (r *blockRepo) ReorderWithinGroup(ctx context.Context, id uuid.UUID, newSort int64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var b model.Block
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(&model.Block{ID: id}).First(&b).Error; err != nil {
			return err
		}
		if newSort < 0 {
			newSort = 0
		}
		if newSort == b.Sort {
			return nil
		}

		// Temporarily set to a sentinel to avoid unique conflict during bulk shift
		if err := tx.Model(&model.Block{}).Where(&model.Block{ID: id}).Update("sort", math.MinInt64).Error; err != nil {
			return err
		}

		group := tx.Model(&model.Block{}).Where(&model.Block{SpaceID: b.SpaceID})
		if b.ParentID == nil {
			group = group.Where("parent_id IS NULL")
		} else {
			group = group.Where("parent_id = ?", *b.ParentID)
		}

		if newSort < b.Sort {
			if err := group.Where("sort >= ? AND sort < ?", newSort, b.Sort).Update("sort", gorm.Expr("sort + 1")).Error; err != nil {
				return err
			}
		} else { // newSort > b.Sort
			if err := group.Where("sort <= ? AND sort > ?", newSort, b.Sort).Update("sort", gorm.Expr("sort - 1")).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&model.Block{}).Where(&model.Block{ID: id}).Update("sort", newSort).Error; err != nil {
			return err
		}
		return nil
	})
}

// MoveToParentAtSort moves a block to a specific position in the target parent group.
func (r *blockRepo) MoveToParentAtSort(ctx context.Context, id uuid.UUID, newParentID *uuid.UUID, targetSort int64) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Lock and load current block
		var b model.Block
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(&model.Block{ID: id}).First(&b).Error; err != nil {
			return err
		}

		// If moving within same group, delegate to reorder
		sameGroup := false
		if b.ParentID == nil && newParentID == nil {
			sameGroup = true
		} else if b.ParentID != nil && newParentID != nil && *b.ParentID == *newParentID {
			sameGroup = true
		}
		if sameGroup {
			return r.ReorderWithinGroup(ctx, id, targetSort)
		}

		// Normalize targetSort within [0, max+1]
		var maxSort int64
		q := tx.Model(&model.Block{}).Select("COALESCE(MAX(sort), -1)").Where(&model.Block{SpaceID: b.SpaceID})
		if newParentID == nil {
			q = q.Where("parent_id IS NULL")
		} else {
			q = q.Where("parent_id = ?", *newParentID)
		}
		if err := q.Take(&maxSort).Error; err != nil {
			return err
		}
		if targetSort < 0 {
			targetSort = 0
		}
		if targetSort > maxSort+1 {
			targetSort = maxSort + 1
		}

		// 1) Close gap in old group by shifting down items after current position
		oldGroup := tx.Model(&model.Block{}).Where(&model.Block{SpaceID: b.SpaceID})
		if b.ParentID == nil {
			oldGroup = oldGroup.Where("parent_id IS NULL")
		} else {
			oldGroup = oldGroup.Where("parent_id = ?", *b.ParentID)
		}
		if err := oldGroup.Where("sort > ?", b.Sort).Update("sort", gorm.Expr("sort - 1")).Error; err != nil {
			return err
		}

		// 2) Make space in target group by shifting up items from targetSort
		newGroup := tx.Model(&model.Block{}).Where(&model.Block{SpaceID: b.SpaceID})
		if newParentID == nil {
			newGroup = newGroup.Where("parent_id IS NULL")
		} else {
			newGroup = newGroup.Where("parent_id = ?", *newParentID)
		}
		if err := newGroup.Where("sort >= ?", targetSort).Update("sort", gorm.Expr("sort + 1")).Error; err != nil {
			return err
		}

		// 3) Move target to new parent and targetSort
		if err := tx.Model(&model.Block{}).Where(&model.Block{ID: id}).Updates(map[string]any{
			"parent_id": newParentID,
			"sort":      targetSort,
		}).Error; err != nil {
			return err
		}

		return nil
	})
}
