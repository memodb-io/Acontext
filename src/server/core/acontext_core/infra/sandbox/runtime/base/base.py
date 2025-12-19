from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple


class SandboxRuntime(ABC):

    def __init__(self, sandbox_id: str) -> None:
        """Id is from lifecycle service not from the stateful backend service or save at stateful container inside like label field in the docker container"""
        self.sandbox_id = sandbox_id

    @abstractmethod
    async def exec(
        self,
        cmd: List[str],
        workdir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Tuple[int, str, str]:
        """
        Execute a command in the sandbox.

        Args:
            cmd: Command to execute as a list of strings (e.g., ['ls', '-la'])
            workdir: Working directory for the command execution. If None, uses default directory
            env: Environment variables to set for the command execution. If None, uses default environment
            timeout: Maximum time in seconds to wait for command completion. If None, no timeout

        Returns:
            Tuple containing:
                - exit_code: Exit code of the command (0 for success, non-zero for failure)
                - stdout: Standard output of the command
                - stderr: Standard error output of the command

        Raises:
            TimeoutError: If command execution exceeds the specified timeout
            RuntimeError: If command execution fails or sandbox is unavailable
        """
        pass

    @abstractmethod
    async def exec_script(
        self,
        script: str,
        workdir: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        shell: str = "sh",
    ) -> Tuple[int, str, str]:
        """
        Execute a script string in the sandbox using the specified interpreter.

        Args:
            script: Full script content to execute
            workdir: Working directory for the execution. If None, uses the runtime default
            env: Environment variables to set for execution. If None, uses the runtime default
            timeout: Maximum time in seconds to wait for completion. If None, no timeout
            shell: Interpreter/binary to use (e.g., "sh", "bash", "python", "node", "deno", "powershell")

        Returns:
            Tuple containing:
                - exit_code: Exit code of the script (0 for success, non-zero for failure)
                - stdout: Standard output of the script
                - stderr: Standard error output of the script

        Raises:
            TimeoutError: If script execution exceeds the specified timeout
            RuntimeError: If script execution fails or sandbox is unavailable
        """
        pass

    async def upload_file(self, local_path: str, remote_path: str) -> None:
        """
        Upload a file from local filesystem to the sandbox.

        Args:
            local_path: Path to the file on the local filesystem
            remote_path: Destination path inside the sandbox

        Raises:
            FileNotFoundError: If local file doesn't exist
            PermissionError: If local file cannot be read or remote path cannot be written
            RuntimeError: If upload operation fails or sandbox is unavailable
        """
        raise NotImplementedError

    async def download_file(self, remote_path: str) -> bytes:
        """
        Download a file from the sandbox to local memory.

        Args:
            remote_path: Path to the file inside the sandbox

        Returns:
            File contents as bytes

        Raises:
            FileNotFoundError: If file doesn't exist in sandbox
            PermissionError: If file cannot be read
            RuntimeError: If download operation fails or sandbox is unavailable
        """
        raise NotImplementedError

    @abstractmethod
    async def read_file(self, remote_path: str) -> str:
        """
        Read a file from the sandbox and return its content as a string.

        Args:
            remote_path: Path to the file inside the sandbox

        Returns:
            File contents as a string

        Raises:
            FileNotFoundError: If file doesn't exist in sandbox
            RuntimeError: If read operation fails
        """
        pass

    @abstractmethod
    async def write_file(self, remote_path: str, content: str) -> None:
        """
        Write content to a file in the sandbox.

        Args:
            remote_path: Path to the file inside the sandbox
            content: Content to write to the file

        Raises:
            FileNotFoundError: If parent directory doesn't exist (if required)
            RuntimeError: If write operation fails
        """
        pass

    @abstractmethod
    async def edit_file(
        self,
        remote_path: str,
        old_string: str,
        new_string: str,
    ) -> None:
        """
        Edit a text file by replacing one occurrence of old_string with new_string.

        Args:
            remote_path: Path to the file inside the sandbox
            old_string: Exact text to locate (must exist)
            new_string: Replacement text

        Raises:
            FileNotFoundError: If the file doesn't exist
            ValueError: If old_string is not found in the file
            RuntimeError: If edit operation fails
        """
        pass

    @abstractmethod
    async def list_dir(self, remote_path: str) -> List[str]:
        """
        List directory contents in the sandbox.

        Args:
            remote_path: Path to the directory inside the sandbox

        Returns:
            List of file and directory names in the directory

        Raises:
            FileNotFoundError: If directory doesn't exist
            ValueError: If path is not a directory
            RuntimeError: If list operation fails
        """
        pass
