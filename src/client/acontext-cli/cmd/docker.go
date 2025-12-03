package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/AlecAivazis/survey/v2"
	"github.com/memodb-io/Acontext/acontext-cli/internal/docker"
	"github.com/spf13/cobra"
)

var DockerCmd = &cobra.Command{
	Use:   "docker",
	Short: "Manage Docker services",
	Long: `Manage Docker Compose services for Acontext projects.

This command helps you:
  - Start local development services (PostgreSQL, Redis, RabbitMQ, etc.)
  - Stop services
  - View service status and logs
  - Generate .env configuration files
`,
}

var (
	detachedMode bool
)

var dockerUpCmd = &cobra.Command{
	Use:   "up",
	Short: "Start Docker services",
	Long:  "Start all Docker Compose services (use -d to run in detached mode)",
	RunE:  runDockerUp,
}

var dockerDownCmd = &cobra.Command{
	Use:   "down",
	Short: "Stop Docker services",
	Long:  "Stop and remove all Docker Compose services",
	RunE:  runDockerDown,
}

var dockerStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show Docker services status",
	Long:  "Display the status of all Docker Compose services",
	RunE:  runDockerStatus,
}

var dockerLogsCmd = &cobra.Command{
	Use:   "logs [service]",
	Short: "View Docker services logs",
	Long:  "Display logs from Docker Compose services",
	Args:  cobra.MaximumNArgs(1),
	RunE:  runDockerLogs,
}

var dockerEnvCmd = &cobra.Command{
	Use:   "env",
	Short: "Generate .env file",
	Long:  "Generate a new .env file with random secrets",
	RunE:  runDockerEnv,
}

func init() {
	dockerUpCmd.Flags().BoolVarP(&detachedMode, "detach", "d", false, "Run containers in the background")
	DockerCmd.AddCommand(dockerUpCmd)
	DockerCmd.AddCommand(dockerDownCmd)
	DockerCmd.AddCommand(dockerStatusCmd)
	DockerCmd.AddCommand(dockerLogsCmd)
	DockerCmd.AddCommand(dockerEnvCmd)
}

func runDockerUp(cmd *cobra.Command, args []string) error {
	projectDir, err := getProjectDir()
	if err != nil {
		return err
	}

	// Check Docker
	if err := docker.CheckDockerInstalled(); err != nil {
		return fmt.Errorf("docker check failed: %w", err)
	}

	// Create temporary docker-compose file
	composeFile, err := docker.CreateTempDockerCompose(projectDir)
	if err != nil {
		return fmt.Errorf("failed to create temporary docker-compose file: %w", err)
	}
	defer func() {
		_ = os.Remove(composeFile) // Clean up temp file
	}()

	// Check if .env file exists
	envFile := filepath.Join(projectDir, ".env")
	if _, err := os.Stat(envFile); os.IsNotExist(err) {
		fmt.Println("🔐 .env file not found. Please provide the following configuration:")
		envConfig, err := promptEnvConfig()
		if err != nil {
			return fmt.Errorf("failed to get environment configuration: %w", err)
		}
		if err := docker.GenerateEnvFile(envFile, envConfig); err != nil {
			return fmt.Errorf("failed to generate .env file: %w", err)
		}
		fmt.Println("✅ Generated .env file")
	}

	fmt.Println("🚀 Starting Docker services...")
	if err := docker.Up(projectDir, composeFile, detachedMode); err != nil {
		return fmt.Errorf("failed to start services: %w", err)
	}

	if detachedMode {
		fmt.Println("⏳ Waiting for services to be healthy...")
		if err := docker.WaitForHealth(projectDir, composeFile, 120*time.Second); err != nil {
			fmt.Printf("⚠️  Warning: %v\n", err)
			fmt.Println("   Services may still be starting. Check status with: acontext docker status")
		} else {
			fmt.Println()
			fmt.Println("🎉 All services are running!")
		}
	}

	return nil
}

