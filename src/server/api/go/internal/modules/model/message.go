package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// ---------------------------------------------------------------------------
// Message format (input/output conversion target)
// ---------------------------------------------------------------------------

// MessageFormat represents the format for message input/output conversion
type MessageFormat string

const (
	FormatAcontext  MessageFormat = "acontext"
	FormatOpenAI    MessageFormat = "openai"
	FormatAnthropic MessageFormat = "anthropic"
	FormatGemini    MessageFormat = "gemini"
)

// ---------------------------------------------------------------------------
// Role constants
// ---------------------------------------------------------------------------

// Role is a type alias for message role strings.
// Using alias (=) instead of a new type so existing "user"/"assistant" literals
// remain assignable without conversion.
type Role = string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

// ---------------------------------------------------------------------------
// Part type constants
// ---------------------------------------------------------------------------

// PartType is the type discriminator for message parts.
// These values are serialized to JSON and stored in S3 -- do NOT change them.
// Using alias (=) so existing string literals remain assignable.
type PartType = string

const (
	PartTypeText       PartType = "text"
	PartTypeImage      PartType = "image"
	PartTypeAudio      PartType = "audio"
	PartTypeVideo      PartType = "video"
	PartTypeFile       PartType = "file"
	PartTypeToolCall   PartType = "tool-call"
	PartTypeToolResult PartType = "tool-result"
	PartTypeData       PartType = "data"
	PartTypeThinking   PartType = "thinking"
)

// ---------------------------------------------------------------------------
// Meta key constants  (Part.Meta and Message.Meta dictionary keys)
// ---------------------------------------------------------------------------

// MetaKey is a string alias for Part.Meta and Message.Meta dictionary keys.
type MetaKey = string

// Shared Meta Keys -- used across multiple Part types or contexts.
const (
	// MetaKeyCacheControl stores cache control config, e.g. {"type": "ephemeral"}.
	// Used in text, image, tool-call, tool-result, file parts (from Anthropic).
	MetaKeyCacheControl MetaKey = "cache_control"

	// MetaKeyMediaType stores the MIME type string, e.g. "image/png".
	// Used in image, audio, video, file parts.
	MetaKeyMediaType MetaKey = "media_type"

	// MetaKeyData stores base64-encoded binary data.
	// Used in image, audio, file parts.
	MetaKeyData MetaKey = "data"

	// MetaKeyURL stores a resource URL.
	// Used in image, file parts.
	MetaKeyURL MetaKey = "url"

	// MetaKeyName stores a name string. Context-dependent:
	//   - tool-call Part: function/tool name
	//   - tool-result Part: function name (for Gemini FunctionResponse)
	//   - Message.Meta: sender name (from OpenAI name field)
	MetaKeyName MetaKey = "name"

	// MetaKeySourceType stores the source type discriminator.
	//   - image/file parts: "base64" or "url" (from Anthropic/Gemini normalizers)
	//   - tool-call parts: "function" or "tool_use" (original provider type)
	MetaKeySourceType MetaKey = "type"
)

// tool-call Part Meta Keys.
const (
	// MetaKeyID is the tool-call's own unique identifier.
	MetaKeyID MetaKey = "id"

	// MetaKeyArguments stores the JSON string of function arguments.
	MetaKeyArguments MetaKey = "arguments"
)

// tool-result Part Meta Keys.
const (
	// MetaKeyToolCallID links a tool-result back to the originating tool-call's MetaKeyID.
	MetaKeyToolCallID MetaKey = "tool_call_id"

	// MetaKeyIsError indicates whether the tool result is an error (bool, from Anthropic).
	MetaKeyIsError MetaKey = "is_error"
)

// image Part Meta Keys.
const (
	// MetaKeyDetail stores the image detail level hint: "auto", "low", "high" (from OpenAI).
	MetaKeyDetail MetaKey = "detail"
)

// audio Part Meta Keys.
const (
	// MetaKeyAudioFormat stores the audio encoding format: "mp3", "wav", etc.
	MetaKeyAudioFormat MetaKey = "format"
)

// file Part Meta Keys.
const (
	// MetaKeyFileID stores an external file reference (e.g. OpenAI file ID).
	MetaKeyFileID MetaKey = "file_id"

	// MetaKeyFileData stores base64-encoded file data (from OpenAI).
	MetaKeyFileData MetaKey = "file_data"

	// MetaKeyFilename stores the original file name.
	MetaKeyFilename MetaKey = "filename"
)

// thinking Part Meta Keys.
const (
	// MetaKeySignature stores the Anthropic extended thinking signature.
	MetaKeySignature MetaKey = "signature"
)

// text Part Meta Keys.
const (
	// MetaKeyIsRefusal indicates the text is a refusal response (bool, from OpenAI).
	MetaKeyIsRefusal MetaKey = "is_refusal"
)

// data Part Meta Keys.
const (
	// MetaKeyDataType is the type discriminator for data parts.
	MetaKeyDataType MetaKey = "data_type"
)

// ---------------------------------------------------------------------------
// Message-level Meta key constants  (stored in Message.Meta DB JSONB)
// ---------------------------------------------------------------------------

const (
	// MsgMetaSourceFormat records which provider format the message was ingested from.
	// Values: "openai", "anthropic", "gemini", "acontext".
	MsgMetaSourceFormat MetaKey = "source_format"

	// GeminiCallInfoKey is used to store generated Gemini function call information.
	// Format: [{"id": "call_xxx", "name": "function_name"}, ...]
	GeminiCallInfoKey = "__gemini_call_info__"

	// UserMetaKey is the key used to store user-provided metadata within the message meta JSONB.
	// User meta is stored in this wrapper field to isolate it from system fields like source_format.
	UserMetaKey = "__user_meta__"
)

