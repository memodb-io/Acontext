package model

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/datatypes"
)

func TestIsValidBlockType(t *testing.T) {
	tests := []struct {
		name      string
		blockType string
		expected  bool
	}{
		{
			name:      "valid page type",
			blockType: BlockTypePage,
			expected:  true,
		},
		{
			name:      "valid folder type",
			blockType: BlockTypeFolder,
			expected:  true,
		},
		{
			name:      "valid text type",
			blockType: BlockTypeText,
			expected:  true,
		},
		{
			name:      "valid code sop type",
			blockType: BlockTypeSOP,
			expected:  true,
		},
		{
			name:      "invalid type",
			blockType: "invalid_type",
			expected:  false,
		},
		{
			name:      "empty string type",
			blockType: "",
			expected:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidBlockType(tt.blockType)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetBlockTypeConfig(t *testing.T) {
	tests := []struct {
		name      string
		blockType string
		wantErr   bool
		expected  BlockTypeConfig
	}{
		{
			name:      "get page type config",
			blockType: BlockTypePage,
			wantErr:   false,
			expected: BlockTypeConfig{
				Name:          BlockTypePage,
				AllowChildren: true, // Page can have text/sop blocks
				RequireParent: false,
			},
		},
		{
			name:      "get folder type config",
			blockType: BlockTypeFolder,
			wantErr:   false,
			expected: BlockTypeConfig{
				Name:          BlockTypeFolder,
				AllowChildren: true,
				RequireParent: false,
			},
		},
		{
			name:      "get text type config",
			blockType: BlockTypeText,
			wantErr:   false,
			expected: BlockTypeConfig{
				Name:          BlockTypeText,
				AllowChildren: false,
				RequireParent: true,
			},
		},
		{
			name:      "get code sop type config",
			blockType: BlockTypeSOP,
			wantErr:   false,
			expected: BlockTypeConfig{
				Name:          BlockTypeSOP,
				AllowChildren: false,
				RequireParent: true,
			},
		},
		{
			name:      "invalid type",
			blockType: "invalid_type",
			wantErr:   true,
			expected:  BlockTypeConfig{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := GetBlockTypeConfig(tt.blockType)

			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), "invalid block type")
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected, config)
			}
		})
	}
}

func TestGetAllBlockTypes(t *testing.T) {
	t.Run("get all block types", func(t *testing.T) {
		allTypes := GetAllBlockTypes()

		// Verify contains expected types
		assert.Contains(t, allTypes, BlockTypePage)
		assert.Contains(t, allTypes, BlockTypeFolder)
		assert.Contains(t, allTypes, BlockTypeText)
		assert.Contains(t, allTypes, BlockTypeSOP)

		// Verify configuration for each type
		pageConfig := allTypes[BlockTypePage]
		assert.Equal(t, BlockTypePage, pageConfig.Name)
		assert.True(t, pageConfig.AllowChildren) // Page can have text/sop blocks
		assert.False(t, pageConfig.RequireParent)

		folderConfig := allTypes[BlockTypeFolder]
		assert.Equal(t, BlockTypeFolder, folderConfig.Name)
		assert.True(t, folderConfig.AllowChildren)
		assert.False(t, folderConfig.RequireParent)

		textConfig := allTypes[BlockTypeText]
		assert.Equal(t, BlockTypeText, textConfig.Name)
		assert.False(t, textConfig.AllowChildren)
		assert.True(t, textConfig.RequireParent)
	})
}

