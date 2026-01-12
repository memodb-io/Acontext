package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/memodb-io/Acontext/acontext-cli/cmd"
	"github.com/memodb-io/Acontext/acontext-cli/internal/logo"
	"github.com/memodb-io/Acontext/acontext-cli/internal/telemetry"
	"github.com/memodb-io/Acontext/acontext-cli/internal/version"
	"github.com/spf13/cobra"
)

type contextKey string

const startTimeKey contextKey = "start_time"

var cliVersion = "dev"

// GetVersion returns the current CLI version
func GetVersion() string {
	return cliVersion
}

func main() {
	// Print logo on first run (skip for help commands and root command)
	shouldSkipLogo := false

	// Check if running root command (no subcommand)
	if len(os.Args) == 1 {
		// No arguments - will execute rootCmd.Run, which prints logo
		shouldSkipLogo = true
	} else if len(os.Args) > 1 {
		firstArg := os.Args[1]
		// Skip logo for help flags
		if firstArg == "--help" || firstArg == "-h" {
			shouldSkipLogo = true
		}
		// Skip logo for "--" followed by "help" (e.g., "acontext -- help")
		if firstArg == "--" && len(os.Args) > 2 && os.Args[2] == "help" {
			shouldSkipLogo = true
		}
		// Skip logo for "help" command
		if firstArg == "help" {
			shouldSkipLogo = true
		}
		// Skip logo if executing root command (first arg is not a known subcommand)
		knownSubcommands := []string{"create", "docker", "version", "upgrade", "help"}
		isSubcommand := false
		for _, subcmd := range knownSubcommands {
			if firstArg == subcmd {
				isSubcommand = true
				break
			}
		}
		if !isSubcommand {
			// Not a known subcommand, will execute rootCmd.Run which prints logo
			shouldSkipLogo = true
		}
	}

	if !shouldSkipLogo {
		fmt.Println(logo.Logo)
	}

	if cmdErr := rootCmd.Execute(); cmdErr != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", cmdErr)
		executedCmd, _, _ := rootCmd.Find(os.Args[1:])
		if executedCmd == nil {
			executedCmd = rootCmd
		}
		trackCommandAndWait(executedCmd, cmdErr, false)
		os.Exit(1)
	}
}

// trackCommandAndWait tracks a command execution asynchronously and waits for completion
func trackCommandAndWait(cmd *cobra.Command, err error, success bool) {
	// Skip telemetry for dev version
	if cliVersion == "dev" {
		return
	}

	// Get start time from context and calculate duration
	var duration time.Duration
	if success {
		startTime, ok := cmd.Context().Value(startTimeKey).(time.Time)
		if !ok {
			startTime = time.Now()
		}
		duration = time.Since(startTime)
	}

	// Build command path
	commandPath := buildCommandPath(cmd)

	// Start async telemetry tracking and wait for completion
	// This ensures telemetry is sent even for blocking commands
	wg := telemetry.TrackCommandAsync(
		commandPath,
		success,
		err,
		duration,
		cliVersion,
	)

	// Wait for telemetry to complete (with timeout to avoid hanging forever)
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	// Wait up to 5 seconds for telemetry to complete
	select {
	case <-done:
		// Telemetry completed successfully
	case <-time.After(5 * time.Second):
		// Timeout - don't block forever
	}
}

// buildCommandPath builds the full command path (e.g., "docker.up", "create")
func buildCommandPath(cmd *cobra.Command) string {
	var parts []string

	// Walk up the command tree
	current := cmd
	for current != nil && current.Use != "acontext" {
		parts = append([]string{current.Use}, parts...)
		current = current.Parent()
	}

	if len(parts) == 0 {
		return "root"
	}

	return strings.Join(parts, ".")
}

var rootCmd = &cobra.Command{
	Use:   "acontext",
	Short: "Acontext CLI - Build context-aware AI applications",
	Long: `Acontext CLI is a command-line tool for quickly creating Acontext projects.
	
It helps you:
  - Create projects with templates for Python or TypeScript
  - Initialize Git repositories
  - Deploy local development environments with Docker

Get started by running: acontext create
`,
	PersistentPreRun: func(c *cobra.Command, args []string) {
		// Store start time for telemetry
		ctx := context.WithValue(c.Context(), startTimeKey, time.Now())
		c.SetContext(ctx)
		// Store version in context for upgrade command
		cmd.SetVersion(c, cliVersion)
	},
	PersistentPostRunE: func(c *cobra.Command, args []string) error {
		// Track successful command execution
		// This is called after the command's Run/RunE completes successfully
		trackCommandAndWait(c, nil, true)

		// Check for updates (skip for version and upgrade commands, and dev version)
		if c.Use != "version" && c.Use != "upgrade" && cliVersion != "dev" {
			checkUpdateAsync()
		}
		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(logo.Logo)
		fmt.Println()
		fmt.Println("Welcome to Acontext CLI!")
		fmt.Println()
		fmt.Println("Quick Commands:")
		fmt.Println("  acontext create     Create a new project")
		fmt.Println("  acontext docker     Manage Docker services (up/down/status/logs/env)")
		fmt.Println("  acontext version    Show version information")
		fmt.Println("  acontext upgrade    Upgrade to the latest version")
		fmt.Println("  acontext help       Show help information")
		fmt.Println()
		fmt.Println("Get started: acontext create")
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(cmd.CreateCmd)
	rootCmd.AddCommand(cmd.DockerCmd)
	rootCmd.AddCommand(cmd.UpgradeCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Acontext CLI version %s\n", cliVersion)
		// Check for updates when version command is run
		if cliVersion != "dev" {
			checkUpdateSync()
		}
	},
}

// checkUpdateAsync checks for updates asynchronously and prints a message if available
func checkUpdateAsync() {
	go func() {
		hasUpdate, latestVersion, err := version.IsUpdateAvailable(cliVersion)
		if err != nil {
			// Silently fail - don't annoy users with network errors
			return
		}
		if hasUpdate {
			fmt.Println()
			fmt.Printf("💡 A new version is available: %s (current: %s)\n", latestVersion, cliVersion)
			fmt.Println("   Run 'acontext upgrade' to update")
			fmt.Println()
		}
	}()
}

// checkUpdateSync checks for updates synchronously and prints a message if available
func checkUpdateSync() {
	hasUpdate, latestVersion, err := version.IsUpdateAvailable(cliVersion)
	if err != nil {
		// Silently fail for version command
		return
	}
	if hasUpdate {
		fmt.Printf("💡 A new version is available: %s\n", latestVersion)
		fmt.Println("   Run 'acontext upgrade' to update")
	}
}
