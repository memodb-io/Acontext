package sandbox

import (
	"fmt"
	"os"
	"path/filepath"
)

// SandboxProject represents a detected sandbox project
type SandboxProject struct {
	Name     string // e.g., "cloudflare"
	Path     string // e.g., "sandbox/cloudflare"
	Type     string // "local" or "create"
	Exists   bool
	FullPath string // Absolute path to the project
}

// ScanSandboxProjects scans the base directory for existing sandbox projects
// in sandbox/xxx subdirectories
func ScanSandboxProjects(baseDir string) ([]SandboxProject, error) {
	sandboxDir := filepath.Join(baseDir, "sandbox")

	// Check if sandbox directory exists
	if _, err := os.Stat(sandboxDir); os.IsNotExist(err) {
		return []SandboxProject{}, nil
	}

	var projects []SandboxProject

	// Read sandbox directory
	entries, err := os.ReadDir(sandboxDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read sandbox directory: %w", err)
	}

	// Get available sandbox types
	availableTypes := GetAvailableSandboxTypes()
	typeMap := make(map[string]SandboxType)
	for _, t := range availableTypes {
		typeMap[t.Name] = t
	}

	// Check each subdirectory
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		projectName := entry.Name()
		projectPath := filepath.Join(sandboxDir, projectName)
		fullPath, err := filepath.Abs(projectPath)
		if err != nil {
			continue
		}

		// Check if it's a valid sandbox project
		if IsValidSandboxProject(fullPath) {
			// Check if this matches a known sandbox type
			if _, ok := typeMap[projectName]; ok {
				projects = append(projects, SandboxProject{
					Name:     projectName,
					Path:     filepath.Join("sandbox", projectName),
					Type:     "local",
					Exists:   true,
					FullPath: fullPath,
				})
			}
		}
	}

	return projects, nil
}

// IsValidSandboxProject checks if a directory contains a valid sandbox project
// by checking for required files like package.json and wrangler.jsonc
func IsValidSandboxProject(dir string) bool {
	// Check for package.json
	packageJson := filepath.Join(dir, "package.json")
	if _, err := os.Stat(packageJson); os.IsNotExist(err) {
		return false
	}

	// Check for wrangler.jsonc (Cloudflare project indicator)
	wranglerJsonc := filepath.Join(dir, "wrangler.jsonc")
	if _, err := os.Stat(wranglerJsonc); err == nil {
		return true
	}

	// Also check for wrangler.json
	wranglerJson := filepath.Join(dir, "wrangler.json")
	if _, err := os.Stat(wranglerJson); err == nil {
		return true
	}

	// Check if package.json contains @cloudflare/sandbox dependency
	// (This is a simplified check - in production you might want to parse the JSON)
	return false
}

// GetAvailableCreateOptions returns sandbox types that can be created
// and filters out ones that already exist locally
func GetAvailableCreateOptions(baseDir string) ([]SandboxProject, error) {
	existingProjects, err := ScanSandboxProjects(baseDir)
	if err != nil {
		return nil, err
	}

	existingMap := make(map[string]bool)
	for _, p := range existingProjects {
		existingMap[p.Name] = true
	}

	availableTypes := GetAvailableSandboxTypes()
	var createOptions []SandboxProject

	for _, t := range availableTypes {
		// Always show create option, even if local exists
		// The user can choose to overwrite
		projectPath := filepath.Join("sandbox", t.Name)
		fullPath, _ := filepath.Abs(filepath.Join(baseDir, projectPath))

		createOptions = append(createOptions, SandboxProject{
			Name:     t.Name,
			Path:     projectPath,
			Type:     "create",
			Exists:   existingMap[t.Name],
			FullPath: fullPath,
		})
	}

	return createOptions, nil
}
