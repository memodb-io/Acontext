"""Text editor file operations for sandbox environments."""

import base64
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .sandbox import AsyncSandboxContext, SandboxContext

MAX_CONTENT_CHARS = 20000


def truncate_content(text: str, max_chars: int = MAX_CONTENT_CHARS) -> str:
    """Truncate text to max_chars, appending a truncation flag if needed."""
    if len(text) > max_chars:
        return text[:max_chars] + "...[truncated]"
    return text


def escape_for_shell(s: str) -> str:
    """Escape a string for safe use in shell commands."""
    # Use single quotes and escape any single quotes in the string
    return "'" + s.replace("'", "'\"'\"'") + "'"


# ============================================================================
# Sync Operations
# ============================================================================


def view_file(
    ctx: "SandboxContext", path: str, view_range: list | None, timeout: float | None
) -> dict:
    """View file content with line numbers.

    Args:
        ctx: The sandbox context.
        path: The file path to view.
        view_range: Optional [start_line, end_line] to view specific lines.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with file content and metadata, or error information.
    """
    # First check if file exists and get total lines
    check_cmd = f"wc -l < {escape_for_shell(path)} 2>/dev/null || echo 'FILE_NOT_FOUND'"
    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=check_cmd,
        timeout=timeout,
    )

    if "FILE_NOT_FOUND" in result.stdout or result.exit_code != 0:
        return {
            "error": f"File not found: {path}",
            "stderr": result.stderr,
        }

    total_lines = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0

    # Build the view command with line numbers
    if view_range and len(view_range) == 2:
        start_line, end_line = view_range
        cmd = f"sed -n '{start_line},{end_line}p' {escape_for_shell(path)} | nl -ba -v {start_line}"
    else:
        # Default to first 200 lines if no range specified
        max_lines = 200
        cmd = f"head -n {max_lines} {escape_for_shell(path)} | nl -ba"
        start_line = 1

    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"Failed to view file: {path}",
            "stderr": result.stderr,
        }

    # Count lines in output
    content_lines = (
        result.stdout.rstrip("\n").split("\n") if result.stdout.strip() else []
    )
    num_lines = len(content_lines)

    return {
        "file_type": "text",
        "content": truncate_content(result.stdout),
        "numLines": num_lines,
        "startLine": start_line if view_range else 1,
        "totalLines": total_lines + 1,  # wc -l doesn't count last line without newline
    }


def create_file(
    ctx: "SandboxContext", path: str, file_text: str, timeout: float | None
) -> dict:
    """Create a new file with content.

    Args:
        ctx: The sandbox context.
        path: The file path to create.
        file_text: The content to write to the file.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with creation status or error information.
    """
    # Check if file already exists
    check_cmd = f"test -f {escape_for_shell(path)} && echo 'EXISTS' || echo 'NEW'"
    check_result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=check_cmd,
        timeout=timeout,
    )
    is_update = "EXISTS" in check_result.stdout

    # Create directory if needed
    dir_path = "/".join(path.split("/")[:-1])
    if dir_path:
        mkdir_cmd = f"mkdir -p {escape_for_shell(dir_path)}"
        ctx.client.sandboxes.exec_command(
            sandbox_id=ctx.sandbox_id,
            command=mkdir_cmd,
            timeout=timeout,
        )

    # Write file using base64 encoding to safely transfer content
    encoded_content = base64.b64encode(file_text.encode()).decode()
    write_cmd = f"echo {escape_for_shell(encoded_content)} | base64 -d > {escape_for_shell(path)}"

    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=write_cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"Failed to create file: {path}",
            "stderr": result.stderr,
        }

    return {
        "is_file_update": is_update,
        "message": f"File {'updated' if is_update else 'created'}: {path}",
    }


def str_replace(
    ctx: "SandboxContext", path: str, old_str: str, new_str: str, timeout: float | None
) -> dict:
    """Replace a string in a file.

    Args:
        ctx: The sandbox context.
        path: The file path to modify.
        old_str: The exact string to find and replace.
        new_str: The string to replace old_str with.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with diff information or error details.
    """
    # First read the file content
    read_cmd = f"cat {escape_for_shell(path)}"
    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=read_cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"File not found: {path}",
            "stderr": result.stderr,
        }

    original_content = result.stdout

    # Check if old_str exists in the file
    if old_str not in original_content:
        return {
            "error": f"String not found in file: {old_str[:50]}...",
        }

    # Count occurrences
    occurrences = original_content.count(old_str)
    if occurrences > 1:
        return {
            "error": f"Multiple occurrences ({occurrences}) of the string found. Please provide more context to make the match unique.",
        }

    # Perform the replacement
    new_content = original_content.replace(old_str, new_str, 1)

    # Find the line numbers affected
    old_lines = original_content.split("\n")
    new_lines = new_content.split("\n")

    # Find where the change starts
    old_start = 1
    for i, (old_line, new_line) in enumerate(zip(old_lines, new_lines)):
        if old_line != new_line:
            old_start = i + 1
            break

    # Write the new content
    encoded_content = base64.b64encode(new_content.encode()).decode()
    write_cmd = f"echo {escape_for_shell(encoded_content)} | base64 -d > {escape_for_shell(path)}"

    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=write_cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"Failed to write file: {path}",
            "stderr": result.stderr,
        }

    # Calculate diff info
    old_str_lines = old_str.count("\n") + 1
    new_str_lines = new_str.count("\n") + 1

    # Build diff lines
    diff_lines = []
    for line in old_str.split("\n"):
        diff_lines.append(f"-{line}")
    for line in new_str.split("\n"):
        diff_lines.append(f"+{line}")

    return {
        "oldStart": old_start,
        "oldLines": old_str_lines,
        "newStart": old_start,
        "newLines": new_str_lines,
        "lines": diff_lines,
    }


