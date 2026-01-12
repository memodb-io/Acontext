package model

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID  uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_project_identifier,priority:1" json:"project_id"`
	Identifier string    `gorm:"type:text;not null;uniqueIndex:idx_project_identifier,priority:2" json:"identifier"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// User <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// User <-> Space
	Spaces []Space `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// User <-> Session
	Sessions []Session `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// User <-> Disk
	Disks []Disk `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// User <-> AgentSkills
	AgentSkills []AgentSkills `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (User) TableName() string { return "users" }
