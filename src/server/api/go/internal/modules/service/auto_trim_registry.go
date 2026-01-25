package service

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/editor"
)

// autoTrimStrategyHandler applies an auto-trim strategy to messages.
type autoTrimStrategyHandler func(ctx context.Context, messages []model.Message) ([]model.Message, error)

// autoTrimStrategyRegistry maps strategy names to handlers.
var autoTrimStrategyRegistry = map[string]autoTrimStrategyHandler{
	"remove_tool_result": applyRemoveToolResultAutoTrim,
}

// IsAutoTrimStrategySupported reports whether the strategy is registered.
func IsAutoTrimStrategySupported(name string) bool {
	_, ok := autoTrimStrategyRegistry[name]
	return ok
}

// ApplyAutoTrimStrategy applies a registered auto-trim strategy by name.
func ApplyAutoTrimStrategy(ctx context.Context, name string, messages []model.Message) ([]model.Message, error) {
	handler, ok := autoTrimStrategyRegistry[name]
	if !ok {
		return nil, fmt.Errorf("unsupported auto-trim strategy: %s", name)
	}
	return handler(ctx, messages)
}

// applyRemoveToolResultAutoTrim applies remove_tool_result with default params.
func applyRemoveToolResultAutoTrim(ctx context.Context, messages []model.Message) ([]model.Message, error) {
	// ctx is unused for now, but kept for future strategy needs.
	_ = ctx
	// Build default remove_tool_result config.
	strategyConfig := editor.StrategyConfig{Type: "remove_tool_result", Params: map[string]interface{}{}}
	// Apply the strategy using the editor pipeline.
	return editor.ApplyStrategies(messages, []editor.StrategyConfig{strategyConfig})
}
