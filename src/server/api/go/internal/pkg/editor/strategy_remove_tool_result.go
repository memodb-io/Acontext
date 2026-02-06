package editor

import (
	"fmt"
	"strings"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
)

// RemoveToolResultStrategy replaces old tool-result parts' text with a placeholder
type RemoveToolResultStrategy struct {
	KeepRecentN int
	Placeholder string
	KeepTools   []string // Tool names that should never have their results removed
	GtToken     int      // Only remove results if token count exceeds this threshold (>0)
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

	// Collect tool-result positions to potentially modify
	type toolResultPosition struct {
		messageIdx int
		partIdx    int
	}
	var toolResultPositions []toolResultPosition

	for msgIdx, msg := range messages {
		for partIdx, part := range msg.Parts {
			if part.Type != "tool-result" {
				continue
			}
			// 1. keep_tools exclusion
			if part.Meta != nil {
				if toolCallID, ok := part.Meta["tool_call_id"].(string); ok {
					if toolName, found := toolCallIDToName[toolCallID]; found {
						if keepToolsSet[toolName] {
							continue
						}
					}
				}
			}
			// Add to list for possible replacement
			toolResultPositions = append(toolResultPositions, toolResultPosition{
				messageIdx: msgIdx,
				partIdx:    partIdx,
			})
		}
	}

	// 2. keep_recent_n filter
	totalToolResults := len(toolResultPositions)
	if totalToolResults <= s.KeepRecentN {
		return messages, nil
	}
	placeholder := s.Placeholder
	if placeholder == "" {
		placeholder = "Done"
	}

	cutoff := totalToolResults - s.KeepRecentN
	for i := 0; i < cutoff; i++ {
		pos := toolResultPositions[i]
		if s.GtToken > 0 {
			text := messages[pos.messageIdx].Parts[pos.partIdx].Text
			if text == "" {
				// Empty result means zero tokens; don't remove based on gt_token.
				continue
			}
			tokCount, err := tokenizer.CountTokens(text)
			if err != nil {
				// Skip gt_token check if tokenization fails.
				continue
			}
			if tokCount <= s.GtToken {
				continue
			}
		}
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

	gtToken := 0
	if gtTokenVal, ok := params["gt_token"]; ok {
		switch v := gtTokenVal.(type) {
		case float64:
			gtToken = int(v)
		case int:
			gtToken = v
		default:
			return nil, fmt.Errorf("gt_token must be an integer, got %T", gtTokenVal)
		}
		if gtToken <= 0 {
			return nil, fmt.Errorf("gt_token must be > 0, got %d", gtToken)
		}
	}
	return &RemoveToolResultStrategy{
		KeepRecentN: keepRecentNInt,
		Placeholder: placeholder,
		KeepTools:   keepTools,
		GtToken:     gtToken,
	}, nil
}
