package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Reserved metadata keys that are not allowed in user metadata
const (
	// FileInfoKey is used to store file-related system metadata
	// This key is reserved for storing file path, filename, mime type, size, etc.
	FileInfoKey = "__file_info__"
)

// GetReservedKeys returns a list of all reserved metadata keys
func GetReservedKeys() []string {
	return []string{FileInfoKey}
}

type Artifact struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID `gorm:"type:uuid;not null;index" json:"project_id"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Artifact <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"project"`
}

func (Artifact) TableName() string { return "artifacts" }

type File struct {
	ID         uuid.UUID                 `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"-"`
	ArtifactID uuid.UUID                 `gorm:"type:uuid;not null;index;uniqueIndex:idx_artifact_path_filename" json:"artifact_id"`
	Path       string                    `gorm:"type:text;not null;uniqueIndex:idx_artifact_path_filename" json:"path"`
	Filename   string                    `gorm:"type:text;not null;uniqueIndex:idx_artifact_path_filename" json:"filename"`
	Meta       datatypes.JSONMap         `gorm:"type:jsonb" swaggertype:"object" json:"meta"`
	AssetMeta  datatypes.JSONType[Asset] `gorm:"type:jsonb;not null" swaggertype:"-" json:"-"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// File <-> Artifact
	Artifact *Artifact `gorm:"foreignKey:ArtifactID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"artifact"`
}

func (File) TableName() string { return "files" }
