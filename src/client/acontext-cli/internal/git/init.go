package git

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Init initializes Git repository
func Init(projectDir string) error {
	// Check if already a Git repository
	gitDir := filepath.Join(projectDir, ".git")
	if _, err := os.Stat(gitDir); err == nil {
		return fmt.Errorf("already a git repository")
	}

	// Initialize Git repository
	cmd := exec.Command("git", "init")
	cmd.Dir = projectDir
	cmd.Stderr = os.Stderr
	cmd.Stdout = os.Stdout

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to initialize git: %w", err)
	}

	// Create or update .gitignore
	if err := ensureGitignore(projectDir); err != nil {
		// Non-fatal error, just log warning
		fmt.Printf("⚠️  Warning: Failed to create .gitignore: %v\n", err)
	}

	// Create initial commit
	cmd = exec.Command("git", "add", ".")
	cmd.Dir = projectDir
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		// Non-fatal error, skip initial commit
		return nil
	}

	cmd = exec.Command("git", "commit", "-m", "Initial commit from acontext-cli")
	cmd.Dir = projectDir
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		// Non-fatal error, skip initial commit
		return nil
	}

	return nil
}

// ensureGitignore ensures .gitignore file exists
func ensureGitignore(projectDir string) error {
	gitignorePath := filepath.Join(projectDir, ".gitignore")

	// Check if file already exists
	if _, err := os.Stat(gitignorePath); err == nil {
		// File already exists, check if contains required content
		return nil
	}

	// Create basic .gitignore content
	content := `# Environment variables
.env
.env.local
.env.*.local

# Dependencies
node_modules/
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.so
*.egg
*.egg-info/
dist/
build/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
tmp/
temp/
*.tmp

# Build outputs
*.exe
*.out
`

	return os.WriteFile(gitignorePath, []byte(content), 0644)
}

