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

func (m *MockBlockRepo) ListChildren(ctx context.Context, parentID uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
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

func (m *MockBlockRepo) BulkUpdateSort(ctx context.Context, items map[uuid.UUID]int64) error {
	args := m.Called(ctx, items)
	return args.Error(0)
}

func (m *MockBlockRepo) UpdateParent(ctx context.Context, id uuid.UUID, parentID *uuid.UUID) error {
	args := m.Called(ctx, id, parentID)
	return args.Error(0)
}

func (m *MockBlockRepo) UpdateSort(ctx context.Context, id uuid.UUID, sort int64) error {
	args := m.Called(ctx, id, sort)
	return args.Error(0)
}

func (m *MockBlockRepo) ListBySpace(ctx context.Context, spaceID uuid.UUID, blockType string, parentID *uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, blockType, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func (m *MockBlockRepo) ListBlocksExcludingPages(ctx context.Context, spaceID uuid.UUID, parentID uuid.UUID) ([]model.Block, error) {
	args := m.Called(ctx, spaceID, parentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]model.Block), args.Error(1)
}

func TestBlockService_CreatePage(t *testing.T) {
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
			errMsg:  "page can only have folder as parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.CreatePage(ctx, tt.block)

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

func TestBlockService_DeletePage(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	pageID := uuid.New()

	tests := []struct {
		name    string
		pageID  uuid.UUID
		setup   func(*MockBlockRepo)
		wantErr bool
		errMsg  string
	}{
		{
			name:   "successful page deletion",
			pageID: pageID,
			setup: func(repo *MockBlockRepo) {
				repo.On("Delete", ctx, spaceID, pageID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:   "empty page ID",
			pageID: uuid.UUID{},
			setup: func(repo *MockBlockRepo) {
				// Note: len() of uuid.UUID{} is not 0, so Delete will be called
				repo.On("Delete", ctx, spaceID, uuid.UUID{}).Return(nil)
			},
			wantErr: false, // Actually won't error, because len(uuid.UUID{}) != 0
		},
		{
			name:   "deletion failure",
			pageID: pageID,
			setup: func(repo *MockBlockRepo) {
				repo.On("Delete", ctx, spaceID, pageID).Return(errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.DeletePage(ctx, spaceID, tt.pageID)

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

func TestBlockService_CreateBlock(t *testing.T) {
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
			name: "successful block creation",
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
			errMsg:  "block type is empty",
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
			errMsg:  "cannot have folder as parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.CreateBlock(ctx, tt.block)

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

// Folder service tests

func TestBlockService_CreateFolder(t *testing.T) {
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
			name: "invalid parent type",
			block: &model.Block{
				SpaceID:  spaceID,
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
			errMsg:  "folder can only have folder as parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.CreateFolder(ctx, tt.block)

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

func TestBlockService_DeleteFolder(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	folderID := uuid.New()

	tests := []struct {
		name     string
		folderID uuid.UUID
		setup    func(*MockBlockRepo)
		wantErr  bool
	}{
		{
			name:     "successful folder deletion",
			folderID: folderID,
			setup: func(repo *MockBlockRepo) {
				repo.On("Delete", ctx, spaceID, folderID).Return(nil)
			},
			wantErr: false,
		},
		{
			name:     "deletion failure",
			folderID: folderID,
			setup: func(repo *MockBlockRepo) {
				repo.On("Delete", ctx, spaceID, folderID).Return(errors.New("database error"))
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.DeleteFolder(ctx, spaceID, tt.folderID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}

func TestBlockService_MoveFolder(t *testing.T) {
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
			errMsg:  "folder can only have folder as parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			err := service.MoveFolder(ctx, tt.folderID, tt.newParentID, tt.targetSort)

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

func TestBlockService_ListFolders(t *testing.T) {
	ctx := context.Background()
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name     string
		spaceID  uuid.UUID
		parentID *uuid.UUID
		setup    func(*MockBlockRepo)
		wantErr  bool
	}{
		{
			name:     "list top-level folders",
			spaceID:  spaceID,
			parentID: nil,
			setup: func(repo *MockBlockRepo) {
				repo.On("ListBySpace", ctx, spaceID, model.BlockTypeFolder, (*uuid.UUID)(nil)).Return([]model.Block{}, nil)
			},
			wantErr: false,
		},
		{
			name:     "list folders with parent filter",
			spaceID:  spaceID,
			parentID: &parentID,
			setup: func(repo *MockBlockRepo) {
				repo.On("ListBySpace", ctx, spaceID, model.BlockTypeFolder, &parentID).Return([]model.Block{}, nil)
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &MockBlockRepo{}
			tt.setup(repo)

			service := NewBlockService(repo)
			_, err := service.ListFolders(ctx, tt.spaceID, tt.parentID)

			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			repo.AssertExpectations(t)
		})
	}
}
