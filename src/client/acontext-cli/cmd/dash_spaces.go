package cmd

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	spacesCmd := &cobra.Command{Use: "spaces", Short: "Manage learning spaces"}

	listCmd := &cobra.Command{
		Use: "list", Short: "List learning spaces",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			spaces, err := c.ListLearningSpaces(context.Background(), &api.ListParams{User: dashUserEmail})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(spaces)
			}
			rows := make([][]string, len(spaces))
			for i, s := range spaces {
				rows[i] = []string{s.ID, s.UserID, s.CreatedAt}
			}
			output.RenderTable([]string{"ID", "USER_ID", "CREATED_AT"}, rows)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use: "create", Short: "Create a new learning space",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			user, _ := cmd.Flags().GetString("user")
			if user == "" {
				user = dashUserEmail
			}
			space, err := c.CreateLearningSpace(context.Background(), &api.CreateLearningSpaceRequest{User: user})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(space)
			}
			fmt.Printf("Learning space created: %s\n", space.ID)
			return nil
		},
	}
	createCmd.Flags().String("user", "", "User identifier (defaults to logged-in email)")

	deleteCmd := &cobra.Command{
		Use: "delete <space-id>", Short: "Delete a learning space", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			if err := c.DeleteLearningSpace(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("Learning space deleted: %s\n", args[0])
			return nil
		},
	}

	learnCmd := &cobra.Command{
		Use: "learn <space-id>", Short: "Learn from a session", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			sessionID, _ := cmd.Flags().GetString("session")
			if err := c.LearnFromSession(context.Background(), args[0], sessionID); err != nil {
				return err
			}
			fmt.Printf("Learning space %s learned from session %s\n", args[0], sessionID)
			return nil
		},
	}
	learnCmd.Flags().String("session", "", "Session ID to learn from")
	learnCmd.MarkFlagRequired("session")

	spacesCmd.AddCommand(listCmd, createCmd, deleteCmd, learnCmd)
	DashCmd.AddCommand(spacesCmd)
}
