package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	"github.com/memodb-io/Acontext/acontext-cli/internal/sandbox"
	"github.com/spf13/cobra"
)

var SandboxCmd = &cobra.Command{
	Use:   "sandbox",
	Short: "Manage sandbox projects",
	Long: `Manage sandbox projects for Acontext.

This command helps you:
  - List and start existing sandbox projects
  - Create new sandbox projects using published templates
  - Automatically detect and use the appropriate package manager`,
}

var sandboxStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start or create a sandbox project",
	Long: `Start an existing sandbox project or create a new one.

The command will:
  1. Scan for existing sandbox projects in sandbox/ directory
  2. List available sandbox types to create
  3. Allow you to select an existing project or create a new one
  4. Automatically start the development server`,
	RunE: runSandboxStart,
}

func init() {
	SandboxCmd.AddCommand(sandboxStartCmd)
}

func runSandboxStart(cmd *cobra.Command, args []string) error {
	// Get current working directory
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get current directory: %w", err)
	}

	fmt.Println("📦 Scanning for existing sandbox projects...")
	fmt.Println()

	// Scan for existing projects
	existingProjects, err := sandbox.ScanSandboxProjects(cwd)
	if err != nil {
		return fmt.Errorf("failed to scan sandbox projects: %w", err)
	}

	// Get available create options
	createOptions, err := sandbox.GetAvailableCreateOptions(cwd)
	if err != nil {
		return fmt.Errorf("failed to get available create options: %w", err)
	}

	// Build options list for user selection
	var options []string
	var optionMap = make(map[string]sandboxOption)

	// Add existing projects
	for _, p := range existingProjects {
		label := fmt.Sprintf("%s (Local) - %s", p.Name, p.Path)
		options = append(options, label)
		optionMap[label] = sandboxOption{
			project:  p,
			isCreate: false,
		}
	}

	// Add create options
	for _, p := range createOptions {
		// Capitalize first letter
		name := p.Name
		if len(name) > 0 {
			name = strings.ToUpper(string(name[0])) + name[1:]
		}
		label := fmt.Sprintf("%s (Create)", name)
		options = append(options, label)
		optionMap[label] = sandboxOption{
			project:  p,
			isCreate: true,
		}
	}

	if len(options) == 0 {
		return fmt.Errorf("no sandbox options available")
	}

	// Prompt user to select
	var selected string
	prompt := &survey.Select{
		Message: "Select a sandbox project:",
		Options: options,
		Help:    "Choose an existing project to start or create a new one",
	}

	if err := survey.AskOne(prompt, &selected); err != nil {
		return fmt.Errorf("failed to get selection: %w", err)
	}

	option, ok := optionMap[selected]
	if !ok {
		return fmt.Errorf("selected option not found")
	}

	// Handle the selection
	if option.isCreate {
		return handleCreate(option.project, cwd)
	} else {
		return handleStart(option.project, cwd)
	}
}

type sandboxOption struct {
	project  sandbox.SandboxProject
	isCreate bool
}

func handleCreate(project sandbox.SandboxProject, baseDir string) error {
	// Check if project already exists and prompt for overwrite
	if project.Exists {
		var overwrite bool
		prompt := &survey.Confirm{
			Message: fmt.Sprintf("Project %s already exists. Overwrite?", project.Path),
			Default: false,
			Help:    "This will remove the existing project and create a new one",
		}

		if err := survey.AskOne(prompt, &overwrite); err != nil {
			return fmt.Errorf("failed to get overwrite confirmation: %w", err)
		}

		if !overwrite {
			fmt.Println("⏭️  Skipping creation. Starting existing project instead...")
			return handleStart(project, baseDir)
		}
	}

	// Prompt for package manager
	fmt.Println()
	fmt.Println("📦 Select package manager:")
	pmOptions := []string{"pnpm", "npm", "yarn", "bun"}
	var selectedPM string
	pmPrompt := &survey.Select{
		Message: "Package manager:",
		Options: pmOptions,
		Help:    "Select the package manager to use for creating the project",
	}

	if err := survey.AskOne(pmPrompt, &selectedPM); err != nil {
		return fmt.Errorf("failed to get package manager selection: %w", err)
	}

	// Check if package manager is installed
	if !isPackageManagerInstalled(selectedPM) {
		return fmt.Errorf("package manager '%s' is not installed. Please install it first", selectedPM)
	}

	// Create the project
	if project.Exists {
		if err := sandbox.CreateSandboxProjectWithOverwrite(project.Name, selectedPM, baseDir); err != nil {
			return fmt.Errorf("failed to create project: %w", err)
		}
	} else {
		if err := sandbox.CreateSandboxProject(project.Name, selectedPM, baseDir); err != nil {
			return fmt.Errorf("failed to create project: %w", err)
		}
	}

	fmt.Println()

	// Get the project directory
	projectDir, err := sandbox.GetProjectDir(baseDir, project.Path)
	if err != nil {
		return fmt.Errorf("failed to get project directory: %w", err)
	}

	// Start the project
	return sandbox.StartProject(projectDir)
}

func handleStart(project sandbox.SandboxProject, baseDir string) error {
	// Get the project directory
	projectDir, err := sandbox.GetProjectDir(baseDir, project.Path)
	if err != nil {
		return fmt.Errorf("failed to get project directory: %w", err)
	}

	// Start the project
	return sandbox.StartProject(projectDir)
}

func isPackageManagerInstalled(pm string) bool {
	// This is a simple check - we'll let the actual command execution handle errors
	// For now, just return true and let the create command fail if not installed
	return true
}
