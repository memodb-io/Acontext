package cmd

import (
	"context"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
)

func TestSetVersion_GetVersion(t *testing.T) {
	cmd := &cobra.Command{Use: "test"}
	cmd.SetContext(context.Background())

	SetVersion(cmd, "v1.2.3")

	result := GetVersion(cmd)
	assert.Equal(t, "v1.2.3", result)
}

func TestGetVersion_NoContext(t *testing.T) {
	// Create a command with root context but no version set
	root := &cobra.Command{Use: "root"}
	root.SetContext(context.Background())

	child := &cobra.Command{Use: "child"}
	root.AddCommand(child)
	child.SetContext(root.Context())

	// Should return fallback (likely "unknown" since acontext binary won't be in PATH during tests)
	result := GetVersion(child)
	assert.NotEmpty(t, result)
}

func TestHasCommand(t *testing.T) {
	tests := []struct {
		name     string
		cmd      string
		expected bool
	}{
		{
			name:     "existing command - sh",
			cmd:      "sh",
			expected: true,
		},
		{
			name:     "existing command - echo",
			cmd:      "echo",
			expected: true,
		},
		{
			name:     "nonexistent command",
			cmd:      "nonexistent-command-xyz-123",
			expected: false,
		},
		{
			name:     "empty command",
			cmd:      "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := hasCommand(tt.cmd)
			assert.Equal(t, tt.expected, result)
		})
	}
}