func runDockerDown(cmd *cobra.Command, args []string) error {
	projectDir, err := getProjectDir()
	if err != nil {
		return err
	}

	// Try to find existing compose file or create temp one
	composeFile := filepath.Join(projectDir, "docker-compose.yaml")
	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		tmpFile, err := docker.CreateTempDockerCompose(projectDir)
		if err != nil {
			return fmt.Errorf("failed to create temporary docker-compose file: %w", err)
		}
		defer func() {
			_ = os.Remove(tmpFile)
		}()
		composeFile = tmpFile
	}

	fmt.Println("🛑 Stopping Docker services...")
	if err := docker.Down(projectDir, composeFile); err != nil {
		return fmt.Errorf("failed to stop services: %w", err)
	}

	fmt.Println("✅ Services stopped")
	return nil
}

func runDockerStatus(cmd *cobra.Command, args []string) error {
	projectDir, err := getProjectDir()
	if err != nil {
		return err
	}

	// Try to find existing compose file or create temp one
	composeFile := filepath.Join(projectDir, "docker-compose.yaml")
	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		tmpFile, err := docker.CreateTempDockerCompose(projectDir)
		if err != nil {
			return fmt.Errorf("failed to create temporary docker-compose file: %w", err)
		}
		defer func() {
			_ = os.Remove(tmpFile)
		}()
		composeFile = tmpFile
	}

	return docker.Status(projectDir, composeFile)
}

func runDockerLogs(cmd *cobra.Command, args []string) error {
	projectDir, err := getProjectDir()
	if err != nil {
		return err
	}

	// Try to find existing compose file or create temp one
	composeFile := filepath.Join(projectDir, "docker-compose.yaml")
	if _, err := os.Stat(composeFile); os.IsNotExist(err) {
		tmpFile, err := docker.CreateTempDockerCompose(projectDir)
		if err != nil {
			return fmt.Errorf("failed to create temporary docker-compose file: %w", err)
		}
		defer func() {
			_ = os.Remove(tmpFile)
		}()
		composeFile = tmpFile
	}

	service := ""
	if len(args) > 0 {
		service = args[0]
	}

	return docker.Logs(projectDir, composeFile, service)
}

func runDockerEnv(cmd *cobra.Command, args []string) error {
	projectDir, err := getProjectDir()
	if err != nil {
		return err
	}

	envFile := filepath.Join(projectDir, ".env")

	// Check if file already exists
	if _, err := os.Stat(envFile); err == nil {
		fmt.Printf("⚠️  .env file already exists at %s\n", envFile)
		fmt.Println("   This will overwrite the existing file.")
		fmt.Print("   Continue? (y/N): ")
		var response string
		if _, err := fmt.Scanln(&response); err != nil {
			fmt.Println("Cancelled.")
			return nil
		}
		if response != "y" && response != "Y" {
			fmt.Println("Cancelled.")
			return nil
		}
	}

	fmt.Println("🔐 Generating .env file...")
	fmt.Println("   Please provide the following configuration:")
	envConfig, err := promptEnvConfig()
	if err != nil {
		return fmt.Errorf("failed to get environment configuration: %w", err)
	}
	if err := docker.GenerateEnvFile(envFile, envConfig); err != nil {
		return fmt.Errorf("failed to generate .env file: %w", err)
	}

	fmt.Printf("✅ Generated .env file at %s\n", envFile)
	return nil
}

// getProjectDir gets the current project directory
// It always returns the current working directory, allowing commands to be run from anywhere
func getProjectDir() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	return cwd, nil
}

