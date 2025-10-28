package normalizer

import (
	"github.com/anthropics/anthropic-sdk-go"
)

// CacheControl represents cache control configuration
type CacheControl struct {
	Type string `json:"type"` // "ephemeral"
	TTL  *int   `json:"ttl,omitempty"`
}

// ExtractAnthropicCacheControl extracts cache control from Anthropic CacheControlEphemeralParam
func ExtractAnthropicCacheControl(cc anthropic.CacheControlEphemeralParam) map[string]interface{} {
	cacheControl := map[string]interface{}{
		"type": string(cc.Type),
	}

	return cacheControl
}

// BuildAnthropicCacheControl builds Anthropic CacheControlEphemeralParam from meta
func BuildAnthropicCacheControl(meta map[string]any) *anthropic.CacheControlEphemeralParam {
	if meta == nil {
		return nil
	}

	cacheControlData, ok := meta["cache_control"].(map[string]interface{})
	if !ok {
		return nil
	}

	controlType, ok := cacheControlData["type"].(string)
	if !ok || controlType != "ephemeral" {
		return nil
	}

	param := anthropic.NewCacheControlEphemeralParam()
	return &param
}
