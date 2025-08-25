package model

import (
	"time"

	"gorm.io/datatypes"
)

type Asset struct {
	ID       datatypes.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Bucket   string         `gorm:"type:text;not null;uniqueIndex:u_bucket_key,priority:1"`
	S3Key    string         `gorm:"column:s3_key;type:text;not null;uniqueIndex:u_bucket_key,priority:2"`
	ETag     string         `gorm:"column:etag;type:text"`
	SHA256   string         `gorm:"column:sha256;type:text"`
	MIME     string         `gorm:"column:mime;type:text;not null"`
	SizeB    int64          `gorm:"column:size_bigint;type:bigint;not null"`
	Width    *int           `gorm:"column:width"`
	Height   *int           `gorm:"column:height"`
	Duration *float64       `gorm:"column:duration_seconds;type:numeric"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Asset <-> Message
	Messages []Message `gorm:"many2many:message_assets;"`
}

func (Asset) TableName() string { return "assets" }

type MessageAsset struct {
	MessageID datatypes.UUID `gorm:"type:uuid;primaryKey;index"`
	AssetID   datatypes.UUID `gorm:"type:uuid;primaryKey;index"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// MessageAsset <-> Message
	Message Message `gorm:"foreignKey:MessageID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`

	// MessageAsset <-> Asset
	Asset Asset `gorm:"foreignKey:AssetID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
}

func (MessageAsset) TableName() string { return "message_assets" }
