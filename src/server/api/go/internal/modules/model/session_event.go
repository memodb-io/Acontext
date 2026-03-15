package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type SessionEvent struct {
	ID        uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SessionID uuid.UUID      `gorm:"type:uuid;not null;index:idx_session_event_created,priority:1" json:"session_id"`
	ProjectID uuid.UUID      `gorm:"type:uuid;not null;index" json:"project_id"`
	Type      string         `gorm:"type:text;not null" json:"type"`
	Data      datatypes.JSON `gorm:"type:jsonb;not null" swaggertype:"object" json:"data"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP;index:idx_session_event_created,priority:2,sort:desc" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// SessionEvent <-> Session
	Session *Session `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// SessionEvent <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (SessionEvent) TableName() string { return "session_events" }