func TestBlock_Validate(t *testing.T) {
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name    string
		block   Block
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid page block",
			block: Block{
				SpaceID: spaceID,
				Type:    BlockTypePage,
				Title:   "test page",
			},
			wantErr: false,
		},
		{
			name: "valid text block (with parent)",
			block: Block{
				SpaceID:  spaceID,
				Type:     BlockTypeText,
				ParentID: &parentID,
				Title:    "test text",
			},
			wantErr: false,
		},
		{
			name: "valid code sop block (with parent)",
			block: Block{
				SpaceID:  spaceID,
				Type:     BlockTypeSOP,
				ParentID: &parentID,
				Title:    "test code sop",
			},
			wantErr: false,
		},
		{
			name: "invalid block type",
			block: Block{
				SpaceID: spaceID,
				Type:    "invalid_type",
				Title:   "test",
			},
			wantErr: true,
			errMsg:  "invalid block type",
		},
		{
			name: "text block missing parent",
			block: Block{
				SpaceID: spaceID,
				Type:    BlockTypeText,
				Title:   "test text",
			},
			wantErr: true,
			errMsg:  "requires a parent",
		},
		{
			name: "code sop block missing parent",
			block: Block{
				SpaceID: spaceID,
				Type:    BlockTypeSOP,
				Title:   "test code sop",
			},
			wantErr: true,
			errMsg:  "requires a parent",
		},
		{
			name: "page block with parent (allowed)",
			block: Block{
				SpaceID:  spaceID,
				Type:     BlockTypePage,
				ParentID: &parentID,
				Title:    "child page",
			},
			wantErr: false,
		},
		{
			name: "valid folder block without parent",
			block: Block{
				SpaceID: spaceID,
				Type:    BlockTypeFolder,
				Title:   "root folder",
			},
			wantErr: false,
		},
		{
			name: "valid folder block with parent",
			block: Block{
				SpaceID:  spaceID,
				Type:     BlockTypeFolder,
				ParentID: &parentID,
				Title:    "subfolder",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.block.Validate()

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestBlock_ValidateForCreation(t *testing.T) {
	spaceID := uuid.New()
	parentID := uuid.New()

	tests := []struct {
		name    string
		block   Block
		wantErr bool
		errMsg  string
	}{
		{
			name: "create valid page block",
			block: Block{
				SpaceID: spaceID,
				Type:    BlockTypePage,
				Title:   "new page",
				Props:   datatypes.NewJSONType(map[string]any{"description": "test page"}),
			},
			wantErr: false,
		},
		{
			name: "create valid text block",
			block: Block{
				SpaceID:  spaceID,
				Type:     BlockTypeText,
				ParentID: &parentID,
				Title:    "new text block",
				Props:    datatypes.NewJSONType(map[string]any{"content": "text content"}),
			},
			wantErr: false,
		},
		{
			name: "create invalid block (invalid type)",
			block: Block{
				SpaceID: spaceID,
				Type:    "invalid_type",
				Title:   "invalid block",
			},
			wantErr: true,
			errMsg:  "invalid block type",
		},
		{
			name: "create invalid text block (missing parent)",
			block: Block{
				SpaceID: spaceID,
				Type:    BlockTypeText,
				Title:   "text block without parent",
			},
			wantErr: true,
			errMsg:  "requires a parent",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.block.Validate()

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestBlock_CanHaveChildren(t *testing.T) {
	tests := []struct {
		name     string
		block    Block
		expected bool
	}{
		{
			name: "page block can have children",
			block: Block{
				Type: BlockTypePage,
			},
			expected: true, // Page can have text/sop blocks
		},
		{
			name: "folder block can have children",
			block: Block{
				Type: BlockTypeFolder,
			},
			expected: true,
		},
		{
			name: "text block cannot have children",
			block: Block{
				Type: BlockTypeText,
			},
			expected: false,
		},
		{
			name: "code sop block cannot have children",
			block: Block{
				Type: BlockTypeSOP,
			},
			expected: false,
		},
		{
			name: "invalid type block cannot have children",
			block: Block{
				Type: "invalid_type",
			},
			expected: false,
		},
		{
			name: "empty type block cannot have children",
			block: Block{
				Type: "",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.block.CanHaveChildren()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBlock_TableName(t *testing.T) {
	t.Run("table name should be blocks", func(t *testing.T) {
		block := Block{}
		tableName := block.TableName()
		assert.Equal(t, "blocks", tableName)
	})
}

func TestBlockTypeConstants(t *testing.T) {
	t.Run("verify block type constants", func(t *testing.T) {
		assert.Equal(t, "page", BlockTypePage)
		assert.Equal(t, "folder", BlockTypeFolder)
		assert.Equal(t, "text", BlockTypeText)
		assert.Equal(t, "sop", BlockTypeSOP)
	})
}

func TestBlockTypes_Configuration(t *testing.T) {
	t.Run("verify block type configuration", func(t *testing.T) {
		// Verify page type configuration
		pageConfig, exists := BlockTypes[BlockTypePage]
		assert.True(t, exists)
		assert.Equal(t, BlockTypePage, pageConfig.Name)
		assert.True(t, pageConfig.AllowChildren) // Page can have text/sop blocks
		assert.False(t, pageConfig.RequireParent)

		// Verify folder type configuration
		folderConfig, exists := BlockTypes[BlockTypeFolder]
		assert.True(t, exists)
		assert.Equal(t, BlockTypeFolder, folderConfig.Name)
		assert.True(t, folderConfig.AllowChildren)
		assert.False(t, folderConfig.RequireParent)

		// Verify text type configuration
		textConfig, exists := BlockTypes[BlockTypeText]
		assert.True(t, exists)
		assert.Equal(t, BlockTypeText, textConfig.Name)
		assert.False(t, textConfig.AllowChildren)
		assert.True(t, textConfig.RequireParent)

		// Verify code sop type configuration
		sopConfig, exists := BlockTypes[BlockTypeSOP]
		assert.True(t, exists)
		assert.Equal(t, BlockTypeSOP, sopConfig.Name)
		assert.False(t, sopConfig.AllowChildren)
		assert.True(t, sopConfig.RequireParent)
	})
}

func TestBlock_ValidateParentType(t *testing.T) {
	tests := []struct {
		name    string
		block   Block
		parent  *Block
		wantErr bool
		errMsg  string
	}{
		{
			name: "page with folder parent - valid",
			block: Block{
				Type: BlockTypePage,
			},
			parent: &Block{
				Type: BlockTypeFolder,
			},
			wantErr: false,
		},
		{
			name: "page with page parent - invalid",
			block: Block{
				Type: BlockTypePage,
			},
			parent: &Block{
				Type: BlockTypePage,
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "page without parent - valid",
			block: Block{
				Type: BlockTypePage,
			},
			parent:  nil,
			wantErr: false,
		},
		{
			name: "folder with folder parent - valid",
			block: Block{
				Type: BlockTypeFolder,
			},
			parent: &Block{
				Type: BlockTypeFolder,
			},
			wantErr: false,
		},
		{
			name: "folder with page parent - invalid",
			block: Block{
				Type: BlockTypeFolder,
			},
			parent: &Block{
				Type: BlockTypePage,
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "folder without parent - valid",
			block: Block{
				Type: BlockTypeFolder,
			},
			parent:  nil,
			wantErr: false,
		},
		{
			name: "text with page parent - valid",
			block: Block{
				Type: BlockTypeText,
			},
			parent: &Block{
				Type: BlockTypePage,
			},
			wantErr: false,
		},
		{
			name: "text with folder parent - invalid",
			block: Block{
				Type: BlockTypeText,
			},
			parent: &Block{
				Type: BlockTypeFolder,
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "text without parent - invalid",
			block: Block{
				Type: BlockTypeText,
			},
			parent:  nil,
			wantErr: true,
			errMsg:  "cannot exist at root level",
		},
		{
			name: "sop with page parent - valid",
			block: Block{
				Type: BlockTypeSOP,
			},
			parent: &Block{
				Type: BlockTypePage,
			},
			wantErr: false,
		},
		{
			name: "sop with text parent - invalid (text cannot have children)",
			block: Block{
				Type: BlockTypeSOP,
			},
			parent: &Block{
				Type: BlockTypeText,
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "sop with folder parent - invalid",
			block: Block{
				Type: BlockTypeSOP,
			},
			parent: &Block{
				Type: BlockTypeFolder,
			},
			wantErr: true,
			errMsg:  "cannot be a child of",
		},
		{
			name: "sop without parent - invalid",
			block: Block{
				Type: BlockTypeSOP,
			},
			parent:  nil,
			wantErr: true,
			errMsg:  "cannot exist at root level",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.block.ValidateParentType(tt.parent)

			if tt.wantErr {
				assert.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestBlock_GetFolderPath(t *testing.T) {
	tests := []struct {
		name     string
		block    Block
		expected string
	}{
		{
			name: "folder with path in props",
			block: Block{
				Type:  BlockTypeFolder,
				Props: datatypes.NewJSONType(map[string]any{"path": "folder1/folder2"}),
			},
			expected: "folder1/folder2",
		},
		{
			name: "folder without path in props",
			block: Block{
				Type:  BlockTypeFolder,
				Props: datatypes.NewJSONType(map[string]any{}),
			},
			expected: "",
		},
		{
			name: "folder with empty props data",
			block: Block{
				Type:  BlockTypeFolder,
				Props: datatypes.NewJSONType(map[string]any(nil)),
			},
			expected: "",
		},
		{
			name: "non-folder type",
			block: Block{
				Type:  BlockTypePage,
				Props: datatypes.NewJSONType(map[string]any{"path": "should/be/ignored"}),
			},
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.block.GetFolderPath()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBlock_SetFolderPath(t *testing.T) {
	tests := []struct {
		name     string
		block    Block
		path     string
		expected string
	}{
		{
			name: "set path on folder",
			block: Block{
				Type:  BlockTypeFolder,
				Props: datatypes.NewJSONType(map[string]any{}),
			},
			path:     "folder1/folder2",
			expected: "folder1/folder2",
		},
		{
			name: "set path on folder with existing props",
			block: Block{
				Type:  BlockTypeFolder,
				Props: datatypes.NewJSONType(map[string]any{"other": "data"}),
			},
			path:     "new/path",
			expected: "new/path",
		},
		{
			name: "set path on non-folder type",
			block: Block{
				Type:  BlockTypePage,
				Props: datatypes.NewJSONType(map[string]any{}),
			},
			path:     "should/not/set",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.block.SetFolderPath(tt.path)
			result := tt.block.GetFolderPath()
			assert.Equal(t, tt.expected, result)
		})
	}
}
