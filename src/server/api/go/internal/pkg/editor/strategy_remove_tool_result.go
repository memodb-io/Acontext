package editor

import (
	"fmt"
	"strings"

	"github.com/memodb-io/Acontext/internal/modules/model"
)

// RemoveToolResultStrategy replaces old tool-result parts' text with a placeholder
type RemoveToolResultStrategy struct {
	KeepRecentN int
	Placeholder string
	KeepTools   []string // Tool names that should never have their results removed
}

// Name returns the strategy name
func (s *RemoveToolResultStrategy) Name() string {
	return "remove_tool_result"
}

// Apply replaces old tool-result parts' text with a placeholder
// Keeps the most recent N tool-result parts with their original content
// Also keeps tool results for tools listed in KeepTools
func (s *RemoveToolResultStrategy) Apply(messages []model.Message) ([]model.Message, error) {
	if s.KeepRecentN < 0 {
		return nil, fmt.Errorf("keep_recent_n_tool_results must be >= 0, got %d", s.KeepRecentN)
	}

	// Build a set of tool names to keep for O(1) lookup
	keepToolsSet := make(map[string]bool)
	for _, toolName := range s.KeepTools {
		keepToolsSet[toolName] = true
	}

	// Build a map from tool-call ID to tool name
	toolCallIDToName := make(map[string]string)
	for _, msg := range messages {
		for _, part := range msg.Parts {
			if part.Type == "tool-call" && part.Meta != nil {
				if id, ok := part.Meta["id"].(string); ok {
					if name, ok := part.Meta["name"].(string); ok {
						toolCallIDToName[id] = name
					}
				}
			}
		}
	}

	// Collect all tool-result parts with their positions, excluding those in KeepTools
	type toolResultPosition struct {
		messageIdx int
		partIdx    int
	}
	var toolResultPositions []toolResultPosition

	for msgIdx, msg := range messages {
		for partIdx, part := range msg.Parts {
			if part.Type == "tool-result" {
				// Check if this tool result should be kept based on KeepTools
				if part.Meta != nil {
					if toolCallID, ok := part.Meta["tool_call_id"].(string); ok {
						if toolName, found := toolCallIDToName[toolCallID]; found {
							if keepToolsSet[toolName] {
								// Skip this tool result - it should always be kept
								continue
							}
						}
					}
				}
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
	for i := range numToReplace {
		pos := toolResultPositions[i]
		messages[pos.messageIdx].Parts[pos.partIdx].Text = placeholder
	}

	return messages, nil
}

// createRemoveToolResultStrategy creates a RemoveToolResultStrategy from config params
func createRemoveToolResultStrategy(params map[string]interface{}) (EditStrategy, error) {
	// Default to keeping 3 most recent tool results if parameter not provided
	keepRecentNInt := 3

	if keepRecentN, ok := params["keep_recent_n_tool_results"]; ok {
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
	if placeholderValue, ok := params["tool_result_placeholder"]; ok {
		if placeholderStr, ok := placeholderValue.(string); ok {
			placeholder = strings.TrimSpace(placeholderStr)
		} else {
			return nil, fmt.Errorf("tool_result_placeholder must be a string, got %T", placeholderValue)
		}
	}

	// Get keep_tools list (tool names that should never have their results removed)
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

	return &RemoveToolResultStrategy{
		KeepRecentN: keepRecentNInt,
		Placeholder: placeholder,
		KeepTools:   keepTools,
	}, nil
}
