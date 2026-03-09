package cmd

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
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
			if dashJSON {
				return output.RenderJSON(sessions)
			}
			rows := make([][]string, len(sessions))
			for i, s := range sessions {
				rows[i] = []string{s.ID, s.UserID, s.CreatedAt}
			}
			output.RenderTable([]string{"ID", "USER_ID", "CREATED_AT"}, rows)
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
			if dashJSON {
				return output.RenderJSON(s)
			}
			fmt.Printf("Session created: %s\n", s.ID)
			return nil
		},
	}
	createCmd.Flags().String("user", "", "User identifier (defaults to logged-in email)")

	deleteCmd := &cobra.Command{
		Use: "delete <session-id>", Short: "Delete a session", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
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

	sessionsCmd.AddCommand(listCmd, createCmd, deleteCmd)
	DashCmd.AddCommand(sessionsCmd)
}
