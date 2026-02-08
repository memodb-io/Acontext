package config

import (
	_ "embed"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type TemplateConfig struct {
	Repo        string `yaml:"repo"`
	Path        string `yaml:"path"`
	Description string `yaml:"description"`
}

type Preset struct {
	Name        string                 `yaml:"name"`
	Description string                 `yaml:"description"`
	Template    string                 `yaml:"template"`
	Combination map[string]interface{} `yaml:"combination,omitempty"`
}

type TemplatesConfig struct {
	Repo      string                               `yaml:"repo"`
	Templates map[string]map[string]TemplateConfig `yaml:"templates"`
	Presets   map[string][]Preset                  `yaml:"presets,omitempty"`
}

//go:embed templates.yaml
var templatesYAML string

var cachedConfig *TemplatesConfig

// LoadTemplatesConfig loads template configuration from embedded file
func LoadTemplatesConfig() (*TemplatesConfig, error) {
	if cachedConfig != nil {
		return cachedConfig, nil
	}

	var config TemplatesConfig
	if err := yaml.Unmarshal([]byte(templatesYAML), &config); err != nil {
		return nil, fmt.Errorf("failed to parse templates config: %w", err)
	}

	cachedConfig = &config
	return &config, nil
}

// GetTemplate gets template config by language and template key
func GetTemplate(language, templateKey string) (*TemplateConfig, error) {
	config, err := LoadTemplatesConfig()
	if err != nil {
		return nil, err
	}

	templates, ok := config.Templates[language]
	if !ok {
		return nil, fmt.Errorf("unsupported language: %s", language)
	}

	template, ok := templates[templateKey]
	if !ok {
		return nil, fmt.Errorf("template not found: %s.%s", language, templateKey)
	}

	return &template, nil
}

// NeedsTemplateDiscovery checks if templates need to be discovered from repository
func NeedsTemplateDiscovery(language string) (bool, error) {
	config, err := LoadTemplatesConfig()
	if err != nil {
		return false, err
	}

	// If presets are defined in YAML, no need to discover
	if presets, ok := config.Presets[language]; ok && len(presets) > 0 {
		return false, nil
	}

	// Otherwise, need to discover templates from repository
	return true, nil
}

// GetPresets gets preset list for specified language
// If presets are defined in YAML, use them; otherwise, dynamically discover from repo
func GetPresets(language string) ([]Preset, error) {
	config, err := LoadTemplatesConfig()
	if err != nil {
		return nil, err
	}

	// If presets are defined in YAML, use them
	if presets, ok := config.Presets[language]; ok && len(presets) > 0 {
		return presets, nil
	}

	// Otherwise, dynamically discover templates from repository
	return discoverTemplates(config.Repo, language)
}

// GetLanguages gets all supported languages
func GetLanguages() []string {
	config, err := LoadTemplatesConfig()
	if err != nil {
		return []string{}
	}

	// If presets are defined, use them
	if len(config.Presets) > 0 {
		languages := make([]string, 0, len(config.Presets))
		for lang := range config.Presets {
			languages = append(languages, lang)
		}
		return languages
	}

	// Otherwise, use templates
	languages := make([]string, 0, len(config.Templates))
	for lang := range config.Templates {
		languages = append(languages, lang)
	}
	return languages
}

// discoverTemplates dynamically discovers templates from the repository
func discoverTemplates(repo, language string) ([]Preset, error) {
	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "acontext-discover-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	// Sparse clone repository
	cmd := exec.Command(
		"git", "clone",
		"--filter=blob:none",
		"--sparse",
		"--depth=1",
		"--quiet",
		repo,
		tempDir,
	)
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to clone repo: %w", err)
	}

	// Enable sparse-checkout for the language directory
	cmd = exec.Command("git", "sparse-checkout", "init", "--cone")
	cmd.Dir = tempDir
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to init sparse-checkout: %w", err)
	}

	cmd = exec.Command("git", "sparse-checkout", "set", language)
	cmd.Dir = tempDir
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("failed to set sparse-checkout: %w", err)
	}

	// List subdirectories in the language folder
	langDir := filepath.Join(tempDir, language)
	entries, err := os.ReadDir(langDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read language directory: %w", err)
	}

	var presets []Preset
	for _, entry := range entries {
		if entry.IsDir() {
			templateName := entry.Name()
			// Skip hidden directories and common non-template folders
			if strings.HasPrefix(templateName, ".") || templateName == "node_modules" {
				continue
			}

			presets = append(presets, Preset{
				Name:     formatTemplateName(language, templateName),
				Template: fmt.Sprintf("%s.%s", language, templateName),
			})
		}
	}

	if len(presets) == 0 {
		return nil, fmt.Errorf("no templates found for language: %s", language)
	}

	return presets, nil
}

// formatTemplateName formats template name for display
func formatTemplateName(_ string, templateName string) string {
	// Capitalize first letter and replace hyphens/underscores with spaces
	parts := strings.FieldsFunc(templateName, func(r rune) bool {
		return r == '-' || r == '_'
	})

	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}

	return strings.Join(parts, " ")
}
