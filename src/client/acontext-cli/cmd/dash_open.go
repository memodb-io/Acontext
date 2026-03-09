package cmd

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/spf13/cobra"
)

func init() {
	openCmd := &cobra.Command{
		Use:   "open",
		Short: "Open the Acontext Dashboard in your browser",
		RunE: func(cmd *cobra.Command, args []string) error {
			url := "https://dash.acontext.io"
			fmt.Printf("Opening %s ...\n", url)

			var openCmd *exec.Cmd
			switch runtime.GOOS {
			case "darwin":
				openCmd = exec.Command("open", url)
			case "linux":
				openCmd = exec.Command("xdg-open", url)
			case "windows":
				openCmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
			default:
				fmt.Printf("Open this URL in your browser: %s\n", url)
				return nil
			}

			if err := openCmd.Start(); err != nil {
				fmt.Printf("Could not open browser. Visit: %s\n", url)
			}
			return nil
		},
	}
	DashCmd.AddCommand(openCmd)
}
