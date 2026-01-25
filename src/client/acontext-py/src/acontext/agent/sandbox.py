"""Agent tools for sandbox operations using the Acontext Sandbox API."""

import json
from dataclasses import dataclass

from .base import BaseContext, BaseTool, BaseToolPool
from ..client import AcontextClient
from ..async_client import AcontextAsyncClient


@dataclass
class SandboxContext(BaseContext):
    """Context for sandbox tools containing the client, sandbox ID, and disk ID."""

    client: AcontextClient
    sandbox_id: str
    disk_id: str

    def get_context_prompt(self) -> str:
        return """<sandbox>
By default, you are in `/workspace`.
<text_editor_sandbox>
The text_editor_sandbox tool enables viewing, creating, and modifying text files within
the secure sandboxed container environment.

How it works:
- All file operations occur within the sandboxed container filesystem

Command guidelines:
- Always use view before editing to understand file structure
- For str_replace commands, ensure search strings are unique and exact
- Include sufficient context in str_replace for accurate placement
- Use proper escaping for special characters in search/replace strings
</text_editor_sandbox>
<bash_execution_sandbox>        
When to use the bash_execution_sandbox tool directly:
- File system operations requiring shell commands (moving, copying, renaming, organizing files)
- Text processing and manipulation using standard Unix tools (grep, sed, awk, cut, sort, etc.) that
should not be done by the text editor tool
- Batch processing of multiple files using shell loops and wildcards
- System inspection tasks (checking file sizes, permissions, directory structures)
- Combining multiple command-line tools in pipelines for complex data processing
- Archive operations (tar, unzip) and file compression/decompression
- Converting between file formats using command-line utilities

When you should write Python file and use bash tool to run it:
- Complex data analysis or numerical computation (use file operations to write a Python script instead, and
then the bash to run the script)
- Tasks requiring advanced programming logic or data structures

When NOT to use the bash_execution_sandbox tool:
- Simple questions that can be answered without executing commands
- Tasks that only require explaining shell concepts without actual execution

How it works:
- Scripts are saved to a temporary sandbox and executed with bash
- Tool results will include stdout, stderr, and return code
- User-uploaded files are accessible in the directory specified by the INPUT_DIR environment variable. If
you know the file path and don't need to open the full INPUT_DIR, then just open the file directly

File Operations (CRITICAL - READ CAREFULLY):
- use text_editor_sandbox tool to view, create, and edit files.

Export Your Result:
- All the files you created kept in the sandbox, which user can't see or access.
- If you want to export them to user, use `export_sandbox_file` tool.
- If too many files to export(>= 6 files), zip those files and export the zip file.
- Result files' names should be unique and descriptive, (wrong: result.md, output.md... right: 2026_us_market_trending.png)

Script guidelines:
- Write POSIX-compliant bash scripts
- Use proper error handling and exit codes
- Quote variables appropriately to handle spaces in filenames
- Keep scripts clean and well-organized
- Only use single-line Bash command (Never use any heredoc syntax!)
    - wrong: cat > random_plot.py << 'EOF'\ncontent\nEOF
    - right: `echo "content" > random_plot.py && head random_plot.py`

Never write blocking script:
- python codes like `plt.show()` or `input()`... will block the execution of the script, don't use them. write non-blocking code instead.

Container environment:
- NO internet access available
- Filesystem persists across multiple executions within the same container
- Standard Unix utilities available (grep, sed, awk, etc.)
- Archive tools: tar, unzip, zip
- Additional tools: ripgrep, fd, sqlite3, jq, imagemagick
- Do not try to install new packages and libraries with pip as there is no internet access
</bash_execution_sandbox>
</sandbox>
"""


@dataclass
class AsyncSandboxContext(SandboxContext):
    """Async context for sandbox tools containing the client, sandbox ID, and disk ID."""

    client: AcontextAsyncClient


