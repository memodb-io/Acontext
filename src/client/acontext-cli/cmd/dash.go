package cmd

import (
	"fmt"
	"os"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/spf13/cobra"
)

var (
	dashAPIKey  string
	dashProject string
	dashJSON    bool
	dashBaseURL string
)

// Resolved at PersistentPreRunE time
var (
	dashClient      *api.Client
	dashAdminClient *api.Client
	dashUserEmail   string
	dashUserID      string
	dashAccessToken string
)

// DashCmd is the parent command for all dashboard operations.
var DashCmd = &cobra.Command{
	Use:   "dash",
	Short: "Dashboard operations — manage projects, sessions, skills, and more",
	Long:  "Interact with the Acontext Dashboard API. Requires login (run 'acontext login' first).",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Inherit parent persistent pre-run hooks (telemetry, etc.)
		if parentE := cmd.Root().PersistentPreRunE; parentE != nil {
			if err := parentE(cmd, args); err != nil {
				return err
			}
		} else if parent := cmd.Root().PersistentPreRun; parent != nil {
			parent(cmd, args)
		}

		// 1. Require login
		af, err := auth.Load()
		if err != nil || af == nil {
			return fmt.Errorf("not logged in — run 'acontext login' first")
		}
		if af.IsExpired() {
			af, err = auth.RefreshIfNeeded(af)
			if err != nil {
				return fmt.Errorf("session expired — run 'acontext login' again")
			}
		}
		dashUserEmail = af.User.Email
		dashUserID = af.User.ID
		dashAccessToken = af.AccessToken

		// 2. Admin client always available (JWT only)
		dashAdminClient = api.NewAdminClient(dashBaseURL, af.AccessToken)

		// 3. Resolve API key for /api/v1 routes
		apiKey := dashAPIKey
		if apiKey == "" {
			apiKey = os.Getenv("ACONTEXT_API_KEY")
		}
		if apiKey == "" && dashProject != "" {
			apiKey = auth.GetProjectKey(dashProject)
		}
		if apiKey == "" {
			// Try default project
			ks, _ := auth.LoadKeyStore()
			if ks != nil && ks.DefaultProject != "" {
				apiKey = ks.Keys[ks.DefaultProject]
				if dashProject == "" {
					dashProject = ks.DefaultProject
				}
			}
		}

		if apiKey != "" {
			dashClient = api.NewClient(dashBaseURL, apiKey, af.AccessToken)
		}

		return nil
	},
}

func init() {
	DashCmd.PersistentFlags().StringVar(&dashAPIKey, "api-key", "", "Project API key (or set ACONTEXT_API_KEY)")
	DashCmd.PersistentFlags().StringVar(&dashProject, "project", "", "Project ID to use")
	DashCmd.PersistentFlags().BoolVar(&dashJSON, "json", false, "Output as JSON")
	DashCmd.PersistentFlags().StringVar(&dashBaseURL, "base-url", "", "API base URL override")
}

// requireClient returns the public API client, or a helpful error if no API key was resolved.
func requireClient() (*api.Client, error) {
	if dashClient == nil {
		if dashProject != "" {
			return nil, fmt.Errorf("no API key found for project %s\n\nTo fix this, run:\n  acontext dash projects select --project %s", dashProject, dashProject)
		}
		return nil, fmt.Errorf("no project selected and no API key available\n\nTo fix this, run:\n  acontext login                        (login and select a project)\n  acontext dash projects select         (select a project interactively)\n  acontext dash projects list           (see your projects)")
	}
	return dashClient, nil
}
