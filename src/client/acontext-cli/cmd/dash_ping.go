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
				return fmt.Errorf("no project selected\n\nTo fix this, run:\n  acontext dash projects select")
			}

			ks, err := auth.LoadKeyStore()
			if err != nil {
				return fmt.Errorf("failed to load credentials: %w", err)
			}
			if ks.Keys[dashProject] == "" {
				return fmt.Errorf("no API key found in credentials.json for project %s\n\nTo fix this, run:\n  acontext dash projects select --project %s --api-key <sk-ac-...>\n\nThe API key can be found on the Acontext Dashboard:\n  https://dash.acontext.io", dashProject, dashProject)
			}

			// 2. Check API connectivity
			client, err := requireClient()
			if err != nil {
				return err
			}

			if err := client.Ping(cmd.Context()); err != nil {
				fmt.Printf("Ping failed for project %s: %v\n", dashProject, err)
				fmt.Println()
				fmt.Println("To fix this, re-select your project with a valid API key:")
				fmt.Printf("  acontext dash projects select --project %s --api-key <sk-ac-...>\n", dashProject)
				fmt.Println()
				fmt.Println("The API key can be found on the Acontext Dashboard:")
				fmt.Println("  https://dash.acontext.io")
				return fmt.Errorf("ping failed")
			}

			fmt.Println(tui.RenderSuccess(fmt.Sprintf("Project %s is reachable. Setup complete.", dashProject)))
			return nil
		},
	}

	DashCmd.AddCommand(pingCmd)
}
