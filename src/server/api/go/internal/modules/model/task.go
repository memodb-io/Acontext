package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Task struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SessionID uuid.UUID `gorm:"type:uuid;not null;index:ix_task_session_id;index:ix_task_session_id_task_id,priority:1;index:ix_task_session_id_status,priority:1;uniqueIndex:uq_session_id_order,priority:1" json:"session_id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index:ix_task_project_id" json:"project_id"`

	Order      int      `gorm:"not null;uniqueIndex:uq_session_id_order,priority:2" json:"order"`
	Data       TaskData `gorm:"type:jsonb;not null;serializer:json" json:"data"`
	Status     string   `gorm:"type:text;not null;default:'pending';check:status IN ('success','failed','running','pending');index:ix_task_session_id_status,priority:2" json:"status"`
	IsPlanning bool     `gorm:"not null;default:false" json:"is_planning"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Task <-> Session
	Session *Session `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Task <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Task <-> Message (one-to-many)
	Messages []Message `gorm:"constraint:OnDelete:SET NULL,OnUpdate:CASCADE;" json:"-"`
}

// TaskData represents the structured data stored in Task.Data field
// This schema matches the Python TaskData model in acontext_core/schema/session/task.py
type TaskData struct {
	TaskDescription string   `json:"task_description"`
	Progresses      []string `json:"progresses,omitempty"`
	UserPreferences []string `json:"user_preferences,omitempty"`
}

// Scan implements the sql.Scanner interface for TaskData
func (td *TaskData) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal JSONB value")
	}
	return json.Unmarshal(bytes, td)
}

// Value implements the driver.Valuer interface for TaskData
func (td TaskData) Value() (driver.Value, error) {
	return json.Marshal(td)
}

func (Task) TableName() string { return "tasks" }
