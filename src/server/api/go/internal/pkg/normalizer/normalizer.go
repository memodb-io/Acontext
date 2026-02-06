package normalizer

import (
	"encoding/json"
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// MessageNormalizer converts a provider-specific message JSON blob into the
// internal Acontext representation (role + []PartIn + messageMeta).
type MessageNormalizer interface {
	Normalize(messageJSON json.RawMessage) (role string, parts []service.PartIn, meta map[string]interface{}, err error)
}

// GetNormalizer returns the appropriate MessageNormalizer for the given format.
func GetNormalizer(format model.MessageFormat) (MessageNormalizer, error) {
	switch format {
	case model.FormatAcontext:
		return &AcontextNormalizer{}, nil
	case model.FormatOpenAI:
		return &OpenAINormalizer{}, nil
	case model.FormatAnthropic:
		return &AnthropicNormalizer{}, nil
	case model.FormatGemini:
		return &GeminiNormalizer{}, nil
	default:
		return nil, fmt.Errorf("unsupported format: %s", format)
	}
}
