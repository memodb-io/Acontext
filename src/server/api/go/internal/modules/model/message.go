package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// MessageFormat represents the format for message input/output conversion
type MessageFormat string

const (
	FormatAcontext  MessageFormat = "acontext"
	FormatOpenAI    MessageFormat = "openai"
	FormatAnthropic MessageFormat = "anthropic"
	FormatGemini    MessageFormat = "gemini"
)

// Reserved metadata keys
const (
	// GeminiCallInfoKey is used to store generated Gemini function call information
	// This key is reserved for storing an array of {id, name} objects that need to be matched with responses
	// Format: [{"id": "call_xxx", "name": "function_name"}, ...]
	GeminiCallInfoKey = "__gemini_call_info__"

	// UserMetaKey is the key used to store user-provided metadata within the message meta JSONB.
	// User meta is stored in this wrapper field to isolate it from system fields like source_format.
	UserMetaKey = "__user_meta__"
)

type Message struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	SessionID uuid.UUID  `gorm:"type:uuid;not null;index;index:idx_session_created,priority:1" json:"session_id"`
	ParentID  *uuid.UUID `gorm:"type:uuid;index" json:"parent_id"`
	Parent    *Message   `gorm:"foreignKey:ParentID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
	Children  []Message  `gorm:"foreignKey:ParentID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	Role string `gorm:"type:text;not null;check:role IN ('user','assistant')" json:"role"`

	Meta datatypes.JSONType[map[string]any] `gorm:"type:jsonb;not null;default:'{}'" swaggertype:"object" json:"meta"`

	PartsAssetMeta datatypes.JSONType[Asset] `gorm:"type:jsonb;not null" swaggertype:"-" json:"-"`
	Parts          []Part                    `gorm:"-" swaggertype:"array,object" json:"parts"`

	// Message <-> Task
	TaskID *uuid.UUID `gorm:"type:uuid;index:ix_message_task_id;constraint:OnDelete:SET NULL,OnUpdate:CASCADE;" json:"task_id"`
	Task   *Task      `gorm:"foreignKey:TaskID;references:ID" json:"-"`

	SessionTaskProcessStatus string `gorm:"type:text;not null;default:'pending';check:session_task_process_status IN ('pending', 'processing', 'completed', 'failed')" json:"session_task_process_status"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP;index:idx_session_created,priority:2,sort:desc" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Message <-> Session
	Session *Session `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Message) TableName() string { return "messages" }

// GetReservedKeys returns a list of reserved metadata keys for Message
func (Message) GetReservedKeys() []string {
	return []string{GeminiCallInfoKey}
}

type Part struct {
	// "text" | "image" | "audio" | "video" | "file" | "tool-call" | "tool-result" | "data"
	Type string `json:"type"`

	// text part
	Text string `json:"text,omitempty"`

	// media part
	Asset    *Asset `json:"asset,omitempty"`
	Filename string `json:"filename,omitempty"`

	// embedding、ocr、asr、caption...
	Meta map[string]any `json:"meta,omitempty"`
}
