package cmd

import (
	"context"
	"fmt"

	"github.com/memodb-io/Acontext/acontext-cli/internal/api"
	"github.com/memodb-io/Acontext/acontext-cli/internal/output"
	"github.com/spf13/cobra"
)

func init() {
	messagesCmd := &cobra.Command{Use: "messages", Short: "Manage messages within a session"}

	listCmd := &cobra.Command{
		Use: "list <session-id>", Short: "List messages in a session", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			messages, err := c.ListMessages(context.Background(), args[0], nil)
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(messages)
			}
			rows := make([][]string, len(messages))
			for i, m := range messages {
				content := m.Content
				if len(content) > 80 {
					content = content[:77] + "..."
				}
				rows[i] = []string{m.ID, m.Role, m.Type, content, m.CreatedAt}
			}
			output.RenderTable([]string{"ID", "ROLE", "TYPE", "CONTENT", "CREATED_AT"}, rows)
			return nil
		},
	}

	sendCmd := &cobra.Command{
		Use: "send <session-id>", Short: "Store a message in a session", Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			c, err := requireClient()
			if err != nil {
				return err
			}
			role, _ := cmd.Flags().GetString("role")
			content, _ := cmd.Flags().GetString("content")
			msgType, _ := cmd.Flags().GetString("type")
			msg, err := c.StoreMessage(context.Background(), args[0], &api.StoreMessageRequest{
				Role: role, Content: content, Type: msgType,
			})
			if err != nil {
				return err
			}
			if dashJSON {
				return output.RenderJSON(msg)
			}
			fmt.Printf("Message stored: %s\n", msg.ID)
			return nil
		},
	}
	sendCmd.Flags().String("role", "user", "Message role")
	sendCmd.Flags().String("content", "", "Message content")
	sendCmd.Flags().String("type", "", "Message type")
	sendCmd.MarkFlagRequired("content")

	messagesCmd.AddCommand(listCmd, sendCmd)
	DashCmd.AddCommand(messagesCmd)
}
