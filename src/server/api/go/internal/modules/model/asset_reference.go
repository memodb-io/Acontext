package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// TODO: Fix race condition in concurrent scenarios. When multiple goroutines simultaneously
// update the RefCount field, there's a risk of data races and incorrect reference counting.
// Moving the reference count data to Redis with atomic operations (e.g., INCR/DECR) will
// prevent race conditions and ensure thread-safe reference counting.

// AssetReference tracks references to assets stored in S3
// This allows for reference counting and safe deletion of assets
type AssetReference struct {
	ID uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`

	// Project ID for multi-tenant isolation
	// Assets are isolated per project for security and access control
	ProjectID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_project_sha256,priority:1" json:"project_id"`

	// SHA256 hash as unique identifier for content-based deduplication
	// Combined with ProjectID as composite unique key
	SHA256 string `gorm:"type:char(64);not null;uniqueIndex:idx_project_sha256,priority:2" json:"sha256"`

	// Canonical S3 key - the first uploaded location or preferred location
	// When same content is uploaded multiple times within a project, we keep only one copy
	// Format: assets/{project_id}/{sha256}.ext
	S3Key string `gorm:"type:text;not null;index" json:"s3_key"`

	// Reference count - how many messages/entities reference this asset within this project
	RefCount int `gorm:"type:integer;not null;default:0;check:ref_count >= 0" json:"ref_count"`

	// Full asset metadata stored as JSON
	AssetMeta datatypes.JSONType[Asset] `gorm:"type:jsonb;not null" swaggertype:"object" json:"asset_meta"`

	// Timestamps
	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Optional: Last referenced timestamp to help with garbage collection
	LastReferencedAt time.Time `gorm:"type:timestamp;index" json:"last_referenced_at"`

	// AssetReference <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"project"`
}

func (AssetReference) TableName() string { return "asset_references" }

type Asset struct {
	Bucket string `json:"bucket"`
	S3Key  string `json:"s3_key"`
	ETag   string `json:"etag"`
	SHA256 string `json:"sha256"`
	MIME   string `json:"mime"`
	SizeB  int64  `json:"size_b"`
}

// IsOrphaned returns true if this asset has no references
func (a *AssetReference) IsOrphaned() bool {
	return a.RefCount <= 0
}
