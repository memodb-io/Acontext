package converter

import (
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/memodb-io/Acontext/internal/modules/model"
	"github.com/memodb-io/Acontext/internal/modules/service"
)

// httpClient is a shared HTTP client with a sensible timeout for downloading
// external resources (images, files). Using a package-level client avoids
// creating a new transport per request and prevents unbounded hangs on slow or malicious URLs.
var httpClient = &http.Client{Timeout: 15 * time.Second}

// GetAssetURL returns the public URL for a given asset using the provided URL mapping.
// Returns empty string if asset is nil or not found in the mapping.
func GetAssetURL(asset *model.Asset, publicURLs map[string]service.PublicURL) string {
	if asset == nil {
		return ""
	}
	if publicURL, ok := publicURLs[asset.S3Key]; ok {
		return publicURL.URL
	}
	return ""
}

// DownloadImageAsBase64 downloads an image from the given URL and returns
// the base64-encoded data and its MIME type.
// Returns empty strings on any error.
func DownloadImageAsBase64(imageURL string) (base64Data string, mediaType string) {
	resp, err := httpClient.Get(imageURL)
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", ""
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", ""
	}

	mediaType = resp.Header.Get("Content-Type")
	if mediaType == "" {
		mediaType = "image/png" // default
	}

	return base64.StdEncoding.EncodeToString(data), mediaType
}

// ParseDataURL parses a data URL (e.g., "data:image/png;base64,<data>") and
// returns the MIME type and the base64-encoded payload.
// Returns empty strings if the URL is not a valid data URL.
func ParseDataURL(dataURL string) (mediaType string, base64Data string) {
	if !strings.HasPrefix(dataURL, "data:") {
		return "", ""
	}

	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return "", ""
	}

	// Parse media type from header: "data:<mediatype>;base64" or "data:<mediatype>"
	header := strings.TrimPrefix(parts[0], "data:")
	// Strip encoding suffix (e.g., ";base64")
	if idx := strings.Index(header, ";"); idx >= 0 {
		header = header[:idx]
	}

	mediaType = header
	if mediaType == "" {
		mediaType = "image/png" // default when MIME type is missing
	}

	return mediaType, parts[1]
}

// ParseToolArguments parses a tool-call's arguments field which may be either
// a JSON string or an already-parsed object, and returns the unmarshalled result.
func ParseToolArguments(arguments interface{}) interface{} {
	if argsStr, ok := arguments.(string); ok {
		var parsed interface{}
		if err := json.Unmarshal([]byte(argsStr), &parsed); err != nil {
			return map[string]interface{}{}
		}
		return parsed
	}
	// Already an object
	if arguments != nil {
		return arguments
	}
	return map[string]interface{}{}
}

// ParseToolArgumentsMap parses a tool-call's arguments field and returns it as
// a map[string]interface{}. If the arguments cannot be parsed as a map, returns
// an empty map.
func ParseToolArgumentsMap(arguments interface{}) map[string]interface{} {
	if argsStr, ok := arguments.(string); ok {
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(argsStr), &parsed); err != nil {
			return make(map[string]interface{})
		}
		return parsed
	}
	if argsObj, ok := arguments.(map[string]interface{}); ok {
		return argsObj
	}
	return make(map[string]interface{})
}
