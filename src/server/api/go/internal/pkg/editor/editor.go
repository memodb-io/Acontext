package editor

import (
	"fmt"
	"sort"

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

// CreateStrategy creates a strategy from a config
func CreateStrategy(config StrategyConfig) (EditStrategy, error) {
	switch config.Type {
	case "remove_tool_result":
		return createRemoveToolResultStrategy(config.Params)
	case "remove_tool_call_params":
		return createRemoveToolCallParamsStrategy(config.Params)
	case "token_limit":
		return createTokenLimitStrategy(config.Params)
	default:
		return nil, fmt.Errorf("unknown strategy type: %s", config.Type)
	}
}

// getStrategyPriority returns the priority of a strategy type.
// Lower numbers are applied first, higher numbers are applied last.
// This ensures strategies are executed in an optimal order.
func getStrategyPriority(strategyType string) int {
	switch strategyType {
	case "remove_tool_result":
		return 1 // Content reduction strategies go first
	case "remove_tool_call_params":
		return 2
	case "token_limit":
		return 100 // Token limit always goes last
	default:
		return 50 // unmarked strategies go in the middle
	}
}

// sortStrategies sorts strategy configs by their priority.
// This ensures strategies are applied in the optimal order:
// 1. Content reduction strategies (e.g., remove_tool_result)
// 2. Other strategies
// 3. Token limit (always last)
func sortStrategies(configs []StrategyConfig) []StrategyConfig {
	// Create a copy to avoid modifying the original slice
	sorted := make([]StrategyConfig, len(configs))
	copy(sorted, configs)

	// Sort by priority
	sort.SliceStable(sorted, func(i, j int) bool {
		return getStrategyPriority(sorted[i].Type) < getStrategyPriority(sorted[j].Type)
	})

	return sorted
}

// ApplyStrategiesResult contains the result of applying strategies
type ApplyStrategiesResult struct {
	// Messages is the list of messages after applying strategies
	Messages []model.Message
	// EditAtMessageID is the message ID where editing strategies were applied up to.
	// If PinAtMessageID was provided, this equals PinAtMessageID.
	// Otherwise, this is the ID of the last message in the input.
	EditAtMessageID string
}

// ApplyStrategies applies multiple editing strategies in sequence.
// Strategies are automatically sorted to ensure optimal execution order,
// with token_limit always applied last.
func ApplyStrategies(messages []model.Message, configs []StrategyConfig) ([]model.Message, error) {
	result, err := ApplyStrategiesWithPin(messages, configs, "")
	if err != nil {
		return nil, err
	}
	return result.Messages, nil
}

// ApplyStrategiesWithPin applies multiple editing strategies in sequence,
// optionally pinning the strategies to apply only up to a specific message ID.
// If pinAtMessageID is empty, strategies are applied to all messages.
// If pinAtMessageID is provided, strategies are only applied to messages
// up to and including that message, leaving subsequent messages unchanged.
// This helps maintain prompt cache stability by keeping a stable prefix.
func ApplyStrategiesWithPin(messages []model.Message, configs []StrategyConfig, pinAtMessageID string) (*ApplyStrategiesResult, error) {
	if len(configs) == 0 {
		// No strategies to apply, return the last message ID
		editAtID := ""
		if len(messages) > 0 {
			editAtID = messages[len(messages)-1].ID.String()
		}
		return &ApplyStrategiesResult{
			Messages:        messages,
			EditAtMessageID: editAtID,
		}, nil
	}

	// Determine the edit boundary
	var editableMessages []model.Message
	var preservedMessages []model.Message
	editAtMessageID := ""

	if pinAtMessageID == "" {
		// No pin: apply strategies to all messages
		editableMessages = messages
		if len(messages) > 0 {
			editAtMessageID = messages[len(messages)-1].ID.String()
		}
	} else {
		// Find the pin message and split
		pinIndex := -1
		for i, msg := range messages {
			if msg.ID.String() == pinAtMessageID {
				pinIndex = i
				break
			}
		}

		if pinIndex == -1 {
			// Pin message not found, apply to all messages
			editableMessages = messages
			if len(messages) > 0 {
				editAtMessageID = messages[len(messages)-1].ID.String()
			}
		} else {
			// Split messages at pin point (inclusive)
			editableMessages = messages[:pinIndex+1]
			if pinIndex+1 < len(messages) {
				preservedMessages = messages[pinIndex+1:]
			}
			editAtMessageID = pinAtMessageID
		}
	}

	// Sort strategies to ensure optimal execution order
	sortedConfigs := sortStrategies(configs)

	// Apply strategies only to editable messages
	result := editableMessages
	for _, config := range sortedConfigs {
		strategy, err := CreateStrategy(config)
		if err != nil {
			return nil, fmt.Errorf("failed to create strategy: %w", err)
		}

		result, err = strategy.Apply(result)
		if err != nil {
			return nil, fmt.Errorf("failed to apply strategy %s: %w", strategy.Name(), err)
		}
	}

	// Concatenate with preserved messages
	if len(preservedMessages) > 0 {
		result = append(result, preservedMessages...)
	}

	return &ApplyStrategiesResult{
		Messages:        result,
		EditAtMessageID: editAtMessageID,
	}, nil
}
