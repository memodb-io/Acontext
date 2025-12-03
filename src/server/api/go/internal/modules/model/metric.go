package model

import (
	"time"

	"github.com/google/uuid"
)

type Metric struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index:idx_metric_project_id_tag_created_at,priority:1" json:"project_id"`

	Tag       string `gorm:"type:text;not null;index:idx_metric_project_id_tag_created_at,priority:2" json:"tag"`
	Increment int    `gorm:"not null;default:0" json:"increment"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP;index:idx_metric_project_id_tag_created_at,priority:3" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Metric <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Metric) TableName() string { return "metrics" }
