package cmd

import (
	"context"
	"errors"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

// printSetupComplete prints the common message after a project is configured.
func printSetupComplete() {
	fmt.Println("API key saved to ~/.acontext/credentials.json")
	fmt.Println()
	fmt.Println("Verify connectivity:")
	fmt.Println("  acontext dash ping")
}

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

			var allProjects []auth.OrgProject
			for _, org := range orgs {
				projects, err := auth.ListProjects(dashAccessToken, org.ID)
				if err != nil {
					if !dashJSON {
						fmt.Printf("Organization: %s (%s)\n", org.Name, org.ID)
						fmt.Printf("  Error fetching projects: %v\n", err)
					}
					continue
				}

				// Attach org id and name to each project
				for i := range projects {
					projects[i].OrgID = org.ID
					projects[i].OrgName = org.Name
				}
				allProjects = append(allProjects, projects...)

				if !dashJSON {
					fmt.Printf("Organization: %s (%s)\n", org.Name, org.ID)
					if len(projects) == 0 {
						fmt.Println("  No projects")
						continue
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
			}

			if dashJSON {
				return output.RenderJSON(allProjects)
			}
			return nil
		},
	}

	// Select a project (interactive or via --project flag)
	selectCmd := &cobra.Command{
		Use:   "select",
		Short: "Select and configure a default project",
		Long:  "Interactively select a project, or use --project <id> for non-interactive mode. Generates and saves an API key locally.",
		RunE: func(cmd *cobra.Command, args []string) error {
			projectFlag, _ := cmd.Flags().GetString("project")
			apiKeyFlag, _ := cmd.Flags().GetString("api-key")
			rotateFlag, _ := cmd.Flags().GetBool("rotate")

			if projectFlag != "" {
				// Non-interactive mode: use the specified project directly

				// Option 1: API key provided directly via flag
				if apiKeyFlag != "" {
					if err := auth.SaveProjectKeyWithAPIKey(projectFlag, apiKeyFlag); err != nil {
						return fmt.Errorf("save project key: %w", err)
					}
					fmt.Printf("Default project set to: %s\n", projectFlag)
					printSetupComplete()
					return nil
				}

				// Option 2: Explicit rotate requested (TTY only)
				if rotateFlag {
					if !auth.IsTTY() {
						return fmt.Errorf("--rotate is not allowed in non-interactive mode (dangerous operation). Use --api-key instead")
					}
					fmt.Println("WARNING: Rotating API key. This will invalidate the current key for this project.")
					if err := auth.SaveProjectKeyRotate(projectFlag, dashAccessToken, dashUserEmail, dashAdminClient); err != nil {
						return fmt.Errorf("rotate project key: %w", err)
					}
					fmt.Printf("Default project set to: %s\n", projectFlag)
					fmt.Println("New API key generated.")
					printSetupComplete()
					return nil
				}

				// Option 3: Check if we already have a local key
				if err := auth.SaveProjectKey(projectFlag, dashAccessToken, dashUserEmail, dashAdminClient); err != nil {
					if errors.Is(err, auth.ErrNonTTYKeyRequired) {
						// Non-TTY and no local key: prompt agent to ask user for the API key
						fmt.Printf("No local API key found for project %s.\n", projectFlag)
						fmt.Println()
						fmt.Println("Please ask the user for the project's API key, then run:")
						fmt.Printf("  acontext dash projects select --project %s --api-key <sk-ac-...>\n", projectFlag)
						fmt.Println()
						fmt.Println("The API key can be found on the Acontext Dashboard:")
						fmt.Println("  https://dash.acontext.io")
						return nil
					}
					return fmt.Errorf("save project key: %w", err)
				}
				fmt.Printf("Default project set to: %s\n", projectFlag)
				printSetupComplete()
				return nil
			}

			// Interactive mode: prompt user to select
			choice, err := auth.SelectProject(dashAccessToken, dashUserID)
			if errors.Is(err, auth.ErrNoProjects) {
				fmt.Println("No projects found.")
				fmt.Println("Create one first with: acontext dash projects create --name <name> --org <org-id>")
				return nil
			}
			if err != nil {
				return err
			}

			if err := auth.SaveProjectKey(choice.ProjectID, dashAccessToken, dashUserEmail, dashAdminClient); err != nil {
				return fmt.Errorf("save project key: %w", err)
			}
			fmt.Println(tui.RenderSuccess(fmt.Sprintf("Default project set to: %s", choice.Name)))
			printSetupComplete()
			return nil
		},
	}
	selectCmd.Flags().String("project", "", "Project ID to select (non-interactive)")
	selectCmd.Flags().String("api-key", "", "Provide an existing API key directly (use with --project)")
	selectCmd.Flags().Bool("rotate", false, "Rotate and generate a new API key (WARNING: invalidates current key)")

	// Create a project via admin API + link to org
	createCmd := &cobra.Command{
		Use: "create", Short: "Create a new project",
		RunE: func(cmd *cobra.Command, args []string) error {
			name, _ := cmd.Flags().GetString("name")
			orgFlag, _ := cmd.Flags().GetString("org")

			// Resolve org
			orgID := orgFlag
			if orgID == "" {
				// List orgs and pick one (or create)
				orgs, err := auth.ListOrganizations(dashAccessToken, dashUserID)
				if err != nil {
					return fmt.Errorf("fetch organizations: %w", err)
				}
				if len(orgs) == 0 {
					// No orgs — need to create one
					if auth.IsTTY() {
						fmt.Println("No organizations found. Creating one first.")
						orgName, inputErr := tui.RunInput("Organization name:", "My Organization", "")
						if inputErr != nil || orgName == "" {
							return fmt.Errorf("organization name is required")
						}
						newOrgID, createErr := auth.CreateOrganization(dashAccessToken, orgName)
						if createErr != nil {
							return createErr
						}
						orgID = newOrgID
						fmt.Printf("Organization created: %s (%s)\n", orgName, orgID)
					} else {
						fmt.Println("No organizations found.")
						fmt.Println("Create one first at https://dash.acontext.io, then retry.")
						return nil
					}
				} else if len(orgs) == 1 {
					orgID = orgs[0].ID
				} else if auth.IsTTY() {
					options := make([]tui.SelectOption, len(orgs))
					for i, o := range orgs {
						options[i] = tui.SelectOption{Label: o.Name, Value: o.ID}
					}
					selected, err := tui.RunSelect("Select organization:", options)
					if err != nil {
						return err
					}
					orgID = selected
				} else {
					return fmt.Errorf("multiple organizations found — use --org <org-id> to specify")
				}
			}

			// 1. Create project via admin API
			project, err := dashAdminClient.AdminCreateProject(context.Background(), &api.CreateProjectRequest{Name: name})
			if err != nil {
				return err
			}

			// 2. Link project to org via Supabase RPC
			if err := auth.LinkProjectToOrg(dashAccessToken, orgID, name, project.ProjectID); err != nil {
				return fmt.Errorf("link project to organization: %w", err)
			}

			if dashJSON {
				return output.RenderJSON(project)
			}
			fmt.Printf("Project created: %s (%s)\n", name, project.ProjectID)

			// Auto-save API key and set as default
			if project.SecretKey != "" {
				if err := auth.SetProjectKey(project.ProjectID, project.SecretKey); err == nil {
					_ = auth.SetDefaultProject(project.ProjectID)
					fmt.Printf("Default project set to: %s\n", project.ProjectID)
					printSetupComplete()
				}
			}
			return nil
		},
	}
	createCmd.Flags().String("name", "", "Project name")
	createCmd.Flags().String("org", "", "Organization ID (auto-detected if only one)")
	_ = createCmd.MarkFlagRequired("name")

	// Delete a project
	deleteCmd := &cobra.Command{
		Use: "delete <project-id>", Short: "Delete a project", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			yes, _ := cmd.Flags().GetBool("yes")
			if !yes {
				if !auth.IsTTY() {
					return fmt.Errorf("use --yes to confirm deletion in non-interactive mode")
				}
				proceed, err := tui.RunConfirm(fmt.Sprintf("Delete project %s?", args[0]), false)
				if err != nil || !proceed {
					fmt.Println("Cancelled.")
					return nil
				}
			}
			if err := dashAdminClient.AdminDeleteProject(context.Background(), args[0]); err != nil {
				return err
			}
			// Clean up local key
			_ = auth.RemoveProjectKey(args[0])
			fmt.Printf("Project deleted: %s\n", args[0])
			return nil
		},
	}
	deleteCmd.Flags().BoolP("yes", "y", false, "Skip confirmation prompt")

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
			fmt.Printf("Tasks:     %d\n", stats.TaskCount)
			fmt.Printf("Skills:    %d\n", stats.SkillCount)
			return nil
		},
	}

	projectsCmd.AddCommand(listCmd, selectCmd, createCmd, deleteCmd, statsCmd)
	DashCmd.AddCommand(projectsCmd)
}
