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

// ApplyStrategies applies multiple editing strategies in sequence.
// Strategies are automatically sorted to ensure optimal execution order,
// with token_limit always applied last.
func ApplyStrategies(messages []model.Message, configs []StrategyConfig) ([]model.Message, error) {
	if len(configs) == 0 {
		return messages, nil
	}

	// Sort strategies to ensure optimal execution order
	sortedConfigs := sortStrategies(configs)

	result := messages
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

	return result, nil
}
