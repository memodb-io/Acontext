package model

import (
	"time"

	"gorm.io/datatypes"
)

type Message struct {
	ID        datatypes.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SessionID datatypes.UUID `gorm:"type:uuid;not null;index" json:"session_id"`
	Role      string         `gorm:"type:text;not null;check:role IN ('user','assistant','system','tool','function')" json:"role"`

	Parts datatypes.JSONType[[]Part] `gorm:"type:jsonb;not null" swaggertype:"array,object" json:"parts"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Message <-> Session
	Session Session `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`

	// Message <-> Asset
	Assets []Asset `gorm:"many2many:message_assets;"`

	// Message <-> MessageAsset
	MessageAssets []MessageAsset `gorm:"constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
}

func (Message) TableName() string { return "messages" }

type Part struct {
	// "text" | "image" | "audio" | "video" | "file" | "tool-call" | "tool-result" | "data"
	Type string `json:"type"`

	// text part
	Text     string `json:"text,omitempty"`
	Markdown bool   `json:"markdown,omitempty"`
	Lang     string `json:"lang,omitempty"`

	// media part
	AssetID   *string  `json:"asset_id,omitempty"`
	MIME      string   `json:"mime,omitempty"`
	Filename  string   `json:"filename,omitempty"`
	SizeB     *int64   `json:"size_bigint,omitempty"`
	Width     *int     `json:"width,omitempty"`
	Height    *int     `json:"height,omitempty"`
	DurationS *float64 `json:"duration_seconds,omitempty"`

	// tool part
	ToolName   string         `json:"tool_name,omitempty"`
	ToolCallID string         `json:"tool_call_id,omitempty"`
	Args       map[string]any `json:"args,omitempty"`
	Result     map[string]any `json:"result,omitempty"`

	// embedding、ocr、asr、caption...
	Meta map[string]any `json:"meta,omitempty"`
}
