package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type Session struct {
	ID                  uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID           uuid.UUID         `gorm:"type:uuid;not null;index" json:"project_id"`
	UserID              *uuid.UUID        `gorm:"type:uuid;index" json:"user_id"`
	DisableTaskTracking bool              `gorm:"not null;default:false" json:"disable_task_tracking"`
	Configs             datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"configs"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Session <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Session <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Session <-> Message
	Messages []Message `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Session <-> Task
	Tasks []Task `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Session) TableName() string { return "sessions" }

// MessageObservingStatus represents the count of messages by their observing status
type MessageObservingStatus struct {
	Observed  int       `json:"observed"`
	InProcess int       `json:"in_process"`
	Pending   int       `json:"pending"`
	UpdatedAt time.Time `json:"updated_at"`
}
