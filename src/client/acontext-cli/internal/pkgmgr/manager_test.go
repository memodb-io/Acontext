package pkgmgr

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetCreateCommand(t *testing.T) {
	tests := []struct {
		name        string
		pm          string
		packageName string
		projectPath string
		expected    string
	}{
		{
			name:        "pnpm",
			pm:          "pnpm",
			packageName: "@acontext/sandbox-cloudflare",
			projectPath: "my-project",
			expected:    "pnpm create @acontext/sandbox-cloudflare my-project",
		},
		{
			name:        "npm",
			pm:          "npm",
			packageName: "@acontext/sandbox-cloudflare",
			projectPath: "my-project",
			expected:    "npm create @acontext/sandbox-cloudflare@latest my-project",
		},
		{
			name:        "yarn",
			pm:          "yarn",
			packageName: "@acontext/sandbox-cloudflare",
			projectPath: "my-project",
			expected:    "yarn create @acontext/sandbox-cloudflare my-project",
		},
		{
			name:        "bun",
			pm:          "bun",
			packageName: "@acontext/sandbox-cloudflare",
			projectPath: "my-project",
			expected:    "bun create @acontext/sandbox-cloudflare my-project",
		},
		{
			name:        "unknown defaults to npm",
			pm:          "unknown",
			packageName: "foo",
			projectPath: "bar",
			expected:    "npm create foo@latest bar",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetCreateCommand(tt.pm, tt.packageName, tt.projectPath)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetDevCommand(t *testing.T) {
	tests := []struct {
		name     string
		pm       string
		expected string
	}{
		{
			name:     "pnpm",
			pm:       "pnpm",
			expected: "pnpm run dev",
		},
		{
			name:     "npm",
			pm:       "npm",
			expected: "npm run dev",
		},
		{
			name:     "yarn",
			pm:       "yarn",
			expected: "yarn dev",
		},
		{
			name:     "bun",
			pm:       "bun",
			expected: "bun run dev",
		},
		{
			name:     "unknown defaults to npm",
			pm:       "unknown",
			expected: "npm run dev",
		},
		{
			name:     "empty defaults to npm",
			pm:       "",
			expected: "npm run dev",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GetDevCommand(tt.pm)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestDetectPackageManager_LockFiles(t *testing.T) {
	tests := []struct {
		name     string
		lockFile string
		expected string
	}{
		{
			name:     "detect pnpm from lock file",
			lockFile: "pnpm-lock.yaml",
			expected: "pnpm",
		},
		{
			name:     "detect npm from lock file",
			lockFile: "package-lock.json",
			expected: "npm",
		},
		{
			name:     "detect yarn from lock file",
			lockFile: "yarn.lock",
			expected: "yarn",
		},
		{
			name:     "detect bun from lock file",
			lockFile: "bun.lockb",
			expected: "bun",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tempDir := t.TempDir()

			// Create the lock file
			lockPath := filepath.Join(tempDir, tt.lockFile)
			err := os.WriteFile(lockPath, []byte(""), 0644)
			require.NoError(t, err)

			pm, err := DetectPackageManager(tempDir)
			assert.NoError(t, err)
			assert.Equal(t, tt.expected, pm)
		})
	}
}

func TestDetectPackageManager_PriorityOrder(t *testing.T) {
	// When multiple lock files exist, pnpm should take priority
	tempDir := t.TempDir()

	// Create both pnpm and npm lock files
	require.NoError(t, os.WriteFile(filepath.Join(tempDir, "pnpm-lock.yaml"), []byte(""), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(tempDir, "package-lock.json"), []byte(""), 0644))

	pm, err := DetectPackageManager(tempDir)
	assert.NoError(t, err)
	assert.Equal(t, "pnpm", pm, "pnpm should take priority when multiple lock files exist")
}

func TestDetectPackageManager_NoLockFile(t *testing.T) {
	// When no lock file exists, it should fall back to installed package managers or npm
	tempDir := t.TempDir()

	pm, err := DetectPackageManager(tempDir)
	assert.NoError(t, err)
	// Should return some package manager (either an installed one or default npm)
	assert.NotEmpty(t, pm)
}

func TestExecuteCommand_EmptyCommand(t *testing.T) {
	err := ExecuteCommand(t.TempDir(), "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "empty command")
}

func TestExecuteCommand_InvalidCommand(t *testing.T) {
	err := ExecuteCommand(t.TempDir(), "nonexistent-command-xyz-123")
	assert.Error(t, err)
}
