package config

import (
	"fmt"
	"os"
	"path/filepath"

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
	Templates map[string]map[string]TemplateConfig `yaml:"templates"`
	Presets   map[string][]Preset                  `yaml:"presets"`
}

var cachedConfig *TemplatesConfig

// LoadTemplatesConfig loads template configuration file
func LoadTemplatesConfig() (*TemplatesConfig, error) {
	if cachedConfig != nil {
		return cachedConfig, nil
	}

	// Get config file path
	exePath, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("failed to get executable path: %w", err)
	}

	exeDir := filepath.Dir(exePath)
	configPath := filepath.Join(exeDir, "templates", "templates.yaml")

	// If not found in executable directory, try development path
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Development environment
		cwd, _ := os.Getwd()
		configPath = filepath.Join(cwd, "templates", "templates.yaml")
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read templates config: %w", err)
	}

	var config TemplatesConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
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

// GetPresets gets preset list for specified language
func GetPresets(language string) ([]Preset, error) {
	config, err := LoadTemplatesConfig()
	if err != nil {
		return nil, err
	}

	presets, ok := config.Presets[language]
	if !ok {
		return nil, fmt.Errorf("no presets for language: %s", language)
	}

	return presets, nil
}

// GetLanguages gets all supported languages
func GetLanguages() []string {
	config, err := LoadTemplatesConfig()
	if err != nil {
		return []string{}
	}

	languages := make([]string, 0, len(config.Presets))
	for lang := range config.Presets {
		languages = append(languages, lang)
	}
	return languages
}
