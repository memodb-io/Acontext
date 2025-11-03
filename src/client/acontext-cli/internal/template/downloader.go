package template

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
)

// Config template configuration (to avoid circular imports)
type Config struct {
	Repo        string
	Path        string
	Description string
}

// DownloadTemplate downloads template to target directory
func DownloadTemplate(template *Config, destDir string) error {
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
