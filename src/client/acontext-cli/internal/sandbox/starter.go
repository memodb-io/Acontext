package sandbox

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/memodb-io/Acontext/acontext-cli/internal/pkgmgr"
)

// StartProject starts a sandbox project by detecting the package manager
// and running the dev command
func StartProject(projectDir string) error {
	// Detect package manager
	pm, err := pkgmgr.DetectPackageManager(projectDir)
	if err != nil {
		return fmt.Errorf("failed to detect package manager: %w", err)
	}

	// Get dev command
	devCmd := pkgmgr.GetDevCommand(pm)

	fmt.Printf("🚀 Starting development server...\n")
	fmt.Printf("   Using package manager: %s\n", pm)
	fmt.Printf("   Executing: %s\n", devCmd)
	fmt.Println()

	// Parse command
	parts := strings.Fields(devCmd)
	if len(parts) == 0 {
		return fmt.Errorf("invalid dev command")
	}

	// Create command
	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Dir = projectDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	// Set up signal handling for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	// Start the command
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start dev server: %w", err)
	}

	// Wait for command to finish or signal
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case err := <-done:
		if err != nil {
			return fmt.Errorf("dev server exited with error: %w", err)
		}
		return nil
	case sig := <-sigChan:
		fmt.Printf("\n🛑 Received signal: %v\n", sig)
		fmt.Println("   Stopping dev server...")

		// Kill the process
		if err := cmd.Process.Kill(); err != nil {
			return fmt.Errorf("failed to stop dev server: %w", err)
		}

		// Wait for process to exit
		<-done
		return nil
	}
}

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
