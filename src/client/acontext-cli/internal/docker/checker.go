package docker

import (
	"fmt"
	"os/exec"
)

// CheckDockerInstalled checks if Docker is installed and running
func CheckDockerInstalled() error {
	// Check if docker command is available
	if _, err := exec.LookPath("docker"); err != nil {
		return fmt.Errorf("docker is not installed. Please install Docker first")
	}

	// Check if Docker daemon is running
	cmd := exec.Command("docker", "info")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("docker daemon is not running. Please start Docker first")
	}

	// Check if docker compose command is available
	if _, err := exec.LookPath("docker"); err == nil {
		// Try docker compose version
		cmd = exec.Command("docker", "compose", "version")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("docker compose is not available. Please install Docker Compose V2")
		}
	}

	return nil
}
