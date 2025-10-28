package converter

import (
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// AcontextConverter converts internal messages to Acontext format
type AcontextConverter struct{}

// AcontextMessage represents the API response format for Acontext.
// This is a Data Transfer Object (DTO) that matches the UI's expected structure.
// It includes both essential fields and optional metadata for client flexibility.
type AcontextMessage struct {
	ID                       string                 `json:"id"`
	SessionID                string                 `json:"session_id"`
	ParentID                 *string                `json:"parent_id"` // Nullable for message threading
	Role                     string                 `json:"role"`
	Parts                    []AcontextPart         `json:"parts"`
	SessionTaskProcessStatus string                 `json:"session_task_process_status"` // Task processing state
	Meta                     map[string]interface{} `json:"meta,omitempty"`
	CreatedAt                string                 `json:"created_at"` // ISO 8601 timestamp for UI compatibility
	UpdatedAt                string                 `json:"updated_at"` // ISO 8601 timestamp
}

// AcontextPart represents a part in Acontext format.
// Separate from model.Part to provide clean API structure and avoid GORM types.
type AcontextPart struct {
	Type      string                 `json:"type"`
	Text      string                 `json:"text,omitempty"`
	Asset     *AcontextAsset         `json:"asset,omitempty"`
	Meta      map[string]interface{} `json:"meta,omitempty"`
	FileField string                 `json:"file_field,omitempty"`
}

// AcontextAsset represents an asset in Acontext format.
// Maps model.Asset fields to client-friendly names:
//   - Asset.MIME      → ContentType
//   - Asset.SizeB     → Size
//   - Part.Filename   → Filename (note: Filename is in Part, not Asset in the model)
type AcontextAsset struct {
	S3Key       string `json:"s3_key,omitempty"`
	Filename    string `json:"filename,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	Size        int64  `json:"size,omitempty"`
}

// Convert converts internal model.Message to Acontext format
func (c *AcontextConverter) Convert(messages []model.Message, publicURLs map[string]service.PublicURL) (interface{}, error) {
	result := make([]AcontextMessage, len(messages))

	for i, msg := range messages {
		acontextMsg := AcontextMessage{
			ID:                       msg.ID.String(),
			SessionID:                msg.SessionID.String(),
			Role:                     msg.Role,
			SessionTaskProcessStatus: msg.SessionTaskProcessStatus,
			CreatedAt:                msg.CreatedAt.Format("2006-01-02T15:04:05.999999Z07:00"), // ISO 8601 / RFC3339
			UpdatedAt:                msg.UpdatedAt.Format("2006-01-02T15:04:05.999999Z07:00"),
		}

		// Convert ParentID if present
		if msg.ParentID != nil {
			parentIDStr := msg.ParentID.String()
			acontextMsg.ParentID = &parentIDStr
		}

		// Convert meta if present - handle datatypes.JSONType
		if metaData := msg.Meta.Data(); len(metaData) > 0 {
			acontextMsg.Meta = metaData
		}

		// Convert parts
		acontextMsg.Parts = make([]AcontextPart, len(msg.Parts))
		for j, part := range msg.Parts {
			acontextPart := AcontextPart{
				Type: part.Type,
				Text: part.Text,
			}

			// Convert asset if present
			if part.Asset != nil {
				acontextPart.Asset = &AcontextAsset{
					S3Key:       part.Asset.S3Key,
					Filename:    part.Filename, // Filename is in Part, not Asset
					ContentType: part.Asset.MIME,
					Size:        part.Asset.SizeB,
				}

				// Add public URL to asset if available
				if url, ok := publicURLs[part.Asset.S3Key]; ok {
					if acontextPart.Meta == nil {
						acontextPart.Meta = make(map[string]interface{})
					}
					acontextPart.Meta["public_url"] = url.URL
				}
			}

			// Convert meta if present
			if len(part.Meta) > 0 {
				if acontextPart.Meta == nil {
					acontextPart.Meta = make(map[string]interface{})
				}
				for k, v := range part.Meta {
					acontextPart.Meta[k] = v
				}
			}

			acontextMsg.Parts[j] = acontextPart
		}

		result[i] = acontextMsg
	}

	return result, nil
}
