package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Space struct {
	ID        uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID         `gorm:"type:uuid;not null;index" json:"project_id"`
	UserID    *uuid.UUID        `gorm:"type:uuid;index" json:"user_id"`
	Configs   datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"configs"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Space <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Space <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Space <-> Session
	Sessions []Session `gorm:"constraint:OnDelete:SET NULL,OnUpdate:CASCADE;" json:"-"`

	// Space <-> ExperienceConfirmation
	ExperienceConfirmations []ExperienceConfirmation `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Space) TableName() string { return "spaces" }
