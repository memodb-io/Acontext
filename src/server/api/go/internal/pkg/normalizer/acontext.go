package normalizer

import (
	"encoding/json"
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/service"
)

// AcontextNormalizer normalizes Acontext (internal) format
type AcontextNormalizer struct{}

// NormalizeFromAcontextMessage converts Acontext format to internal format
// This is essentially a validation step since Acontext IS the internal format
func (n *AcontextNormalizer) NormalizeFromAcontextMessage(messageJSON json.RawMessage) (string, []service.PartIn, error) {
	var msg struct {
		Role  string           `json:"role"`
		Parts []service.PartIn `json:"parts"`
	}

	if err := json.Unmarshal(messageJSON, &msg); err != nil {
		return "", nil, fmt.Errorf("failed to unmarshal Acontext message: %w", err)
	}

	// Validate role
	validRoles := map[string]bool{"user": true, "assistant": true, "system": true}
	if !validRoles[msg.Role] {
		return "", nil, fmt.Errorf("invalid role: %s (must be one of: user, assistant, system)", msg.Role)
	}

	// Validate each part
	for i, part := range msg.Parts {
		if err := part.Validate(); err != nil {
			return "", nil, fmt.Errorf("invalid part at index %d: %w", i, err)
		}
	}

	return msg.Role, msg.Parts, nil
}
