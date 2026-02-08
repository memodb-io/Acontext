package sandbox

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetProjectDir(t *testing.T) {
	tests := []struct {
		name        string
		setupDir    bool
		projectPath string
		wantErr     bool
		errContains string
	}{
		{
			name:        "valid existing directory",
			setupDir:    true,
			projectPath: "myproject",
			wantErr:     false,
		},
		{
			name:        "nested valid directory",
			setupDir:    true,
			projectPath: filepath.Join("sandbox", "cloudflare"),
			wantErr:     false,
		},
		{
			name:        "nonexistent directory",
			setupDir:    false,
			projectPath: "nonexistent",
			wantErr:     true,
			errContains: "does not exist",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			baseDir := t.TempDir()

			if tt.setupDir {
				fullPath := filepath.Join(baseDir, tt.projectPath)
				err := os.MkdirAll(fullPath, 0755)
				require.NoError(t, err)
			}

			result, err := GetProjectDir(baseDir, tt.projectPath)
			if tt.wantErr {
				assert.Error(t, err)
				if tt.errContains != "" {
					assert.Contains(t, err.Error(), tt.errContains)
				}
			} else {
				assert.NoError(t, err)
				assert.NotEmpty(t, result)

				// Verify the returned path is absolute
				assert.True(t, filepath.IsAbs(result), "returned path should be absolute")

				// Verify the directory actually exists
				info, statErr := os.Stat(result)
				assert.NoError(t, statErr)
				assert.True(t, info.IsDir())
			}
		})
	}
}
