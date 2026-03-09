package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	projectsCmd := &cobra.Command{Use: "projects", Short: "Manage projects (requires login)"}

	// List projects via Supabase PostgREST (org → projects)
	listCmd := &cobra.Command{
		Use: "list", Short: "List your organizations and projects",
		RunE: func(cmd *cobra.Command, args []string) error {
			orgs, err := auth.ListOrganizations(dashAccessToken, dashUserID)
			if err != nil {
				return fmt.Errorf("fetch organizations: %w", err)
			}
			if len(orgs) == 0 {
				fmt.Println("No organizations found.")
				return nil
			}

			// Load key store to show which projects have local keys
			ks, _ := auth.LoadKeyStore()

			for _, org := range orgs {
				fmt.Printf("Organization: %s (%s)\n", org.Name, org.ID)

				projects, err := auth.ListProjects(dashAccessToken, org.ID)
				if err != nil {
					fmt.Printf("  Error fetching projects: %v\n", err)
					continue
				}
				if len(projects) == 0 {
					fmt.Println("  No projects")
					continue
				}

				if dashJSON {
					return output.RenderJSON(projects)
				}

				rows := make([][]string, len(projects))
				for i, p := range projects {
					hasKey := ""
					if ks != nil && ks.Keys[p.ProjectID] != "" {
						hasKey = "yes"
					}
					isDefault := ""
					if ks != nil && ks.DefaultProject == p.ProjectID {
						isDefault = "*"
					}
					rows[i] = []string{p.ProjectID, p.Name, hasKey, isDefault, p.CreatedAt}
				}
				output.RenderTable([]string{"ID", "NAME", "HAS_KEY", "DEFAULT", "CREATED_AT"}, rows)
				fmt.Println()
			}
			return nil
		},
	}

	// Save an API key for a project
	setKeyCmd := &cobra.Command{
		Use: "set-key <project-id> <api-key>", Short: "Save an API key for a project locally",
		Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			projectID := args[0]
			apiKey := args[1]

			if !strings.HasPrefix(apiKey, "sk-ac-") {
				return fmt.Errorf("invalid API key format — keys start with 'sk-ac-'")
			}

			if err := auth.SetProjectKey(projectID, apiKey); err != nil {
				return fmt.Errorf("save key: %w", err)
			}

			// Set as default if no default yet
			ks, _ := auth.LoadKeyStore()
			if ks != nil && ks.DefaultProject == "" {
				auth.SetDefaultProject(projectID)
				fmt.Printf("API key saved for project %s (set as default)\n", projectID)
			} else {
				fmt.Printf("API key saved for project %s\n", projectID)
			}

			setDefault, _ := cmd.Flags().GetBool("default")
			if setDefault {
				auth.SetDefaultProject(projectID)
				fmt.Printf("Set as default project\n")
			}
			return nil
		},
	}
	setKeyCmd.Flags().Bool("default", false, "Set as default project")

	// Create a project via admin API
	createCmd := &cobra.Command{
		Use: "create", Short: "Create a new project",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			project, err := dashAdminClient.AdminCreateProject(context.Background(), &api.CreateProjectRequest{Name: name})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(project)
			}
			fmt.Printf("Project created: %s\n", project.ID)

			// Auto-save API key if returned
			if project.SecretKey != "" {
				fmt.Printf("API Key: %s\n", project.SecretKey)
				if err := auth.SetProjectKey(project.ID, project.SecretKey); err == nil {
					fmt.Println("API key saved locally.")
				}
				// Set as default if first project
				ks, _ := auth.LoadKeyStore()
				if ks != nil && (ks.DefaultProject == "" || len(ks.Keys) == 1) {
					auth.SetDefaultProject(project.ID)
					fmt.Println("Set as default project.")
				}
			}
			return nil
		},
	}
	createCmd.Flags().String("name", "", "Project name")
	createCmd.MarkFlagRequired("name")

	// Delete a project
	deleteCmd := &cobra.Command{
		Use: "delete <project-id>", Short: "Delete a project", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := dashAdminClient.AdminDeleteProject(context.Background(), args[0]); err != nil {
				return err
			}
			// Clean up local key
			auth.RemoveProjectKey(args[0])
			fmt.Printf("Project deleted: %s\n", args[0])
			return nil
		},
	}

	// Project stats
	statsCmd := &cobra.Command{
		Use: "stats <project-id>", Short: "Show project statistics", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			stats, err := dashAdminClient.AdminGetProjectStats(context.Background(), args[0])
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(stats)
			}
			fmt.Printf("Sessions:  %d\n", stats.SessionCount)
			fmt.Printf("Messages:  %d\n", stats.MessageCount)
			fmt.Printf("Disks:     %d\n", stats.DiskCount)
			fmt.Printf("Skills:    %d\n", stats.SkillCount)
			fmt.Printf("Users:     %d\n", stats.UserCount)
			return nil
		},
	}

	// Rotate key + auto-save
	rotateKeyCmd := &cobra.Command{
		Use: "rotate-key <project-id>", Short: "Rotate API key and save locally", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			projectID := args[0]
			project, err := dashAdminClient.AdminRotateKey(context.Background(), projectID)
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(project)
			}
			if project.SecretKey != "" {
				fmt.Printf("New API Key: %s\n", project.SecretKey)
				if err := auth.SetProjectKey(projectID, project.SecretKey); err == nil {
					fmt.Println("API key saved locally. The old key is now invalid.")
				}
			} else {
				fmt.Println("Key rotated successfully.")
			}
			return nil
		},
	}

	// Set default project
	useCmd := &cobra.Command{
		Use: "use <project-id>", Short: "Set the default project", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := auth.SetDefaultProject(args[0]); err != nil {
				return err
			}
			fmt.Printf("Default project set to: %s\n", args[0])
			return nil
		},
	}

	projectsCmd.AddCommand(listCmd, setKeyCmd, createCmd, deleteCmd, statsCmd, rotateKeyCmd, useCmd)
	DashCmd.AddCommand(projectsCmd)
}
