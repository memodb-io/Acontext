package converter

import (
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/service"
)

// MessageNormalizer normalizes input messages from different formats to internal format
type MessageNormalizer interface {
	// Normalize converts format-specific role and parts to internal representation
	Normalize(role string, parts []service.PartIn) (string, []service.PartIn, error)
}

// GetNormalizer returns the appropriate normalizer for the given format
func GetNormalizer(format MessageFormat) (MessageNormalizer, error) {
	switch format {
	case FormatAcontext, "": // Internal format, no normalization needed
		return &NoOpNormalizer{}, nil
	case FormatOpenAI:
		return &OpenAINormalizer{}, nil
	case FormatAnthropic:
		return &AnthropicNormalizer{}, nil
	default:
		return nil, fmt.Errorf("unsupported input format: %s", format)
	}
}

// NoOpNormalizer does no transformation (for internal format)
type NoOpNormalizer struct{}

func (n *NoOpNormalizer) Normalize(role string, parts []service.PartIn) (string, []service.PartIn, error) {
	return role, parts, nil
}

// OpenAINormalizer normalizes OpenAI format to internal format
type OpenAINormalizer struct{}

func (n *OpenAINormalizer) Normalize(role string, parts []service.PartIn) (string, []service.PartIn, error) {
	// OpenAI supports: user, assistant, system, tool, function
	// Internal format only supports: user, assistant, system
	// We convert tool and function roles to user

	normalizedRole := role

	// Convert deprecated/external roles to internal format
	if role == "tool" || role == "function" {
		normalizedRole = "user"
	}

	// Validate normalized role
	validRoles := map[string]bool{
		"user": true, "assistant": true, "system": true,
	}
	if !validRoles[normalizedRole] {
		return "", nil, fmt.Errorf("invalid OpenAI role: %s", role)
	}

	// Normalize parts structure
	normalizedParts := make([]service.PartIn, len(parts))
	for i, part := range parts {
		normalizedParts[i] = part

		// Ensure tool-call parts have correct field names
		if part.Type == "tool-call" && part.Meta != nil {
			// OpenAI may use 'name' for tool name, normalize to 'tool_name'
			if name, ok := part.Meta["name"].(string); ok && part.Meta["tool_name"] == nil {
				normalizedParts[i].Meta["tool_name"] = name
			}
		}
	}

	return normalizedRole, normalizedParts, nil
}

// AnthropicNormalizer normalizes Anthropic format to internal format
type AnthropicNormalizer struct{}

func (n *AnthropicNormalizer) Normalize(role string, parts []service.PartIn) (string, []service.PartIn, error) {
	// Anthropic only has "user" and "assistant" roles
	// System messages should be sent via system parameter, not as messages
	validRoles := map[string]bool{
		"user": true, "assistant": true,
	}
	if !validRoles[role] {
		return "", nil, fmt.Errorf("invalid Anthropic role: %s (only 'user' and 'assistant' are supported)", role)
	}

	normalizedParts := make([]service.PartIn, 0, len(parts))

	for _, part := range parts {
		normalizedPart := part

		switch part.Type {
		case "text", "image":
			// Direct mapping
			normalizedParts = append(normalizedParts, normalizedPart)

		case "tool-use":
			// Anthropic's "tool_use" -> internal "tool-call"
			normalizedPart.Type = "tool-call"

			if part.Meta == nil {
				return "", nil, fmt.Errorf("tool-use part missing meta")
			}

			// Anthropic uses 'name' for tool name, we use 'tool_name'
			if name, ok := part.Meta["name"].(string); ok {
				normalizedPart.Meta["tool_name"] = name
			}
			// Anthropic uses 'input' for arguments, we use 'arguments'
			if input, ok := part.Meta["input"]; ok {
				normalizedPart.Meta["arguments"] = input
			}
			normalizedParts = append(normalizedParts, normalizedPart)

		case "tool-call":
			// Already in internal format, but check field mappings
			if part.Meta == nil {
				return "", nil, fmt.Errorf("tool-call part missing meta")
			}

			// Map 'name' to 'tool_name' if needed
			if name, ok := part.Meta["name"].(string); ok && part.Meta["tool_name"] == nil {
				normalizedPart.Meta["tool_name"] = name
			}
			// Map 'input' to 'arguments' if needed
			if input, ok := part.Meta["input"]; ok && part.Meta["arguments"] == nil {
				normalizedPart.Meta["arguments"] = input
			}
			normalizedParts = append(normalizedParts, normalizedPart)

		case "tool-result":
			// Anthropic calls this "tool_result"
			// Map tool_use_id to tool_call_id
			if part.Meta == nil {
				return "", nil, fmt.Errorf("tool-result part missing meta")
			}

			// Map tool_use_id to tool_call_id for internal storage
			if toolUseID, ok := part.Meta["tool_use_id"].(string); ok {
				normalizedPart.Meta["tool_call_id"] = toolUseID
			}
			normalizedParts = append(normalizedParts, normalizedPart)

		default:
			// Other types pass through
			normalizedParts = append(normalizedParts, normalizedPart)
		}
	}

	return role, normalizedParts, nil
}
