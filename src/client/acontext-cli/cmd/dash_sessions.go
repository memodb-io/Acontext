package cmd

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

func init() {
	sessionsCmd := &cobra.Command{Use: "sessions", Short: "Manage sessions"}

	listCmd := &cobra.Command{
		Use: "list", Short: "List all sessions",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			sessions, err := c.ListSessions(context.Background(), &api.ListParams{User: dashUserEmail})
			if err != nil {
				return err
			}
			rows := make([][]string, len(sessions))
			for i, s := range sessions {
				rows[i] = []string{s.ID, s.UserID, s.CreatedAt}
			}
			output.RenderTable([]string{"ID", "USER_ID", "CREATED_AT"}, rows)
			return nil
		},
	}

	getCmd := &cobra.Command{
		Use: "get <session-id>", Short: "Get session details", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			session, err := c.GetSession(context.Background(), args[0])
			if err != nil {
				return err
			}
			fmt.Printf("ID:         %s\n", session.ID)
			fmt.Printf("User:       %s\n", session.UserID)
			fmt.Printf("Project:    %s\n", session.ProjectID)
			fmt.Printf("Created:    %s\n", session.CreatedAt)
			fmt.Printf("Updated:    %s\n", session.UpdatedAt)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use: "create", Short: "Create a new session",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			user, _ := cmd.Flags().GetString("user")
			if user == "" {
				user = dashUserEmail
			}
			s, err := c.CreateSession(context.Background(), &api.CreateSessionRequest{User: user})
			if err != nil {
				return err
			}
			fmt.Printf("Session created: %s\n", s.ID)
			return nil
		},
	}
	createCmd.Flags().String("user", "", "User identifier (defaults to logged-in email)")

	deleteCmd := &cobra.Command{
		Use: "delete <session-id>", Short: "Delete a session", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			yes, _ := cmd.Flags().GetBool("yes")
			if !yes {
				if !auth.IsTTY() {
					return fmt.Errorf("use --yes to confirm deletion in non-interactive mode")
				}
				proceed, err := tui.RunConfirm(fmt.Sprintf("Delete session %s?", args[0]), false)
				if err != nil || !proceed {
					fmt.Println("Cancelled.")
					return nil
				}
			}
			c, err := requireClient()
			if err != nil {
				return err
			}
			if err := c.DeleteSession(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("Session deleted: %s\n", args[0])
			return nil
		},
	}
	deleteCmd.Flags().BoolP("yes", "y", false, "Skip confirmation prompt")

	sessionsCmd.AddCommand(listCmd, getCmd, createCmd, deleteCmd)
	DashCmd.AddCommand(sessionsCmd)
}
