package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Reserved metadata keys that are not allowed in user metadata
const (
	// ArtifactInfoKey is used to store artifact-related system metadata
	// This key is reserved for storing file path, filename, mime type, size, etc.
	ArtifactInfoKey = "__artifact_info__"
)

type Disk struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID  `gorm:"type:uuid;not null;index" json:"project_id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"user_id"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Disk <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Disk <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Disk) TableName() string { return "disks" }

type Artifact struct {
	ID        uuid.UUID                 `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"-"`
	DiskID    uuid.UUID                 `gorm:"type:uuid;not null;index;uniqueIndex:idx_disk_path_filename" json:"disk_id"`
	Path      string                    `gorm:"type:text;not null;uniqueIndex:idx_disk_path_filename" json:"path"`
	Filename  string                    `gorm:"type:text;not null;uniqueIndex:idx_disk_path_filename" json:"filename"`
	Meta      datatypes.JSONMap         `gorm:"type:jsonb" swaggertype:"object" json:"meta"`
	AssetMeta datatypes.JSONType[Asset] `gorm:"type:jsonb;not null" swaggertype:"-" json:"-"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Artifact <-> Disk
	Disk *Disk `gorm:"foreignKey:DiskID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Artifact) TableName() string { return "artifacts" }

// GetReservedKeys returns a list of reserved metadata keys for Artifact
func (Artifact) GetReservedKeys() []string {
	return []string{ArtifactInfoKey}
}
