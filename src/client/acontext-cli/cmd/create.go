package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/AlecAivazis/survey/v2"
	"github.com/memodb-io/Acontext/acontext-cli/internal/config"
	"github.com/memodb-io/Acontext/acontext-cli/internal/git"
	"github.com/memodb-io/Acontext/acontext-cli/internal/template"
	"github.com/spf13/cobra"
)

var (
	templatePath string // Custom template path, e.g., "python/custom-template"
)

var CreateCmd = &cobra.Command{
	Use:   "create [project-name]",
	Short: "Create a new Acontext project",
	Long: `Create a new Acontext project with a template.
	
You will be guided through:
  1. Project name (if not provided)
  2. Programming language selection
  3. Template selection
  4. Git initialization
  5. Optional Docker deployment

Use --template-path to specify a custom template folder from:
  https://github.com/memodb-io/Acontext-Examples
  
Example:
  acontext create my-project --template-path "python/custom-template"
`,
	Args: cobra.MaximumNArgs(1),
	RunE: runCreate,
}

func init() {
	CreateCmd.Flags().StringVarP(&templatePath, "template-path", "t", "", "Custom template folder path from Acontext-Examples repository (e.g., python/custom-template)")
}

func runCreate(cmd *cobra.Command, args []string) error {
	// 1. Get project name
	var projectName string
	if len(args) > 0 {
		projectName = args[0]
	} else {
		defaultName := "my-acontext-app"
		prompt := &survey.Input{
			Message: "Project name:",
			Help:    "Enter a name for your project (e.g., my-acontext-app)",
			Default: defaultName,
		}
		if err := survey.AskOne(prompt, &projectName); err != nil {
			return fmt.Errorf("failed to get project name: %w", err)
		}
		// If user just pressed Enter, use default value
		if projectName == "" {
			projectName = defaultName
		}
	}

	// Validate project name
	if err := validateProjectName(projectName); err != nil {
		return err
	}

	// Check if directory already exists
	projectDir, err := filepath.Abs(projectName)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	if _, err := os.Stat(projectDir); err == nil {
		return fmt.Errorf("directory %s already exists", projectName)
	}

	fmt.Printf("📦 Creating project: %s\n", projectName)
	fmt.Println()

	var templateConfig *template.Config

	// 2. If custom template path is specified, use it directly
	if templatePath != "" {
		fmt.Printf("✓ Using custom template: %s\n", templatePath)
		fmt.Println()
		templateConfig = &template.Config{
			Repo:        "https://github.com/memodb-io/Acontext-Examples",
			Path:        templatePath,
			Description: fmt.Sprintf("Custom template from %s", templatePath),
		}
	} else {
		// 3. Select language
		language, err := promptLanguage()
		if err != nil {
			return err
		}
		fmt.Printf("✓ Selected language: %s\n", language)
		fmt.Println()

		// 4. Load config and select template
		templateKey, preset, err := promptTemplate(language)
		if err != nil {
			return err
		}
		fmt.Printf("✓ Selected template: %s\n", preset.Name)
		fmt.Println()

		// 5. Get template config
		// Parse template key (e.g., "python.openai")
		parts := strings.Split(templateKey, ".")
		if len(parts) != 2 {
			return fmt.Errorf("invalid template key: %s", templateKey)
		}

		tmpl, err := config.GetTemplate(parts[0], parts[1])
		if err != nil {
			return fmt.Errorf("failed to get template: %w", err)
		}

		templateConfig = &template.Config{
			Repo:        tmpl.Repo,
			Path:        tmpl.Path,
			Description: tmpl.Description,
		}
	}

	// 6. Create project directory
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return fmt.Errorf("failed to create project directory: %w", err)
	}

	// 7. Download template

	if err := template.DownloadTemplate(templateConfig, projectDir); err != nil {
		return fmt.Errorf("failed to download template: %w", err)
	}
	fmt.Println()

	// 8. Ask whether to initialize Git
	initGit := false
	prompt := &survey.Confirm{
		Message: "Would you like to initialize a Git repository?",
		Help:    "This will create a new Git repository and make an initial commit.",
		Default: true,
	}

	if err := survey.AskOne(prompt, &initGit); err != nil {
		return fmt.Errorf("failed to get Git initialization preference: %w", err)
	}

	if initGit {
		fmt.Println("🔧 Initializing Git repository...")
		if err := git.Init(projectDir); err != nil {
			fmt.Printf("⚠️  Warning: Failed to initialize Git: %v\n", err)
			fmt.Println("   You can initialize Git manually later with: git init")
		} else {
			fmt.Println("✓ Git repository initialized")
		}
		fmt.Println()
	} else {
		fmt.Println("⏭️  Skipping Git initialization")
		fmt.Println("   You can initialize Git manually later with: git init")
		fmt.Println()
	}

	// 9. Display success message
	fmt.Println()
	fmt.Println("✅ Project created successfully!")
	fmt.Println()
	fmt.Printf("📁 Project location: %s\n", projectDir)
	fmt.Println()
	fmt.Println("🚀 Next steps:")
	fmt.Println()
	fmt.Printf("   1. Navigate to your project:\n")
	fmt.Printf("      cd %s\n", projectName)
	fmt.Println()
	fmt.Printf("   2. Read the README to get started:\n")
	fmt.Printf("      cat README.md\n")
	fmt.Println()
	fmt.Printf("   3. Deploy with Docker (optional):\n")
	fmt.Printf("      acontext docker up\n")
	fmt.Println()

	return nil
}

