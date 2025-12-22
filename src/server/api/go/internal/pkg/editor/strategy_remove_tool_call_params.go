package editor

import (
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

// RemoveToolCallParamsStrategy removes parameters from old tool-call parts
type RemoveToolCallParamsStrategy struct {
	KeepRecentN int
}

// Name returns the strategy name
func (s *RemoveToolCallParamsStrategy) Name() string {
	return "remove_tool_call_params"
}

// Apply removes input parameters from old tool-call parts
// Keeps the most recent N tool-call parts with their original parameters
func (s *RemoveToolCallParamsStrategy) Apply(messages []model.Message) ([]model.Message, error) {
	if s.KeepRecentN < 0 {
		return nil, fmt.Errorf("keep_recent_n_tool_calls must be >= 0, got %d", s.KeepRecentN)
	}

	// Collect all tool-call parts with their positions
	type toolCallPosition struct {
		messageIdx int
		partIdx    int
	}
	var toolCallPositions []toolCallPosition

	for msgIdx, msg := range messages {
		for partIdx, part := range msg.Parts {
			if part.Type == "tool-call" {
				toolCallPositions = append(toolCallPositions, toolCallPosition{
					messageIdx: msgIdx,
					partIdx:    partIdx,
				})
			}
		}
	}

	// Calculate how many to modify
	totalToolCalls := len(toolCallPositions)
	if totalToolCalls <= s.KeepRecentN {
		return messages, nil
	}

	numToModify := totalToolCalls - s.KeepRecentN

	// Remove arguments from the oldest tool-call parts
	for i := range numToModify {
		pos := toolCallPositions[i]
		if messages[pos.messageIdx].Parts[pos.partIdx].Meta != nil {
			messages[pos.messageIdx].Parts[pos.partIdx].Meta["arguments"] = "{}"
		}
	}

	return messages, nil
}

// createRemoveToolCallParamsStrategy creates a RemoveToolCallParamsStrategy from config params
func createRemoveToolCallParamsStrategy(params map[string]interface{}) (EditStrategy, error) {
	keepRecentNInt := 3

	if keepRecentN, ok := params["keep_recent_n_tool_calls"]; ok {
		switch v := keepRecentN.(type) {
		case float64:
			keepRecentNInt = int(v)
		case int:
			keepRecentNInt = v
		default:
			return nil, fmt.Errorf("keep_recent_n_tool_calls must be an integer, got %T", keepRecentN)
		}
	}

	return &RemoveToolCallParamsStrategy{
		KeepRecentN: keepRecentNInt,
	}, nil
}
