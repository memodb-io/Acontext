package cmd

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/memodb-io/Acontext/acontext-cli/internal/version"
	"github.com/spf13/cobra"
)

var upgradeYes bool

var UpgradeCmd = &cobra.Command{
	Use:   "upgrade",
	Short: "Upgrade Acontext CLI to the latest version",
	Long: `Upgrade Acontext CLI to the latest version.

This command downloads and installs the latest version of Acontext CLI
by executing the installation script from install.acontext.io.

The upgrade process:
  1. Checks for the latest available version
  2. Downloads the installation script
  3. Executes the script to upgrade the CLI

Note: This command requires sudo privileges on most systems.
`,
	RunE: runUpgrade,
}

func init() {
	UpgradeCmd.Flags().BoolVarP(&upgradeYes, "yes", "y", false, "Skip upgrade confirmation prompt")
}

// VersionKey is the context key for storing version
type VersionKey string

const versionKey VersionKey = "version"

// SetVersion sets the version in the command context
func SetVersion(cmd *cobra.Command, v string) {
	ctx := cmd.Context()
	if ctx == nil {
		ctx = cmd.Root().Context()
	}
	ctx = context.WithValue(ctx, versionKey, v)
	cmd.SetContext(ctx)
}

// GetVersion gets the version from the command context
func GetVersion(cmd *cobra.Command) string {
	ctx := cmd.Context()
	if ctx == nil {
		ctx = cmd.Root().Context()
	}
	if v, ok := ctx.Value(versionKey).(string); ok {
		return v
	}
	// Fallback: try to get from binary
	return getCurrentVersionFallback()
}

func runUpgrade(cmd *cobra.Command, args []string) error {
	currentVersion := GetVersion(cmd)

	var hasUpdate bool
	var latestVersion string
	var checkErr error

	// Use spinner while checking for updates
	_, err := tui.RunSpinner("Checking for updates", func() (string, error) {
		hasUpdate, latestVersion, checkErr = version.IsUpdateAvailable(currentVersion)
		if checkErr != nil {
			return "", checkErr
		}
		if hasUpdate {
			return fmt.Sprintf("New version available: %s", latestVersion), nil
		}
		return fmt.Sprintf("Already on latest version: %s", currentVersion), nil
	})

	if err != nil {
		return fmt.Errorf("failed to check for updates: %w", err)
	}
	if checkErr != nil {
		return fmt.Errorf("failed to check for updates: %w", checkErr)
	}

	if !hasUpdate {
		fmt.Printf("\n%s You are already using the latest version: %s\n",
			tui.SuccessStyle.Render(tui.IconSuccess),
			tui.SubtitleStyle.Render(currentVersion))
		return nil
	}

	fmt.Println()
	fmt.Printf("%s New version available: %s %s %s\n",
		tui.IconPackage,
		tui.SubtitleStyle.Render(latestVersion),
		tui.MutedStyle.Render("(current:"),
		tui.MutedStyle.Render(currentVersion+")"))
	fmt.Println()

	// Ask for confirmation
	if !upgradeYes {
		if !tui.IsTTY() {
			return fmt.Errorf("use --yes to confirm upgrade in non-interactive mode")
		}
		proceed, err := tui.RunConfirm("Would you like to upgrade now?", true)
		if err != nil || !proceed {
			fmt.Printf("\n%s Upgrade cancelled\n", tui.IconSkip)
			return nil
		}
	}

	fmt.Println()
	fmt.Printf("%s Starting upgrade...\n", tui.IconRocket)
	fmt.Println()

	// Execute the installation script
	installScriptURL := "https://install.acontext.io"
	if err := executeInstallScript(installScriptURL); err != nil {
		return fmt.Errorf("upgrade failed: %w", err)
	}

	fmt.Println()
	fmt.Printf("%s Upgrade complete!\n", tui.IconDone)
	fmt.Printf("   Run %s to verify the new version\n", tui.MutedStyle.Render("acontext version"))

	return nil
}

// getCurrentVersionFallback gets the current version by executing the version command
// This is a fallback method when version is not available in context
func getCurrentVersionFallback() string {
	// Try to get version from the binary itself
	versionCmd := exec.Command("acontext", "version")
	output, err := versionCmd.Output()
	if err != nil {
		return "unknown"
	}

	// Parse output: "Acontext CLI version v0.0.1"
	versionStr := string(output)
	if idx := strings.Index(versionStr, "version "); idx != -1 {
		versionStr = versionStr[idx+8:]
		versionStr = strings.TrimSpace(versionStr)
		return versionStr
	}

	return "unknown"
}

// executeInstallScript downloads and executes the installation script
func executeInstallScript(url string) error {
	// Determine the command to use (curl or wget)
	var cmd *exec.Cmd

	if hasCommand("curl") {
		// Use curl to download and pipe to sh
		cmd = exec.Command("sh", "-c", fmt.Sprintf("curl -fsSL %s | sh", url))
	} else if hasCommand("wget") {
		// Use wget to download and pipe to sh
		cmd = exec.Command("sh", "-c", fmt.Sprintf("wget -qO- %s | sh", url))
	} else {
		return fmt.Errorf("neither curl nor wget is available. Please install one of them to proceed")
	}

	// Set up command to run in foreground with output
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	// Execute the command
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("installation script failed: %w", err)
	}

	return nil
}

// hasCommand checks if a command is available in PATH
func hasCommand(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}
