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
	artifactsCmd := &cobra.Command{Use: "artifacts", Short: "Manage artifacts within a disk"}

	listCmd := &cobra.Command{
		Use: "list <disk-id>", Short: "List artifacts in a disk", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			artifacts, err := c.ListArtifacts(context.Background(), args[0])
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(artifacts)
			}
			rows := make([][]string, len(artifacts))
			for i, a := range artifacts {
				rows[i] = []string{a.ID, a.Path, fmt.Sprintf("%d", a.Size), a.CreatedAt}
			}
			output.RenderTable([]string{"ID", "PATH", "SIZE", "CREATED_AT"}, rows)
			return nil
		},
	}

	uploadCmd := &cobra.Command{
		Use: "upload <disk-id> <file>", Short: "Upload a file to a disk", Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			destPath, _ := cmd.Flags().GetString("path")
			artifact, err := c.UploadArtifact(context.Background(), args[0], args[1], destPath)
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(artifact)
			}
			fmt.Printf("Artifact uploaded: %s\n", artifact.ID)
			fmt.Printf("Path: %s\n", artifact.Path)
			return nil
		},
	}
	uploadCmd.Flags().String("path", "", "Destination path within the disk (e.g. /documents/)")

	deleteCmd := &cobra.Command{
		Use: "delete <disk-id> <path>", Short: "Delete an artifact", Args: cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			yes, _ := cmd.Flags().GetBool("yes")
			if !yes {
				if !auth.IsTTY() {
					return fmt.Errorf("use --yes to confirm deletion in non-interactive mode")
				}
				proceed, err := tui.RunConfirm(fmt.Sprintf("Delete artifact %s/%s?", args[0], args[1]), false)
				if err != nil || !proceed {
					fmt.Println("Cancelled.")
					return nil
				}
			}
			c, err := requireClient()
			if err != nil {
				return err
			}
			if err := c.DeleteArtifact(context.Background(), args[0], args[1]); err != nil {
				return err
			}
			fmt.Printf("Artifact deleted: %s/%s\n", args[0], args[1])
			return nil
		},
	}
	deleteCmd.Flags().BoolP("yes", "y", false, "Skip confirmation prompt")

	artifactsCmd.AddCommand(listCmd, uploadCmd, deleteCmd)
	DashCmd.AddCommand(artifactsCmd)
}
