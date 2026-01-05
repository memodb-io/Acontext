package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Thread-Safety Note: Reference counting is handled atomically at the database level using
// SQL expressions (e.g., "ref_count = ref_count + 1") in the repository layer. This leverages
// PostgreSQL's row-level locking and transaction isolation to prevent race conditions even
// under high concurrency, eliminating the need for application-level synchronization or Redis.

// AssetReference tracks references to assets stored in S3
// This allows for reference counting and safe deletion of assets
type AssetReference struct {
	ID uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`

	// Project ID for multi-tenant isolation
	// Assets are isolated per project for security and access control
	ProjectID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_project_sha256,priority:1;index:idx_asset_ref_updated_at_project_id,priority:2" json:"project_id"`

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
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP;index:idx_asset_ref_updated_at_project_id,priority:1" json:"updated_at"`

	// Optional: Last referenced timestamp to help with garbage collection
	LastReferencedAt time.Time `gorm:"type:timestamp;index" json:"last_referenced_at"`

	// AssetReference <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (AssetReference) TableName() string { return "asset_references" }

type Asset struct {
	Bucket  string `json:"bucket"`
	S3Key   string `json:"s3_key"`
	ETag    string `json:"etag"`
	SHA256  string `json:"sha256"`
	MIME    string `json:"mime"`
	SizeB   int64  `json:"size_b"`
	Content string `json:"content,omitempty"` // Text content for text-searchable files (text/*, application/json, application/x-*)
}

// IsOrphaned returns true if this asset has no references
func (a *AssetReference) IsOrphaned() bool {
	return a.RefCount <= 0
}