// ---------------------------------------------------------------------------
// Message model
// ---------------------------------------------------------------------------

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

	SessionTaskProcessStatus string `gorm:"type:text;not null;default:'pending';check:session_task_process_status IN ('pending', 'running', 'success', 'failed')" json:"session_task_process_status"`

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

// ---------------------------------------------------------------------------
// Part model
// ---------------------------------------------------------------------------

// Part represents a single content block within a message.
// The Type field (use PartType* constants) determines which struct fields and
// Meta keys are expected. The struct and its JSON serialization are stored in
// S3 -- do NOT change field names or json tags.
//
// Canonical schema per Type:
//
//	text:        Text (required). Meta: cache_control?, is_refusal?
//	image:       Asset or Meta. Meta: media_type, data (base64) | url, detail?, type?, cache_control?
//	audio:       Asset or Meta. Meta: data (base64), format
//	video:       Asset or Meta. Meta: media_type, data (base64) | url
//	file:        Asset+Filename or Meta. Meta: media_type?, data? | url? | file_id?, file_data?, filename?, type?, cache_control?
//	tool-call:   Meta (required): id, name, arguments (JSON string). Optional: type, cache_control
//	tool-result: Text + Meta (required): tool_call_id. Optional: name, is_error, cache_control
//	data:        Meta (required): data_type
//	thinking:    Text (required). Meta: signature?
type Part struct {
	Type string `json:"type"`

	// Text content (used by text, tool-result, thinking parts).
	Text string `json:"text,omitempty"`

	// Asset reference for uploaded media (image, audio, video, file).
	Asset    *Asset `json:"asset,omitempty"`
	Filename string `json:"filename,omitempty"`

	// Meta holds type-specific metadata. See MetaKey* constants for canonical keys.
	Meta map[string]any `json:"meta,omitempty"`
}

// ---------------------------------------------------------------------------
// Part Meta accessor helpers
// ---------------------------------------------------------------------------

// GetMetaString safely extracts a string value from Part.Meta.
func (p Part) GetMetaString(key MetaKey) string {
	if p.Meta == nil {
		return ""
	}
	v, _ := p.Meta[key].(string)
	return v
}

// GetMetaBool safely extracts a bool value from Part.Meta.
func (p Part) GetMetaBool(key MetaKey) bool {
	if p.Meta == nil {
		return false
	}
	v, _ := p.Meta[key].(bool)
	return v
}

// ID returns the tool-call's own unique ID from Meta.
func (p Part) ID() string { return p.GetMetaString(MetaKeyID) }

// ToolCallID returns the tool_call_id that links a tool-result to its tool-call.
func (p Part) ToolCallID() string { return p.GetMetaString(MetaKeyToolCallID) }

// Name returns the function/tool name from a tool-call or tool-result Meta.
func (p Part) Name() string { return p.GetMetaString(MetaKeyName) }

// Arguments returns the arguments JSON string from a tool-call Meta.
func (p Part) Arguments() string { return p.GetMetaString(MetaKeyArguments) }

// IsError returns is_error from a tool-result Meta.
func (p Part) IsError() bool { return p.GetMetaBool(MetaKeyIsError) }

// Signature returns the Anthropic thinking signature from Meta.
func (p Part) Signature() string { return p.GetMetaString(MetaKeySignature) }

// ---------------------------------------------------------------------------
// Part constructor helpers
// ---------------------------------------------------------------------------

// NewTextPart creates a text Part.
func NewTextPart(text string) Part {
	return Part{Type: PartTypeText, Text: text}
}

// NewToolCallPart creates a tool-call Part with the canonical meta schema.
func NewToolCallPart(id, name, arguments string) Part {
	return Part{
		Type: PartTypeToolCall,
		Meta: map[string]any{
			MetaKeyID:        id,
			MetaKeyName:      name,
			MetaKeyArguments: arguments,
		},
	}
}

// NewToolResultPart creates a tool-result Part with the canonical meta schema.
func NewToolResultPart(toolCallID, text string) Part {
	return Part{
		Type: PartTypeToolResult,
		Text: text,
		Meta: map[string]any{
			MetaKeyToolCallID: toolCallID,
		},
	}
}

// NewThinkingPart creates a thinking Part.
func NewThinkingPart(text, signature string) Part {
	return Part{
		Type: PartTypeThinking,
		Text: text,
		Meta: map[string]any{
			MetaKeySignature: signature,
		},
	}
}

// NewImagePartBase64 creates an image Part from base64 data.
func NewImagePartBase64(mediaType, base64Data string) Part {
	return Part{
		Type: PartTypeImage,
		Meta: map[string]any{
			MetaKeyMediaType: mediaType,
			MetaKeyData:      base64Data,
		},
	}
}

// NewImagePartURL creates an image Part from a URL.
func NewImagePartURL(url string) Part {
	return Part{
		Type: PartTypeImage,
		Meta: map[string]any{
			MetaKeyURL: url,
		},
	}
}

// NewFilePartBase64 creates a file Part from base64 data.
func NewFilePartBase64(mediaType, base64Data string) Part {
	return Part{
		Type: PartTypeFile,
		Meta: map[string]any{
			MetaKeyMediaType: mediaType,
			MetaKeyData:      base64Data,
		},
	}
}

// NewAudioPart creates an audio Part from base64 data.
func NewAudioPart(base64Data, format string) Part {
	return Part{
		Type: PartTypeAudio,
		Meta: map[string]any{
			MetaKeyData:        base64Data,
			MetaKeyAudioFormat: format,
		},
	}
}
