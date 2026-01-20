package sandbox

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/memodb-io/Acontext/acontext-cli/internal/pkgmgr"
)

// CreateSandboxProject creates a new sandbox project using the npm package
func CreateSandboxProject(sandboxType, packageManager, baseDir string) error {
	// Get sandbox type info
	sandboxTypeInfo, err := GetSandboxTypeByName(sandboxType)
	if err != nil {
		return fmt.Errorf("invalid sandbox type: %w", err)
	}

	// Ensure sandbox directory exists
	sandboxDir := filepath.Join(baseDir, "sandbox")
	if _, err := os.Stat(sandboxDir); os.IsNotExist(err) {
		if err := os.MkdirAll(sandboxDir, 0755); err != nil {
			return fmt.Errorf("failed to create sandbox directory: %w", err)
		}
	}

	projectPath := filepath.Join("sandbox", sandboxType)
	fullPath := filepath.Join(baseDir, projectPath)

	// Check if directory already exists
	if _, err := os.Stat(fullPath); err == nil {
		return fmt.Errorf("project directory already exists: %s", projectPath)
	}

	// Get the create command - only pass project name, not full path
	createCmd := pkgmgr.GetCreateCommand(packageManager, sandboxTypeInfo.NpmPackage, sandboxType)

	fmt.Printf("🚀 Creating %s project...\n", sandboxTypeInfo.DisplayName)
	fmt.Printf("   Executing: %s\n", createCmd)
	fmt.Println()

	// Parse command
	parts := strings.Fields(createCmd)
	if len(parts) == 0 {
		return fmt.Errorf("invalid create command")
	}

	// Execute the command in sandbox directory
	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Dir = sandboxDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create project: %w", err)
	}

	fmt.Println()
	fmt.Printf("✅ Project created successfully at %s\n", projectPath)
	return nil
}

// CreateSandboxProjectWithOverwrite creates a new sandbox project, removing existing directory if needed
func CreateSandboxProjectWithOverwrite(sandboxType, packageManager, baseDir string) error {
	projectPath := filepath.Join("sandbox", sandboxType)
	fullPath := filepath.Join(baseDir, projectPath)

	// Remove existing directory if it exists
	if _, err := os.Stat(fullPath); err == nil {
		fmt.Printf("🗑️  Removing existing project at %s...\n", projectPath)
		if err := os.RemoveAll(fullPath); err != nil {
			return fmt.Errorf("failed to remove existing project: %w", err)
		}
	}

	return CreateSandboxProject(sandboxType, packageManager, baseDir)
}
