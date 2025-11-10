package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/repo"
)

type BlockService interface {
	// Create - unified method, handles special logic for folder path
	Create(ctx context.Context, b *model.Block) error

	// Delete - unified method
	Delete(ctx context.Context, spaceID uuid.UUID, blockID uuid.UUID) error

	// Properties - unified methods
	GetBlockProperties(ctx context.Context, blockID uuid.UUID) (*model.Block, error)
	UpdateBlockProperties(ctx context.Context, b *model.Block) error

	// List - unified method with optional filters
	List(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error)

	// Move - unified method, handles special logic for folder path
	Move(ctx context.Context, blockID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error

	// Sort - unified method
	UpdateSort(ctx context.Context, blockID uuid.UUID, sort int64) error
}

type blockService struct{ r repo.BlockRepo }

func NewBlockService(r repo.BlockRepo) BlockService { return &blockService{r: r} }

// validateAndPrepareCreate validates a block for creation and prepares its parent
func (s *blockService) validateAndPrepareCreate(ctx context.Context, b *model.Block) (*model.Block, error) {
	if err := b.Validate(); err != nil {
		return nil, err
	}

	var parent *model.Block
	if b.ParentID != nil {
		var err error
		parent, err = s.r.Get(ctx, *b.ParentID)
		if err != nil {
			return nil, err
		}
		if !parent.CanHaveChildren() {
			return nil, errors.New("parent cannot have children")
		}
	}

	if err := b.ValidateParentType(parent); err != nil {
		return nil, err
	}

	return parent, nil
}

// prepareBlockForCreation sets the sort order for a new block
func (s *blockService) prepareBlockForCreation(ctx context.Context, b *model.Block) error {
	next, err := s.r.NextSort(ctx, b.SpaceID, b.ParentID)
	if err != nil {
		return err
	}
	b.Sort = next
	return nil
}

// Create - unified create method for all block types
func (s *blockService) Create(ctx context.Context, b *model.Block) error {
	if b.Type == "" {
		return errors.New("block type is required")
	}

	parent, err := s.validateAndPrepareCreate(ctx, b)
	if err != nil {
		return err
	}

	// Special handling for folder type - calculate and set path
	if b.Type == model.BlockTypeFolder {
		path := b.Title
		if parent != nil {
			parentPath := parent.GetFolderPath()
			if parentPath != "" {
				path = parentPath + "/" + b.Title
			}
		}
		b.SetFolderPath(path)
	}

	if err := s.prepareBlockForCreation(ctx, b); err != nil {
		return err
	}

	return s.r.Create(ctx, b)
}

// isDescendant checks if candidateID is a descendant of ancestorID in the tree
func (s *blockService) isDescendant(ctx context.Context, ancestorID uuid.UUID, candidateID uuid.UUID) (bool, error) {
	// Start from candidateID and traverse up the parent chain
	currentID := candidateID

	// Limit depth to prevent infinite loops in case of data corruption
	maxDepth := 1000
	depth := 0

	for depth < maxDepth {
		block, err := s.r.Get(ctx, currentID)
		if err != nil {
			return false, err
		}

		// Check if we've reached the ancestor
		if block.ID == ancestorID {
			return true, nil
		}

		// If no parent, we've reached the root without finding ancestor
		if block.ParentID == nil {
			return false, nil
		}

		// Move up to parent
		currentID = *block.ParentID
		depth++
	}

	// If we exceeded max depth, something is wrong - be safe and return true
	return true, errors.New("max depth exceeded while checking descendant, possible circular reference")
}

// validateAndPrepareMove validates a block move and prepares the new parent
func (s *blockService) validateAndPrepareMove(ctx context.Context, blockID uuid.UUID, newParentID *uuid.UUID) (*model.Block, *model.Block, error) {
	if len(blockID) == 0 {
		return nil, nil, errors.New("block id is empty")
	}

	block, err := s.r.Get(ctx, blockID)
	if err != nil {
		return nil, nil, err
	}

	var parent *model.Block
	if newParentID != nil {
		if *newParentID == blockID {
			return nil, nil, errors.New("new parent cannot be the same as the block")
		}

		// Check for circular reference: newParentID cannot be a descendant of blockID
		isDesc, err := s.isDescendant(ctx, blockID, *newParentID)
		if err != nil {
			return nil, nil, err
		}
		if isDesc {
			return nil, nil, errors.New("new parent cannot be a descendant of the block (would create circular reference)")
		}

		parent, err = s.r.Get(ctx, *newParentID)
		if err != nil {
			return nil, nil, err
		}
		if !parent.CanHaveChildren() {
			return nil, nil, errors.New("new parent cannot have children")
		}
	}

	if err := block.ValidateParentType(parent); err != nil {
		return nil, nil, err
	}

	return block, parent, nil
}

// Delete - unified delete method for all block types
func (s *blockService) Delete(ctx context.Context, spaceID uuid.UUID, blockID uuid.UUID) error {
	if len(blockID) == 0 {
		return errors.New("block id is empty")
	}
	return s.r.Delete(ctx, spaceID, blockID)
}

// GetBlockProperties - unified get properties method
func (s *blockService) GetBlockProperties(ctx context.Context, blockID uuid.UUID) (*model.Block, error) {
	if len(blockID) == 0 {
		return nil, errors.New("block id is empty")
	}
	return s.r.Get(ctx, blockID)
}

// UpdateBlockProperties - unified update properties method
func (s *blockService) UpdateBlockProperties(ctx context.Context, b *model.Block) error {
	if len(b.ID) == 0 {
		return errors.New("block id is empty")
	}
	return s.r.Update(ctx, b)
}

// List - unified list method with optional type and parent_id filters
func (s *blockService) List(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error) {
	if len(spaceID) == 0 {
		return nil, errors.New("space id is empty")
	}
	return s.r.ListBySpace(ctx, spaceID, blockType, parentID)
}

// Move - unified move method for all block types
func (s *blockService) Move(ctx context.Context, blockID uuid.UUID, newParentID *uuid.UUID, targetSort *int64) error {
	block, parent, err := s.validateAndPrepareMove(ctx, blockID, newParentID)
	if err != nil {
		return err
	}

	// Special handling for folder type - update path
	if block.Type == model.BlockTypeFolder {
		path := block.Title
		if parent != nil {
			parentPath := parent.GetFolderPath()
			if parentPath != "" {
				path = parentPath + "/" + block.Title
			}
		}
		block.SetFolderPath(path)

		// Update the folder properties with the new path
		if err := s.r.Update(ctx, block); err != nil {
			return err
		}
	}

	if targetSort == nil {
		return s.r.MoveToParentAppend(ctx, blockID, newParentID)
	}
	return s.r.MoveToParentAtSort(ctx, blockID, newParentID, *targetSort)
}

// UpdateSort - unified sort method for all block types
func (s *blockService) UpdateSort(ctx context.Context, blockID uuid.UUID, sort int64) error {
	if len(blockID) == 0 {
		return errors.New("block id is empty")
	}
	return s.r.ReorderWithinGroup(ctx, blockID, sort)
}
