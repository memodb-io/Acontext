package editor

import (
	"fmt"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

// RemoveToolCallParamsStrategy removes parameters from old tool-call parts
type RemoveToolCallParamsStrategy struct {
	KeepRecentN int
	KeepTools   []string // Tool names that should never have their parameters removed
}

// Name returns the strategy name
func (s *RemoveToolCallParamsStrategy) Name() string {
	return "remove_tool_call_params"
}

// Apply removes input parameters from old tool-call parts
// Keeps the most recent N tool-call parts with their original parameters
// Also keeps parameters for tools listed in KeepTools
func (s *RemoveToolCallParamsStrategy) Apply(messages []model.Message) ([]model.Message, error) {
	if s.KeepRecentN < 0 {
		return nil, fmt.Errorf("keep_recent_n_tool_calls must be >= 0, got %d", s.KeepRecentN)
	}

	// Build a set of tool names to keep for O(1) lookup
	keepToolsSet := make(map[string]bool)
	for _, toolName := range s.KeepTools {
		keepToolsSet[toolName] = true
	}

	// Collect all tool-call parts with their positions, excluding those in KeepTools
	type toolCallPosition struct {
		messageIdx int
		partIdx    int
	}
	var toolCallPositions []toolCallPosition

	for msgIdx, msg := range messages {
		for partIdx, part := range msg.Parts {
			if part.Type == "tool-call" {
				// Check if this tool call should be kept based on KeepTools
				if part.Meta != nil {
					if toolName, ok := part.Meta["name"].(string); ok {
						if keepToolsSet[toolName] {
							// Skip this tool call - its parameters should always be kept
							continue
						}
					}
				}
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

	// Get keep_tools list (tool names that should never have their parameters removed)
	var keepTools []string
	if keepToolsValue, ok := params["keep_tools"]; ok {
		if keepToolsArr, ok := keepToolsValue.([]interface{}); ok {
			for _, v := range keepToolsArr {
				if toolName, ok := v.(string); ok {
					keepTools = append(keepTools, toolName)
				} else {
					return nil, fmt.Errorf("keep_tools must be an array of strings, got element of type %T", v)
				}
			}
		} else if keepToolsStrArr, ok := keepToolsValue.([]string); ok {
			keepTools = keepToolsStrArr
		} else {
			return nil, fmt.Errorf("keep_tools must be an array of strings, got %T", keepToolsValue)
		}
	}

	return &RemoveToolCallParamsStrategy{
		KeepRecentN: keepRecentNInt,
		KeepTools:   keepTools,
	}, nil
}
