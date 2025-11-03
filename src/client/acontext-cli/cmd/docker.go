package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
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
			fmt.Println()
			showServiceInfo(projectDir, composeFile)
		}
	} else {
		fmt.Println("✅ Services started (press Ctrl+C to stop)")
		fmt.Println()
		showServiceInfo(projectDir, composeFile)
		fmt.Println("💡 Tip: Use 'acontext docker up -d' to run services in the background")
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

func showServiceInfo(projectDir string, composeFile string) {
	portsMap, err := docker.GetServicePorts(projectDir, composeFile)
	if err != nil {
		// Fallback to default values if query fails
		fmt.Println("📝 Access your services:")
		fmt.Println("   - PostgreSQL: localhost:5432")
		fmt.Println("   - Redis: localhost:6379")
		fmt.Println("   - RabbitMQ UI: http://localhost:15672")
		fmt.Println("   - SeaweedFS Console: http://localhost:9001")
		fmt.Println()
		return
	}

	fmt.Println("📝 Access your services:")

	// Service name mappings to display names
	serviceLabels := map[string]string{
		"acontext-server-pg":        "PostgreSQL",
		"acontext-server-redis":     "Redis",
		"acontext-server-rabbitmq":  "RabbitMQ",
		"acontext-server-seaweedfs": "SeaweedFS",
	}

	// Extract and display port information
	for serviceName, ports := range portsMap {
		if ports == "" {
			continue
		}
		displayName := serviceLabels[serviceName]
		if displayName == "" {
			displayName = serviceName
		}

		// Parse ports: format is like "0.0.0.0:5432->5432/tcp" or "0.0.0.0:5432->5432/tcp, 0.0.0.0:15672->15672/tcp"
		portList := strings.Split(ports, ", ")
		for _, portStr := range portList {
			// Extract host port (before ->)
			if strings.Contains(portStr, "->") {
				parts := strings.Split(portStr, "->")
				if len(parts) > 0 {
					hostPort := parts[0]
					// Extract just the port number (after last :)
					if idx := strings.LastIndex(hostPort, ":"); idx >= 0 {
						port := hostPort[idx+1:]
						if strings.Contains(portStr, "/tcp") || strings.Contains(portStr, "/udp") {
							if strings.Contains(displayName, "RabbitMQ") && strings.Contains(portStr, "15672") {
								fmt.Printf("   - %s UI: http://localhost:%s\n", displayName, port)
							} else if strings.Contains(displayName, "SeaweedFS") && strings.Contains(portStr, "8888") {
								fmt.Printf("   - %s Console: http://localhost:%s\n", displayName, port)
							} else if displayName == "PostgreSQL" || displayName == "Redis" {
								fmt.Printf("   - %s: localhost:%s\n", displayName, port)
							} else {
								fmt.Printf("   - %s: localhost:%s\n", displayName, port)
							}
						}
					}
				}
			}
		}
	}
	fmt.Println()
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

	// Prompt for Root API Bearer Token (with default)
	var rootAPIBearerToken string
	rootTokenPrompt := &survey.Input{
		Message: "4. Enter Root API Bearer Token:",
		Default: "your-root-api-bearer-token",
		Help:    "This token is used for root API access (e.g., for creating projects)",
	}
	if err := survey.AskOne(rootTokenPrompt, &rootAPIBearerToken); err != nil {
		return nil, fmt.Errorf("failed to get Root API Bearer Token: %w", err)
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
	}, nil
}
