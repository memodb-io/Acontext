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

	// DiskID references the Disk that stores this skill's files as Artifacts
	DiskID uuid.UUID `gorm:"type:uuid;not null" json:"disk_id"`

	// FileIndex is computed at query time from the Disk's Artifacts, not persisted
	FileIndex []FileInfo `gorm:"-" json:"file_index"`

	Meta datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"meta"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// AgentSkills <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// AgentSkills <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// AgentSkills <-> Disk
	Disk *Disk `gorm:"foreignKey:DiskID;constraint:OnDelete:CASCADE" json:"-"`
}

func (AgentSkills) TableName() string { return "agent_skills" }

// FileInfo represents a file in the agent skill package
type FileInfo struct {
	Path string `json:"path"` // Relative path from skillName root
	MIME string `json:"mime"` // MIME type of the file
}
