import asyncio
import os
import base64
import shlex
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

    def _decode_exec_result(self, output) -> Tuple[str, str]:
        """
        Decode exec_run output tuple to (stdout, stderr) strings.
        
        Args:
            output: Output from exec_run, can be tuple (stdout_bytes, stderr_bytes) or bytes
            
        Returns:
            Tuple of (stdout_str, stderr_str)
        """
        stdout_bytes, stderr_bytes = output if isinstance(output, tuple) else (output, b"")
        stdout_str = (
            stdout_bytes.decode("utf-8", errors="replace") if stdout_bytes else ""
        )
        stderr_str = (
            stderr_bytes.decode("utf-8", errors="replace") if stderr_bytes else ""
        )
        return (stdout_str, stderr_str)

    def _encode_to_base64(self, text: str) -> str:
        """Encode text string to base64 ASCII string."""
        return base64.b64encode(text.encode("utf-8")).decode("ascii")

    def _decode_from_base64(self, b64: str) -> str:
        """Decode base64 ASCII string to text string."""
        return base64.b64decode(b64).decode("utf-8")

    def _normalize_dir_path(self, path: str) -> str:
        """Normalize directory path, defaulting to '/' if empty."""
        return os.path.dirname(path) or "/"

    def _create_tar_archive(self, files: Dict[str, bytes], mode: str = "w") -> bytes:
        """
        Create a tar archive from a dictionary of file paths to file contents.
        
        Args:
            files: Dictionary mapping file paths (in tar) to file contents (bytes)
            mode: Tar file mode, 'w' for write, 'r:' for read
            
        Returns:
            Tar archive as bytes
        """
        import tarfile
        import io
        
        tar_stream = io.BytesIO()
        with tarfile.open(fileobj=tar_stream, mode=mode) as tar:
            for tar_path, file_content in files.items():
                # Remove leading / from path for tar (tar format requirement)
                tar_path_normalized = tar_path.lstrip("/")
                tarinfo = tarfile.TarInfo(name=tar_path_normalized)
                tarinfo.size = len(file_content)
                tarinfo.mode = 0o644  # Set reasonable file permissions
                tar.addfile(tarinfo, io.BytesIO(file_content))
        
        return tar_stream.getvalue()

    def _extract_file_from_tar(self, tar_data: bytes, target_path: str) -> bytes:
        """
        Extract a file from tar archive data.
        
        Args:
            tar_data: Tar archive as bytes
            target_path: Path of the file to extract (used for matching)
            
        Returns:
            File contents as bytes
            
        Raises:
            RuntimeError: If archive is empty or file extraction fails
            ValueError: If path is not a file
        """
        import tarfile
        import io
        
        tar_stream = io.BytesIO(tar_data)
        with tarfile.open(fileobj=tar_stream, mode="r:") as tar:
            members = tar.getmembers()
            if not members:
                raise RuntimeError(f"Archive is empty for path: {target_path}")
            
            # Find the member that matches our file
            file_member = None
            target_path_normalized = target_path.lstrip("/")
            for member in members:
                member_path = member.name.lstrip("/")
                if member_path == target_path_normalized or member.name == target_path:
                    file_member = member
                    break
            
            if file_member is None:
                # Use first member as fallback
                file_member = members[0]
            
            if not file_member.isfile():
                raise ValueError(f"Path is not a file in container: {target_path}")
            
            file_obj = tar.extractfile(file_member)
            if file_obj is None:
                raise RuntimeError(f"Failed to extract file from archive: {target_path}")
            
            return file_obj.read()

    def _check_file_exists(
        self, container: "docker.models.containers.Container", file_path: str
    ) -> bool:
        """
        Check if a file exists in the container.
        
        Args:
            container: Docker container instance
            file_path: Path to check
            
        Returns:
            True if file exists, False otherwise
        """
        check_code = (
            "import os, sys; "
            "file_path=os.environ.get('FILE_PATH', ''); "
            "exit(0 if file_path and os.path.exists(file_path) else 1)"
        )
        check_env = {"FILE_PATH": file_path}
        check_result = container.exec_run(
            ["python", "-c", check_code],
            workdir="/",
            detach=False,
            demux=True,
            environment=check_env,
        )
        return check_result[0] == 0

    def _exec_python_script(
        self,
        container: "docker.models.containers.Container",
        script: str,
        env: Dict[str, str],
        script_path: Optional[str] = None,
        workdir: str = "/",
    ) -> Tuple[int, str, str]:
        """
        Execute a Python script in the container.
        
        Args:
            container: Docker container instance
            script: Python script content (used if script_path is None)
            env: Environment variables to pass
            script_path: Optional path to script file in container (if None, uses -c mode)
            workdir: Working directory for execution
            
        Returns:
            Tuple of (exit_code, stdout, stderr)
        """
        if script_path:
            cmd = ["python", script_path]
        else:
            cmd = ["python", "-c", script]
        
        result = container.exec_run(
            cmd,
            workdir=workdir,
            detach=False,
            demux=True,
            environment=env,
        )
        exit_code = result[0]
        stdout, stderr = self._decode_exec_result(result[1])
        return (exit_code, stdout, stderr)

    def _handle_exec_result(
        self,
        result: Tuple[int, any],
        operation_name: str,
        path: str,
        check_file_not_found: bool = False,
    ) -> None:
        """
        Handle exec_run result and raise appropriate exceptions on failure.
        
        Args:
            result: Tuple of (exit_code, output) from exec_run
            operation_name: Name of the operation for error messages
            path: File or directory path for error messages
            check_file_not_found: If True, check stderr for file not found errors
            
        Raises:
            FileNotFoundError: If check_file_not_found is True and file not found
            RuntimeError: If operation failed
        """
        exit_code, output = result[0], result[1]
        
        if exit_code != 0:
            stdout, stderr = self._decode_exec_result(output)
            
            if check_file_not_found:
                if "No such file" in stderr or "cannot open" in stderr.lower():
                    raise FileNotFoundError(f"File not found in container: {path}")
            
            raise RuntimeError(
                f"Failed to {operation_name}: {path}. "
                f"Exit code: {exit_code}, stdout: {stdout}, stderr: {stderr}"
            )

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
            # Decode bytes to strings using helper method
            # errors="replace": Replace invalid UTF-8 bytes with replacement character (�)
            # instead of raising UnicodeDecodeError. This ensures command execution
            # won't fail due to encoding issues (e.g., binary output or special characters).
            stdout_str, stderr_str = self._decode_exec_result(exec_result[1])
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
            # Read local file content
            with open(local_path, "rb") as f:
                file_content = f.read()
            
            # Create tar archive in memory
            tar_data = self._create_tar_archive(
                {os.path.basename(remote_path): file_content}
            )

            # Extract to the target directory in container
            remote_dir = self._normalize_dir_path(remote_path)
            remote_filename = os.path.basename(remote_path)

            # Require target directory to already exist in the container
            # (do not auto-create). Return code 0 means the directory exists.
            self._ensure_dir_exists(
                container, remote_dir, error_prefix="Remote directory does not exist"
            )

            # Put archive directly to target directory
            # put_archive returns True if successful, False otherwise
            success = container.put_archive(remote_dir, tar_data)
            if not success:
                raise RuntimeError(
                    f"put_archive failed to extract file to {remote_dir} in container"
                )

            # Verify file exists at target location using shell commands
            # Use test -f to check if path exists and is a regular file
            # Exit code 0: File exists and is a regular file (success)
            # Exit code 1: File does not exist or is not a regular file
            remote_path_escaped = shlex.quote(remote_path)
            verify_script = f"test -f {remote_path_escaped}"
            
            verify_result = container.exec_run(
                ["sh", "-c", verify_script],
                detach=False,
                demux=True,
            )
            exit_code = verify_result[0]
            
            # Handle verification results
            if exit_code != 0:
                raise RuntimeError(
                    f"File not found after put_archive: {remote_path}"
                )
            # Note: test -f returns exit code 0 only if the path exists and is a regular file.
            # If exit_code is 0, verification succeeded. No additional checks needed.

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
            tar_data = b"".join(bits)
            return self._extract_file_from_tar(tar_data, remote_path)

        return await self._run_in_thread(_download)

    async def read_file(
        self, remote_path: str, offset: Optional[int] = None, limit: Optional[int] = None
    ) -> str:
        """
        Read a UTF-8 text file from the container and return content.
        Uses shell commands (cat/sed) for safe path handling and supports offset/limit.
        """
        container = await self._get_container()

        def _read() -> str:
            # Use shlex.quote() to safely escape the file path
            file_path_quoted = shlex.quote(remote_path)

            # Build shell command to read file with optional offset/limit
            if offset is not None or limit is not None:
                # Special case: limit=0 should return empty string
                if limit is not None and limit == 0:
                    return ""
                
                # Read with line numbers and offset/limit support
                # offset is 1-based (line numbers start from 1)
                offset_val = offset if offset is not None else 1
                
                if limit is not None and limit > 0:
                    # Read specific range: sed -n 'start,end p'
                    end_line = offset_val + limit - 1
                    read_cmd = f"sed -n '{offset_val},{end_line}p' {file_path_quoted}"
                else:
                    # Read from offset to end: tail -n +start
                    read_cmd = f"tail -n +{offset_val} {file_path_quoted}"
                
                # Add line numbers using awk (more universal than nl)
                # Format: line_num|content
                read_cmd = f"{read_cmd} | awk '{{print NR+{offset_val}-1\"|\"$0}}'"
            else:
                # Simple read without line numbers
                read_cmd = f"cat {file_path_quoted}"

            result = container.exec_run(["sh", "-c", read_cmd], detach=False, demux=True)
            
            if result[0] != 0:
                stdout, stderr = self._decode_exec_result(result[1])
                # Check if it's a file not found error
                if "No such file" in stderr or "cannot open" in stderr.lower():
                    raise FileNotFoundError(f"File not found in container: {remote_path}")
                raise RuntimeError(f"Failed to read file: {remote_path}. Error: {stderr}")

            stdout, _ = self._decode_exec_result(result[1])
            return stdout

        return await self._run_in_thread(_read)

    async def write_file(self, remote_path: str, content: str) -> None:
        """
        Write text content to a file in the container. Parent directory must exist.
        Uses Python script with environment variables for small files, and tar archive for large files
        to avoid command line argument length limits.
        """
        container = await self._get_container()
        remote_dir = self._normalize_dir_path(remote_path)

        def _write():
            # Ensure target directory exists (do not create automatically)
            self._ensure_dir_exists(
                container, remote_dir, error_prefix="Remote directory does not exist"
            )

            # Use base64 encoding to safely pass content (handles special chars, newlines, etc.)
            payload = self._encode_to_base64(content)
            
            # Use different strategies based on file size to avoid limits
            # Environment variables have size limits (~128KB-2MB depending on system)
            # For large files, use tar archive which has no practical size limit
            max_env_size = 50000  # Conservative limit for environment variables
            
            if len(payload) <= max_env_size:
                # Small file: use Python script with environment variable
                # This is faster and simpler for small files
                write_script = """import base64
import os
import sys

file_path = os.environ.get('FILE_PATH')
b64_data = os.environ.get('B64_DATA')
# Check if environment variables exist (None means not set)
# Note: b64_data can be empty string for empty files, which is valid
if file_path is None or b64_data is None:
    print('Missing FILE_PATH or B64_DATA environment variable', file=sys.stderr)
    sys.exit(1)
try:
    # Decode base64 data (empty string decodes to empty string, which is valid)
    decoded_content = base64.b64decode(b64_data).decode('utf-8')
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(decoded_content)
except Exception as e:
    print(f'Error writing file: {e}', file=sys.stderr)
    sys.exit(1)
"""
                exit_code, stdout, stderr = self._exec_python_script(
                    container,
                    write_script,
                    {"FILE_PATH": remote_path, "B64_DATA": payload},
                )
                
                if exit_code != 0:
                    raise RuntimeError(
                        f"Failed to write file: {remote_path}. "
                        f"Exit code: {exit_code}, stdout: {stdout}, stderr: {stderr}"
                    )
            else:
                # Large file: use tar archive to write the file directly
                # This avoids all command line and environment variable size limits
                file_content_bytes = content.encode('utf-8')
                tar_data = self._create_tar_archive({remote_path: file_content_bytes})
                
                try:
                    container.put_archive("/", tar_data)
                except Exception as e:
                    raise RuntimeError(
                        f"Failed to write large file via tar archive: {remote_path}. Error: {e}"
                    )

        await self._run_in_thread(_write)

    async def edit_file(
        self, remote_path: str, old_string: str, new_string: str
    ) -> None:
        """
        Edit a text file by replacing one occurrence of old_string with new_string.
        Uses base64 encoding and environment variables to safely pass strings and file path
        to container, avoiding shell escaping issues. Uses Python script for reliable string replacement.
        Executes Python directly without shell wrapper for better security.
        """
        container = await self._get_container()

        def _edit():
            # First, check if file exists before attempting to edit
            if not self._check_file_exists(container, remote_path):
                raise FileNotFoundError(
                    f"File does not exist in container: {remote_path}"
                )
            
            # Use base64 encoding to safely pass content
            old_b64 = self._encode_to_base64(old_string)
            new_b64 = self._encode_to_base64(new_string)
            
            # Create a proper multi-line Python script to avoid syntax errors in -c mode
            # This script reads from environment variables and performs the edit operation
            edit_script = """import base64
import os
import sys

old_b64 = os.environ.get('OLD_B64', '')
new_b64 = os.environ.get('NEW_B64', '')
file_path = os.environ.get('FILE_PATH', '')

print(f'DEBUG: file_path={file_path}', file=sys.stderr)
print(f'DEBUG: Current dir: {os.getcwd()}', file=sys.stderr)
print(f'DEBUG: File exists: {os.path.exists(file_path)}', file=sys.stderr)

if not file_path:
    print('FILE_PATH environment variable is empty', file=sys.stderr)
    sys.exit(3)

try:
    old = base64.b64decode(old_b64).decode('utf-8')
    new = base64.b64decode(new_b64).decode('utf-8')
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old not in content:
        print('Old string not found', file=sys.stderr)
        sys.exit(2)
    
    content = content.replace(old, new, 1)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
        
except FileNotFoundError as e:
    print(f'File not found: {e}, file_path={file_path}', file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(3)
"""
            
            # Create tar archive with the script file
            script_filename = "edit_script.py"
            script_path = f"/tmp/{script_filename}"
            script_bytes = edit_script.encode("utf-8")
            tar_data = self._create_tar_archive({script_filename: script_bytes})
            
            # Upload script to container's /tmp directory
            success = container.put_archive("/tmp", tar_data)
            if not success:
                raise RuntimeError(
                    f"Failed to upload edit script to container"
                )
            
            # Set environment variables for base64 strings and full file path
            env = {
                "OLD_B64": old_b64,
                "NEW_B64": new_b64,
                "FILE_PATH": remote_path,  # Use full path to avoid path resolution issues
            }

            # Execute the script from root directory
            exit_code, stdout, stderr = self._exec_python_script(
                container, "", env, script_path=script_path
            )

            # Clean up: remove the temporary script (best effort, ignore errors)
            try:
                container.exec_run(
                    ["rm", "-f", script_path],
                    detach=False,
                )
            except Exception:
                pass  # Ignore cleanup errors

            if exit_code == 1:
                raise FileNotFoundError(
                    f"File not found in container: {remote_path}. "
                    f"Debug info: {stderr}"
                )
            elif exit_code == 2:
                raise ValueError(
                    f"old_string not found in file: {remote_path}"
                )
            elif exit_code != 0:
                raise RuntimeError(
                    f"Failed to edit file: {remote_path}. "
                    f"Exit code: {exit_code}, stdout: {stdout}, stderr: {stderr}"
                )

        await self._run_in_thread(_edit)

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
            if result[0] != 0:
                raise RuntimeError(f"Failed to list directory: {remote_path}")

            stdout_str, _ = self._decode_exec_result(result[1])
            # Split lines and drop empty trailing entries
            return [line for line in stdout_str.splitlines() if line]

        return await self._run_in_thread(_list)

