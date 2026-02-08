package sandbox

import (
	"fmt"
	"os"
	"path/filepath"
)

// GetProjectDir returns the absolute path to a project directory
func GetProjectDir(baseDir, projectPath string) (string, error) {
	fullPath := filepath.Join(baseDir, projectPath)
	absPath, err := filepath.Abs(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Verify the directory exists
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return "", fmt.Errorf("project directory does not exist: %s", absPath)
	}

	return absPath, nil
}
