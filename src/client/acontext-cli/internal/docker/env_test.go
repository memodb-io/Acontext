package docker

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateEnvFile(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
		wantErr  bool
	}{
		{
			name:     "generate valid env file",
			filePath: filepath.Join(t.TempDir(), ".env"),
			wantErr:  false,
		},
		{
			name:     "generate in nested directory",
			filePath: filepath.Join(t.TempDir(), "subdir", ".env"),
			wantErr:  false,
		},
	}

		for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create directory if needed
			dir := filepath.Dir(tt.filePath)
			err := os.MkdirAll(dir, 0755)
			require.NoError(t, err)

			// Create mock env config for testing
			envConfig := &EnvConfig{
				LLMConfig: &LLMConfig{
					APIKey:  "test-api-key",
					BaseURL: "https://api.example.com",
					SDK:     "openai",
				},
				RootAPIBearerToken: "test-root-token",
			}
			
			err = GenerateEnvFile(tt.filePath, envConfig)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)

				// Verify file exists
				_, err = os.Stat(tt.filePath)
				assert.NoError(t, err)

				// Read and verify content
				content, err := os.ReadFile(tt.filePath)
				assert.NoError(t, err)
				contentStr := string(content)

				// Check for required environment variables
				assert.Contains(t, contentStr, "LLM_API_KEY=")
				assert.Contains(t, contentStr, "LLM_BASE_URL=")
				assert.Contains(t, contentStr, "LLM_SDK=")
				assert.Contains(t, contentStr, "ROOT_API_BEARER_TOKEN=")

				// Verify config values are not empty
				lines := strings.Split(contentStr, "\n")
				var llmAPIKey, llmBaseURL, llmSDK, rootToken string
				for _, line := range lines {
					if strings.HasPrefix(line, "LLM_API_KEY=") {
						llmAPIKey = strings.TrimPrefix(line, "LLM_API_KEY=")
					}
					if strings.HasPrefix(line, "LLM_BASE_URL=") {
						llmBaseURL = strings.TrimPrefix(line, "LLM_BASE_URL=")
					}
					if strings.HasPrefix(line, "LLM_SDK=") {
						llmSDK = strings.TrimPrefix(line, "LLM_SDK=")
					}
					if strings.HasPrefix(line, "ROOT_API_BEARER_TOKEN=") {
						rootToken = strings.TrimPrefix(line, "ROOT_API_BEARER_TOKEN=")
					}
				}
				assert.NotEmpty(t, llmAPIKey)
				assert.NotEmpty(t, llmBaseURL)
				assert.NotEmpty(t, llmSDK)
				assert.NotEmpty(t, rootToken)
				assert.Equal(t, "test-api-key", llmAPIKey)
				assert.Equal(t, "https://api.example.com", llmBaseURL)
				assert.Equal(t, "openai", llmSDK)
				assert.Equal(t, "test-root-token", rootToken)
			}
		})
	}
}

