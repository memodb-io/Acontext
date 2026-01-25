"""
Example demonstrating how to use the Sandbox Agent Tools.

This script shows how to:
1. Create a sandbox and disk
2. Use SANDBOX_TOOLS to execute bash commands via LLM tool calling
3. Export files from sandbox to disk using export_sandbox_file tool
4. Clean up resources when done
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient
from acontext.agent import SANDBOX_TOOLS
from acontext.errors import APIError


def resolve_credentials() -> tuple[str, str]:
    api_key = os.getenv("ACONTEXT_API_KEY", "sk-ac-your-root-api-bearer-token")
    base_url = os.getenv("ACONTEXT_BASE_URL", "http://localhost:8029/api/v1")
    return api_key, base_url


def main() -> None:
    api_key, base_url = resolve_credentials()

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        # Test connectivity
        print(f"Server ping: {client.ping()}")

        sandbox_id: str | None = None
        disk_id: str | None = None

        try:
            # Create a disk for file exports
            print("\n--- Creating disk ---")
            disk = client.disks.create()
            disk_id = disk.id
            print(f"Disk ID: {disk_id}")

            # Create a sandbox
            print("\n--- Creating sandbox ---")
            sandbox = client.sandboxes.create()
            sandbox_id = sandbox.sandbox_id
            print(f"Sandbox ID: {sandbox_id}")
            print(f"Status: {sandbox.sandbox_status}")

            # Create the context for the tool pool (requires both sandbox_id and disk_id)
            ctx = SANDBOX_TOOLS.format_context(
                client=client, sandbox_id=sandbox_id, disk_id=disk_id
            )

            # Show the tool schemas (useful for LLM integration)
            print("\n--- Tool Schemas ---")
            print("OpenAI format:")
            for tool_schema in SANDBOX_TOOLS.to_openai_tool_schema():
                print(
                    f"  - {tool_schema['function']['name']}: {tool_schema['function']['description'][:60]}..."
                )

            print("\nAnthropic format:")
            for tool_schema in SANDBOX_TOOLS.to_anthropic_tool_schema():
                print(
                    f"  - {tool_schema['name']}: {tool_schema['description'][:60]}..."
                )

            # Simulate LLM tool calls
            print("\n--- Executing bash commands via tool ---")

            # Example 1: Simple command
            print("\n1. List home directory:")
            result = SANDBOX_TOOLS.execute_tool(
                ctx=ctx,
                tool_name="bash_execution",
                llm_arguments={"command": "ls -la ~"},
            )
            print(result)

            # Example 2: Check Python version
            print("\n2. Check Python version:")
            result = SANDBOX_TOOLS.execute_tool(
                ctx=ctx,
                tool_name="bash_execution",
                llm_arguments={"command": "python3 --version"},
            )
            print(result)

            # Example 3: Create a file in the sandbox
            print("\n3. Create a file in sandbox:")
            result = SANDBOX_TOOLS.execute_tool(
                ctx=ctx,
                tool_name="bash_execution",
                llm_arguments={
                    "command": (
                        "mkdir -p /workspace && "
                        "echo 'Hello from sandbox!' > /workspace/output.txt && "
                        "cat /workspace/output.txt"
                    )
                },
            )
            print(result)

            # Example 4: Export the file to disk
            print("\n4. Export file from sandbox to disk:")
            result = SANDBOX_TOOLS.execute_tool(
                ctx=ctx,
                tool_name="export_sandbox_file",
                llm_arguments={
                    "sandbox_path": "/workspace/",
                    "sandbox_filename": "output.txt",
                    "disk_path": "/exports/",
                },
            )
            print(result)

            # Verify the file was exported to disk
            print("\n5. Verify exported file on disk:")
            artifact_info = client.disks.artifacts.get(
                disk_id=disk_id,
                file_path="/exports/",
                filename="output.txt",
                with_content=True,
            )
            print(f"Artifact: {artifact_info.artifact.path}{artifact_info.artifact.filename}")
            if artifact_info.content:
                print(f"Content: {artifact_info.content.raw}")

            print("\n--- Sandbox agent example completed successfully! ---")

        finally:
            # Cleanup: Kill sandbox and delete disk
            print("\n--- Cleanup ---")
            if sandbox_id:
                try:
                    kill_result = client.sandboxes.kill(sandbox_id)
                    print(f"Sandbox killed: status={kill_result.status}")
                except APIError as e:
                    print(f"Failed to kill sandbox: {e.message}")

            if disk_id:
                try:
                    client.disks.delete(disk_id)
                    print(f"Disk deleted: {disk_id}")
                except APIError as e:
                    print(f"Failed to delete disk: {e.message}")


if __name__ == "__main__":
    try:
        main()
    except APIError as exc:
        print(f"[API error] status={exc.status_code} message={exc.message}")
        raise
