package cmd

import (
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

func init() {
	pingCmd := &cobra.Command{
		Use:   "ping",
		Short: "Check connectivity to the Acontext API",
		Long:  "Verifies that the current project's API key is valid and the API is reachable.",
		RunE: func(cmd *cobra.Command, args []string) error {
			client, err := requireClient()
			if err != nil {
				return err
			}

			if err := client.Ping(cmd.Context()); err != nil {
				if dashJSON {
					return output.RenderJSON(map[string]interface{}{
						"status":  "error",
						"project": dashProject,
						"error":   err.Error(),
					})
				}
				fmt.Printf("Ping failed for project %s: %v\n", dashProject, err)
				fmt.Println()
				fmt.Println("To fix this, re-select your project with a valid API key:")
				fmt.Printf("  acontext dash projects select --project %s --api-key <sk-ac-...>\n", dashProject)
				fmt.Println()
				fmt.Println("The API key can be found on the Acontext Dashboard:")
				fmt.Println("  https://dash.acontext.io")
				return fmt.Errorf("ping failed")
			}

			if dashJSON {
				return output.RenderJSON(map[string]interface{}{
					"status":  "ok",
					"project": dashProject,
				})
			}

			fmt.Println(tui.RenderSuccess(fmt.Sprintf("Project %s is reachable. Setup complete.", dashProject)))
			return nil
		},
	}

	DashCmd.AddCommand(pingCmd)
}
