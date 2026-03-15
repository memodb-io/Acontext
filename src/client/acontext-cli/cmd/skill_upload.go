package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/auth"
	"github.com/spf13/cobra"
)

var (
	skillAPIKey  string
	skillBaseURL string
)

// SkillCmd is the top-level "skill" command group.
var SkillCmd = &cobra.Command{
	Use:   "skill",
	Short: "Manage agent skills",
	Long:  "Upload and manage agent skills. Requires login (run 'acontext login' first).",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		// Inherit parent persistent pre-run hooks (telemetry, etc.)
		if parentE := cmd.Root().PersistentPreRunE; parentE != nil {
			if err := parentE(cmd, args); err != nil {
				return err
			}
		} else if parent := cmd.Root().PersistentPreRun; parent != nil {
			parent(cmd, args)
		}

		// Require login
		af, err := auth.Load()
		if err != nil || af == nil {
			return fmt.Errorf("not logged in — run 'acontext login' first")
		}
		af, err = auth.ValidateAndRefresh(af)
		if err != nil {
			return fmt.Errorf("session invalid — run 'acontext login' again: %w", err)
		}
		dashUserEmail = af.User.Email
		dashAccessToken = af.AccessToken

		// Resolve API key: flag > default project keystore
		apiKey := skillAPIKey
		if apiKey == "" {
			ks, _ := auth.LoadKeyStore()
			if ks != nil && ks.DefaultProject != "" {
				apiKey = ks.Keys[ks.DefaultProject]
			}
		}
		if apiKey != "" {
			dashClient = api.NewClient(skillBaseURL, apiKey, af.AccessToken)
		}

		return nil
	},
}

func init() {
	SkillCmd.PersistentFlags().StringVar(&skillAPIKey, "api-key", "", "Project API key (overrides credentials.json)")
	SkillCmd.PersistentFlags().StringVar(&skillBaseURL, "base-url", "", "API base URL override")

	uploadCmd := &cobra.Command{
		Use:   "upload <directory>",
		Short: "Upload a skill directory to Acontext",
		Long:  "Zip and upload a local directory as an agent skill. The directory must contain a SKILL.md with name and description in YAML front-matter.",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			dirPath := args[0]

			// Validate that the path is a directory
			info, err := os.Stat(dirPath)
			if err != nil {
				return fmt.Errorf("cannot access %s: %w", dirPath, err)
			}
			if !info.IsDir() {
				return fmt.Errorf("%s is not a directory", dirPath)
			}

			c, err := requireClient()
			if err != nil {
				return err
			}

			user, _ := cmd.Flags().GetString("user")
			if user == "" {
				user = dashUserEmail
			}
			meta, _ := cmd.Flags().GetString("meta")

			zipPath, err := zipDirectory(dirPath)
			if err != nil {
				return fmt.Errorf("zip directory: %w", err)
			}
			defer func() { _ = os.Remove(zipPath) }()

			skill, err := c.CreateAgentSkill(context.Background(), zipPath, user, meta)
			if err != nil {
				return err
			}

			fmt.Printf("Skill uploaded: %s\n", skill.ID)
			fmt.Printf("Name: %s\n", skill.Name)
			return nil
		},
	}
	uploadCmd.Flags().String("user", "", "User identifier (defaults to logged-in email)")
	uploadCmd.Flags().String("meta", "", "Metadata as JSON string")

	SkillCmd.AddCommand(uploadCmd)
}
