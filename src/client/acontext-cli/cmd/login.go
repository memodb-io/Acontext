package cmd

import (
	"errors"
	"fmt"

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
	LoginCmd.Flags().Bool("poll", false, "Poll for a pending login session (non-interactive)")
}

func runLogin(cmd *cobra.Command, args []string) error {
	// --poll flag: check for pending login
	pollFlag, _ := cmd.Flags().GetBool("poll")
	if pollFlag {
		if err := auth.LoginPoll(); err != nil {
			return err
		}
		af, _ := auth.Load()
		if af != nil {
			fmt.Printf("Login successful. Logged in as %s\n", af.User.Email)
			fmt.Println("Credentials saved to ~/.acontext/auth.json")
		}
		fmt.Println()
		fmt.Println("Next: set up a project. Run 'acontext dash projects list --json' to see available projects.")
		return nil
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
		// Interactive mode: blocking flow with browser open + polling
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
			if linkErr := auth.LinkProjectToOrg(af.AccessToken, orgID, projectName, project.ProjectID); linkErr != nil {
				return fmt.Errorf("link project to organization: %w", linkErr)
			}
			fmt.Println(tui.RenderSuccess(fmt.Sprintf("Project created: %s (%s)", projectName, project.ProjectID)))
			if project.SecretKey != "" {
				if err := auth.SetProjectKey(project.ProjectID, project.SecretKey); err == nil {
					_ = auth.SetDefaultProject(project.ProjectID)
					fmt.Println(tui.RenderSuccess(fmt.Sprintf("Default project set to: %s", projectName)))
					printSetupComplete()
				}
			}
			return nil
		} else if err != nil {
			fmt.Println(tui.RenderWarning(fmt.Sprintf("Could not select project: %v", err)))
			fmt.Println(tui.RenderInfo("You can select a project later with 'acontext dash projects select'"))
			return nil
		}

		if err := auth.SaveProjectKey(choice.ProjectID, af.AccessToken, af.User.Email, adminClient); err != nil {
			fmt.Println(tui.RenderWarning(fmt.Sprintf("Could not save API key: %v", err)))
			fmt.Println(tui.RenderInfo("You can set up the project later with 'acontext dash projects select'"))
			return nil
		}
		fmt.Println(tui.RenderSuccess(fmt.Sprintf("Default project set to: %s", choice.Name)))
		printSetupComplete()
	} else {
		// Non-interactive (agent) mode: print URL and save state for later polling
		loginURL, err := auth.LoginNonInteractive()
		if err != nil {
			return fmt.Errorf("login failed: %w", err)
		}
		fmt.Println()
		fmt.Println("ACTION REQUIRED: Show the following login URL to the user and ask them to open it in their browser:")
		fmt.Println()
		fmt.Printf("  %s\n", loginURL)
		fmt.Println()
		fmt.Println("After the user confirms they have completed login in the browser, run:")
		fmt.Println()
		fmt.Println("  acontext login --poll")
		fmt.Println()
		fmt.Println("This will retrieve the authentication tokens. Then proceed with project setup:")
		fmt.Println()
		fmt.Println("  1. Run 'acontext dash projects list --json' to see available projects.")
		fmt.Println("  2. If projects exist, show them to the user as a numbered table")
		fmt.Println("     (# | org_name | name | project_id) and ask which one to use.")
		fmt.Println("     Ask the user for the project's API key (found on https://dash.acontext.io), then run:")
		fmt.Println("       acontext dash projects select --project <project-id> --api-key <sk-ac-...>")
		fmt.Println("  3. If the list is empty, ask the user for an org name and project name,")
		fmt.Println("     then run:")
		fmt.Println("       acontext dash projects create --name <project-name> --org <org-id>")
		fmt.Println("     If no orgs exist either, the user must create one at https://dash.acontext.io first.")
		fmt.Println("     The create output includes project_id and secret_key, auto-saved as default.")
		fmt.Println("  4. After project setup, verify connectivity:")
		fmt.Println("       acontext dash ping")
		fmt.Println("     If ping fails, re-run 'acontext dash projects select' with the correct API key.")
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
	fmt.Println(tui.RenderInfo("Removed ~/.acontext/auth.json and ~/.acontext/credentials.json"))
	return nil
}

func runWhoami(cmd *cobra.Command, args []string) error {
	af, err := auth.MustLoad()
	if err != nil {
		return err
	}

	// Validate token with Supabase and refresh if needed
	af, err = auth.ValidateAndRefresh(af)
	if err != nil {
		return fmt.Errorf("session invalid — run 'acontext login' again: %w", err)
	}

	fmt.Printf("Logged in as %s\n", tui.SuccessStyle.Render(af.User.Email))
	fmt.Printf("User ID: %s\n", tui.MutedStyle.Render(af.User.ID))
	return nil
}
