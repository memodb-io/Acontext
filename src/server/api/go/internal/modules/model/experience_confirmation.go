package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type ExperienceConfirmation struct {
	ID             uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SpaceID        uuid.UUID         `gorm:"type:uuid;not null;index:idx_experience_confirmations_space" json:"space_id"`
	ExperienceData datatypes.JSONMap `gorm:"type:jsonb;not null" swaggertype:"object" json:"experience_data"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// ExperienceConfirmation <-> Space
	Space *Space `gorm:"foreignKey:SpaceID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (ExperienceConfirmation) TableName() string { return "experience_confirmations" }
