package tokenizer

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/tiktoken-go/tokenizer"
	"go.uber.org/zap"
)

var (
	// Global codec instance
	codec   tokenizer.Codec
	once    sync.Once
	initErr error
)

// Init initializes the tokenizer
// The tokenizer uses embedded vocabulary data, no network or file system access required
func Init(log *zap.Logger) error {
	once.Do(func() {
		// Get codec for o200k_base (used by GPT-4o, GPT-4.1, O1, O3, etc.)
		// The vocabulary is already embedded in the tiktoken-go package
		enc, err := tokenizer.Get(tokenizer.O200kBase)
		if err != nil {
			initErr = fmt.Errorf("failed to get tokenizer: %w", err)
			return
		}

		codec = enc
		log.Info("Tokenizer initialized successfully", zap.String("encoding", "o200k_base"))
	})

	return initErr
}

// CountTokens counts the number of tokens in the given text
func CountTokens(text string) (int, error) {
	if codec == nil {
		return 0, fmt.Errorf("tokenizer not initialized, call Init() first")
	}

	count, err := codec.Count(text)
	if err != nil {
		return 0, fmt.Errorf("failed to count tokens: %w", err)
	}

	return count, nil
}

// ExtractTextAndToolContent extracts text and tool-call content from message parts
func ExtractTextAndToolContent(parts []model.Part) (string, error) {
	var content strings.Builder

	for _, part := range parts {
		switch part.Type {
		case "text":
			if part.Text != "" {
				content.WriteString(part.Text)
				content.WriteString("\n") // Add separator
			}
		case "tool-call":
			// Extract only "name" and "arguments" from meta for token counting
			if part.Meta != nil {
				filtered := make(map[string]interface{})
				if name, ok := part.Meta["name"]; ok {
					filtered["name"] = name
				}
				if args, ok := part.Meta["arguments"]; ok {
					filtered["arguments"] = args
				}
				metaJSON, err := json.Marshal(filtered)
				if err != nil {
					return "", fmt.Errorf("failed to marshal tool-call meta: %w", err)
				}
				content.WriteString(string(metaJSON))
				content.WriteString("\n")
			}
		case "tool-result":
			// Extract tool result information from meta
			if part.Text != "" {
				content.WriteString(part.Text)
				content.WriteString("\n")
			}
		default:
			// Fallback: write text if not empty
			if part.Text != "" {
				content.WriteString(part.Text)
				content.WriteString("\n")
			}
		}
	}

	return content.String(), nil
}

// CountSingleMessageTokens counts tokens for a single message
func CountSingleMessageTokens(ctx context.Context, message model.Message) (int, error) {
	content, err := ExtractTextAndToolContent(message.Parts)
	if err != nil {
		return 0, fmt.Errorf("failed to extract content from message %s: %w", message.ID, err)
	}

	if content == "" {
		return 0, nil
	}

	count, err := CountTokens(content)
	if err != nil {
		return 0, fmt.Errorf("failed to count tokens for message %s: %w", message.ID, err)
	}

	return count, nil
}

// CountMessagePartsTokens counts tokens for all text and tool-call parts in messages
func CountMessagePartsTokens(ctx context.Context, messages []model.Message) (int, error) {
	totalTokens := 0

	for _, msg := range messages {
		count, err := CountSingleMessageTokens(ctx, msg)
		if err != nil {
			return 0, err
		}
		totalTokens += count
	}

	return totalTokens, nil
}
