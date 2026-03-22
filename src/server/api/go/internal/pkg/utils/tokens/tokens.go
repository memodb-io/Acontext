package tokens

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/bytedance/sonic"
	"github.com/google/uuid"
)

func ParseToken(raw, prefix string) (secret string, ok bool) {
	if !strings.HasPrefix(raw, prefix) {
		return "", false
	}
	return strings.TrimPrefix(raw, prefix), true
}

func HMAC256Hex(pepper, secret string) string {
	m := hmac.New(sha256.New, []byte(pepper))
	m.Write([]byte(secret))
	return hex.EncodeToString(m.Sum(nil)) // 64 hex chars
}

// ProjectTokenData represents the parsed project token data
type ProjectTokenData struct {
	ProjectID uuid.UUID
	Valid     bool
}

// ParseAndVerifyProjectToken parses a base64-encoded JSON token and verifies its signature.
// The token should be a base64-encoded JSON containing:
//   - signature: the signature (base64 of sorted kv pairs + apiBearerToken)
//   - project_id: the project UUID
//   - other key-value pairs (sorted by key, concatenated as key+value, then base64 encoded with apiBearerToken)
func ParseAndVerifyProjectToken(secret, apiBearerToken string) (*ProjectTokenData, error) {
	// Decode base64 to get JSON
	jsonBytes, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	// Parse JSON
	var tokenData map[string]any
	if err := sonic.Unmarshal(jsonBytes, &tokenData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Extract required fields
	signatureValue, ok := tokenData["signature"].(string)
	if !ok || signatureValue == "" {
		return nil, errors.New("missing or invalid signature field")
	}

	projectIDStr, ok := tokenData["project_id"].(string)
	if !ok || projectIDStr == "" {
		return nil, errors.New("missing or invalid project_id field")
	}

	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		return nil, fmt.Errorf("invalid project_id format: %w", err)
	}

	// Extract fields (excluding signature), sort by key, and concatenate
	type kvPair struct {
		key   string
		value string
	}
	var pairs []kvPair
	for key, value := range tokenData {
		if key == "signature" {
			continue
		}
		pairs = append(pairs, kvPair{key: key, value: stringifyTokenValue(value)})
	}

	// Sort by key
	sort.Slice(pairs, func(i, j int) bool {
		return pairs[i].key < pairs[j].key
	})

	// Concatenate all pairs (key+value)
	var parts []string
	for _, pair := range pairs {
		parts = append(parts, pair.key+pair.value)
	}
	concatenated := strings.Join(parts, "")

	// Add apiBearerToken
	signatureInput := concatenated + apiBearerToken

	// Base64 encode
	expectedSignature := base64.StdEncoding.EncodeToString([]byte(signatureInput))

	// Verify token matches
	valid := expectedSignature == signatureValue

	return &ProjectTokenData{
		ProjectID: projectID,
		Valid:     valid,
	}, nil
}

func stringifyTokenValue(v any) string {
	switch t := v.(type) {
	case nil:
		return "null"
	case string:
		return t
	case bool:
		if t {
			return "true"
		}
		return "false"
	case float64:
		// JSON numbers decode into float64 for map[string]any
		if !math.IsNaN(t) && !math.IsInf(t, 0) && math.Trunc(t) == t {
			if t >= math.MinInt64 && t <= math.MaxInt64 {
				return strconv.FormatInt(int64(t), 10)
			}
		}
		return strconv.FormatFloat(t, 'f', -1, 64)
	case float32:
		f := float64(t)
		return strconv.FormatFloat(f, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	case int64:
		return strconv.FormatInt(t, 10)
	case uint64:
		return strconv.FormatUint(t, 10)
	default:
		return fmt.Sprintf("%v", t)
	}
}
