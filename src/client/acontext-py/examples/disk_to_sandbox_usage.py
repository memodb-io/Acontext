"""
Example demonstrating file transfer between disk and sandbox.

This script demonstrates:
1. Creating a disk and uploading an artifact
2. Creating a sandbox
3. Downloading the artifact to the sandbox (download_to_sandbox)
4. Verifying the file exists in the sandbox
5. Creating a new file in sandbox and uploading it to disk (upload_from_sandbox)
6. Cleaning up resources
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

        disk_id: str | None = None
        sandbox_id: str | None = None

        try:
            # Create a disk
            print("\n--- Creating disk ---")
            disk = client.disks.create()
            disk_id = disk.id
            print(f"Disk ID: {disk_id}")

            # Upload a test file as an artifact
            print("\n--- Uploading artifact ---")
            test_content = (
                b"Hello from disk artifact!\nThis file was transferred to sandbox."
            )
            artifact = client.disks.artifacts.upsert(
                disk_id=disk_id,
                file=("test_file.txt", test_content, "text/plain"),
                file_path="/test/",
                meta={"source": "disk_to_sandbox_example"},
            )
            print(f"Artifact uploaded: {artifact.path}{artifact.filename}")

            # Create a sandbox
            print("\n--- Creating sandbox ---")
            sandbox = client.sandboxes.create()
            sandbox_id = sandbox.sandbox_id
            print(f"Sandbox ID: {sandbox_id}")
            print(f"Status: {sandbox.sandbox_status}")

            # Download the artifact to the sandbox
            print("\n--- Downloading artifact to sandbox ---")
            success = client.disks.artifacts.download_to_sandbox(
                disk_id=disk_id,
                file_path="/test/",
                filename="test_file.txt",
                sandbox_id=sandbox_id,
                sandbox_path="/workspace/",
            )
            print(f"Download success: {success}")

            # Verify the file exists in the sandbox
            print("\n--- Verifying file in sandbox ---")
            result = client.sandboxes.exec_command(
                sandbox_id=sandbox_id,
                command="ls -la /workspace/test_file.txt",
            )
            print(f"ls result:\n{result.stdout}")
            print(f"exit_code: {result.exit_code}")

            if result.exit_code == 0:
                print("✓ File exists in sandbox!")
            else:
                print("✗ File not found in sandbox")

            # Read the file content in sandbox
            print("\n--- Reading file content in sandbox ---")
            result = client.sandboxes.exec_command(
                sandbox_id=sandbox_id,
                command="cat /workspace/test_file.txt",
            )
            print(f"File content:\n{result.stdout}")
            print(f"exit_code: {result.exit_code}")

            # Create a new file in sandbox
            print("\n--- Creating new file in sandbox ---")
            result = client.sandboxes.exec_command(
                sandbox_id=sandbox_id,
                command="echo 'Generated in sandbox!' > /workspace/sandbox_output.txt",
            )
            print(f"File created, exit_code: {result.exit_code}")

            print("\n--- Reading new file in sandbox ---")
            result = client.sandboxes.exec_command(
                sandbox_id=sandbox_id,
                command="cat /workspace/sandbox_output.txt",
            )
            print(f"File content:\n{result.stdout}")
            print(f"exit_code: {result.exit_code}")

            # Upload the sandbox file to disk
            print("\n--- Uploading file from sandbox to disk ---")
            uploaded_artifact = client.disks.artifacts.upload_from_sandbox(
                disk_id=disk_id,
                sandbox_id=sandbox_id,
                sandbox_path="/workspace/",
                sandbox_filename="sandbox_output.txt",
                file_path="/results/",
            )
            print(
                f"Uploaded artifact: {uploaded_artifact.path}{uploaded_artifact.filename}"
            )

            # Verify the uploaded artifact by reading it back
            print("\n--- Verifying uploaded artifact ---")
            artifact_info = client.disks.artifacts.get(
                disk_id=disk_id,
                file_path="/results/",
                filename="sandbox_output.txt",
                with_content=True,
            )
            print(
                f"Artifact path: {artifact_info.artifact.path}{artifact_info.artifact.filename}"
            )
            if artifact_info.content:
                print(f"Artifact content: {artifact_info.content.raw}")

            artifact_infos = client.disks.artifacts.grep_artifacts(
                disk_id=disk_id, query="Generated in"
            )

            print("Grep result", artifact_infos)

            print("\n✓ Disk-sandbox file transfer example completed successfully!")

        finally:
            # Cleanup: Kill sandbox and delete disk
            print("\n--- Cleanup ---")

            if sandbox_id:
                try:
                    kill_result = client.sandboxes.kill(sandbox_id)
                    print(f"Sandbox killed: status={kill_result.status}")
                except APIError as e:
                    print(f"Failed to kill sandbox: {e.message}")


if __name__ == "__main__":
    try:
        main()
    except APIError as exc:
        print(f"[API error] status={exc.status_code} message={exc.message}")
        raise
