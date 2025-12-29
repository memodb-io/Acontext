package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type AgentSkills struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_project_name,priority:1" json:"project_id"`

	// Name is unique within a project
	Name        string `gorm:"type:text;not null;uniqueIndex:idx_project_name,priority:2" json:"name"`
	Description string `gorm:"type:text" json:"description"`

	// AssetMeta points to the base directory path (skillName root)
	// S3Key format: "agent_skills/{project_id}/{agent_skills_id}/{skillName}/"
	// skillName is included in S3 path, so FileIndex doesn't need to repeat it
	AssetMeta datatypes.JSONType[Asset] `gorm:"type:jsonb;not null" swaggertype:"-" json:"-"`

	// FileIndex contains relative paths of files from the skillName root directory
	// Example: ["pdf/SKILL.md", "pdf/scripts/extract_text.json"]
	// These paths are relative to baseS3Key (which includes skillName)
	// Full S3 key = baseS3Key + "/" + fileIndex[i]
	FileIndex datatypes.JSONType[[]string] `gorm:"type:jsonb" swaggertype:"array,string" json:"file_index"`

	Meta datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"meta"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// AgentSkills <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (AgentSkills) TableName() string { return "agent_skills" }

// GetFileS3Key returns the full S3 key for a file given its relative path
func (as *AgentSkills) GetFileS3Key(relativePath string) string {
	baseAsset := as.AssetMeta.Data()
	return baseAsset.S3Key + "/" + relativePath
}
