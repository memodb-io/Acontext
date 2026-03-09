package cmd

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	disksCmd := &cobra.Command{Use: "disks", Short: "Manage disks"}

	listCmd := &cobra.Command{
		Use: "list", Short: "List all disks",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			disks, err := c.ListDisks(context.Background(), &api.ListParams{User: dashUserEmail})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(disks)
			}
			rows := make([][]string, len(disks))
			for i, d := range disks {
				rows[i] = []string{d.ID, d.UserID, d.CreatedAt}
			}
			output.RenderTable([]string{"ID", "USER_ID", "CREATED_AT"}, rows)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use: "create", Short: "Create a new disk",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			user, _ := cmd.Flags().GetString("user")
			if user == "" {
				user = dashUserEmail
			}
			disk, err := c.CreateDisk(context.Background(), &api.CreateDiskRequest{User: user})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(disk)
			}
			fmt.Printf("Disk created: %s\n", disk.ID)
			return nil
		},
	}
	createCmd.Flags().String("user", "", "User identifier (defaults to logged-in email)")

	deleteCmd := &cobra.Command{
		Use: "delete <disk-id>", Short: "Delete a disk", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			if err := c.DeleteDisk(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("Disk deleted: %s\n", args[0])
			return nil
		},
	}

	disksCmd.AddCommand(listCmd, createCmd, deleteCmd)
	DashCmd.AddCommand(disksCmd)
}
