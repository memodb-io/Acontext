package main

import (
	"fmt"
	"os"

	"github.com/memodb-io/Acontext/acontext-cli/cmd"
	"github.com/memodb-io/Acontext/acontext-cli/internal/logo"
	"github.com/spf13/cobra"
)

var version = "dev"

func main() {
	// Print logo on first run
	if len(os.Args) > 1 && os.Args[1] != "--help" && os.Args[1] != "-h" {
		fmt.Println(logo.Logo)
	}

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "acontext",
	Short: "Acontext CLI - Build context-aware AI applications",
	Long: `Acontext CLI is a command-line tool for quickly creating Acontext projects.
	
It helps you:
  - Create projects with templates for Python or TypeScript
  - Initialize Git repositories
  - Deploy local development environments with Docker

Get started by running: acontext create
`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println(logo.Logo)
		fmt.Println()
		fmt.Println("Welcome to Acontext CLI!")
		fmt.Println()
		fmt.Println("Quick Commands:")
		fmt.Println("  acontext create     Create a new project")
		fmt.Println("  acontext version    Show version information")
		fmt.Println("  acontext help       Show help information")
		fmt.Println()
		fmt.Println("Get started: acontext create")
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(cmd.CreateCmd)
	rootCmd.AddCommand(cmd.DockerCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Acontext CLI version %s\n", version)
	},
}

