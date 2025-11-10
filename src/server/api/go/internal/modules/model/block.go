package model

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// BlockTypeConfig Define the configuration of block types
type BlockTypeConfig struct {
	Name          string `json:"name"`
	AllowChildren bool   `json:"allow_children"` // whether the block type can have children
	RequireParent bool   `json:"require_parent"` // whether the block type requires a parent
}

// For backward compatibility, keep the constant definitions
const (
	BlockTypePage   = "page"
	BlockTypeFolder = "folder"
	BlockTypeText   = "text"
	BlockTypeSOP    = "sop"
)

// BlockType Define all supported block types
var BlockTypes = map[string]BlockTypeConfig{
	BlockTypeFolder: {
		Name:          BlockTypeFolder,
		AllowChildren: true,
		RequireParent: false,
	},
	BlockTypePage: {
		Name:          BlockTypePage,
		AllowChildren: true,
		RequireParent: false,
	},
	BlockTypeText: {
		Name:          BlockTypeText,
		AllowChildren: false,
		RequireParent: true,
	},
	BlockTypeSOP: {
		Name:          BlockTypeSOP,
		AllowChildren: false,
		RequireParent: true,
	},
}

// IsValidBlockType Check if the given type is valid
func IsValidBlockType(blockType string) bool {
	_, exists := BlockTypes[blockType]
	return exists
}

// GetBlockTypeConfig Get the configuration of a block type
func GetBlockTypeConfig(blockType string) (BlockTypeConfig, error) {
	config, exists := BlockTypes[blockType]
	if !exists {
		return BlockTypeConfig{}, fmt.Errorf("invalid block type: %s", blockType)
	}
	return config, nil
}

// GetAllBlockTypes Get all supported block types
func GetAllBlockTypes() map[string]BlockTypeConfig {
	return BlockTypes
}

type Block struct {
	ID uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`

	SpaceID uuid.UUID `gorm:"type:uuid;not null;index:idx_blocks_space;index:idx_blocks_space_type_archived,priority:1;uniqueIndex:ux_blocks_space_parent_sort,priority:1" json:"space_id"`
	Space   *Space    `gorm:"constraint:fk_blocks_space,OnUpdate:CASCADE,OnDelete:CASCADE;" json:"space"`

	Type string `gorm:"type:text;not null;index:idx_blocks_space_type;index:idx_blocks_space_type_archived,priority:2" json:"type"`

	ParentID *uuid.UUID `gorm:"type:uuid;uniqueIndex:ux_blocks_space_parent_sort,priority:2" json:"parent_id"`
	Parent   *Block     `gorm:"constraint:fk_blocks_parent,OnUpdate:CASCADE,OnDelete:CASCADE;" json:"parent"`

	Title string                             `gorm:"type:text;not null;default:''" json:"title"`
	Props datatypes.JSONType[map[string]any] `gorm:"type:jsonb;not null;default:'{}'" swaggertype:"object" json:"props"`

	Sort       int64 `gorm:"not null;default:0;uniqueIndex:ux_blocks_space_parent_sort,priority:3" json:"sort"`
	IsArchived bool  `gorm:"not null;default:false;index:idx_blocks_space_type_archived,priority:3;index" json:"is_archived"`

	Children  []*Block  `gorm:"foreignKey:ParentID;constraint:fk_blocks_children,OnUpdate:CASCADE,OnDelete:CASCADE;" json:"children,omitempty"`
	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (Block) TableName() string { return "blocks" }

// Validate Validate the fields of a Block
func (b *Block) Validate() error {
	// Check if the type is valid
	if !IsValidBlockType(b.Type) {
		return fmt.Errorf("invalid block type: %s", b.Type)
	}

	config, _ := GetBlockTypeConfig(b.Type)

	// Check the parent-child relationship constraints
	if config.RequireParent && b.ParentID == nil {
		return fmt.Errorf("block type '%s' requires a parent", b.Type)
	}

	// Only page and folder types can exist without a parent
	if !config.RequireParent && b.Type != BlockTypePage && b.Type != BlockTypeFolder && b.ParentID == nil {
		return fmt.Errorf("only page and folder type blocks can exist without a parent")
	}

	return nil
}

// CanHaveChildren Check if the block type can have children
func (b *Block) CanHaveChildren() bool {
	config, err := GetBlockTypeConfig(b.Type)
	if err != nil {
		return false
	}
	return config.AllowChildren
}

// ValidateParentType Check if the parent type is valid for this block
// Rules:
// - Page can have folder as parent or no parent
// - Folder can have folder as parent or no parent
// - Other blocks (text, sop, etc.) must have page (or other non-folder block) as parent
func (b *Block) ValidateParentType(parent *Block) error {
	// No parent means root level - only folder and page allowed
	if parent == nil {
		if b.Type != BlockTypeFolder && b.Type != BlockTypePage {
			return fmt.Errorf("block type '%s' cannot exist at root level", b.Type)
		}
		return nil
	}

	// First check if the parent can have children
	if !parent.CanHaveChildren() {
		return fmt.Errorf("block type '%s' cannot be a child of '%s' (parent cannot have children)", b.Type, parent.Type)
	}

	// Check what can be under each parent type
	var canBeChild bool
	switch parent.Type {
	case BlockTypeFolder:
		// Folder can only contain folder and page
		canBeChild = b.Type == BlockTypeFolder || b.Type == BlockTypePage
	case BlockTypePage:
		// Page can only contain other blocks (not folder or page)
		canBeChild = b.Type != BlockTypeFolder && b.Type != BlockTypePage
	default:
		// Other blocks (text, sop, etc.) cannot have children
		canBeChild = false
	}

	if !canBeChild {
		return fmt.Errorf("block type '%s' cannot be a child of '%s'", b.Type, parent.Type)
	}
	return nil
}

// GetFolderPath Get the hierarchical path for a folder from Props
func (b *Block) GetFolderPath() string {
	if b.Type != BlockTypeFolder {
		return ""
	}
	propsData := b.Props.Data()
	if propsData != nil {
		if path, ok := propsData["path"].(string); ok {
			return path
		}
	}
	return ""
}

// SetFolderPath Set the hierarchical path for a folder in Props
func (b *Block) SetFolderPath(path string) {
	if b.Type != BlockTypeFolder {
		return
	}
	propsData := b.Props.Data()
	if propsData == nil {
		propsData = make(map[string]any)
	}
	propsData["path"] = path
	b.Props = datatypes.NewJSONType(propsData)
}
