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

	CreateFolder(ctx context.Context, b *model.Block) error
	DeleteFolder(ctx context.Context, spaceID uuid.UUID, folderID uuid.UUID) error
	GetFolderProperties(ctx context.Context, folderID uuid.UUID) (*model.Block, error)
	UpdateFolderProperties(ctx context.Context, b *model.Block) error
	ListFolders(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) ([]model.Block, error)
	MoveFolder(ctx context.Context, folderID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error
	UpdateFolderSort(ctx context.Context, folderID uuid.UUID, sort int64) error

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

	// Validate parent type: when parent_id is provided, it must be a folder
	var parent *model.Block
	if b.ParentID != nil {
		var err error
		parent, err = s.r.Get(ctx, *b.ParentID)
		if err != nil {
			return err
		}
		if !parent.CanHaveChildren() {
			return errors.New("parent cannot have children")
		}
	}

	if err := b.ValidateParentType(parent); err != nil {
		return err
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

	// Get the page being moved
	page, err := s.r.Get(ctx, pageID)
	if err != nil {
		return err
	}

	// Validate parent type for moving: when newParentID is provided, it must be a folder
	var parent *model.Block
	if newParentID != nil {
		parent, err = s.r.Get(ctx, *newParentID)
		if err != nil {
			return err
		}
		if !parent.CanHaveChildren() {
			return errors.New("new parent cannot have children")
		}
	}

	if err := page.ValidateParentType(parent); err != nil {
		return err
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

	// Validate if the parent block can have children and parent type
	var parent *model.Block
	if b.ParentID != nil {
		var err error
		parent, err = s.r.Get(ctx, *b.ParentID)
		if err != nil {
			return err
		}
		if !parent.CanHaveChildren() {
			return errors.New("parent cannot have children")
		}
	}

	if err := b.ValidateParentType(parent); err != nil {
		return err
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

// Folder-related methods

func (s *blockService) CreateFolder(ctx context.Context, b *model.Block) error {
	if b.Type == "" {
		b.Type = model.BlockTypeFolder
	}

	if err := b.ValidateForCreation(); err != nil {
		return err
	}

	// Validate parent type: when parent_id is provided, it must be a folder
	var parent *model.Block
	if b.ParentID != nil {
		var err error
		parent, err = s.r.Get(ctx, *b.ParentID)
		if err != nil {
			return err
		}
		if !parent.CanHaveChildren() {
			return errors.New("parent cannot have children")
		}
	}

	if err := b.ValidateParentType(parent); err != nil {
		return err
	}

	// Calculate and set the folder path
	path := b.Title
	if parent != nil {
		parentPath := parent.GetFolderPath()
		if parentPath != "" {
			path = parentPath + "/" + b.Title
		}
	}
	b.SetFolderPath(path)

	next, err := s.r.NextSort(ctx, b.SpaceID, b.ParentID)
	if err != nil {
		return err
	}
	b.Sort = next
	return s.r.Create(ctx, b)
}

func (s *blockService) DeleteFolder(ctx context.Context, spaceID uuid.UUID, folderID uuid.UUID) error {
	if len(folderID) == 0 {
		return errors.New("folder id is empty")
	}
	return s.r.Delete(ctx, spaceID, folderID)
}

func (s *blockService) GetFolderProperties(ctx context.Context, folderID uuid.UUID) (*model.Block, error) {
	if len(folderID) == 0 {
		return nil, errors.New("folder id is empty")
	}
	return s.r.Get(ctx, folderID)
}

func (s *blockService) UpdateFolderProperties(ctx context.Context, b *model.Block) error {
	if len(b.ID) == 0 {
		return errors.New("folder id is empty")
	}
	return s.r.Update(ctx, b)
}

func (s *blockService) ListFolders(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) ([]model.Block, error) {
	if len(spaceID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.r.ListBySpace(ctx, spaceID, model.BlockTypeFolder, parentID)
}

func (s *blockService) MoveFolder(ctx context.Context, folderID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error {
	if len(folderID) == 0 {
		return errors.New("folder id is empty")
	}
	if newParentID != nil && *newParentID == folderID {
		return errors.New("new parent cannot be the same as the folder")
	}

	// Get the folder being moved
	folder, err := s.r.Get(ctx, folderID)
	if err != nil {
		return err
	}

	// Validate parent type for moving: when newParentID is provided, it must be a folder
	var parent *model.Block
	if newParentID != nil {
		parent, err = s.r.Get(ctx, *newParentID)
		if err != nil {
			return err
		}
		if !parent.CanHaveChildren() {
			return errors.New("new parent cannot have children")
		}
	}

	if err := folder.ValidateParentType(parent); err != nil {
		return err
	}

	// Update the folder path
	path := folder.Title
	if parent != nil {
		parentPath := parent.GetFolderPath()
		if parentPath != "" {
			path = parentPath + "/" + folder.Title
		}
	}
	folder.SetFolderPath(path)

	// Update the folder properties with the new path
	if err := s.r.Update(ctx, folder); err != nil {
		return err
	}

	if targetSort == nil {
		return s.r.MoveToParentAppend(ctx, folderID, newParentID)
	}
	return s.r.MoveToParentAtSort(ctx, folderID, newParentID, *targetSort)
}

func (s *blockService) UpdateFolderSort(ctx context.Context, folderID uuid.UUID, sort int64) error {
	if len(folderID) == 0 {
		return errors.New("folder id is empty")
	}
	return s.r.ReorderWithinGroup(ctx, folderID, sort)
}
