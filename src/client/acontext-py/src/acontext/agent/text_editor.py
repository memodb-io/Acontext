"""Text editor file operations for sandbox environments."""

import base64
import posixpath
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
    escaped_path = escape_for_shell(path)

    # Build combined command: check existence, get total lines, and view content in one exec
    if view_range and len(view_range) == 2:
        start_line, end_line = view_range
        view_cmd = (
            f"sed -n '{start_line},{end_line}p' {escaped_path} | nl -ba -v {start_line}"
        )
    else:
        max_lines = 200
        view_cmd = f"head -n {max_lines} {escaped_path} | nl -ba"
        start_line = 1

    # Single combined command: outputs "TOTAL:<n>" on first line, then file content
    cmd = (
        f"if [ ! -f {escaped_path} ]; then echo 'FILE_NOT_FOUND'; exit 1; fi; "
        f'echo "TOTAL:$(wc -l < {escaped_path})"; {view_cmd}'
    )

    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    if result.exit_code != 0 or "FILE_NOT_FOUND" in result.stdout:
        return {
            "error": f"File not found: {path}",
            "stderr": result.stderr,
        }

    # Parse output: first line is "TOTAL:<n>", rest is content
    lines = result.stdout.split("\n", 1)
    total_lines = 0
    content = ""

    if lines and lines[0].startswith("TOTAL:"):
        total_str = lines[0][6:].strip()
        total_lines = int(total_str) if total_str.isdigit() else 0
        content = lines[1] if len(lines) > 1 else ""

    content_lines = content.rstrip("\n").split("\n") if content.strip() else []
    num_lines = len(content_lines)

    return {
        "file_type": "text",
        "content": truncate_content(content),
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
    escaped_path = escape_for_shell(path)
    encoded_content = base64.b64encode(file_text.encode()).decode()

    # Get directory path for mkdir
    dir_path = posixpath.dirname(path)
    mkdir_part = f"mkdir -p {escape_for_shell(dir_path)} && " if dir_path else ""

    # Single combined command: check existence, create dir, write file
    cmd = (
        f"is_update=$(test -f {escaped_path} && echo 1 || echo 0); "
        f"{mkdir_part}"
        f"echo {escape_for_shell(encoded_content)} | base64 -d > {escaped_path} && "
        f'echo "STATUS:$is_update"'
    )

    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    if result.exit_code != 0 or "STATUS:" not in result.stdout:
        return {
            "error": f"Failed to create file: {path}",
            "stderr": result.stderr,
        }

    is_update = "STATUS:1" in result.stdout

    return {
        "is_file_update": is_update,
        "message": f"File {'updated' if is_update else 'created'}: {path}",
    }


def str_replace(
    ctx: "SandboxContext", path: str, old_str: str, new_str: str, timeout: float | None
) -> dict:
    """Replace a string in a file.

    Uses a Python script on the sandbox to avoid transferring the entire file.
    Only the base64-encoded old_str and new_str are sent.

    Args:
        ctx: The sandbox context.
        path: The file path to modify.
        old_str: The exact string to find and replace.
        new_str: The string to replace old_str with.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with success message or error details.
    """
    old_b64 = base64.b64encode(old_str.encode()).decode()
    new_b64 = base64.b64encode(new_str.encode()).decode()

    # Write Python script to a temp file and execute it
    # This avoids shell escaping issues with inline python -c
    py_script = f'''import sys, base64, os
old = base64.b64decode("{old_b64}").decode()
new = base64.b64decode("{new_b64}").decode()
path = "{path}"
if not os.path.exists(path):
    print("FILE_NOT_FOUND")
    sys.exit(1)
with open(path, "r") as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print("NOT_FOUND")
    sys.exit(0)
if count > 1:
    print(f"MULTIPLE:{{count}}")
    sys.exit(0)
with open(path, "w") as f:
    f.write(content.replace(old, new, 1))
print("SUCCESS")
'''
    # Base64 encode the script itself to avoid any escaping issues
    script_b64 = base64.b64encode(py_script.encode()).decode()
    cmd = f"echo {escape_for_shell(script_b64)} | base64 -d | python3"

    result = ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    output = result.stdout.strip()

    if result.exit_code != 0 or output == "FILE_NOT_FOUND":
        return {"error": f"File not found: {path}", "stderr": result.stderr}

    if output == "NOT_FOUND":
        return {"error": f"String not found in file: {old_str[:50]}..."}

    if output.startswith("MULTIPLE:"):
        count = output.split(":")[1]
        return {
            "error": f"Multiple occurrences ({count}) of the string found. "
            "Please provide more context to make the match unique."
        }

    if output == "SUCCESS":
        return {"msg": "Successfully replaced text at exactly one location."}

    return {"error": f"Unexpected response: {output}", "stderr": result.stderr}


# ============================================================================
# Async Operations
# ============================================================================


async def async_view_file(
    ctx: "AsyncSandboxContext",
    path: str,
    view_range: list | None,
    timeout: float | None,
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
    escaped_path = escape_for_shell(path)

    # Build combined command: check existence, get total lines, and view content in one exec
    if view_range and len(view_range) == 2:
        start_line, end_line = view_range
        view_cmd = (
            f"sed -n '{start_line},{end_line}p' {escaped_path} | nl -ba -v {start_line}"
        )
    else:
        max_lines = 200
        view_cmd = f"head -n {max_lines} {escaped_path} | nl -ba"
        start_line = 1

    # Single combined command: outputs "TOTAL:<n>" on first line, then file content
    cmd = (
        f"if [ ! -f {escaped_path} ]; then echo 'FILE_NOT_FOUND'; exit 1; fi; "
        f'echo "TOTAL:$(wc -l < {escaped_path})"; {view_cmd}'
    )

    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    if result.exit_code != 0 or "FILE_NOT_FOUND" in result.stdout:
        return {
            "error": f"File not found: {path}",
            "stderr": result.stderr,
        }

    # Parse output: first line is "TOTAL:<n>", rest is content
    lines = result.stdout.split("\n", 1)
    total_lines = 0
    content = ""

    if lines and lines[0].startswith("TOTAL:"):
        total_str = lines[0][6:].strip()
        total_lines = int(total_str) if total_str.isdigit() else 0
        content = lines[1] if len(lines) > 1 else ""

    content_lines = content.rstrip("\n").split("\n") if content.strip() else []
    num_lines = len(content_lines)

    return {
        "file_type": "text",
        "content": truncate_content(content),
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
    escaped_path = escape_for_shell(path)
    encoded_content = base64.b64encode(file_text.encode()).decode()

    # Get directory path for mkdir
    dir_path = posixpath.dirname(path)
    mkdir_part = f"mkdir -p {escape_for_shell(dir_path)} && " if dir_path else ""

    # Single combined command: check existence, create dir, write file
    cmd = (
        f"is_update=$(test -f {escaped_path} && echo 1 || echo 0); "
        f"{mkdir_part}"
        f"echo {escape_for_shell(encoded_content)} | base64 -d > {escaped_path} && "
        f'echo "STATUS:$is_update"'
    )

    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    if result.exit_code != 0 or "STATUS:" not in result.stdout:
        return {
            "error": f"Failed to create file: {path}",
            "stderr": result.stderr,
        }

    is_update = "STATUS:1" in result.stdout

    return {
        "is_file_update": is_update,
        "message": f"File {'updated' if is_update else 'created'}: {path}",
    }


async def async_str_replace(
    ctx: "AsyncSandboxContext",
    path: str,
    old_str: str,
    new_str: str,
    timeout: float | None,
) -> dict:
    """Replace a string in a file (async).

    Uses a Python script on the sandbox to avoid transferring the entire file.
    Only the base64-encoded old_str and new_str are sent.

    Args:
        ctx: The async sandbox context.
        path: The file path to modify.
        old_str: The exact string to find and replace.
        new_str: The string to replace old_str with.
        timeout: Optional timeout for command execution.

    Returns:
        A dict with success message or error details.
    """
    old_b64 = base64.b64encode(old_str.encode()).decode()
    new_b64 = base64.b64encode(new_str.encode()).decode()

    # Write Python script to a temp file and execute it
    # This avoids shell escaping issues with inline python -c
    py_script = f'''import sys, base64, os
old = base64.b64decode("{old_b64}").decode()
new = base64.b64decode("{new_b64}").decode()
path = "{path}"
if not os.path.exists(path):
    print("FILE_NOT_FOUND")
    sys.exit(1)
with open(path, "r") as f:
    content = f.read()
count = content.count(old)
if count == 0:
    print("NOT_FOUND")
    sys.exit(0)
if count > 1:
    print(f"MULTIPLE:{{count}}")
    sys.exit(0)
with open(path, "w") as f:
    f.write(content.replace(old, new, 1))
print("SUCCESS")
'''
    # Base64 encode the script itself to avoid any escaping issues
    script_b64 = base64.b64encode(py_script.encode()).decode()
    cmd = f"echo {escape_for_shell(script_b64)} | base64 -d | python3"

    result = await ctx.client.sandboxes.exec_command(
        sandbox_id=ctx.sandbox_id,
        command=cmd,
        timeout=timeout,
    )

    output = result.stdout.strip()

    if result.exit_code != 0 or output == "FILE_NOT_FOUND":
        return {"error": f"File not found: {path}", "stderr": result.stderr}

    if output == "NOT_FOUND":
        return {"error": f"String not found in file: {old_str[:50]}..."}

    if output.startswith("MULTIPLE:"):
        count = output.split(":")[1]
        return {
            "error": f"Multiple occurrences ({count}) of the string found. "
            "Please provide more context to make the match unique."
        }

    if output == "SUCCESS":
        return {"msg": "Successfully replaced text at exactly one location."}

    return {"error": f"Unexpected response: {output}", "stderr": result.stderr}
