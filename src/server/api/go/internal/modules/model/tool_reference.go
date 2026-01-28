package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type ToolReference struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description *string   `gorm:"type:text" json:"description"`
	ProjectID   uuid.UUID `gorm:"type:uuid;not null;index:idx_tool_reference_project_id;index:idx_tool_reference_project_id_name,priority:1" json:"project_id"`
	Project     *Project  `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	ArgumentsSchema datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"arguments_schema"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (ToolReference) TableName() string { return "tool_references" }