// promptEnvConfig prompts user for required environment configuration
func promptEnvConfig() (*docker.EnvConfig, error) {
	fmt.Println()

	// Prompt for LLM SDK
	var llmSDK string
	sdkPrompt := &survey.Select{
		Message: "1. Choose LLM SDK:",
		Options: []string{"openai", "anthropic"},
		Default: "openai",
		Help:    "Select the LLM SDK you want to use",
	}
	if err := survey.AskOne(sdkPrompt, &llmSDK); err != nil {
		return nil, fmt.Errorf("failed to get LLM SDK: %w", err)
	}

	// Prompt for LLM API Key
	var llmAPIKey string
	llmAPIKeyPrompt := &survey.Input{
		Message: "2. Enter LLM API Key:",
		Help:    fmt.Sprintf("Your %s API key (e.g., sk-xxx for OpenAI, sk-ant-xxx for Anthropic)", llmSDK),
	}
	if err := survey.AskOne(llmAPIKeyPrompt, &llmAPIKey, survey.WithValidator(survey.Required)); err != nil {
		return nil, fmt.Errorf("failed to get LLM API key: %w", err)
	}

	// Prompt for LLM Base URL (with default)
	var llmBaseURL string
	llmBaseURLDefault := ""
	switch llmSDK {
	case "openai":
		llmBaseURLDefault = "https://api.openai.com/v1"
	case "anthropic":
		llmBaseURLDefault = "https://api.anthropic.com"
	}

	llmBaseURLPrompt := &survey.Input{
		Message: "3. Enter LLM Base URL:",
		Default: llmBaseURLDefault,
		Help:    "Base URL for your LLM API (leave default for official APIs)",
	}
	if err := survey.AskOne(llmBaseURLPrompt, &llmBaseURL); err != nil {
		return nil, fmt.Errorf("failed to get LLM Base URL: %w", err)
	}

	// Prompt for Root API Bearer Token
	var rootAPIBearerToken string
	if err := survey.AskOne(&survey.Input{
		Message: "4. Pass a string to build Acontext token:",
		Default: "your-root-api-bearer-token",
		Help:    "'sk-ac-' prefix will be added automatically. Enter token part only (xxxx).",
	}, &rootAPIBearerToken); err != nil {
		return nil, fmt.Errorf("failed to get Root API Bearer Token: %w", err)
	}

	// Build complete API key and display it
	completeAPIKey := fmt.Sprintf("sk-ac-%s", rootAPIBearerToken)
	// Use ANSI color codes: \033[1m = bold, \033[93m = bright yellow, \033[0m = reset
	fmt.Printf("  🔑 \033[1m\033[93mACONTEXT_API_KEY=\"%s\"\033[0m\n", completeAPIKey)

	// Prompt for Core Config YAML File (optional)
	var coreConfigYAMLFile string
	if err := survey.AskOne(&survey.Input{
		Message: "5. Configure Acontext by passing an existing config.yaml (optional):",
		Default: "./config.yaml",
		Help:    "Path to config.yaml file. Leave empty to use env vars only.",
	}, &coreConfigYAMLFile); err != nil {
		return nil, fmt.Errorf("failed to get Core Config YAML File: %w", err)
	}

	// Convert to absolute path if provided
	if coreConfigYAMLFile != "" {
		absPath, err := filepath.Abs(coreConfigYAMLFile)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve config file path: %w", err)
		}
		coreConfigYAMLFile = absPath

		// Check if file exists (just for user feedback, not required)
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			fmt.Printf("⚠️  Note: Config file does not exist yet: %s\n", absPath)
			fmt.Println("   The core service will use environment variables for configuration.")
		} else {
			fmt.Printf("✅ Using config file: %s\n", absPath)
		}
	}

	fmt.Println()
	fmt.Println("✅ Configuration saved!")

	return &docker.EnvConfig{
		LLMConfig: &docker.LLMConfig{
			APIKey:  llmAPIKey,
			BaseURL: llmBaseURL,
			SDK:     llmSDK,
		},
		RootAPIBearerToken: rootAPIBearerToken,
		CoreConfigYAMLFile: coreConfigYAMLFile,
	}, nil
}
