package mime

import (
	"path/filepath"
	"strings"

	"github.com/gabriel-vasile/mimetype"
)

// extMimeMap maps file extensions to more specific MIME types for text-based files.
// Used when content-based detection returns "text/plain" but extension suggests a specific format.
var extMimeMap = map[string]string{
	".md":       "text/markdown",
	".markdown": "text/markdown",
	".yaml":     "text/yaml",
	".yml":      "text/yaml",
	".csv":      "text/csv",
	".json":     "application/json",
	".xml":      "application/xml",
	".html":     "text/html",
	".htm":      "text/html",
	".css":      "text/css",
	".js":       "text/javascript",
	".ts":       "text/typescript",
	".go":       "text/x-go",
	".py":       "text/x-python",
	".rs":       "text/x-rust",
	".rb":       "text/x-ruby",
	".java":     "text/x-java",
	".c":        "text/x-c",
	".cpp":      "text/x-c++",
	".h":        "text/x-c",
	".hpp":      "text/x-c++",
	".sh":       "text/x-shellscript",
	".bash":     "text/x-shellscript",
	".sql":      "text/x-sql",
	".toml":     "text/x-toml",
	".ini":      "text/x-ini",
	".cfg":      "text/x-ini",
	".conf":     "text/x-ini",
}

// DetectMimeType detects the MIME type from file content, with extension-based refinement
// for text files where content detection alone cannot distinguish formats.
// It uses mimetype library for content-based detection and falls back to extension-based
// mapping for text files that are detected as "text/plain".
func DetectMimeType(content []byte, filename string) string {
	// Get file extension
	ext := strings.ToLower(filepath.Ext(filename))

	// Detect MIME type from content
	contentType := mimetype.Detect(content).String()

	// For plain text, refine based on file extension since content detection
	// cannot distinguish between markdown, yaml, code files, etc.
	if strings.HasPrefix(contentType, "text/plain") {
		if refined, ok := extMimeMap[ext]; ok {
			// Replace "text/plain" with refined type, preserving charset parameters
			result := strings.Replace(contentType, "text/plain", refined, 1)
			return result
		}
	}
	return contentType
}
