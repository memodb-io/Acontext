package model

import (
	"time"

	"gorm.io/datatypes"
)

type Project struct {
	ID      datatypes.UUID    `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Configs datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"configs"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Project <-> Space
	Spaces []Space `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`

	// Project <-> Session
	Sessions []Session `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
}

func (Project) TableName() string { return "projects" }
