package cmd

import (
	"fmt"
	"os"

	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

// LoginCmd handles `acontext login`.
var LoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Log in to Acontext Dashboard via browser",
	Long:  "Authenticate with the Acontext Dashboard using browser-based OAuth. Tokens are stored in ~/.acontext/auth.json.",
	RunE:  runLogin,
}

// LogoutCmd handles `acontext logout`.
var LogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Log out and clear stored credentials",
	RunE:  runLogout,
}

// WhoamiCmd handles `acontext whoami`.
var WhoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show the currently logged-in user",
	RunE:  runWhoami,
}

func init() {
	LoginCmd.Flags().String("wait", "", "Internal: run as background callback listener (state file path)")
	LoginCmd.Flags().MarkHidden("wait")
}

func runLogin(cmd *cobra.Command, args []string) error {
	// Hidden --wait flag: run as background callback listener
	waitFile, _ := cmd.Flags().GetString("wait")
	if waitFile != "" {
		return auth.LoginWaitForCallback(waitFile)
	}

	// Check if already logged in
	if auth.IsLoggedIn() {
		af, _ := auth.Load()
		if af != nil {
			if auth.IsTTY() {
				fmt.Printf("%s Already logged in as %s\n", tui.IconInfo, tui.SuccessStyle.Render(af.User.Email))
				proceed, err := tui.RunConfirm("Log in again?", false)
				if err != nil || !proceed {
					return nil
				}
			} else {
				fmt.Printf("Already logged in as %s\n", af.User.Email)
				return nil
			}
		}
	}

	if auth.IsTTY() {
		// Interactive mode: blocking flow with browser open
		af, err := auth.LoginInteractive()
		if err != nil {
			return fmt.Errorf("login failed: %w", err)
		}
		if err := auth.Save(af); err != nil {
			return fmt.Errorf("save auth: %w", err)
		}
		fmt.Println(tui.RenderSuccess(fmt.Sprintf("Logged in as %s", tui.SuccessStyle.Render(af.User.Email))))
	} else {
		// Non-interactive (agent) mode: background listener, return URL immediately
		loginURL, err := auth.LoginStartBackground()
		if err != nil {
			return fmt.Errorf("login failed: %w", err)
		}
		fmt.Println()
		fmt.Println("Please open the following URL in your browser to authenticate:")
		fmt.Println()
		fmt.Printf("  ➜  %s\n", loginURL)
		fmt.Println()
		fmt.Println("A background listener is waiting for the callback (60s timeout).")
		fmt.Println("After login, run 'acontext whoami' to verify.")
	}

	return nil
}

func runLogout(cmd *cobra.Command, args []string) error {
	if !auth.IsLoggedIn() {
		fmt.Println(tui.RenderInfo("Not currently logged in"))
		return nil
	}

	if err := auth.Clear(); err != nil {
		return fmt.Errorf("logout failed: %w", err)
	}

	fmt.Println(tui.RenderSuccess("Logged out successfully"))
	return nil
}

func runWhoami(cmd *cobra.Command, args []string) error {
	// Check ACONTEXT_API_TOKEN env var first (for CI/CD)
	if token := os.Getenv("ACONTEXT_API_TOKEN"); token != "" {
		fmt.Println(tui.RenderInfo("Authenticated via ACONTEXT_API_TOKEN environment variable"))
		return nil
	}

	af, err := auth.MustLoad()
	if err != nil {
		return err
	}

	// Refresh if needed
	af, err = auth.RefreshIfNeeded(af)
	if err != nil {
		return fmt.Errorf("token refresh failed: %w", err)
	}

	fmt.Printf("Logged in as %s\n", tui.SuccessStyle.Render(af.User.Email))
	fmt.Printf("User ID: %s\n", tui.MutedStyle.Render(af.User.ID))
	return nil
}
