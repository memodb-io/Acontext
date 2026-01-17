"""
Simple end-to-end example for sandbox operations.

This script demonstrates creating a sandbox, executing commands, and cleaning up.
Requires a running Acontext instance with sandbox support enabled.
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


def main() -> None:
    api_key, base_url = resolve_credentials()

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        # Test connectivity
        print(f"✓ Server ping: {client.ping()}")

        # Create a new sandbox
        print("\n--- Creating sandbox ---")
        sandbox = client.sandboxes.create()
        print(f"Sandbox ID: {sandbox.sandbox_id}")
        print(f"Status: {sandbox.sandbox_status}")
        print(f"Expires at: {sandbox.sandbox_expires_at}")

        sandbox_id = sandbox.sandbox_id

        # Execute some commands
        print("\n--- Executing commands ---")

        # Run a simple echo command
        result = client.sandboxes.exec_command(
            sandbox_id=sandbox_id, command="echo 'Hello from sandbox!'"
        )
        print("echo command:")
        print(f"  stdout: {result.stdout.strip()}")
        print(f"  exit_code: {result.exit_code}")

        # List files in the home directory
        result = client.sandboxes.exec_command(
            sandbox_id=sandbox_id, command="ls -la ~"
        )
        print("\nls -la ~:")
        print(f"  stdout:\n{result.stdout}")
        print(f"  exit_code: {result.exit_code}")

        # Check Python version
        result = client.sandboxes.exec_command(
            sandbox_id=sandbox_id, command="python3 --version"
        )
        print("python3 --version:")
        print(f"  stdout: {result.stdout.strip()}")
        print(f"  exit_code: {result.exit_code}")

        # Create and run a simple Python script
        result = client.sandboxes.exec_command(
            sandbox_id=sandbox_id,
            command="python3 -c \"print('Hello from Python in sandbox!')\"",
        )
        print("\nPython script:")
        print(f"  stdout: {result.stdout.strip()}")
        print(f"  exit_code: {result.exit_code}")

        # Kill the sandbox
        print("\n--- Killing sandbox ---")
        kill_result = client.sandboxes.kill(sandbox_id)
        print(f"Kill status: {kill_result.status}")
        print(f"Kill message: {kill_result.errmsg or 'success'}")

        print("\n✓ Sandbox example completed successfully!")


if __name__ == "__main__":
    try:
        main()
    except APIError as exc:
        print(f"[API error] status={exc.status_code} message={exc.message}")
        raise
