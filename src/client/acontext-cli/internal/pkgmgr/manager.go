package pkgmgr

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// DetectPackageManager detects the package manager used in a project directory
// by checking for lock files. Returns the package manager name or error.
func DetectPackageManager(projectDir string) (string, error) {
	// Check for lock files in order of preference
	lockFiles := map[string]string{
		"pnpm-lock.yaml":    "pnpm",
		"package-lock.json": "npm",
		"yarn.lock":         "yarn",
		"bun.lockb":         "bun",
	}

	for lockFile, pm := range lockFiles {
		lockPath := filepath.Join(projectDir, lockFile)
		if _, err := os.Stat(lockPath); err == nil {
			return pm, nil
		}
	}

	// If no lock file found, check which package managers are installed
	// and return the first available one (in order of preference)
	availablePMs := []string{"pnpm", "yarn", "bun", "npm"}
	for _, pm := range availablePMs {
		if isPackageManagerInstalled(pm) {
			return pm, nil
		}
	}

	return "npm", nil // Default to npm (usually comes with Node.js)
}

// isPackageManagerInstalled checks if a package manager is installed
func isPackageManagerInstalled(pm string) bool {
	cmd := exec.Command(pm, "--version")
	if err := cmd.Run(); err != nil {
		return false
	}
	return true
}

// GetCreateCommand returns the command to create a project using the specified package manager
func GetCreateCommand(pm, packageName, projectPath string) string {
	switch pm {
	case "pnpm":
		return fmt.Sprintf("pnpm create %s %s", packageName, projectPath)
	case "npm":
		return fmt.Sprintf("npm create %s@latest %s", packageName, projectPath)
	case "yarn":
		return fmt.Sprintf("yarn create %s %s", packageName, projectPath)
	case "bun":
		return fmt.Sprintf("bun create %s %s", packageName, projectPath)
	default:
		return fmt.Sprintf("npm create %s@latest %s", packageName, projectPath)
	}
}

// GetDevCommand returns the dev command for the specified package manager
func GetDevCommand(pm string) string {
	switch pm {
	case "pnpm":
		return "pnpm run dev"
	case "npm":
		return "npm run dev"
	case "yarn":
		return "yarn dev"
	case "bun":
		return "bun run dev"
	default:
		return "npm run dev"
	}
}

// ExecuteCommand executes a command in the specified directory and streams output
func ExecuteCommand(dir, command string) error {
	parts := strings.Fields(command)
	if len(parts) == 0 {
		return fmt.Errorf("empty command")
	}

	cmd := exec.Command(parts[0], parts[1:]...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	return cmd.Run()
}

// PromptPackageManager prompts the user to select a package manager
func PromptPackageManager() (string, error) {
	options := []string{"pnpm", "npm", "yarn", "bun"}

	// Filter out unavailable package managers
	available := []string{}
	for _, pm := range options {
		if isPackageManagerInstalled(pm) {
			available = append(available, pm)
		}
	}

	if len(available) == 0 {
		return "npm", nil // Default to npm if none available
	}

	// If only one is available, return it
	if len(available) == 1 {
		return available[0], nil
	}

	// Use survey to prompt user (we'll need to import it in the calling code)
	// For now, return the first available
	return available[0], nil
}
