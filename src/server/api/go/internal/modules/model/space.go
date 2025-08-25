package model

import (
	"time"

	"gorm.io/datatypes"
)

type Space struct {
	ID        datatypes.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID datatypes.UUID    `gorm:"type:uuid;not null;index" json:"project_id"`
	Configs   datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"configs"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Space <-> Project
	Project Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`

	// Space <-> Session
	Sessions []Session `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
}

func (Space) TableName() string { return "spaces" }
