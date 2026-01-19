package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type SandboxLog struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index:ix_sandbox_log_project_id" json:"project_id"`

	BackendSandboxID *string `gorm:"type:text" json:"backend_sandbox_id"`

	BackendType string `gorm:"type:text;not null" json:"backend_type"`

	HistoryCommands datatypes.JSONType[[]HistoryCommand] `gorm:"type:jsonb;not null" swaggertype:"array,object" json:"history_commands"`

	GeneratedFiles datatypes.JSONType[[]GeneratedFile] `gorm:"type:jsonb;not null" swaggertype:"array,object" json:"generated_files"`

	WillTotalAliveSeconds int `gorm:"not null" json:"will_total_alive_seconds"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// SandboxLog <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (SandboxLog) TableName() string { return "sandbox_logs" }

type HistoryCommand struct {
	Command  string `json:"command"`
	ExitCode int    `json:"exit_code"`
}

type GeneratedFile struct {
	SandboxPath string `json:"sandbox_path"`
}