// validateProjectName validates the project name
func validateProjectName(name string) error {
	if name == "" {
		return fmt.Errorf("project name cannot be empty")
	}

	// Check for invalid characters
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	for _, char := range invalidChars {
		if strings.Contains(name, char) {
			return fmt.Errorf("project name cannot contain: %s", char)
		}
	}

	// Check if reserved name
	reserved := []string{".", "..", ".git", ".env"}
	for _, reservedName := range reserved {
		if name == reservedName {
			return fmt.Errorf("'%s' is a reserved name and cannot be used", name)
		}
	}

	return nil
}

// promptLanguage prompts user to select a language
func promptLanguage() (string, error) {
	languages := config.GetLanguages()
	if len(languages) == 0 {
		return "", fmt.Errorf("no languages available in templates config")
	}

	var selected string
	prompt := &survey.Select{
		Message: "Choose a programming language:",
		Options: languages,
		Help:    "Select the language for your project",
	}

	if err := survey.AskOne(prompt, &selected); err != nil {
		return "", fmt.Errorf("failed to select language: %w", err)
	}

	return selected, nil
}

// promptTemplate prompts user to select a template
func promptTemplate(language string) (string, *config.Preset, error) {
	presets, err := config.GetPresets(language)
	if err != nil {
		return "", nil, fmt.Errorf("failed to get presets: %w", err)
	}

	if len(presets) == 0 {
		return "", nil, fmt.Errorf("no presets available for language: %s", language)
	}

	// Create options list
	options := make([]string, len(presets))
	optionsWithDesc := make(map[string]*config.Preset)

	for i, preset := range presets {
		optionText := preset.Name
		if preset.Description != "" {
			optionText += " - " + preset.Description
		}
		options[i] = optionText
		optionsWithDesc[optionText] = &presets[i]
	}

	var selectedOption string
	prompt := &survey.Select{
		Message: "Choose a template:",
		Options: options,
		Help:    "Select a template that matches your needs",
	}

	if err := survey.AskOne(prompt, &selectedOption); err != nil {
		return "", nil, fmt.Errorf("failed to select template: %w", err)
	}

	preset, ok := optionsWithDesc[selectedOption]
	if !ok {
		return "", nil, fmt.Errorf("selected preset not found")
	}

	return preset.Template, preset, nil
}
