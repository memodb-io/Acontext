package template

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/pelletier/go-toml/v2"
)

// Config template configuration (to avoid circular imports)
type Config struct {
	Repo        string
	Path        string
	Description string
}

// DownloadTemplate downloads template to target directory
func DownloadTemplate(template *Config, destDir string) error {
	return DownloadTemplateWithVars(template, destDir, nil)
}

// DownloadTemplateWithVars downloads template and replaces template variables
func DownloadTemplateWithVars(template *Config, destDir string, vars map[string]string) error {
	fmt.Println("📦 Downloading template...")

	// 1. Create temporary directory
	tempDir, err := os.MkdirTemp("", "acontext-template-*")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	// 2. Sparse clone repository
	cmd := exec.Command(
		"git", "clone",
		"--filter=blob:none",
		"--sparse",
		"--depth=1",
		"--quiet",
		template.Repo,
		tempDir,
	)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to clone repo: %w", err)
	}

	// 3. Enable sparse-checkout
	cmd = exec.Command("git", "sparse-checkout", "init", "--cone")
	cmd.Dir = tempDir
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to init sparse-checkout: %w", err)
	}

	// 4. Set checkout path
	cmd = exec.Command("git", "sparse-checkout", "set", template.Path)
	cmd.Dir = tempDir
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to set sparse-checkout: %w", err)
	}

	// 5. Extract template content
	srcDir := filepath.Join(tempDir, template.Path)
	if _, err := os.Stat(srcDir); os.IsNotExist(err) {
		return fmt.Errorf("template path not found: %s", template.Path)
	}

	fmt.Println("📋 Copying template files...")
	if err := copyDir(srcDir, destDir); err != nil {
		return fmt.Errorf("failed to copy template: %w", err)
	}

	// 6. Replace template variables if provided
	if len(vars) > 0 {
		if err := replaceTemplateVars(destDir, vars); err != nil {
			return fmt.Errorf("failed to replace template variables: %w", err)
		}
	}

	fmt.Println("✅ Template downloaded successfully")
	return nil
}

func copyDir(src, dst string) error {
	// Ensure target directory exists
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	// Use Go native file copying instead of cp command
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Calculate relative path from source
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		destPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			// Create directory in destination
			return os.MkdirAll(destPath, info.Mode())
		}

		// Ensure parent directory exists for file
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}

		// Copy file
		return copyFile(path, destPath, info.Mode())
	})
}

func copyFile(src, dst string, mode os.FileMode) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer func() {
		_ = sourceFile.Close()
	}()

	destFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, mode)
	if err != nil {
		return err
	}
	defer func() {
		_ = destFile.Close()
	}()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// replaceTemplateVars replaces template variables in configuration files
func replaceTemplateVars(projectDir string, vars map[string]string) error {
	// Handle pyproject.toml (Python projects)
	pyprojectPath := filepath.Join(projectDir, "pyproject.toml")
	if _, err := os.Stat(pyprojectPath); err == nil {
		if err := replacePyProjectName(pyprojectPath, vars["project_name"]); err != nil {
			return fmt.Errorf("failed to update pyproject.toml: %w", err)
		}
	}

	// Handle package.json (TypeScript/JavaScript projects)
	packageJsonPath := filepath.Join(projectDir, "package.json")
	if _, err := os.Stat(packageJsonPath); err == nil {
		if err := replacePackageJsonName(packageJsonPath, vars["project_name"]); err != nil {
			return fmt.Errorf("failed to update package.json: %w", err)
		}
	}

	// Handle Cargo.toml (Rust projects)
	cargoTomlPath := filepath.Join(projectDir, "Cargo.toml")
	if _, err := os.Stat(cargoTomlPath); err == nil {
		if err := replaceCargoTomlName(cargoTomlPath, vars["project_name"]); err != nil {
			return fmt.Errorf("failed to update Cargo.toml: %w", err)
		}
	}

	return nil
}

// replacePyProjectName replaces the name field in pyproject.toml
func replacePyProjectName(filePath, projectName string) error {
	if projectName == "" {
		return nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	// Parse TOML
	var config map[string]interface{}
	if err := toml.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse pyproject.toml: %w", err)
	}

	// Sanitize project name for Python package naming conventions
	packageName := sanitizeProjectNameForPackage(projectName, "python")

	// Update project name
	if project, ok := config["project"].(map[string]interface{}); ok {
		project["name"] = packageName
	} else {
		// If project section doesn't exist, create it
		config["project"] = map[string]interface{}{
			"name": packageName,
		}
	}

	// Write back
	updatedData, err := toml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal pyproject.toml: %w", err)
	}

	return os.WriteFile(filePath, updatedData, 0644)
}

// replacePackageJsonName replaces the name field in package.json
func replacePackageJsonName(filePath, projectName string) error {
	if projectName == "" {
		return nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	// Parse JSON
	var config map[string]interface{}
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse package.json: %w", err)
	}

	// Sanitize project name for npm package naming conventions
	packageName := sanitizeProjectNameForPackage(projectName, "npm")

	// Update name
	config["name"] = packageName

	// Write back with proper formatting
	updatedData, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal package.json: %w", err)
	}
	updatedData = append(updatedData, '\n') // Add trailing newline

	return os.WriteFile(filePath, updatedData, 0644)
}

// replaceCargoTomlName replaces the name field in Cargo.toml
func replaceCargoTomlName(filePath, projectName string) error {
	if projectName == "" {
		return nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	// Parse TOML
	var config map[string]interface{}
	if err := toml.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse Cargo.toml: %w", err)
	}

	// Update package name
	if packageSection, ok := config["package"].(map[string]interface{}); ok {
		packageSection["name"] = projectName
	} else {
		// If package section doesn't exist, create it
		config["package"] = map[string]interface{}{
			"name": projectName,
		}
	}

	// Write back
	updatedData, err := toml.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal Cargo.toml: %w", err)
	}

	return os.WriteFile(filePath, updatedData, 0644)
}

// sanitizeProjectNameForPackage converts project name to a valid package name
// For Python: lowercase, replace spaces/hyphens with underscores
// For npm: lowercase, replace spaces with hyphens
func sanitizeProjectNameForPackage(name, format string) string {
	name = strings.ToLower(name)
	switch format {
	case "python":
		// Python package names: lowercase, underscores allowed, no hyphens
		re := regexp.MustCompile(`[^a-z0-9_]`)
		name = re.ReplaceAllString(name, "_")
	case "npm":
		// npm package names: lowercase, hyphens allowed, no underscores
		re := regexp.MustCompile(`[^a-z0-9-]`)
		name = re.ReplaceAllString(name, "-")
	}
	return name
}
