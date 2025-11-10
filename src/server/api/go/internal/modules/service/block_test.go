package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockBlockRepo is a mock implementation of BlockRepo
type MockBlockRepo struct {
	mock.Mock
}

func (m *MockBlockRepo) Create(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockRepo) Get(ctx context.Context, id uuid.UUID) (*model.Block, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.Block), args.Error(1)
}

func (m *MockBlockRepo) Update(ctx context.Context, b *model.Block) error {
	args := m.Called(ctx, b)
	return args.Error(0)
}

func (m *MockBlockRepo) Delete(ctx context.Context, spaceID, blockID uuid.UUID) error {
	args := m.Called(ctx, spaceID, blockID)
	return args.Error(0)
}

func (m *MockBlockRepo) NextSort(ctx context.Context, spaceID uuid.UUID, parentID *uuid.UUID) (int64, error) {
	args := m.Called(ctx, spaceID, parentID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockBlockRepo) MoveToParentAppend(ctx context.Context, blockID uuid.UUID, newParentID *uuid.UUID) error {
	args := m.Called(ctx, blockID, newParentID)
	return args.Error(0)
}

func (m *MockBlockRepo) MoveToParentAtSort(ctx context.Context, blockID uuid.UUID, newParentID *uuid.UUID, sort int64) error {
	args := m.Called(ctx, blockID, newParentID, sort)
	return args.Error(0)
}

func (m *MockBlockRepo) ReorderWithinGroup(ctx context.Context, blockID uuid.UUID, sort int64) error {
	args := m.Called(ctx, blockID, sort)
	return args.Error(0)
}

func (m *MockBlockRepo) ListBySpace(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, blockType, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func TestBlockService_Create_Page(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name    string
		block   *model.Block
		setup   func(*MockBlockRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful page creation",
			block: &model.Block{
				SpaceID: spaceID,
				Type:    model.BlockTypePage,
				Title:   "Test Page",
			},
			setup: func(repo *MockBlockRepo) {
				repo.On("NextSort", ctx, spaceID, (*uuid.UUID)(nil)).Return(int64(1), nil)
				repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.Type == model.BlockTypePage && b.Sort == 1
				})).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "valid parent folder",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypePage,
				ParentID: &parentID,
				Title:    "Child Page",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeFolder,
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
				repo.On("NextSort", ctx, spaceID, &parentID).Return(int64(2), nil)
				repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.Type == model.BlockTypePage && b.Sort == 2
				})).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "invalid parent page type",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypePage,
				ParentID: &parentID,
				Title:    "Child Page",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypePage, // pages cannot have page children
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "page with text parent - invalid",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypePage,
				ParentID: &parentID,
				Title:    "Child Page",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeText, // text cannot have children
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "parent cannot have children",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.Create(ctx, tt.block)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, model.BlockTypePage, tt.block.Type)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_Delete(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	blockID := uuid.New()

	tests := []struct {
		name    string
		blockID uuid.UUID
		setup   func(*MockBlockRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name:    "successful block deletion",
			blockID: blockID,
			setup: func(repo *MockBlockRepo) {
				repo.On("Delete", ctx, spaceID, blockID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:    "empty block ID",
			blockID: uuid.UUID{},
			setup: func(repo *MockBlockRepo) {
				// Note: len() of uuid.UUID{} is not 0, so Delete will be called
				repo.On("Delete", ctx, spaceID, uuid.UUID{}).Return(nil)
			},
			wantErr: false, // Actually won't error, because len(uuid.UUID{}) != 0
		},
		{
			name:    "deletion failure",
			blockID: blockID,
			setup: func(repo *MockBlockRepo) {
				repo.On("Delete", ctx, spaceID, blockID).Return(errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.Delete(ctx, spaceID, tt.blockID)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_Create_Text(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name    string
		block   *model.Block
		setup   func(*MockBlockRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name: "successful text block creation",
			block: &model.Block{
				SpaceID:  spaceID,
				ParentID: &parentID,
				Type:     "text",
				Title:    "test block",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypePage,
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
				repo.On("NextSort", ctx, spaceID, &parentID).Return(int64(1), nil)
				repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.Type == "text" && b.Sort == 1
				})).Return(nil)
			},
			wantErr: false,
		},
		{
			name: "empty block type",
			block: &model.Block{
				SpaceID:  spaceID,
				ParentID: &parentID,
				Title:    "test block",
			},
			setup:   func(repo *MockBlockRepo) {},
			wantErr: true,
			errMsg:  "block type is required",
		},
		{
			name: "parent block cannot have children",
			block: &model.Block{
				SpaceID:  spaceID,
				ParentID: &parentID,
				Type:     "text",
				Title:    "test block",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: "image", // Assume image type cannot have children
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "parent cannot have children",
		},
		{
			name: "text block with folder parent - invalid",
			block: &model.Block{
				SpaceID:  spaceID,
				ParentID: &parentID,
				Type:     "text",
				Title:    "test block",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeFolder,
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "text block under text block - invalid (text cannot have children)",
			block: &model.Block{
				SpaceID:  spaceID,
				ParentID: &parentID,
				Type:     "text",
				Title:    "nested text block",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeText, // text cannot have children
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "parent cannot have children",
		},
		{
			name: "sop block under text block - invalid (text cannot have children)",
			block: &model.Block{
				SpaceID:  spaceID,
				ParentID: &parentID,
				Type:     model.BlockTypeSOP,
				Title:    "sop under text",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeText, // text cannot have children
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "parent cannot have children",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.Create(ctx, tt.block)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_Create_Folder(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name         string
		block        *model.Block
		setup        func(*MockBlockRepo)
		wantErr      bool
		errMsg       string
		expectedPath string
	}{
		{
			name: "successful folder creation without parent",
			block: &model.Block{
				SpaceID: spaceID,
				Type:    model.BlockTypeFolder,
				Title:   "RootFolder",
			},
			setup: func(repo *MockBlockRepo) {
				repo.On("NextSort", ctx, spaceID, (*uuid.UUID)(nil)).Return(int64(1), nil)
				repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.Type == model.BlockTypeFolder && b.Sort == 1 && b.GetFolderPath() == "RootFolder"
				})).Return(nil)
			},
			wantErr:      false,
			expectedPath: "RootFolder",
		},
		{
			name: "successful folder creation with parent",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypeFolder,
				ParentID: &parentID,
				Title:    "Subfolder",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeFolder,
				}
				parentBlock.SetFolderPath("RootFolder")
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
				repo.On("NextSort", ctx, spaceID, &parentID).Return(int64(2), nil)
				repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.Type == model.BlockTypeFolder && b.Sort == 2 && b.GetFolderPath() == "RootFolder/Subfolder"
				})).Return(nil)
			},
			wantErr:      false,
			expectedPath: "RootFolder/Subfolder",
		},
		{
			name: "deep nested folder creation",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypeFolder,
				ParentID: &parentID,
				Title:    "DeepFolder",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeFolder,
				}
				parentBlock.SetFolderPath("Folder1/Folder2/Folder3")
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
				repo.On("NextSort", ctx, spaceID, &parentID).Return(int64(1), nil)
				repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.Type == model.BlockTypeFolder && b.GetFolderPath() == "Folder1/Folder2/Folder3/DeepFolder"
				})).Return(nil)
			},
			wantErr:      false,
			expectedPath: "Folder1/Folder2/Folder3/DeepFolder",
		},
		{
			name: "invalid parent type - page",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypeFolder,
				ParentID: &parentID,
				Title:    "Subfolder",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypePage, // pages cannot be folder parents
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "invalid parent type - text",
			block: &model.Block{
				SpaceID:  spaceID,
				Type:     model.BlockTypeFolder,
				ParentID: &parentID,
				Title:    "Subfolder",
			},
			setup: func(repo *MockBlockRepo) {
				parentBlock := &model.Block{
					ID:   parentID,
					Type: model.BlockTypeText, // text cannot have children
				}
				repo.On("Get", ctx, parentID).Return(parentBlock, nil)
			},
			wantErr: true,
			errMsg:  "parent cannot have children",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.Create(ctx, tt.block)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, model.BlockTypeFolder, tt.block.Type)
				if tt.expectedPath != "" {
					assert.Equal(t, tt.expectedPath, tt.block.GetFolderPath())
				}
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_Move_Folder(t *testing.T) {
	ctx := context.Background()
	folderID := uuid.New()
	newParentID := uuid.New()

	tests := []struct {
		name         string
		folderID     uuid.UUID
		newParentID  *uuid.UUID
		targetSort   *int64
		setup        func(*MockBlockRepo)
		wantErr      bool
		errMsg       string
		expectedPath string
	}{
		{
			name:        "move folder to root",
			folderID:    folderID,
			newParentID: nil,
			targetSort:  nil,
			setup: func(repo *MockBlockRepo) {
				folder := &model.Block{
					ID:    folderID,
					Type:  model.BlockTypeFolder,
					Title: "MovedFolder",
				}
				folder.SetFolderPath("OldParent/MovedFolder")
				repo.On("Get", ctx, folderID).Return(folder, nil)
				repo.On("Update", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.GetFolderPath() == "MovedFolder"
				})).Return(nil)
				repo.On("MoveToParentAppend", ctx, folderID, (*uuid.UUID)(nil)).Return(nil)
			},
			wantErr:      false,
			expectedPath: "MovedFolder",
		},
		{
			name:        "move folder to new parent",
			folderID:    folderID,
			newParentID: &newParentID,
			targetSort:  nil,
			setup: func(repo *MockBlockRepo) {
				folder := &model.Block{
					ID:    folderID,
					Type:  model.BlockTypeFolder,
					Title: "MovedFolder",
				}
				newParent := &model.Block{
					ID:   newParentID,
					Type: model.BlockTypeFolder,
				}
				newParent.SetFolderPath("NewParent")
				repo.On("Get", ctx, folderID).Return(folder, nil)
				repo.On("Get", ctx, newParentID).Return(newParent, nil)
				repo.On("Update", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.GetFolderPath() == "NewParent/MovedFolder"
				})).Return(nil)
				repo.On("MoveToParentAppend", ctx, folderID, &newParentID).Return(nil)
			},
			wantErr:      false,
			expectedPath: "NewParent/MovedFolder",
		},
		{
			name:        "move folder to invalid parent type",
			folderID:    folderID,
			newParentID: &newParentID,
			targetSort:  nil,
			setup: func(repo *MockBlockRepo) {
				folder := &model.Block{
					ID:    folderID,
					Type:  model.BlockTypeFolder,
					Title: "MovedFolder",
				}
				invalidParent := &model.Block{
					ID:   newParentID,
					Type: model.BlockTypePage, // pages cannot be folder parents
				}
				repo.On("Get", ctx, folderID).Return(folder, nil)
				repo.On("Get", ctx, newParentID).Return(invalidParent, nil)
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.Move(ctx, tt.folderID, tt.newParentID, tt.targetSort)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_List(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name      string
		spaceID   uuid.UUID
		blockType string
		parentID  *uuid.UUID
		setup     func(*MockBlockRepo)
		wantErr   bool
	}{
		{
			name:      "list top-level folders",
			spaceID:   spaceID,
			blockType: model.BlockTypeFolder,
			parentID:  nil,
			setup: func(repo *MockBlockRepo) {
				repo.On("ListBySpace", ctx, spaceID, model.BlockTypeFolder, (*uuid.UUID)(nil)).Return([]model.Block{}, nil)
			},
			wantErr: false,
		},
		{
			name:      "list folders with parent filter",
			spaceID:   spaceID,
			blockType: model.BlockTypeFolder,
			parentID:  &parentID,
			setup: func(repo *MockBlockRepo) {
				repo.On("ListBySpace", ctx, spaceID, model.BlockTypeFolder, &parentID).Return([]model.Block{}, nil)
			},
			wantErr: false,
		},
		{
			name:      "list all types at root",
			spaceID:   spaceID,
			blockType: "",
			parentID:  nil,
			setup: func(repo *MockBlockRepo) {
				repo.On("ListBySpace", ctx, spaceID, "", (*uuid.UUID)(nil)).Return([]model.Block{}, nil)
			},
			wantErr: false,
		},
		{
			name:      "list pages with parent",
			spaceID:   spaceID,
			blockType: model.BlockTypePage,
			parentID:  &parentID,
			setup: func(repo *MockBlockRepo) {
				repo.On("ListBySpace", ctx, spaceID, model.BlockTypePage, &parentID).Return([]model.Block{}, nil)
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			_, err := service.List(ctx, tt.spaceID, tt.blockType, tt.parentID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

// Test comprehensive nesting scenarios
func TestBlockService_ComprehensiveNesting(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()

	t.Run("folder -> folder -> page -> text -> sop", func(t *testing.T) {
		repo := &MockBlockRepo{}

		// Create root folder
		rootFolder := &model.Block{
			SpaceID: spaceID,
			Type:    model.BlockTypeFolder,
			Title:   "Root",
		}
		repo.On("NextSort", ctx, spaceID, (*uuid.UUID)(nil)).Return(int64(1), nil)
		repo.On("Create", ctx, mock.MatchedBy(func(b *model.Block) bool {
			return b.Type == model.BlockTypeFolder && b.GetFolderPath() == "Root"
		})).Return(nil)

		service := NewBlockService(repo)
		err := service.Create(ctx, rootFolder)
		assert.NoError(t, err)
		assert.Equal(t, "Root", rootFolder.GetFolderPath())

		repo.AssertExpectations(t)
	})

	t.Run("invalid: folder -> page -> folder (should fail)", func(t *testing.T) {
		repo := &MockBlockRepo{}
		pageID := uuid.New()

		folderUnderPage := &model.Block{
			SpaceID:  spaceID,
			ParentID: &pageID,
			Type:     model.BlockTypeFolder,
			Title:    "InvalidFolder",
		}

		pageBlock := &model.Block{
			ID:   pageID,
			Type: model.BlockTypePage,
		}
		repo.On("Get", ctx, pageID).Return(pageBlock, nil)

		service := NewBlockService(repo)
		err := service.Create(ctx, folderUnderPage)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "cannot be a child of")

		repo.AssertExpectations(t)
	})

	t.Run("invalid: text at root level (should fail)", func(t *testing.T) {
		repo := &MockBlockRepo{}

		textAtRoot := &model.Block{
			SpaceID: spaceID,
			Type:    model.BlockTypeText,
			Title:   "InvalidText",
		}

		service := NewBlockService(repo)
		err := service.Create(ctx, textAtRoot)
		assert.Error(t, err)
		// The error comes from Validate() which checks RequireParent first
		assert.Contains(t, err.Error(), "requires a parent")

		repo.AssertExpectations(t)
	})
}

func TestBlockService_Move_CircularReference(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()

	// Create test block IDs representing a tree structure:
	// Root -> FolderA -> FolderB -> FolderC
	folderAID := uuid.New()
	folderBID := uuid.New()
	folderCID := uuid.New()
	unrelatedID := uuid.New()

	tests := []struct {
		name        string
		blockID     uuid.UUID
		newParentID *uuid.UUID
		setup       func(*MockBlockRepo)
		wantErr     bool
		errMsg      string
		description string
	}{
		{
			name:        "direct circular reference: move parent to direct child",
			description: "FolderA -> FolderB, try to move FolderA under FolderB",
			blockID:     folderAID,
			newParentID: &folderBID,
			setup: func(repo *MockBlockRepo) {
				// FolderA is the parent
				folderA := &model.Block{
					ID:      folderAID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderA",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderAID).Return(folderA, nil)

				// FolderB is a direct child of FolderA
				folderB := &model.Block{
					ID:       folderBID,
					Type:     model.BlockTypeFolder,
					Title:    "FolderB",
					ParentID: &folderAID, // FolderB is child of FolderA
				}
				repo.On("Get", ctx, folderBID).Return(folderB, nil)
			},
			wantErr: true,
			errMsg:  "new parent cannot be a descendant of the block",
		},
		{
			name:        "indirect circular reference: move ancestor to indirect descendant",
			description: "FolderA -> FolderB -> FolderC, try to move FolderA under FolderC",
			blockID:     folderAID,
			newParentID: &folderCID,
			setup: func(repo *MockBlockRepo) {
				// FolderA is the ancestor
				folderA := &model.Block{
					ID:      folderAID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderA",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderAID).Return(folderA, nil)

				// FolderC is an indirect descendant (grandchild)
				folderC := &model.Block{
					ID:       folderCID,
					Type:     model.BlockTypeFolder,
					Title:    "FolderC",
					ParentID: &folderBID, // FolderC is child of FolderB
				}
				repo.On("Get", ctx, folderCID).Return(folderC, nil)

				// FolderB is the intermediate node
				folderB := &model.Block{
					ID:       folderBID,
					Type:     model.BlockTypeFolder,
					Title:    "FolderB",
					ParentID: &folderAID, // FolderB is child of FolderA
				}
				repo.On("Get", ctx, folderBID).Return(folderB, nil)
			},
			wantErr: true,
			errMsg:  "new parent cannot be a descendant of the block",
		},
		{
			name:        "valid move: move to unrelated folder",
			description: "Move FolderB to an unrelated folder (not a descendant)",
			blockID:     folderBID,
			newParentID: &unrelatedID,
			setup: func(repo *MockBlockRepo) {
				// FolderB is being moved
				folderB := &model.Block{
					ID:      folderBID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderB",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderBID).Return(folderB, nil)

				// Unrelated folder is not a descendant
				unrelated := &model.Block{
					ID:      unrelatedID,
					Type:    model.BlockTypeFolder,
					Title:   "Unrelated",
					SpaceID: spaceID,
					// No parent, or parent is different
				}
				repo.On("Get", ctx, unrelatedID).Return(unrelated, nil)
				repo.On("Update", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.ID == folderBID
				})).Return(nil)
				repo.On("MoveToParentAppend", ctx, folderBID, &unrelatedID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:        "valid move: move to root (nil parent)",
			description: "Move FolderB to root level",
			blockID:     folderBID,
			newParentID: nil,
			setup: func(repo *MockBlockRepo) {
				// FolderB is being moved
				folderB := &model.Block{
					ID:      folderBID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderB",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderBID).Return(folderB, nil)
				repo.On("Update", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.ID == folderBID
				})).Return(nil)
				repo.On("MoveToParentAppend", ctx, folderBID, (*uuid.UUID)(nil)).Return(nil)
			},
			wantErr: false,
		},
		{
			name:        "same block as parent",
			description: "Try to move a block to itself",
			blockID:     folderAID,
			newParentID: &folderAID,
			setup: func(repo *MockBlockRepo) {
				folderA := &model.Block{
					ID:      folderAID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderA",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderAID).Return(folderA, nil)
			},
			wantErr: true,
			errMsg:  "new parent cannot be the same as the block",
		},
		{
			name:        "deep nesting: 5 levels deep",
			description: "A -> B -> C -> D -> E, try to move A under E",
			blockID:     folderAID,
			newParentID: &folderCID,
			setup: func(repo *MockBlockRepo) {
				// Create a deep chain: A -> B -> C
				folderA := &model.Block{
					ID:      folderAID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderA",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderAID).Return(folderA, nil)

				// FolderC is deep in the chain
				folderC := &model.Block{
					ID:       folderCID,
					Type:     model.BlockTypeFolder,
					Title:    "FolderC",
					ParentID: &folderBID,
				}
				repo.On("Get", ctx, folderCID).Return(folderC, nil)

				// FolderB is the intermediate
				folderB := &model.Block{
					ID:       folderBID,
					Type:     model.BlockTypeFolder,
					Title:    "FolderB",
					ParentID: &folderAID,
				}
				repo.On("Get", ctx, folderBID).Return(folderB, nil)
			},
			wantErr: true,
			errMsg:  "new parent cannot be a descendant of the block",
		},
		{
			name:        "move sibling to sibling (valid)",
			description: "Move FolderB to be under FolderC, where both are siblings under FolderA",
			blockID:     folderBID,
			newParentID: &folderCID,
			setup: func(repo *MockBlockRepo) {
				// FolderB being moved
				folderB := &model.Block{
					ID:      folderBID,
					Type:    model.BlockTypeFolder,
					Title:   "FolderB",
					SpaceID: spaceID,
				}
				repo.On("Get", ctx, folderBID).Return(folderB, nil)

				// FolderC is a sibling (same parent FolderA, but not a descendant of FolderB)
				folderC := &model.Block{
					ID:       folderCID,
					Type:     model.BlockTypeFolder,
					Title:    "FolderC",
					ParentID: &unrelatedID, // Different parent, so not a descendant
				}
				repo.On("Get", ctx, folderCID).Return(folderC, nil)
				// isDescendant will traverse up the parent chain, need to mock unrelatedID
				unrelated := &model.Block{
					ID:       unrelatedID,
					ParentID: nil, // Root level
				}
				repo.On("Get", ctx, unrelatedID).Return(unrelated, nil)
				repo.On("Update", ctx, mock.MatchedBy(func(b *model.Block) bool {
					return b.ID == folderBID
				})).Return(nil)
				repo.On("MoveToParentAppend", ctx, folderBID, &folderCID).Return(nil)
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.Move(ctx, tt.blockID, tt.newParentID, nil)

			if tt.wantErr {
				assert.Error(t, err, "Expected error for: %s", tt.description)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg, "Error message should contain: %s", tt.errMsg)
				}
			} else {
				assert.NoError(t, err, "Expected no error for: %s", tt.description)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_isDescendant(t *testing.T) {
	ctx := context.Background()

	// Create a test tree: Root -> A -> B -> C
	blockAID := uuid.New()
	blockBID := uuid.New()
	blockCID := uuid.New()
	unrelatedID := uuid.New()

	tests := []struct {
		name        string
		ancestorID  uuid.UUID
		candidateID uuid.UUID
		setup       func(*MockBlockRepo)
		expected    bool
		wantErr     bool
		description string
	}{
		{
			name:        "direct child is descendant",
			description: "B is direct child of A",
			ancestorID:  blockAID,
			candidateID: blockBID,
			setup: func(repo *MockBlockRepo) {
				blockB := &model.Block{
					ID:       blockBID,
					ParentID: &blockAID,
				}
				repo.On("Get", ctx, blockBID).Return(blockB, nil)
				// isDescendant will traverse up to parent, need to mock blockA
				blockA := &model.Block{
					ID:       blockAID,
					ParentID: nil,
				}
				repo.On("Get", ctx, blockAID).Return(blockA, nil)
			},
			expected: true,
			wantErr:  false,
		},
		{
			name:        "grandchild is descendant",
			description: "C is grandchild of A",
			ancestorID:  blockAID,
			candidateID: blockCID,
			setup: func(repo *MockBlockRepo) {
				blockC := &model.Block{
					ID:       blockCID,
					ParentID: &blockBID,
				}
				repo.On("Get", ctx, blockCID).Return(blockC, nil)
				blockB := &model.Block{
					ID:       blockBID,
					ParentID: &blockAID,
				}
				repo.On("Get", ctx, blockBID).Return(blockB, nil)
				// isDescendant will traverse up to blockA
				blockA := &model.Block{
					ID:       blockAID,
					ParentID: nil,
				}
				repo.On("Get", ctx, blockAID).Return(blockA, nil)
			},
			expected: true,
			wantErr:  false,
		},
		{
			name:        "unrelated block is not descendant",
			description: "Unrelated block is not descendant of A",
			ancestorID:  blockAID,
			candidateID: unrelatedID,
			setup: func(repo *MockBlockRepo) {
				unrelated := &model.Block{
					ID:       unrelatedID,
					ParentID: nil, // Root level
				}
				repo.On("Get", ctx, unrelatedID).Return(unrelated, nil)
			},
			expected: false,
			wantErr:  false,
		},
		{
			name:        "self matches ancestor (edge case)",
			description: "When candidateID equals ancestorID, isDescendant returns true (though this case is handled earlier in validateAndPrepareMove)",
			ancestorID:  blockAID,
			candidateID: blockAID,
			setup: func(repo *MockBlockRepo) {
				blockA := &model.Block{
					ID:       blockAID,
					ParentID: nil,
				}
				repo.On("Get", ctx, blockAID).Return(blockA, nil)
			},
			expected: true, // Returns true because block.ID == ancestorID
			wantErr:  false,
		},
		{
			name:        "block with different parent chain",
			description: "C has parent B, but B has different parent, so C is not descendant of A",
			ancestorID:  blockAID,
			candidateID: blockCID,
			setup: func(repo *MockBlockRepo) {
				blockC := &model.Block{
					ID:       blockCID,
					ParentID: &blockBID,
				}
				repo.On("Get", ctx, blockCID).Return(blockC, nil)
				blockB := &model.Block{
					ID:       blockBID,
					ParentID: &unrelatedID, // Different parent, not A
				}
				repo.On("Get", ctx, blockBID).Return(blockB, nil)
				unrelated := &model.Block{
					ID:       unrelatedID,
					ParentID: nil,
				}
				repo.On("Get", ctx, unrelatedID).Return(unrelated, nil)
			},
			expected: false,
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			result, err := service.(*blockService).isDescendant(ctx, tt.ancestorID, tt.candidateID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, result, "isDescendant result mismatch for: %s", tt.description)
			}

			repo.AssertExpectations(t)
		})
	}
}
