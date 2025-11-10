package docker

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// RunDockerCompose directly executes docker compose command
// If composeFile is provided, use it as the compose file, otherwise use default docker-compose.yaml
func RunDockerCompose(projectDir string, composeFile string, args ...string) error {
	cmdArgs := []string{"compose"}
	if composeFile != "" {
		cmdArgs = append(cmdArgs, "-f", composeFile)
	}
	cmdArgs = append(cmdArgs, args...)
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = projectDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	return cmd.Run()
}

// Up starts Docker Compose services using a temporary compose file
// If detached is false, services run in foreground (no -d flag)
// If detached is true, services run in background (with -d flag)
func Up(projectDir string, composeFile string, detached bool) error {
	args := []string{"up"}
	if detached {
		args = append(args, "-d")
	}
	return RunDockerCompose(projectDir, composeFile, args...)
}

// Down stops Docker Compose services
func Down(projectDir string, composeFile string) error {
	return RunDockerCompose(projectDir, composeFile, "down")
}

// Status checks Docker Compose services status
func Status(projectDir string, composeFile string) error {
	return RunDockerCompose(projectDir, composeFile, "ps")
}

// Logs views Docker Compose services logs
func Logs(projectDir string, composeFile string, service string) error {
	args := []string{"logs", "-f"}
	if service != "" {
		args = append(args, service)
	}
	return RunDockerCompose(projectDir, composeFile, args...)
}

// WaitForHealth waits for services health check to pass
func WaitForHealth(projectDir string, composeFile string, timeout time.Duration) error {
	fmt.Println("⏳ Waiting for services to be healthy...")

	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	checkCount := 0
	for time.Now().Before(deadline) {
		checkCount++

		// Check critical services health status
		var cmdArgs []string
		if composeFile != "" {
			cmdArgs = []string{"compose", "-f", composeFile, "ps", "--format", "json"}
		} else {
			cmdArgs = []string{"compose", "ps", "--format", "json"}
		}
		cmd := exec.Command("docker", cmdArgs...)
		cmd.Dir = projectDir
		cmd.Stderr = nil // Hide error output
		output, err := cmd.Output()
		if err != nil {
			// If command fails, continue waiting
			select {
			case <-ticker.C:
				fmt.Print(".")
			case <-time.After(time.Until(deadline)):
				return fmt.Errorf("timeout waiting for services to start")
			}
			continue
		}

		// Check if there are running services
		if len(output) > 0 {
			// Check health status: use docker compose ps to view health status
			if composeFile != "" {
				cmdArgs = []string{"compose", "-f", composeFile, "ps", "--format", "{{.Service}}:{{.Status}}"}
			} else {
				cmdArgs = []string{"compose", "ps", "--format", "{{.Service}}:{{.Status}}"}
			}
			cmd = exec.Command("docker", cmdArgs...)
			cmd.Dir = projectDir
			cmd.Stderr = nil
			output, err = cmd.Output()
			if err == nil && len(output) > 0 {
				// Check if there are services running
				outputStr := string(output)
				if strings.Contains(outputStr, "Up") || strings.Contains(outputStr, "running") {
					// Wait a bit to ensure services are stable
					if checkCount >= 2 {
						fmt.Println()
						fmt.Println("✅ Services are running")
						return nil
					}
				}
			}
		}

		select {
		case <-ticker.C:
			if checkCount%10 == 0 {
				fmt.Print(".")
			}
		case <-time.After(time.Until(deadline)):
			return fmt.Errorf("timeout waiting for services to be healthy")
		}
	}

	fmt.Println()
	return fmt.Errorf("timeout waiting for services to be healthy")
}

//go:embed docker-compose.yaml
var dockerComposeContent string

// GetDockerComposeContent returns the predefined docker-compose content from embedded file
func GetDockerComposeContent() string {
	return dockerComposeContent
}

// CreateTempDockerCompose creates a temporary docker-compose file and returns its path
func CreateTempDockerCompose(projectDir string) (string, error) {
	tmpFile, err := os.CreateTemp(projectDir, ".docker-compose-*.yaml")
	if err != nil {
		return "", fmt.Errorf("failed to create temp file: %w", err)
	}
	defer func() {
		_ = tmpFile.Close()
	}()

	content := GetDockerComposeContent()
	if _, err := tmpFile.WriteString(content); err != nil {
		_ = os.Remove(tmpFile.Name())
		return "", fmt.Errorf("failed to write temp file: %w", err)
	}

	return tmpFile.Name(), nil
}

// ServiceInfo represents docker compose service information
type ServiceInfo struct {
	Service string `json:"Service"`
	State   string `json:"State"`
	Ports   string `json:"Ports"`
}

// GetServicePorts queries docker compose for service ports and returns a map of service name to ports
func GetServicePorts(projectDir string, composeFile string) (map[string]string, error) {
	cmdArgs := []string{"compose", "ps", "--format", "json"}
	if composeFile != "" {
		cmdArgs = []string{"compose", "-f", composeFile, "ps", "--format", "json"}
	}
	cmd := exec.Command("docker", cmdArgs...)
	cmd.Dir = projectDir
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	// Parse JSON output - each line is a JSON object
	portsMap := make(map[string]string)
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		var info ServiceInfo
		if err := json.Unmarshal([]byte(line), &info); err != nil {
			continue
		}
		if info.Service != "" && info.Ports != "" {
			portsMap[info.Service] = info.Ports
		}
	}

	return portsMap, nil
}
