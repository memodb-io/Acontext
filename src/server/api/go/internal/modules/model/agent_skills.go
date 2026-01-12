package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type AgentSkills struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID  `gorm:"type:uuid;not null;index" json:"-"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"user_id"`

	// Name is not unique - multiple skills can have the same name
	Name        string `gorm:"type:text;not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`

	// AssetMeta points to the base directory path (skillName root)
	// S3Key format: "agent_skills/{project_id}/{agent_skills_id}/{skillName}/"
	// skillName is included in S3 path, so FileIndex doesn't need to repeat it
	AssetMeta datatypes.JSONType[Asset] `gorm:"type:jsonb;not null" swaggertype:"-" json:"-"`

	// FileIndex contains file information (path and MIME type) from the skillName root directory
	// Example: [{"path": "SKILL.md", "mime": "text/markdown"}, {"path": "scripts/extract_text.json", "mime": "application/json"}]
	// These paths are relative to baseS3Key (which includes skillName)
	// Full S3 key = baseS3Key + "/" + fileIndex[i].Path
	FileIndex datatypes.JSONType[[]FileInfo] `gorm:"type:jsonb" swaggertype:"array,object" json:"file_index"`

	Meta datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"meta"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// AgentSkills <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// AgentSkills <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (AgentSkills) TableName() string { return "agent_skills" }

// FileInfo represents a file in the agent skill package
type FileInfo struct {
	Path string `json:"path"` // Relative path from skillName root
	MIME string `json:"mime"` // MIME type of the file
}

// GetFileS3Key returns the full S3 key for a file given its relative path
func (as *AgentSkills) GetFileS3Key(relativePath string) string {
	baseAsset := as.AssetMeta.Data()
	return baseAsset.S3Key + "/" + relativePath
}
