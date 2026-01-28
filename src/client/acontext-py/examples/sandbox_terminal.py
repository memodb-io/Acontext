#!/usr/bin/env python3
"""
Mock terminal command line using Sandbox API.

This script creates an interactive terminal session that executes commands
in a remote sandbox environment. Type 'exit' or 'quit' to end the session.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient
from acontext.errors import APIError


def resolve_credentials() -> tuple[str, str]:
    api_key = os.getenv("ACONTEXT_API_KEY", "sk-ac-your-root-api-bearer-token")
    base_url = os.getenv("ACONTEXT_BASE_URL", "http://localhost:8029/api/v1")
    return api_key, base_url


def print_banner() -> None:
    """Print a welcome banner for the terminal."""
    print("=" * 60)
    print("  Acontext Sandbox Terminal")
    print("  Type commands to execute them in a remote sandbox")
    print("  Type 'exit' or 'quit' to end the session")
    print("  Type 'help' for available meta-commands")
    print("=" * 60)
    print()


def print_help() -> None:
    """Print help information."""
    print("""
Available meta-commands:
  exit, quit    - End the terminal session and cleanup sandbox
  help          - Show this help message
  clear         - Clear the terminal screen
  status        - Show sandbox status information

All other input is executed as shell commands in the sandbox.
""")


def clear_screen() -> None:
    """Clear the terminal screen."""
    os.system("cls" if os.name == "nt" else "clear")


class SandboxTerminal:
    """Interactive terminal using the Acontext Sandbox API."""

    def __init__(self, client: AcontextClient) -> None:
        self.client = client
        self.sandbox_id: str | None = None
        self.cwd = "~"

    def start(self) -> None:
        """Initialize the sandbox and start the terminal session."""
        print("Connecting to Acontext server...")
        ping_response = self.client.ping()
        print(f"Server status: {ping_response}")

        print("Creating sandbox...")
        sandbox = self.client.sandboxes.create()
        self.sandbox_id = sandbox.sandbox_id
        print(f"Sandbox created: {self.sandbox_id}")
        print(f"Expires at: {sandbox.sandbox_expires_at}")
        print()

        # Get initial working directory
        result = self.client.sandboxes.exec_command(
            sandbox_id=self.sandbox_id, command="pwd"
        )
        if result.exit_code == 0:
            self.cwd = result.stdout.strip()

    def get_prompt(self) -> str:
        """Generate the command prompt."""
        # Shorten home directory to ~
        display_cwd = self.cwd
        return f"sandbox:{display_cwd}$ "

    def execute(self, command: str) -> tuple[str, str, int]:
        """Execute a command in the sandbox.

        Returns:
            Tuple of (stdout, stderr, exit_code)
        """
        if not self.sandbox_id:
            raise RuntimeError("Sandbox not initialized")

        result = self.client.sandboxes.exec_command(
            sandbox_id=self.sandbox_id,
            command=command,
            timeout=60.0,  # 60 second timeout for commands
        )

        # Update cwd if command was cd
        if command.strip().startswith("cd "):
            pwd_result = self.client.sandboxes.exec_command(
                sandbox_id=self.sandbox_id, command="pwd"
            )
            if pwd_result.exit_code == 0:
                self.cwd = pwd_result.stdout.strip()

        return result.stdout, result.stderr, result.exit_code

    def show_status(self) -> None:
        """Show current sandbox status."""
        print(f"\nSandbox ID: {self.sandbox_id}")
        print(f"Current directory: {self.cwd}")
        print()

    def cleanup(self) -> None:
        """Kill the sandbox and cleanup resources."""
        if self.sandbox_id:
            print("\nCleaning up sandbox...")
            try:
                result = self.client.sandboxes.kill(self.sandbox_id)
                print(f"Sandbox terminated: {result.status}")
            except APIError as e:
                print(f"Warning: Failed to cleanup sandbox: {e.message}")
            self.sandbox_id = None

    def run(self) -> None:
        """Run the interactive terminal loop."""
        print_banner()

        try:
            self.start()
        except APIError as e:
            print(f"Failed to initialize sandbox: {e.message}")
            return

        try:
            while True:
                try:
                    # Read user input
                    user_input = input(self.get_prompt())
                except EOFError:
                    # Handle Ctrl+D
                    print()
                    break
                except KeyboardInterrupt:
                    # Handle Ctrl+C
                    print("^C")
                    continue

                # Strip whitespace
                command = user_input.strip()

                # Skip empty commands
                if not command:
                    continue

                # Handle meta-commands
                if command.lower() in ("exit", "quit"):
                    break
                elif command.lower() == "help":
                    print_help()
                    continue
                elif command.lower() == "clear":
                    clear_screen()
                    continue
                elif command.lower() == "status":
                    self.show_status()
                    continue

                # Execute the command in the sandbox
                try:
                    stdout, stderr, exit_code = self.execute(command)

                    # Print output
                    if stdout:
                        print(stdout, end="" if stdout.endswith("\n") else "\n")
                    if stderr:
                        print(f"\033[91m{stderr}\033[0m", end="" if stderr.endswith("\n") else "\n")

                    # Show exit code if non-zero
                    if exit_code != 0:
                        print(f"\033[93m[exit code: {exit_code}]\033[0m")

                except APIError as e:
                    print(f"\033[91mError: {e.message}\033[0m")
                except Exception as e:
                    print(f"\033[91mUnexpected error: {e}\033[0m")

        finally:
            self.cleanup()

        print("Goodbye!")


def main() -> None:
    api_key, base_url = resolve_credentials()

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        terminal = SandboxTerminal(client)
        terminal.run()


if __name__ == "__main__":
    main()
