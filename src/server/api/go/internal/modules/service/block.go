package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
)

type BlockService interface {
	CreatePage(ctx context.Context, b *model.Block) error
	DeletePage(ctx context.Context, spaceID uuid.UUID, pageID uuid.UUID) error
	GetPageProperties(ctx context.Context, pageID uuid.UUID) (*model.Block, error)
	UpdatePageProperties(ctx context.Context, b *model.Block) error
	ListPageChildren(ctx context.Context, pageID uuid.UUID) ([]model.Block, error)
	ListPages(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) ([]model.Block, error)
	MovePage(ctx context.Context, pageID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error
	UpdatePageSort(ctx context.Context, pageID uuid.UUID, sort int64) error

	CreateBlock(ctx context.Context, b *model.Block) error
	DeleteBlock(ctx context.Context, spaceID uuid.UUID, blockID uuid.UUID) error
	GetBlockProperties(ctx context.Context, blockID uuid.UUID) (*model.Block, error)
	UpdateBlockProperties(ctx context.Context, b *model.Block) error
	ListBlockChildren(ctx context.Context, blockID uuid.UUID) ([]model.Block, error)
	ListBlocks(ctx context.Context, spaceID uuid.UUID, parentID uuid.UUID) ([]model.Block, error)
	MoveBlock(ctx context.Context, blockID uuid.UUID, newParentID uuid.UUID, targetSort *int64) error
	UpdateBlockSort(ctx context.Context, blockID uuid.UUID, sort int64) error
}

type blockService struct{ r repo.BlockRepo }

func NewBlockService(r repo.BlockRepo) BlockService { return &blockService{r: r} }

func (s *blockService) CreatePage(ctx context.Context, b *model.Block) error {
	if b.Type == "" {
		b.Type = model.BlockTypePage
	}

	if err := b.ValidateForCreation(); err != nil {
		return err
	}

	// Validate parent type: when parent_id is provided, it must be a page
	if b.ParentID != nil {
		parent, err := s.r.Get(ctx, *b.ParentID)
		if err != nil {
			return err
		}
		if parent.Type != model.BlockTypePage {
			return errors.New("parent must be a page")
		}
		if !parent.CanHaveChildren() {
			return errors.New("parent cannot have children")
		}
	}

	next, err := s.r.NextSort(ctx, b.SpaceID, b.ParentID)
	if err != nil {
		return err
	}
	b.Sort = next
	return s.r.Create(ctx, b)
}

func (s *blockService) DeletePage(ctx context.Context, spaceID uuid.UUID, pageID uuid.UUID) error {
	if len(pageID) == 0 {
		return errors.New("page id is empty")
	}
	return s.r.Delete(ctx, spaceID, pageID)
}

func (s *blockService) GetPageProperties(ctx context.Context, pageID uuid.UUID) (*model.Block, error) {
	if len(pageID) == 0 {
		return nil, errors.New("page id is empty")
	}
	return s.r.Get(ctx, pageID)
}

func (s *blockService) UpdatePageProperties(ctx context.Context, b *model.Block) error {
	if len(b.ID) == 0 {
		return errors.New("page id is empty")
	}
	return s.r.Update(ctx, b)
}

func (s *blockService) ListPageChildren(ctx context.Context, pageID uuid.UUID) ([]model.Block, error) {
	if len(pageID) == 0 {
		return nil, errors.New("page id is empty")
	}
	return s.r.ListChildren(ctx, pageID)
}

func (s *blockService) ListPages(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) ([]model.Block, error) {
	if len(spaceID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.r.ListBySpace(ctx, spaceID, model.BlockTypePage, parentID)
}

func (s *blockService) MovePage(ctx context.Context, pageID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error {
	if len(pageID) == 0 {
		return errors.New("page id is empty")
	}
	if newParentID != nil && *newParentID == pageID {
		return errors.New("new parent cannot be the same as the page")
	}
	// Validate parent type for moving: when newParentID is provided, it must allow children
	if newParentID != nil {
		parent, err := s.r.Get(ctx, *newParentID)
		if err != nil {
			return err
		}
		if parent.Type != model.BlockTypePage {
			return errors.New("new parent must be a page")
		}
		if !parent.CanHaveChildren() {
			return errors.New("new parent cannot have children")
		}
	}
	if targetSort == nil {
		return s.r.MoveToParentAppend(ctx, pageID, newParentID)
	}
	return s.r.MoveToParentAtSort(ctx, pageID, newParentID, *targetSort)
}

func (s *blockService) UpdatePageSort(ctx context.Context, pageID uuid.UUID, sort int64) error {
	if len(pageID) == 0 {
		return errors.New("page id is empty")
	}
	return s.r.ReorderWithinGroup(ctx, pageID, sort)
}

func (s *blockService) CreateBlock(ctx context.Context, b *model.Block) error {
	if b.Type == "" {
		return errors.New("block type is empty")
	}

	if err := b.ValidateForCreation(); err != nil {
		return err
	}

	// Validate if the parent block can have children
	if b.ParentID != nil {
		parent, err := s.r.Get(ctx, *b.ParentID)
		if err != nil {
			return err
		}
		if !parent.CanHaveChildren() {
			return errors.New("parent cannot have children")
		}
	}

	next, err := s.r.NextSort(ctx, b.SpaceID, b.ParentID)
	if err != nil {
		return err
	}
	b.Sort = next
	return s.r.Create(ctx, b)
}

func (s *blockService) DeleteBlock(ctx context.Context, spaceID uuid.UUID, blockID uuid.UUID) error {
	if len(blockID) == 0 {
		return errors.New("block id is empty")
	}
	return s.r.Delete(ctx, spaceID, blockID)
}

func (s *blockService) GetBlockProperties(ctx context.Context, blockID uuid.UUID) (*model.Block, error) {
	if len(blockID) == 0 {
		return nil, errors.New("block id is empty")
	}
	return s.r.Get(ctx, blockID)
}

func (s *blockService) UpdateBlockProperties(ctx context.Context, b *model.Block) error {
	if len(b.ID) == 0 {
		return errors.New("block id is empty")
	}
	return s.r.Update(ctx, b)
}

func (s *blockService) ListBlockChildren(ctx context.Context, blockID uuid.UUID) ([]model.Block, error) {
	if len(blockID) == 0 {
		return nil, errors.New("block id is empty")
	}
	return s.r.ListChildren(ctx, blockID)
}

func (s *blockService) ListBlocks(ctx context.Context, spaceID uuid.UUID, parentID uuid.UUID) ([]model.Block, error) {
	if len(spaceID) == 0 {
		return nil, errors.New("space id is empty")
	}
	if len(parentID) == 0 {
		return nil, errors.New("parent id is required")
	}
	return s.r.ListBlocksExcludingPages(ctx, spaceID, parentID)
}

func (s *blockService) MoveBlock(ctx context.Context, blockID uuid.UUID, newParentID uuid.UUID, targetSort *int64) error {
	if len(blockID) == 0 {
		return errors.New("block id is empty")
	}
	if newParentID == blockID {
		return errors.New("new parent cannot be the same as the block")
	}
	parent, err := s.r.Get(ctx, newParentID)
	if err != nil {
		return err
	}
	if !parent.CanHaveChildren() {
		return errors.New("new parent cannot have children")
	}
	if targetSort == nil {
		return s.r.MoveToParentAppend(ctx, blockID, &newParentID)
	}
	return s.r.MoveToParentAtSort(ctx, blockID, &newParentID, *targetSort)
}

func (s *blockService) UpdateBlockSort(ctx context.Context, blockID uuid.UUID, sort int64) error {
	if len(blockID) == 0 {
		return errors.New("block id is empty")
	}
	return s.r.ReorderWithinGroup(ctx, blockID, sort)
}
