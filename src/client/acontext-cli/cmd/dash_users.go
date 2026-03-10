package cmd

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

func init() {
	usersCmd := &cobra.Command{Use: "users", Short: "Manage users"}

	listCmd := &cobra.Command{
		Use: "list", Short: "List all users",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			users, err := c.ListUsers(context.Background(), nil)
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(users)
			}
			rows := make([][]string, len(users))
			for i, u := range users {
				rows[i] = []string{u.ID, u.Identifier, u.CreatedAt}
			}
			output.RenderTable([]string{"ID", "IDENTIFIER", "CREATED_AT"}, rows)
			return nil
		},
	}

	deleteCmd := &cobra.Command{
		Use: "delete <identifier>", Short: "Delete a user and associated resources", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			yes, _ := cmd.Flags().GetBool("yes")
			if !yes {
				if !auth.IsTTY() {
					return fmt.Errorf("use --yes to confirm deletion in non-interactive mode")
				}
				proceed, err := tui.RunConfirm(fmt.Sprintf("Delete user %s?", args[0]), false)
				if err != nil || !proceed {
					fmt.Println("Cancelled.")
					return nil
				}
			}
			c, err := requireClient()
			if err != nil {
				return err
			}
			if err := c.DeleteUser(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("User deleted: %s\n", args[0])
			return nil
		},
	}
	deleteCmd.Flags().BoolP("yes", "y", false, "Skip confirmation prompt")

	usersCmd.AddCommand(listCmd, deleteCmd)
	DashCmd.AddCommand(usersCmd)
}