# ============================================================================
# Async Operations
# ============================================================================


async def async_view_file(
    ctx: "AsyncSandboxContext", path: str, view_range: list | None, timeout: float | None
) -> dict:
    """View file content with line numbers (async).

    Args:
        ctx: The async sandbox context.
        path: The file path to view.
        view_range: Optional [start_line, end_line] to view specific lines.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with file content and metadata, or error information.
    """
    check_cmd = f"wc -l < {escape_for_shell(path)} 2>/dev/null || echo 'FILE_NOT_FOUND'"
    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=check_cmd,
        timeout=timeout,
    )

    if "FILE_NOT_FOUND" in result.stdout or result.exit_code != 0:
        return {
            "error": f"File not found: {path}",
            "stderr": result.stderr,
        }

    total_lines = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0

    if view_range and len(view_range) == 2:
        start_line, end_line = view_range
        cmd = f"sed -n '{start_line},{end_line}p' {escape_for_shell(path)} | nl -ba -v {start_line}"
    else:
        # Default to first 200 lines if no range specified
        max_lines = 200
        cmd = f"head -n {max_lines} {escape_for_shell(path)} | nl -ba"
        start_line = 1

    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"Failed to view file: {path}",
            "stderr": result.stderr,
        }

    content_lines = (
        result.stdout.rstrip("\n").split("\n") if result.stdout.strip() else []
    )
    num_lines = len(content_lines)

    return {
        "file_type": "text",
        "content": truncate_content(result.stdout),
        "numLines": num_lines,
        "startLine": start_line if view_range else 1,
        "totalLines": total_lines + 1,
    }


async def async_create_file(
    ctx: "AsyncSandboxContext", path: str, file_text: str, timeout: float | None
) -> dict:
    """Create a new file with content (async).

    Args:
        ctx: The async sandbox context.
        path: The file path to create.
        file_text: The content to write to the file.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with creation status or error information.
    """
    check_cmd = f"test -f {escape_for_shell(path)} && echo 'EXISTS' || echo 'NEW'"
    check_result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=check_cmd,
        timeout=timeout,
    )
    is_update = "EXISTS" in check_result.stdout

    dir_path = "/".join(path.split("/")[:-1])
    if dir_path:
        mkdir_cmd = f"mkdir -p {escape_for_shell(dir_path)}"
        await ctx.client.sandboxes.exec_command(
            sandbox_id=ctx.sandbox_id,
            command=mkdir_cmd,
            timeout=timeout,
        )

    encoded_content = base64.b64encode(file_text.encode()).decode()
    write_cmd = f"echo {escape_for_shell(encoded_content)} | base64 -d > {escape_for_shell(path)}"

    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=write_cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"Failed to create file: {path}",
            "stderr": result.stderr,
        }

    return {
        "is_file_update": is_update,
        "message": f"File {'updated' if is_update else 'created'}: {path}",
    }


async def async_str_replace(
    ctx: "AsyncSandboxContext", path: str, old_str: str, new_str: str, timeout: float | None
) -> dict:
    """Replace a string in a file (async).

    Args:
        ctx: The async sandbox context.
        path: The file path to modify.
        old_str: The exact string to find and replace.
        new_str: The string to replace old_str with.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with diff information or error details.
    """
    read_cmd = f"cat {escape_for_shell(path)}"
    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=read_cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"File not found: {path}",
            "stderr": result.stderr,
        }

    original_content = result.stdout

    if old_str not in original_content:
        return {
            "error": f"String not found in file: {old_str[:50]}...",
        }

    occurrences = original_content.count(old_str)
    if occurrences > 1:
        return {
            "error": f"Multiple occurrences ({occurrences}) of the string found. Please provide more context to make the match unique.",
        }

    new_content = original_content.replace(old_str, new_str, 1)

    old_lines = original_content.split("\n")
    new_lines = new_content.split("\n")

    old_start = 1
    for i, (old_line, new_line) in enumerate(zip(old_lines, new_lines)):
        if old_line != new_line:
            old_start = i + 1
            break

    encoded_content = base64.b64encode(new_content.encode()).decode()
    write_cmd = f"echo {escape_for_shell(encoded_content)} | base64 -d > {escape_for_shell(path)}"

    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=write_cmd,
        timeout=timeout,
    )

    if result.exit_code != 0:
        return {
            "error": f"Failed to write file: {path}",
            "stderr": result.stderr,
        }

    old_str_lines = old_str.count("\n") + 1
    new_str_lines = new_str.count("\n") + 1

    diff_lines = []
    for line in old_str.split("\n"):
        diff_lines.append(f"-{line}")
    for line in new_str.split("\n"):
        diff_lines.append(f"+{line}")

    return {
        "oldStart": old_start,
        "oldLines": old_str_lines,
        "newStart": old_start,
        "newLines": new_str_lines,
        "lines": diff_lines,
    }
