package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
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
	LoginCmd.Flags().String("wait", "", "Internal: run as background callback listener (<port> <state>)")
	LoginCmd.Flags().MarkHidden("wait")
}

func runLogin(cmd *cobra.Command, args []string) error {
	// Hidden --wait flag: run as background callback listener.
	// Usage: acontext login --wait <port> <state>
	waitFlag, _ := cmd.Flags().GetString("wait")
	if waitFlag != "" {
		// waitFlag is the port; the state is the next positional arg.
		if len(args) < 1 {
			return fmt.Errorf("--wait requires port and state arguments")
		}
		return auth.LoginWaitForCallback(waitFlag, args[0])
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

		// Project selection
		fmt.Println()
		adminClient := api.NewAdminClient("", af.AccessToken)
		choice, err := auth.SelectProject(af.AccessToken, af.User.ID)
		if errors.Is(err, auth.ErrNoProjects) {
			// Offer to create a project
			fmt.Println(tui.RenderWarning("No projects found."))
			proceed, confirmErr := tui.RunConfirm("Create a new project?", true)
			if confirmErr != nil || !proceed {
				fmt.Println(tui.RenderInfo("You can create a project later with 'acontext dash projects create --name <name>'"))
				return nil
			}

			// Pick or create org
			orgs, orgErr := auth.ListOrganizations(af.AccessToken, af.User.ID)
			if orgErr != nil {
				return fmt.Errorf("fetch organizations: %w", orgErr)
			}
			var orgID, orgName string
			if len(orgs) == 0 {
				orgName, _ = tui.RunInput("Organization name:", "My Organization", "")
				if orgName == "" {
					return nil
				}
				newOrgID, createErr := auth.CreateOrganization(af.AccessToken, orgName)
				if createErr != nil {
					return fmt.Errorf("create organization: %w", createErr)
				}
				orgID = newOrgID
				fmt.Println(tui.RenderSuccess(fmt.Sprintf("Organization created: %s", orgName)))
			} else if len(orgs) == 1 {
				orgID = orgs[0].ID
				orgName = orgs[0].Name
			} else {
				options := make([]tui.SelectOption, len(orgs))
				for i, o := range orgs {
					options[i] = tui.SelectOption{Label: o.Name, Value: o.ID}
				}
				selectedLabel, selectedValue, selectErr := tui.RunSelectWithLabel("Select organization:", options)
				if selectErr != nil {
					return selectErr
				}
				orgID = selectedValue
				orgName = selectedLabel
			}
			_ = orgName

			projectName, inputErr := tui.RunInput("Project name:", "my-project", "")
			if inputErr != nil || projectName == "" {
				return nil
			}
			project, createErr := adminClient.AdminCreateProject(cmd.Context(), &api.CreateProjectRequest{Name: projectName})
			if createErr != nil {
				return fmt.Errorf("create project: %w", createErr)
			}
			if linkErr := auth.LinkProjectToOrg(af.AccessToken, orgID, projectName, project.ID); linkErr != nil {
				return fmt.Errorf("link project to organization: %w", linkErr)
			}
			fmt.Println(tui.RenderSuccess(fmt.Sprintf("Project created: %s (%s)", projectName, project.ID)))
			if project.SecretKey != "" {
				if err := auth.SetProjectKey(project.ID, project.SecretKey); err == nil {
					auth.SetDefaultProject(project.ID)
					fmt.Println(tui.RenderSuccess(fmt.Sprintf("Default project set to: %s", projectName)))
					fmt.Println(tui.RenderInfo("API key saved locally."))
				}
			}
			return nil
		} else if err != nil {
			fmt.Println(tui.RenderWarning(fmt.Sprintf("Could not select project: %v", err)))
			fmt.Println(tui.RenderInfo("You can select a project later with 'acontext dash projects select'"))
			return nil
		}

		if err := auth.SaveProjectKey(choice.ProjectID, adminClient); err != nil {
			fmt.Println(tui.RenderWarning(fmt.Sprintf("Could not save API key: %v", err)))
			fmt.Println(tui.RenderInfo("You can set up the project later with 'acontext dash projects select'"))
			return nil
		}
		fmt.Println(tui.RenderSuccess(fmt.Sprintf("Default project set to: %s", choice.Name)))
		fmt.Println(tui.RenderInfo("API key saved locally."))
	} else {
		// Non-interactive (agent) mode: background listener, return URL immediately
		loginURL, err := auth.LoginStartBackground()
		if err != nil {
			return fmt.Errorf("login failed: %w", err)
		}
		fmt.Println()
		fmt.Println("ACTION REQUIRED: Show the following login URL to the user and ask them to open it in their browser:")
		fmt.Println()
		fmt.Printf("  %s\n", loginURL)
		fmt.Println()
		fmt.Println("A background listener is waiting for the callback (60s timeout).")
		fmt.Println()
		fmt.Println("Next steps after the user completes login:")
		fmt.Println("  1. Run 'acontext dash projects list --json' to see available projects.")
		fmt.Println("  2. If projects exist, show them to the user as a numbered table")
		fmt.Println("     (# | org_name | name | project_id) and ask which one to use.")
		fmt.Println("     Then run:")
		fmt.Println("       acontext dash projects select --project <project-id>")
		fmt.Println("  3. If the list is empty, ask the user for an org name and project name,")
		fmt.Println("     then run:")
		fmt.Println("       acontext dash projects create --name <project-name> --org <org-id>")
		fmt.Println("     If no orgs exist either, the user must create one at https://dash.acontext.io first.")
		fmt.Println("     The create output includes project_id and secret_key, auto-saved as default.")
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
