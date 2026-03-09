package cmd

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/memodb-io/Acontext/acontext-cli/internal/tui"
	"github.com/spf13/cobra"
)

func init() {
	skillsCmd := &cobra.Command{Use: "skills", Short: "Manage agent skills"}

	listCmd := &cobra.Command{
		Use: "list", Short: "List all agent skills",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			skills, err := c.ListAgentSkills(context.Background(), &api.ListParams{User: dashUserEmail})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(skills)
			}
			rows := make([][]string, len(skills))
			for i, s := range skills {
				desc := s.Description
				if len(desc) > 60 {
					desc = desc[:57] + "..."
				}
				rows[i] = []string{s.ID, s.Name, desc, s.CreatedAt}
			}
			output.RenderTable([]string{"ID", "NAME", "DESCRIPTION", "CREATED_AT"}, rows)
			return nil
		},
	}

	getCmd := &cobra.Command{
		Use: "get <skill-id>", Short: "Get agent skill details", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			skill, err := c.GetAgentSkill(context.Background(), args[0])
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(skill)
			}
			fmt.Printf("ID:          %s\n", skill.ID)
			fmt.Printf("Name:        %s\n", skill.Name)
			fmt.Printf("Description: %s\n", skill.Description)
			fmt.Printf("Created:     %s\n", skill.CreatedAt)
			fmt.Printf("Updated:     %s\n", skill.UpdatedAt)
			return nil
		},
	}

	createCmd := &cobra.Command{
		Use:   "create",
		Short: "Create an agent skill from a ZIP file or directory",
		Long:  "Upload a skill. Provide --file for a ZIP, or --dir for a directory (will be zipped automatically). The ZIP must contain a SKILL.md with name and description in YAML.",
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}

			fileFlag, _ := cmd.Flags().GetString("file")
			dirFlag, _ := cmd.Flags().GetString("dir")
			user, _ := cmd.Flags().GetString("user")
			meta, _ := cmd.Flags().GetString("meta")

			if user == "" {
				user = dashUserEmail
			}

			var zipPath string
			var tempFile bool

			if fileFlag != "" {
				zipPath = fileFlag
			} else if dirFlag != "" {
				// Auto-zip the directory
				tmp, err := zipDirectory(dirFlag)
				if err != nil {
					return fmt.Errorf("zip directory: %w", err)
				}
				zipPath = tmp
				tempFile = true
			} else {
				return fmt.Errorf("provide --file <path.zip> or --dir <directory>")
			}

			if tempFile {
				defer os.Remove(zipPath)
			}

			skill, err := c.CreateAgentSkill(context.Background(), zipPath, user, meta)
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(skill)
			}
			fmt.Printf("Skill created: %s\n", skill.ID)
			fmt.Printf("Name: %s\n", skill.Name)
			return nil
		},
	}
	createCmd.Flags().String("file", "", "Path to ZIP file containing the skill")
	createCmd.Flags().String("dir", "", "Path to directory to zip and upload")
	createCmd.Flags().String("user", "", "User identifier (defaults to logged-in email)")
	createCmd.Flags().String("meta", "", "Metadata as JSON string")

	deleteCmd := &cobra.Command{
		Use: "delete <skill-id>", Short: "Delete an agent skill", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			yes, _ := cmd.Flags().GetBool("yes")
			if !yes {
				if !auth.IsTTY() {
					return fmt.Errorf("use --yes to confirm deletion in non-interactive mode")
				}
				proceed, err := tui.RunConfirm(fmt.Sprintf("Delete skill %s?", args[0]), false)
				if err != nil || !proceed {
					fmt.Println("Cancelled.")
					return nil
				}
			}
			c, err := requireClient()
			if err != nil {
				return err
			}
			if err := c.DeleteAgentSkill(context.Background(), args[0]); err != nil {
				return err
			}
			fmt.Printf("Skill deleted: %s\n", args[0])
			return nil
		},
	}
	deleteCmd.Flags().BoolP("yes", "y", false, "Skip confirmation prompt")

	skillsCmd.AddCommand(listCmd, getCmd, createCmd, deleteCmd)
	DashCmd.AddCommand(skillsCmd)
}

// zipDirectory creates a temporary ZIP from a directory. Returns the temp file path.
// The caller is responsible for removing the temp file.
func zipDirectory(dir string) (string, error) {
	tmp, err := os.CreateTemp("", "acontext-skill-*.zip")
	if err != nil {
		return "", err
	}
	tmpName := tmp.Name()

	w := zip.NewWriter(tmp)

	base := filepath.Clean(dir)
	if err := filepath.Walk(base, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(base, path)
		if err != nil {
			return err
		}
		// Skip hidden files
		if strings.HasPrefix(relPath, ".") || strings.Contains(relPath, string(os.PathSeparator)+".") {
			return nil
		}

		fw, err := w.Create(relPath)
		if err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(fw, f)
		return err
	}); err != nil {
		w.Close()
		tmp.Close()
		os.Remove(tmpName)
		return "", err
	}
	if err := w.Close(); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return "", err
	}
	tmp.Close()
	return tmpName, nil
}
