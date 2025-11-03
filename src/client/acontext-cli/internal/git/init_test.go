package git

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEnsureGitignore(t *testing.T) {
	tests := []struct {
		name      string
		fileExists bool
		wantErr   bool
	}{
		{
			name:      "create new gitignore",
			fileExists: false,
			wantErr:   false,
		},
		{
			name:      "skip if gitignore exists",
			fileExists: true,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tempDir := t.TempDir()
			gitignorePath := filepath.Join(tempDir, ".gitignore")

			if tt.fileExists {
				err := os.WriteFile(gitignorePath, []byte("# Existing gitignore"), 0644)
				require.NoError(t, err)
			}

			err := ensureGitignore(tempDir)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify file exists
				_, err = os.Stat(gitignorePath)
				assert.NoError(t, err)

				// If file didn't exist before, verify content
				if !tt.fileExists {
					content, err := os.ReadFile(gitignorePath)
					assert.NoError(t, err)
					contentStr := string(content)

					// Check for key patterns
					assert.Contains(t, contentStr, ".env")
					assert.Contains(t, contentStr, "node_modules")
					assert.Contains(t, contentStr, "__pycache__")
				}
			}
		})
	}
}

