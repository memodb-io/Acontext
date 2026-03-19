package model

import (
	"time"

	"github.com/google/uuid"
)

// MetricTags defines the constants for metric tag values
// These should match the MetricTags class in Python (acontext_core/constants.py)
const (
	MetricTagStorageUsage = "storage.usage"
	MetricTagTaskCreated  = "task.created"
)

type Metric struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index:idx_metric_project_id_tag_created_at,priority:1" json:"project_id"`

	Tag       string `gorm:"type:text;not null;index:idx_metric_project_id_tag_created_at,priority:2" json:"tag"`
	Increment int64  `gorm:"not null;default:0" json:"increment"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP;index:idx_metric_project_id_tag_created_at,priority:3;index:idx_metric_created_at" json:"created_at"`
	// No autoUpdateTime — quota metrics set UpdatedAt to an epoch sentinel that must be preserved on insert/update.
	UpdatedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Metric <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Metric) TableName() string { return "metrics" }