class BashTool(BaseTool):
    """Tool for executing bash commands in a sandbox environment."""

    def __init__(self, timeout: float | None = None):
        """Initialize the BashTool.

        Args:
            timeout: Optional default timeout in seconds for command execution.
                    If not provided, uses the client's default timeout.
        """
        self._timeout = timeout

    @property
    def name(self) -> str:
        return "bash_execution_sandbox"

    @property
    def description(self) -> str:
        return "The bash_execution_sandbox tool enables execution of bash scripts in a secure sandboxed container environment."

    @property
    def arguments(self) -> dict:
        return {
            "command": {
                "type": "string",
                "description": (
                    "The bash command to execute. "
                    "Examples: 'ls -la', 'python3 script.py', 'sed -i 's/old_string/new_string/g' file.py'"
                ),
            },
            "timeout": {
                "type": ["number", "null"],
                "description": (
                    "Optional timeout in seconds for this command. "
                    "Use for long-running commands that may exceed the default timeout."
                ),
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["command"]

    def execute(self, ctx: SandboxContext, llm_arguments: dict) -> str:
        """Execute a bash command in the sandbox."""
        command = llm_arguments.get("command")
        timeout = llm_arguments.get("timeout", self._timeout)

        if not command:
            raise ValueError("command is required")

        result = ctx.client.sandboxes.exec_command(
            sandbox_id=ctx.sandbox_id,
            command=command,
            timeout=timeout,
        )

        return json.dumps(
            {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }
        )

    async def async_execute(self, ctx: AsyncSandboxContext, llm_arguments: dict) -> str:
        """Execute a bash command in the sandbox (async)."""
        command = llm_arguments.get("command")
        timeout = llm_arguments.get("timeout", self._timeout)

        if not command:
            raise ValueError("command is required")

        result = await ctx.client.sandboxes.exec_command(
            sandbox_id=ctx.sandbox_id,
            command=command,
            timeout=timeout,
        )

        return json.dumps(
            {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.exit_code,
            }
        )


class TextEditorTool(BaseTool):
    """Tool for file operations (view, create, str_replace) in the sandbox."""

    def __init__(self, timeout: float | None = None):
        """Initialize the TextEditorTool.

        Args:
            timeout: Optional default timeout in seconds for command execution.
                    If not provided, uses the client's default timeout.
        """
        self._timeout = timeout

    @property
    def name(self) -> str:
        return "text_editor_sandbox"

    @property
    def description(self) -> str:
        return (
            """A tool for viewing, creating, and editing text files in the sandbox."""
        )

    @property
    def arguments(self) -> dict:
        return {
            "command": {
                "type": "string",
                "enum": ["view", "create", "str_replace"],
                "description": "The operation to perform: 'view', 'create', or 'str_replace'",
            },
            "path": {
                "type": "string",
                "description": "The file path in the sandbox (e.g., '/workspace/script.py')",
            },
            "file_text": {
                "type": ["string", "null"],
                "description": "For 'create' command: the content to write to the file",
            },
            "old_str": {
                "type": ["string", "null"],
                "description": "For 'str_replace' command: the exact string to find and replace",
            },
            "new_str": {
                "type": ["string", "null"],
                "description": "For 'str_replace' command: the string to replace old_str with",
            },
            "view_range": {
                "type": ["array", "null"],
                "description": "For 'view' command: optional [start_line, end_line] to view specific lines",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["command", "path"]

    def execute(self, ctx: SandboxContext, llm_arguments: dict) -> str:
        """Execute a text editor command."""
        from .text_editor import view_file, create_file, str_replace

        command = llm_arguments.get("command")
        path = llm_arguments.get("path")

        if not command:
            raise ValueError("command is required")
        if not path:
            raise ValueError("path is required")

        if command == "view":
            view_range = llm_arguments.get("view_range")
            result = view_file(ctx, path, view_range, self._timeout)
        elif command == "create":
            file_text = llm_arguments.get("file_text")
            if file_text is None:
                raise ValueError("file_text is required for create command")
            result = create_file(ctx, path, file_text, self._timeout)
        elif command == "str_replace":
            old_str = llm_arguments.get("old_str")
            new_str = llm_arguments.get("new_str")
            if old_str is None:
                raise ValueError("old_str is required for str_replace command")
            if new_str is None:
                raise ValueError("new_str is required for str_replace command")
            result = str_replace(ctx, path, old_str, new_str, self._timeout)
        else:
            raise ValueError(
                f"Unknown command: {command}. Must be 'view', 'create', or 'str_replace'"
            )

        return json.dumps(result)

    async def async_execute(self, ctx: AsyncSandboxContext, llm_arguments: dict) -> str:
        """Execute a text editor command (async)."""
        from .text_editor import async_view_file, async_create_file, async_str_replace

        command = llm_arguments.get("command")
        path = llm_arguments.get("path")

        if not command:
            raise ValueError("command is required")
        if not path:
            raise ValueError("path is required")

        if command == "view":
            view_range = llm_arguments.get("view_range")
            result = await async_view_file(ctx, path, view_range, self._timeout)
        elif command == "create":
            file_text = llm_arguments.get("file_text")
            if file_text is None:
                raise ValueError("file_text is required for create command")
            result = await async_create_file(ctx, path, file_text, self._timeout)
        elif command == "str_replace":
            old_str = llm_arguments.get("old_str")
            new_str = llm_arguments.get("new_str")
            if old_str is None:
                raise ValueError("old_str is required for str_replace command")
            if new_str is None:
                raise ValueError("new_str is required for str_replace command")
            result = await async_str_replace(ctx, path, old_str, new_str, self._timeout)
        else:
            raise ValueError(
                f"Unknown command: {command}. Must be 'view', 'create', or 'str_replace'"
            )

        return json.dumps(result)


class ExportSandboxFileTool(BaseTool):
    """Tool for exporting files from sandbox to disk storage."""

    @property
    def name(self) -> str:
        return "export_sandbox_file"

    @property
    def description(self) -> str:
        return """Export a file from the sandbox to persistent, shared disk storage, and return you a public download URL.
If the sandbox file is changed, the disk file won't be updated unless you export the file again."""

    @property
    def arguments(self) -> dict:
        return {
            "sandbox_path": {
                "type": "string",
                "description": (
                    "The directory path in the sandbox where the file is located. "
                    "Must end with '/'. Examples: '/workspace/', '/home/user/output/'"
                ),
            },
            "sandbox_filename": {
                "type": "string",
                "description": "The name of the file to export from the sandbox. ",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["sandbox_path", "sandbox_filename"]

    def _normalize_path(self, path: str | None) -> str:
        """Normalize a file path to ensure it starts and ends with '/'."""
        if not path:
            return "/"
        normalized = path if path.startswith("/") else f"/{path}"
        if not normalized.endswith("/"):
            normalized += "/"
        return normalized

    def execute(self, ctx: SandboxContext, llm_arguments: dict) -> str:
        """Export a file from sandbox to disk."""
        sandbox_path = llm_arguments.get("sandbox_path")
        sandbox_filename = llm_arguments.get("sandbox_filename")
        disk_path = "/artifacts/"

        if not sandbox_path:
            raise ValueError("sandbox_path is required")
        if not sandbox_filename:
            raise ValueError("sandbox_filename is required")

        normalized_sandbox_path = self._normalize_path(sandbox_path)
        normalized_disk_path = self._normalize_path(disk_path)

        artifact = ctx.client.disks.artifacts.upload_from_sandbox(
            disk_id=ctx.disk_id,
            sandbox_id=ctx.sandbox_id,
            sandbox_path=normalized_sandbox_path,
            sandbox_filename=sandbox_filename,
            file_path=normalized_disk_path,
        )

        # Get the public URL for the uploaded artifact
        artifact_info = ctx.client.disks.artifacts.get(
            disk_id=ctx.disk_id,
            file_path=artifact.path,
            filename=artifact.filename,
            with_public_url=True,
            with_content=False,
        )

        return json.dumps(
            {
                "message": "successfully exported file to disk",
                "public_url": artifact_info.public_url,
            }
        )

    async def async_execute(self, ctx: AsyncSandboxContext, llm_arguments: dict) -> str:
        """Export a file from sandbox to disk (async)."""
        sandbox_path = llm_arguments.get("sandbox_path")
        sandbox_filename = llm_arguments.get("sandbox_filename")
        disk_path = "/artifacts/"

        if not sandbox_path:
            raise ValueError("sandbox_path is required")
        if not sandbox_filename:
            raise ValueError("sandbox_filename is required")

        normalized_sandbox_path = self._normalize_path(sandbox_path)
        normalized_disk_path = self._normalize_path(disk_path)

        artifact = await ctx.client.disks.artifacts.upload_from_sandbox(
            disk_id=ctx.disk_id,
            sandbox_id=ctx.sandbox_id,
            sandbox_path=normalized_sandbox_path,
            sandbox_filename=sandbox_filename,
            file_path=normalized_disk_path,
        )

        # Get the public URL for the uploaded artifact
        artifact_info = await ctx.client.disks.artifacts.get(
            disk_id=ctx.disk_id,
            file_path=artifact.path,
            filename=artifact.filename,
            with_public_url=True,
            with_content=False,
        )

        return json.dumps(
            {
                "message": "successfully exported file to disk",
                "public_url": artifact_info.public_url,
            }
        )


class SandboxToolPool(BaseToolPool):
    """Tool pool for sandbox operations."""

    def format_context(
        self, client: AcontextClient, sandbox_id: str, disk_id: str
    ) -> SandboxContext:
        """Create a sync sandbox context.

        Args:
            client: The Acontext client instance.
            sandbox_id: The UUID of the sandbox.
            disk_id: The UUID of the disk for file exports.

        Returns:
            SandboxContext for use with sandbox tools.
        """
        return SandboxContext(client=client, sandbox_id=sandbox_id, disk_id=disk_id)

    async def async_format_context(
        self, client: AcontextAsyncClient, sandbox_id: str, disk_id: str
    ) -> AsyncSandboxContext:
        """Create an async sandbox context.

        Args:
            client: The Acontext async client instance.
            sandbox_id: The UUID of the sandbox.
            disk_id: The UUID of the disk for file exports.

        Returns:
            AsyncSandboxContext for use with sandbox tools.
        """
        return AsyncSandboxContext(
            client=client, sandbox_id=sandbox_id, disk_id=disk_id
        )


# Pre-configured tool pool with sandbox tools
SANDBOX_TOOLS = SandboxToolPool()
SANDBOX_TOOLS.add_tool(BashTool())
SANDBOX_TOOLS.add_tool(TextEditorTool())
SANDBOX_TOOLS.add_tool(ExportSandboxFileTool())
