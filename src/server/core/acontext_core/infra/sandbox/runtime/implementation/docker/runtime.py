import asyncio
import os
import base64
from typing import Dict, List, Optional, Tuple

import docker  # type: ignore

from ...base import SandboxRuntime


class DockerSandboxRuntime(SandboxRuntime):
    """Docker backend runtime implementation for executing commands and file operations."""

    def __init__(self, sandbox_id: str) -> None:
        super().__init__(sandbox_id)
        self._client: Optional["docker.DockerClient"] = None  # type: ignore[name-defined]
        self._container: Optional["docker.models.containers.Container"] = None #one runtime for one container

    def _require_docker(self) -> None:
        """Ensure docker SDK is available."""
        if docker is None:
            raise RuntimeError(
                "docker SDK is required for DockerSandboxRuntime. "
                "Install it with: pip install docker"
            )

    def _get_client(self) -> "docker.DockerClient":  # type: ignore[name-defined]
        """Get or create Docker client."""
        self._require_docker()
        if self._client is None:
            self._client = docker.from_env()  # type: ignore[operator]
        return self._client

    async def _get_container(self) -> "docker.models.containers.Container":  # type: ignore[name-defined]
        """Find and cache the container for this sandbox."""
        if self._container is not None:
            # Verify container still exists and is accessible
            try:
                self._container.reload()
                return self._container
            except docker.errors.NotFound:  # type: ignore[attr-defined]
                self._container = None

        def _find():
            client = self._get_client()
            containers = client.containers.list(
                all=True, filters={"label": f"acontext.sandboxId={self.sandbox_id}"}
            )
            if not containers:
                raise RuntimeError(
                    f"Container not found for sandbox_id: {self.sandbox_id}"
                )
            return containers[0]

        self._container = await asyncio.to_thread(_find)
        return self._container

    async def _run_in_thread(self, func, *args, **kwargs):
        """Run a blocking function in a thread pool."""
        return await asyncio.to_thread(func, *args, **kwargs)

    def _ensure_dir_exists(
        self, container: "docker.models.containers.Container", directory: str, *, error_prefix: str = "Directory not found"
    ) -> None:
        """Verify directory exists inside container; raise if missing."""
        check_result = container.exec_run(
            ["sh", "-c", f"test -d '{directory}'"],
            detach=False,
        )
        if check_result[0] != 0:
            raise FileNotFoundError(f"{error_prefix}: {directory}")

    async def exec(
        self,
        cmd: List[str],
        workdir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: float = 10,
    ) -> Tuple[int, str, str]:
        """
        Execute a command in the Docker container.

        Args:
            cmd: Command and arguments to execute
            workdir: Working directory (optional)
            env: Environment variables (optional)
            timeout: Execution timeout in seconds (optional)

        Returns:
            Tuple of (exit_code, stdout, stderr)
        """
        container = await self._get_container()

        def _exec() -> Tuple[int, str, str]:
            exec_result = container.exec_run(
                cmd,
                workdir=workdir,#The command work for
                environment=env,
                detach=False,
                stdout=True,
                stderr=True,
                demux=True,  # Separate stdout and stderr
                tty=False,
            )
            #output:(exit_code, (stdout_bytes, stderr_bytes)) 0 success
            # exec_run with demux=True returns (exit_code, (stdout, stderr))
            exit_code = exec_result[0]
            stdout_bytes, stderr_bytes = exec_result[1]

            # Decode bytes to strings
            # errors="replace": Replace invalid UTF-8 bytes with replacement character (�)
            # instead of raising UnicodeDecodeError. This ensures command execution
            # won't fail due to encoding issues (e.g., binary output or special characters).
            stdout_str = (
                stdout_bytes.decode("utf-8", errors="replace")
                if stdout_bytes
                else ""
            )
            stderr_str = (
                stderr_bytes.decode("utf-8", errors="replace")
                if stderr_bytes
                else ""
            )

            return (exit_code, stdout_str, stderr_str)

        return await asyncio.wait_for(
            self._run_in_thread(_exec), timeout=timeout
        )

    async def exec_script(
        self,
        script: str,
        workdir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = 10,
        shell: str = "python",
    ) -> Tuple[int, str, str]:
        """
        Execute a script inside the Docker container. Currently supports Python via `python -c`.

        Args:
            script: Script content to execute
            workdir: Working directory for execution (optional)
            env: Environment variables for execution (optional)
            timeout: Execution timeout in seconds. Defaults to the same as exec() if None.
            shell: Interpreter to use. Only "python" is supported in this implementation.

        Returns:
            Tuple of (exit_code, stdout, stderr)
        """
        if shell != "python":
            raise ValueError('Only "python" is supported for exec_script in Docker runtime currently.')

        cmd = ["python", "-c", script]#python -c script


        return await self.exec(
            cmd=cmd,
            workdir=workdir,
            env=env,
            timeout=timeout,
        )

    async def upload_file(self, local_path: str, remote_path: str) -> None:
        """
        Upload a file from local filesystem to the Docker container.

        Args:
            local_path: Path to the local file
            remote_path: Destination path inside the container

        Raises:
            FileNotFoundError: If local file doesn't exist or remote directory is missing
            RuntimeError: If container is not found or upload fails
        """
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        if not os.path.isfile(local_path):
            raise ValueError(f"Path is not a file: {local_path}")

        container = await self._get_container()

        def _upload():
            # Use docker cp to copy file into container
            # docker-py doesn't have a direct API for this, so we use put_archive
            # which requires creating a tar archive first
            import tarfile
            import tempfile
            import io

            # Create tar archive in memory
            tar_stream = io.BytesIO()
            with tarfile.open(fileobj=tar_stream, mode="w") as tar:
                # Add file to tar with the target path structure
                # We need to preserve the directory structure in the container
                tar.add(local_path, arcname=os.path.basename(remote_path))

            tar_data = tar_stream.getvalue()

            # Extract to the target directory in container
            remote_dir = os.path.dirname(remote_path) or "/"
            remote_filename = os.path.basename(remote_path)

            # Require target directory to already exist in the container
            # (do not auto-create). Return code 0 means the directory exists.
            self._ensure_dir_exists(
                container, remote_dir, error_prefix="Remote directory does not exist"
            )

            # Put archive to a temp location first, then move to final location
            # This ensures the file is placed correctly
            container.put_archive("/tmp", tar_data)

            # Move file from temp to final location
            container.exec_run(
                ["sh", "-c", f"mv /tmp/{remote_filename} '{remote_path}'"],
                detach=False,
            )

        await self._run_in_thread(_upload)

    async def download_file(self, remote_path: str) -> bytes:
        """
        Download a file from the Docker container to memory.

        Args:
            remote_path: Path to the file inside the container

        Returns:
            File contents as bytes

        Raises:
            RuntimeError: If container is not found or file doesn't exist
            FileNotFoundError: If file doesn't exist in container
        """
        container = await self._get_container()

        def _download() -> bytes:
            # Use get_archive to get file from container
            # This returns a tuple of (stream, stat) where stream is a generator
            try:
                bits, stat = container.get_archive(remote_path)
            except docker.errors.NotFound as e:  # type: ignore[attr-defined]
                raise FileNotFoundError(
                    f"File not found in container: {remote_path}"
                ) from e

            # bits is a generator that yields chunks of the tar archive
            # We need to read all chunks and extract the file
            import tarfile
            import io

            tar_data = b"".join(bits)
            tar_stream = io.BytesIO(tar_data)

            with tarfile.open(fileobj=tar_stream, mode="r:") as tar:
                # The archive contains the file at the same path
                # Extract the first member (should be our file)
                members = tar.getmembers()
                if not members:
                    raise RuntimeError(
                        f"Archive is empty for path: {remote_path}"
                    )

                # Find the member that matches our file
                # The archive path might be different (e.g., with leading /)
                file_member = None
                for member in members:
                    # Normalize paths for comparison
                    member_path = member.name.lstrip("/")
                    target_path = remote_path.lstrip("/")
                    if member_path == target_path or member.name == remote_path:
                        file_member = member
                        break

                if file_member is None:
                    # Use first member as fallback
                    file_member = members[0]

                if not file_member.isfile():
                    raise ValueError(
                        f"Path is not a file in container: {remote_path}"
                    )

                # Extract file contents
                file_obj = tar.extractfile(file_member)
                if file_obj is None:
                    raise RuntimeError(
                        f"Failed to extract file from archive: {remote_path}"
                    )

                return file_obj.read()

        return await self._run_in_thread(_download)

    async def read_file(self, remote_path: str) -> str:
        """
        Read a UTF-8 text file from the container and return content.
        """
        container = await self._get_container()

        def _read() -> str:
            result = container.exec_run(
                ["sh", "-c", f"cat '{remote_path}'"],
                detach=False,
                demux=True,
            )
            exit_code, output = result[0], result[1]
            if exit_code != 0:
                raise FileNotFoundError(f"File not found or unreadable: {remote_path}")

            stdout_bytes, _ = output if isinstance(output, tuple) else (output, b"")
            return stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""

        return await self._run_in_thread(_read)

    async def write_file(self, remote_path: str, content: str) -> None:
        """
        Write text content to a file in the container. Parent directory must exist.
        """
        container = await self._get_container()
        remote_dir = os.path.dirname(remote_path) or "/"

        def _write():
            # Ensure target directory exists (do not create automatically)
            self._ensure_dir_exists(
                container, remote_dir, error_prefix="Remote directory does not exist"
            )

            # Use base64 + in-container python to avoid shell escaping issues (quotes/newlines)
            # and to allow arbitrary bytes to be written safely.
            payload = base64.b64encode(content.encode("utf-8")).decode("ascii")
            write_cmd = (
                "python -c \"import base64, pathlib;"
                f"p=pathlib.Path('{remote_path}');"
                f"d=p.parent; "
                "import sys; "
                "data=base64.b64decode('" + payload + "'); "
                "p.write_bytes(data)\""
            )
            result = container.exec_run(["sh", "-c", write_cmd], detach=False)
            if result[0] != 0:
                raise RuntimeError(f"Failed to write file: {remote_path}")

        await self._run_in_thread(_write)

    async def edit_file(
        self, remote_path: str, old_string: str, new_string: str
    ) -> None:
        """
        Temporarily not implemented for Docker runtime.
        """
        raise NotImplementedError("edit_file is not implemented for Docker runtime yet.")

    async def list_dir(self, remote_path: str) -> List[str]:
        """
        List directory contents in the container.
        """
        container = await self._get_container()

        def _list() -> List[str]:
            # Confirm path is a directory
            self._ensure_dir_exists(container, remote_path)

            result = container.exec_run(
                ["sh", "-c", f"ls -a '{remote_path}'"], detach=False, demux=True
            )
            exit_code, output = result[0], result[1]
            if exit_code != 0:
                raise RuntimeError(f"Failed to list directory: {remote_path}")

            stdout_bytes, _ = output if isinstance(output, tuple) else (output, b"")
            stdout_str = (
                stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
            )
            # Split lines and drop empty trailing entries
            return [line for line in stdout_str.splitlines() if line]

        return await self._run_in_thread(_list)

