package main

import (
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
)

func TestBuildCommandPath(t *testing.T) {
	tests := []struct {
		name     string
		setup    func() *cobra.Command
		expected string
	}{
		{
			name: "root command",
			setup: func() *cobra.Command {
				root := &cobra.Command{Use: "acontext"}
				return root
			},
			expected: "root",
		},
		{
			name: "single subcommand",
			setup: func() *cobra.Command {
				root := &cobra.Command{Use: "acontext"}
				child := &cobra.Command{Use: "create"}
				root.AddCommand(child)
				return child
			},
			expected: "create",
		},
		{
			name: "nested subcommand",
			setup: func() *cobra.Command {
				root := &cobra.Command{Use: "acontext"}
				parent := &cobra.Command{Use: "server"}
				child := &cobra.Command{Use: "up"}
				root.AddCommand(parent)
				parent.AddCommand(child)
				return child
			},
			expected: "server.up",
		},
		{
			name: "version command",
			setup: func() *cobra.Command {
				root := &cobra.Command{Use: "acontext"}
				child := &cobra.Command{Use: "version"}
				root.AddCommand(child)
				return child
			},
			expected: "version",
		},
		{
			name: "upgrade command",
			setup: func() *cobra.Command {
				root := &cobra.Command{Use: "acontext"}
				child := &cobra.Command{Use: "upgrade"}
				root.AddCommand(child)
				return child
			},
			expected: "upgrade",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cmd := tt.setup()
			result := buildCommandPath(cmd)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetVersion(t *testing.T) {
	// GetVersion should return the cliVersion variable
	result := GetVersion()
	assert.Equal(t, "dev", result, "default cliVersion should be 'dev'")
}
