package cmd

import (
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

func init() {
	pingCmd := &cobra.Command{
		Use:   "ping",
		Short: "Check connectivity to the Acontext API",
		Long:  "Verifies that the current project's API key is valid and the API is reachable.",
		RunE: func(cmd *cobra.Command, args []string) error {
			// 1. Verify that we have a local key for the resolved project
			if dashProject == "" {
				fmt.Println(tui.RenderWarning("No project selected"))
				fmt.Println("\nTo fix this, run:\n  acontext dash projects select")
				return nil
			}

			ks, err := auth.LoadKeyStore()
			if err != nil {
				return fmt.Errorf("failed to load credentials: %w", err)
			}
			if ks.Keys[dashProject] == "" {
				fmt.Println(tui.RenderWarning(fmt.Sprintf("No API key found in credentials.json for project %s", dashProject)))
				fmt.Printf("\nTo fix this, run:\n  acontext dash projects select --project %s --api-key <sk-ac-...>\n\nThe API key can be found on the Acontext Dashboard:\n  https://dash.acontext.io\n", dashProject)
				return nil
			}

			// 2. Check API connectivity
			client, err := requireClient()
			if err != nil {
				return err
			}

			if err := client.Ping(cmd.Context()); err != nil {
				fmt.Printf("Ping failed for project %s: %v\n", dashProject, err)
				fmt.Printf("Fix with: acontext dash projects select --project %s --api-key <sk-ac-...>\n", dashProject)
				return nil
			}

			fmt.Println(tui.RenderSuccess(fmt.Sprintf("Project %s is reachable. Setup complete.", dashProject)))
			return nil
		},
	}

	DashCmd.AddCommand(pingCmd)
}
