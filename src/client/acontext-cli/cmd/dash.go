package cmd

import (
	"fmt"
	"sync"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/spf13/cobra"
)

var (
	dashAPIKey  string
	dashProject string
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

var adminOnce sync.Once
var adminErr error

// DashCmd is the parent command for all dashboard operations.
var DashCmd = &cobra.Command{
	Use:   "dash",
	Short: "Dashboard operations — manage projects, sessions, skills, and more",
	Long:  "Interact with the Acontext Dashboard API. Most commands require an API key; admin commands (projects) also require login.",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Inherit parent persistent pre-run hooks (telemetry, etc.)
		if parentE := cmd.Root().PersistentPreRunE; parentE != nil {
			if err := parentE(cmd, args); err != nil {
				return err
			}
		} else if parent := cmd.Root().PersistentPreRun; parent != nil {
			parent(cmd, args)
		}

		// Reset adminOnce for each command invocation
		adminOnce = sync.Once{}
		adminErr = nil

		// Resolve API key for /api/v1 routes: --api-key flag > --project flag > credentials.json default
		apiKey := dashAPIKey
		if apiKey == "" && dashProject != "" {
			apiKey = auth.GetProjectKey(dashProject)
		}
		if apiKey == "" {
			// Try default project from credentials.json
			ks, _ := auth.LoadKeyStore()
			if ks != nil && ks.DefaultProject != "" {
				apiKey = ks.Keys[ks.DefaultProject]
				if dashProject == "" {
					dashProject = ks.DefaultProject
				}
			}
		}

		if apiKey != "" {
			dashClient = api.NewClient(dashBaseURL, apiKey)
		}

		// Best-effort: populate user email from auth.json without token validation.
		// This ensures list/create commands scope to the correct user even when
		// full admin login is not required.
		if af, _ := auth.Load(); af != nil {
			dashUserEmail = af.User.Email
			dashUserID = af.User.ID
		}

		return nil
	},
}

func init() {
	DashCmd.PersistentFlags().StringVar(&dashAPIKey, "api-key", "", "Project API key (overrides credentials.json)")
	DashCmd.PersistentFlags().StringVar(&dashProject, "project", "", "Project ID to use")
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

// requireAdmin validates the Supabase login and creates the admin client.
// It is cached: multiple calls within the same command invocation are no-ops.
func requireAdmin() error {
	adminOnce.Do(func() {
		af, err := auth.Load()
		if err != nil || af == nil {
			adminErr = fmt.Errorf("not logged in — run 'acontext login' first")
			return
		}
		af, err = auth.ValidateAndRefresh(af)
		if err != nil {
			adminErr = fmt.Errorf("session invalid — run 'acontext login' again: %w", err)
			return
		}
		dashAccessToken = af.AccessToken
		dashUserEmail = af.User.Email
		dashUserID = af.User.ID
		dashAdminClient = api.NewAdminClient(dashBaseURL, af.AccessToken)
	})
	return adminErr
}
