package editor

import (
	"fmt"

	"github.com/bytedance/sonic"
	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/pkg/tokenizer"
)

// RemoveToolCallParamsStrategy removes parameters from old tool-call parts
type RemoveToolCallParamsStrategy struct {
	KeepRecentN int
	KeepTools   []string // Tool names that should never have their parameters removed
	GtToken     int      // Only remove params if token count exceeds this threshold (>0)
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

	// Collect tool-call positions to potentially modify
	type toolCallPosition struct {
		messageIdx int
		partIdx    int
	}
	var toolCallPositions []toolCallPosition

	for msgIdx, msg := range messages {
		for partIdx, part := range msg.Parts {
			if part.Type != model.PartTypeToolCall {
				continue
			}
			// 1. keep_tools exclusion
			if part.Meta != nil {
				if toolName := part.Name(); toolName != "" {
					if keepToolsSet[toolName] {
						continue
					}
				}
			}
			// Add to list for possible removal
			toolCallPositions = append(toolCallPositions, toolCallPosition{
				messageIdx: msgIdx,
				partIdx:    partIdx,
			})
		}
	}

	// 2. keep_recent_n filter
	totalToolCalls := len(toolCallPositions)
	if totalToolCalls <= s.KeepRecentN {
		return messages, nil
	}
	cutoff := totalToolCalls - s.KeepRecentN
	for i := 0; i < cutoff; i++ {
		pos := toolCallPositions[i]
		partMeta := messages[pos.messageIdx].Parts[pos.partIdx].Meta
		if partMeta == nil {
			continue
		}
		if s.GtToken > 0 {
			args, ok := partMeta[model.MetaKeyArguments]
			if !ok {
				// No arguments means zero tokens; don't remove based on gt_token.
				continue
			}
			var tokCount int
			var err error
			switch v := args.(type) {
			case string:
				tokCount, err = tokenizer.CountTokens(v)
			default:
				b, merr := sonic.Marshal(v)
				if merr == nil {
					tokCount, err = tokenizer.CountTokens(string(b))
				} else {
					// Skip gt_token check if marshal fails.
					continue
				}
			}
			if err != nil {
				// Skip gt_token check if tokenization fails.
				continue
			}
			if tokCount <= s.GtToken {
				continue
			}
		}
		partMeta[model.MetaKeyArguments] = "{}"
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

	return &RemoveToolCallParamsStrategy{
		KeepRecentN: keepRecentNInt,
		KeepTools:   keepTools,
		GtToken:     gtToken,
	}, nil
}
