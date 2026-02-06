package normalizer

import (
	"encoding/json"
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// AcontextNormalizer normalizes Acontext (internal) format.
type AcontextNormalizer struct{}

// Normalize converts Acontext format to internal format.
// This is essentially a validation step since Acontext IS the internal format.
func (n *AcontextNormalizer) Normalize(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	var msg struct {
		Role  string                 `json:"role"`
		Parts []service.PartIn       `json:"parts"`
		Meta  map[string]interface{} `json:"meta,omitempty"`
	}

	if err := json.Unmarshal(messageJSON, &msg); err != nil {
		return "", nil, nil, fmt.Errorf("failed to unmarshal Acontext message: %w", err)
	}

	// Validate role
	if msg.Role != model.RoleUser && msg.Role != model.RoleAssistant {
		return "", nil, nil, fmt.Errorf("invalid role: %s (must be one of: user, assistant)", msg.Role)
	}

	// Validate each part
	for i, part := range msg.Parts {
		if err := part.Validate(); err != nil {
			return "", nil, nil, fmt.Errorf("invalid part at index %d: %w", i, err)
		}
	}

	// Extract or create message-level metadata
	messageMeta := msg.Meta
	if messageMeta == nil {
		messageMeta = make(map[string]interface{})
	}

	// Ensure source_format is set
	if _, hasSourceFormat := messageMeta[model.MsgMetaSourceFormat]; !hasSourceFormat {
		messageMeta[model.MsgMetaSourceFormat] = "acontext"
	}

	return msg.Role, msg.Parts, messageMeta, nil
}

// NormalizeFromAcontextMessage is a backward-compatible alias for Normalize.
// Deprecated: Use Normalize() via the MessageNormalizer interface instead.
func (n *AcontextNormalizer) NormalizeFromAcontextMessage(messageJSON json.RawMessage) (string, []service.PartIn, map[string]interface{}, error) {
	return n.Normalize(messageJSON)
}
