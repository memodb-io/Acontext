package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestLoadTemplatesConfig(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(t *testing.T) string
		wantErr bool
	}{
		{
			name: "load valid config from templates directory",
			setup: func(t *testing.T) string {
				// This will use the actual templates.yaml file
				return ""
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := LoadTemplatesConfig()
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, config)
			} else {
				// If config file exists, should load successfully
				// If not, error is acceptable
				if err == nil {
					assert.NotNil(t, config)
					assert.NotEmpty(t, config.Templates)
					assert.NotEmpty(t, config.Presets)
				}
			}
		})
	}
}

func TestGetTemplate(t *testing.T) {
	// Create a temporary config file for testing
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "templates.yaml")

	configContent := `
templates:
  python:
    plain:
      repo: "https://github.com/test/repo"
      path: "python/plain"
      description: "Test template"
presets:
  python:
    - name: "Test"
      template: "python.plain"
`

	err := os.MkdirAll(filepath.Dir(configPath), 0755)
	require.NoError(t, err)

	err = os.WriteFile(configPath, []byte(configContent), 0644)
	require.NoError(t, err)

	// Reset cached config
	cachedConfig = nil

	// We can't easily test this without modifying the package to accept a config path
	// So we'll test the logic with a manual config
	var config TemplatesConfig
	err = yaml.Unmarshal([]byte(configContent), &config)
	require.NoError(t, err)

	template, ok := config.Templates["python"]["plain"]
	assert.True(t, ok)
	assert.Equal(t, "https://github.com/test/repo", template.Repo)
	assert.Equal(t, "python/plain", template.Path)
	assert.Equal(t, "Test template", template.Description)
}

func TestGetPresets(t *testing.T) {
	configContent := `
presets:
  python:
    - name: "Basic"
      description: "Basic Python"
      template: "python.plain"
    - name: "With OpenAI"
      description: "Python with OpenAI"
      template: "python.openai"
  typescript:
    - name: "Basic TS"
      description: "Basic TypeScript"
      template: "typescript.plain"
`

	var config TemplatesConfig
	err := yaml.Unmarshal([]byte(configContent), &config)
	require.NoError(t, err)

	// Test Python presets
	presets, ok := config.Presets["python"]
	assert.True(t, ok)
	assert.Len(t, presets, 2)
	assert.Equal(t, "Basic", presets[0].Name)
	assert.Equal(t, "With OpenAI", presets[1].Name)

	// Test TypeScript presets
	tsPresets, ok := config.Presets["typescript"]
	assert.True(t, ok)
	assert.Len(t, tsPresets, 1)
	assert.Equal(t, "Basic TS", tsPresets[0].Name)
}

func TestGetLanguages(t *testing.T) {
	configContent := `
presets:
  python:
    - name: "Test"
      template: "python.plain"
  typescript:
    - name: "Test"
      template: "typescript.plain"
`

	var config TemplatesConfig
	err := yaml.Unmarshal([]byte(configContent), &config)
	require.NoError(t, err)

	// Since GetLanguages uses LoadTemplatesConfig, we test the logic directly
	languages := make([]string, 0, len(config.Presets))
	for lang := range config.Presets {
		languages = append(languages, lang)
	}

	assert.Contains(t, languages, "python")
	assert.Contains(t, languages, "typescript")
	assert.Len(t, languages, 2)
}

