package model

import (
	"time"

	"gorm.io/datatypes"
)

type Session struct {
	ID        datatypes.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID datatypes.UUID    `gorm:"type:uuid;not null;index" json:"project_id"`
	SpaceID   datatypes.UUID    `gorm:"type:uuid;index" json:"space_id"`
	Configs   datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"configs"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Session <-> Project
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`

	// Session <-> Space
	Space *Space `gorm:"foreignKey:SpaceID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`

	// Session <-> Message
	Messages []Message `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
}

func (Session) TableName() string { return "sessions" }
