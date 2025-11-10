package docker

import (
	"fmt"
	"os"
	"text/template"
)

// GenerateEnvFile generates .env file with required configuration
func GenerateEnvFile(filePath string, config *EnvConfig) error {
	tmpl := `# Required Configuration
# LLM Configuration
LLM_API_KEY={{.LLMAPIKey}}
LLM_BASE_URL={{.LLMBaseURL}}
LLM_SDK={{.LLMSDK}}

# API Bearer Token (for root API access)
ROOT_API_BEARER_TOKEN={{.RootAPIBearerToken}}

# Optional: Override defaults if needed
# All other settings use defaults from docker-compose.yaml
# Uncomment and set values below to override docker-compose defaults:
# DATABASE_USER=acontext
# DATABASE_PASSWORD=your-custom-password
# DATABASE_NAME=acontext
# REDIS_PASSWORD=your-custom-password
# RABBITMQ_USER=acontext
# RABBITMQ_PASSWORD=your-custom-password
# S3_ACCESS_KEY=your-custom-key
# S3_SECRET_KEY=your-custom-secret
`

	vars := struct {
		LLMAPIKey        string
		LLMBaseURL       string
		LLMSDK           string
		RootAPIBearerToken string
	}{
		LLMAPIKey:        config.LLMConfig.APIKey,
		LLMBaseURL:       config.LLMConfig.BaseURL,
		LLMSDK:           config.LLMConfig.SDK,
		RootAPIBearerToken: config.RootAPIBearerToken,
	}

	t, err := template.New("env").Parse(tmpl)
	if err != nil {
		return fmt.Errorf("failed to parse env template: %w", err)
	}

	f, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("failed to create env file: %w", err)
	}
	defer func() {
		_ = f.Close()
	}()

	if err := t.Execute(f, vars); err != nil {
		return fmt.Errorf("failed to write env file: %w", err)
	}

	return nil
}

// LLMConfig contains LLM configuration
type LLMConfig struct {
	APIKey  string
	BaseURL string
	SDK     string
}

// EnvConfig contains all environment configuration
type EnvConfig struct {
	LLMConfig         *LLMConfig
	RootAPIBearerToken string
}
