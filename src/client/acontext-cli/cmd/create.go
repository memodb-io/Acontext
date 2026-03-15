package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/memodb-io/Acontext/acontext-cli/internal/config"
	"github.com/memodb-io/Acontext/acontext-cli/internal/git"
	"github.com/memodb-io/Acontext/acontext-cli/internal/template"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

var (
	templatePath   string // Custom template path, e.g., "python/custom-template"
	createLanguage string // Language selection for non-interactive mode
	createTemplate string // Template key for non-interactive mode
	createGitInit  bool   // Initialize git repo without prompting
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

For non-interactive (non-TTY) usage, provide --language and --template:
  acontext create my-project --language python --template openai

Example:
  acontext create my-project --template-path "python/custom-template"
`,
	Args: cobra.MaximumNArgs(1),
	RunE: runCreate,
}

func init() {
	CreateCmd.Flags().StringVarP(&templatePath, "template-path", "t", "", "Custom template folder path from Acontext-Examples repository (e.g., python/custom-template)")
	CreateCmd.Flags().StringVarP(&createLanguage, "language", "l", "", "Programming language (e.g., python, typescript)")
	CreateCmd.Flags().StringVar(&createTemplate, "template", "", "Template key (e.g., openai, langchain)")
	CreateCmd.Flags().BoolVar(&createGitInit, "git-init", false, "Initialize a Git repository (skips interactive prompt)")
}

func runCreate(cmd *cobra.Command, args []string) error {
	// 1. Get project name
	var projectName string
	if len(args) > 0 {
		projectName = args[0]
	} else {
		defaultName := "my-acontext-app"
		var err error
		projectName, err = tui.RunInput("Project name:", "Enter a name for your project", defaultName)
		if err != nil {
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

	fmt.Println()
	fmt.Printf("%s Creating project: %s\n", tui.IconPackage, tui.TitleStyle.Render(projectName))
	fmt.Println()

	var templateConfig *template.Config

	// 2. If custom template path is specified, use it directly
	if templatePath != "" {
		fmt.Printf("%s Using custom template: %s\n", tui.SuccessStyle.Render(tui.IconSuccess), templatePath)
		fmt.Println()
		templateConfig = &template.Config{
			Repo:        "https://github.com/memodb-io/Acontext-Examples",
			Path:        templatePath,
			Description: fmt.Sprintf("Custom template from %s", templatePath),
		}
	} else {
		// 3. Select language
		var language string
		if createLanguage != "" {
			language = createLanguage
		} else if !tui.IsTTY() {
			languages := config.GetLanguages()
			return fmt.Errorf("use --language to specify a language in non-interactive mode\navailable languages: %s", strings.Join(languages, ", "))
		} else {
			var err error
			language, err = promptLanguage()
			if err != nil {
				return err
			}
		}
		fmt.Printf("%s Selected language: %s\n", tui.SuccessStyle.Render(tui.IconSuccess), tui.SelectedStyle.Render(language))
		fmt.Println()

		// 4. Load config and select template
		var templateKey string
		var preset *config.Preset
		if createTemplate != "" {
			templateKey = fmt.Sprintf("%s.%s", language, createTemplate)
			preset = &config.Preset{
				Name:     createTemplate,
				Template: templateKey,
			}
		} else if !tui.IsTTY() {
			presets, err := config.GetPresets(language)
			if err != nil {
				return fmt.Errorf("failed to get templates for %s: %w", language, err)
			}
			names := make([]string, len(presets))
			for i, p := range presets {
				parts := strings.Split(p.Template, ".")
				if len(parts) == 2 {
					names[i] = parts[1]
				} else {
					names[i] = p.Template
				}
			}
			return fmt.Errorf("use --template to specify a template in non-interactive mode\navailable templates for %s: %s", language, strings.Join(names, ", "))
		} else {
			var err error
			templateKey, preset, err = promptTemplate(language)
			if err != nil {
				return err
			}
		}
		fmt.Printf("%s Selected template: %s\n", tui.SuccessStyle.Render(tui.IconSuccess), tui.SelectedStyle.Render(preset.Name))
		fmt.Println()

		// 5. Get template config
		// Parse template key (e.g., "python.openai")
		parts := strings.Split(templateKey, ".")
		if len(parts) != 2 {
			return fmt.Errorf("invalid template key: %s", templateKey)
		}

		// Try to get template from config first
		tmpl, err := config.GetTemplate(parts[0], parts[1])
		if err != nil {
			// If not found in config, construct path dynamically
			cfg, err := config.LoadTemplatesConfig()
			if err != nil {
				return fmt.Errorf("failed to load templates config: %w", err)
			}
			templateConfig = &template.Config{
				Repo:        cfg.Repo,
				Path:        fmt.Sprintf("%s/%s", parts[0], parts[1]),
				Description: fmt.Sprintf("%s template", templateKey),
			}
		} else {
			templateConfig = &template.Config{
				Repo:        tmpl.Repo,
				Path:        tmpl.Path,
				Description: tmpl.Description,
			}
		}
	}

	// 6. Create project directory
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return fmt.Errorf("failed to create project directory: %w", err)
	}

	// 7. Download template with project name variable
	vars := map[string]string{
		"project_name": projectName,
	}

	fmt.Printf("%s Downloading template...\n", tui.IconDownload)
	if err := template.DownloadTemplateWithVars(templateConfig, projectDir, vars); err != nil {
		return fmt.Errorf("failed to download template: %w", err)
	}
	fmt.Println()

	// 8. Ask whether to initialize Git
	var initGit bool
	if cmd.Flags().Changed("git-init") || !tui.IsTTY() {
		initGit = createGitInit
	} else {
		var err error
		initGit, err = tui.RunConfirm("Would you like to initialize a Git repository?", true)
		if err != nil {
			// User cancelled, treat as no
			initGit = false
		}
	}

	if initGit {
		fmt.Printf("%s Initializing Git repository...\n", tui.IconGit)
		if err := git.Init(projectDir); err != nil {
			fmt.Printf("%s Warning: Failed to initialize Git: %v\n", tui.WarningStyle.Render(tui.IconWarning), err)
			fmt.Println("   You can initialize Git manually later with: git init")
		} else {
			fmt.Printf("%s Git repository initialized\n", tui.SuccessStyle.Render(tui.IconSuccess))
		}
		fmt.Println()
	} else {
		fmt.Printf("%s Skipping Git initialization\n", tui.IconSkip)
		fmt.Println("   You can initialize Git manually later with: git init")
		fmt.Println()
	}

	// 9. Display success message
	fmt.Println()
	fmt.Printf("%s Project created successfully!\n", tui.IconDone)
	fmt.Println()
	fmt.Printf("%s Project location: %s\n", tui.IconFolder, tui.SubtitleStyle.Render(projectDir))
	fmt.Println()
	fmt.Printf("%s Next steps:\n", tui.IconRocket)
	fmt.Println()
	fmt.Printf("   1. Navigate to your project:\n")
	fmt.Printf("      %s\n", tui.MutedStyle.Render("cd "+projectName))
	fmt.Println()
	fmt.Printf("   2. Read the README to get started:\n")
	fmt.Printf("      %s\n", tui.MutedStyle.Render("cat README.md"))
	fmt.Println()
	fmt.Printf("   3. Start Acontext server (optional):\n")
	fmt.Printf("      %s\n", tui.MutedStyle.Render("acontext server up"))
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

	// Convert to TUI options
	options := make([]tui.SelectOption, len(languages))
	for i, lang := range languages {
		options[i] = tui.SelectOption{
			Label: lang,
			Value: lang,
		}
	}

	value, err := tui.RunSelect("Choose a programming language:", options)
	if err != nil {
		return "", fmt.Errorf("failed to select language: %w", err)
	}

	return value, nil
}

// promptTemplate prompts user to select a template
func promptTemplate(language string) (string, *config.Preset, error) {
	// Check if we need to discover templates dynamically
	needsDiscovery, err := config.NeedsTemplateDiscovery(language)
	if err != nil {
		return "", nil, fmt.Errorf("failed to check template discovery: %w", err)
	}

	var presets []config.Preset

	// Show spinner if we need to discover templates
	if needsDiscovery {
		var discoverErr error
		_, spinnerErr := tui.RunSpinner("Discovering templates from repository", func() (string, error) {
			presets, discoverErr = config.GetPresets(language)
			if discoverErr != nil {
				return "", discoverErr
			}
			return fmt.Sprintf("Found %d templates", len(presets)), nil
		})
		if spinnerErr != nil {
			return "", nil, fmt.Errorf("failed during template discovery: %w", spinnerErr)
		}
		if discoverErr != nil {
			return "", nil, fmt.Errorf("failed to get presets: %w", discoverErr)
		}
	} else {
		presets, err = config.GetPresets(language)
		if err != nil {
			return "", nil, fmt.Errorf("failed to get presets: %w", err)
		}
	}

	if len(presets) == 0 {
		return "", nil, fmt.Errorf("no presets available for language: %s", language)
	}

	// Convert to TUI options
	options := make([]tui.SelectOption, len(presets))
	optionsMap := make(map[string]*config.Preset)

	for i, preset := range presets {
		options[i] = tui.SelectOption{
			Label:       preset.Name,
			Value:       preset.Name,
			Description: preset.Description,
		}
		optionsMap[preset.Name] = &presets[i]
	}

	selectedLabel, _, err := tui.RunSelectWithLabel("Choose a template:", options)
	if err != nil {
		return "", nil, fmt.Errorf("failed to select template: %w", err)
	}

	preset, ok := optionsMap[selectedLabel]
	if !ok {
		return "", nil, fmt.Errorf("selected preset not found")
	}

	return preset.Template, preset, nil
}
