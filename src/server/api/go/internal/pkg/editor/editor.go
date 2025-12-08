package editor

import (
	"fmt"
	"strings"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

// EditStrategy defines the interface for message editing strategies
type EditStrategy interface {
	Apply(messages []model.Message) ([]model.Message, error)
	Name() string
}

// StrategyConfig represents a strategy configuration from the request
type StrategyConfig struct {
	Type   string                 `json:"type"`
	Params map[string]interface{} `json:"params"`
}

// RemoveToolResultStrategy replaces old tool-result parts' text with a placeholder
type RemoveToolResultStrategy struct {
	KeepRecentN int
	Placeholder string
}

// Name returns the strategy name
func (s *RemoveToolResultStrategy) Name() string {
	return "remove_tool_result"
}

// Apply replaces old tool-result parts' text with a placeholder
// Keeps the most recent N tool-result parts with their original content
func (s *RemoveToolResultStrategy) Apply(messages []model.Message) ([]model.Message, error) {
	if s.KeepRecentN < 0 {
		return nil, fmt.Errorf("keep_recent_n_tool_results must be >= 0, got %d", s.KeepRecentN)
	}

	// First, collect all tool-result parts with their positions
	type toolResultPosition struct {
		messageIdx int
		partIdx    int
	}
	var toolResultPositions []toolResultPosition

	for msgIdx, msg := range messages {
		for partIdx, part := range msg.Parts {
			if part.Type == "tool-result" {
				toolResultPositions = append(toolResultPositions, toolResultPosition{
					messageIdx: msgIdx,
					partIdx:    partIdx,
				})
			}
		}
	}

	// Calculate how many to replace (all except the most recent KeepRecentN)
	totalToolResults := len(toolResultPositions)
	if totalToolResults <= s.KeepRecentN {
		// Nothing to replace
		return messages, nil
	}

	numToReplace := totalToolResults - s.KeepRecentN

	// Use the placeholder text (defaults to "Done" if not set)
	placeholder := s.Placeholder
	if placeholder == "" {
		placeholder = "Done"
	}

	// Replace the text of the oldest tool-result parts
	for i := 0; i < numToReplace; i++ {
		pos := toolResultPositions[i]
		messages[pos.messageIdx].Parts[pos.partIdx].Text = placeholder
	}

	return messages, nil
}

// CreateStrategy creates a strategy from a config
func CreateStrategy(config StrategyConfig) (EditStrategy, error) {
	switch config.Type {
	case "remove_tool_result":
		// Default to keeping 3 most recent tool results if parameter not provided
		keepRecentNInt := 3

		if keepRecentN, ok := config.Params["keep_recent_n_tool_results"]; ok {
			// Handle both float64 (from JSON unmarshaling) and int
			switch v := keepRecentN.(type) {
			case float64:
				keepRecentNInt = int(v)
			case int:
				keepRecentNInt = v
			default:
				return nil, fmt.Errorf("keep_recent_n_tool_results must be an integer, got %T", keepRecentN)
			}
		}

		// Get placeholder text (defaults to "Done" if not provided)
		placeholder := "Done"
		if placeholderValue, ok := config.Params["tool_result_placeholder"]; ok {
			if placeholderStr, ok := placeholderValue.(string); ok {
				placeholder = strings.TrimSpace(placeholderStr)
			} else {
				return nil, fmt.Errorf("tool_result_placeholder must be a string, got %T", placeholderValue)
			}
		}

		return &RemoveToolResultStrategy{
			KeepRecentN: keepRecentNInt,
			Placeholder: placeholder,
		}, nil
	default:
		return nil, fmt.Errorf("unknown strategy type: %s", config.Type)
	}
}

// ApplyStrategies applies multiple editing strategies in sequence
func ApplyStrategies(messages []model.Message, configs []StrategyConfig) ([]model.Message, error) {
	if len(configs) == 0 {
		return messages, nil
	}

	result := messages
	for _, config := range configs {
		strategy, err := CreateStrategy(config)
		if err != nil {
			return nil, fmt.Errorf("failed to create strategy: %w", err)
		}

		result, err = strategy.Apply(result)
		if err != nil {
			return nil, fmt.Errorf("failed to apply strategy %s: %w", strategy.Name(), err)
		}
	}

	return result, nil
}
