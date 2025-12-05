from dataclasses import dataclass

from .base import BaseContext, BaseTool, BaseToolPool
from ..client import AcontextClient
from ..uploads import FileUpload


@dataclass
class DiskContext(BaseContext):
    client: AcontextClient
    disk_id: str


def _normalize_path(path: str | None) -> str:
    """Normalize a file path to ensure it starts with '/'."""
    if not path:
        return "/"
    normalized = path if path.startswith("/") else f"/{path}"
    if not normalized.endswith("/"):
        normalized += "/"
    return normalized


class WriteFileTool(BaseTool):
    """Tool for writing text content to a file on the Acontext disk."""

    @property
    def name(self) -> str:
        return "write_file"

    @property
    def description(self) -> str:
        return "Write text content to a file in the file system. Creates the file if it doesn't exist, overwrites if it does."

    @property
    def arguments(self) -> dict:
        return {
            "file_path": {
                "type": "string",
                "description": "Optional folder path to organize files, e.g. '/notes/' or '/documents/'. Defaults to root '/' if not specified.",
            },
            "filename": {
                "type": "string",
                "description": "Filename such as 'report.md' or 'demo.txt'.",
            },
            "content": {
                "type": "string",
                "description": "Text content to write to the file.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["filename", "content"]

    def execute(self, ctx: DiskContext, llm_arguments: dict) -> str:
        """Write text content to a file."""
        filename = llm_arguments.get("filename")
        content = llm_arguments.get("content")
        file_path = llm_arguments.get("file_path")

        if not filename:
            raise ValueError("filename is required")
        if not content:
            raise ValueError("content is required")

        normalized_path = _normalize_path(file_path)
        payload = FileUpload(filename=filename, content=content.encode("utf-8"))
        artifact = ctx.client.disks.artifacts.upsert(
            ctx.disk_id,
            file=payload,
            file_path=normalized_path,
        )
        return f"File '{artifact.filename}' written successfully to '{artifact.path}'"


class ReadFileTool(BaseTool):
    """Tool for reading a text file from the Acontext disk."""

    @property
    def name(self) -> str:
        return "read_file"

    @property
    def description(self) -> str:
        return "Read a text file from the file system and return its content."

    @property
    def arguments(self) -> dict:
        return {
            "file_path": {
                "type": "string",
                "description": "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified.",
            },
            "filename": {
                "type": "string",
                "description": "Filename to read.",
            },
            "line_offset": {
                "type": "integer",
                "description": "The line number to start reading from. Default to 0",
            },
            "line_limit": {
                "type": "integer",
                "description": "The maximum number of lines to return. Default to 100",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["filename"]

    def execute(self, ctx: DiskContext, llm_arguments: dict) -> str:
        """Read a text file and return its content preview."""
        filename = llm_arguments.get("filename")
        file_path = llm_arguments.get("file_path")
        line_offset = llm_arguments.get("line_offset", 0)
        line_limit = llm_arguments.get("line_limit", 100)

        if not filename:
            raise ValueError("filename is required")

        normalized_path = _normalize_path(file_path)
        result = ctx.client.disks.artifacts.get(
            ctx.disk_id,
            file_path=normalized_path,
            filename=filename,
            with_content=True,
        )

        if not result.content:
            raise RuntimeError("Failed to read file: server did not return content.")

        content_str = result.content.raw
        lines = content_str.split("\n")
        line_start = min(line_offset, len(lines) - 1)
        line_end = min(line_start + line_limit, len(lines))
        preview = "\n".join(lines[line_start:line_end])
        return f"[{normalized_path}{filename} - showing L{line_start}-{line_end} of {len(lines)} lines]\n{preview}"


class ReplaceStringTool(BaseTool):
    """Tool for replacing an old string with a new string in a file on the Acontext disk."""

    @property
    def name(self) -> str:
        return "replace_string"

    @property
    def description(self) -> str:
        return "Replace an old string with a new string in a file. Reads the file, performs the replacement, and writes it back."

    @property
    def arguments(self) -> dict:
        return {
            "file_path": {
                "type": "string",
                "description": "Optional directory path where the file is located, e.g. '/notes/'. Defaults to root '/' if not specified.",
            },
            "filename": {
                "type": "string",
                "description": "Filename to modify.",
            },
            "old_string": {
                "type": "string",
                "description": "The string to be replaced.",
            },
            "new_string": {
                "type": "string",
                "description": "The string to replace the old_string with.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["filename", "old_string", "new_string"]

    def execute(self, ctx: DiskContext, llm_arguments: dict) -> str:
        """Replace an old string with a new string in a file."""
        filename = llm_arguments.get("filename")
        file_path = llm_arguments.get("file_path")
        old_string = llm_arguments.get("old_string")
        new_string = llm_arguments.get("new_string")

        if not filename:
            raise ValueError("filename is required")
        if old_string is None:
            raise ValueError("old_string is required")
        if new_string is None:
            raise ValueError("new_string is required")

        normalized_path = _normalize_path(file_path)

        # Read the file content
        result = ctx.client.disks.artifacts.get(
            ctx.disk_id,
            file_path=normalized_path,
            filename=filename,
            with_content=True,
        )

        if not result.content:
            raise RuntimeError("Failed to read file: server did not return content.")

        content_str = result.content.raw

        # Perform the replacement
        if old_string not in content_str:
            return f"String '{old_string}' not found in file '{filename}'"

        updated_content = content_str.replace(old_string, new_string)
        replacement_count = content_str.count(old_string)

        # Write the updated content back
        payload = FileUpload(filename=filename, content=updated_content.encode("utf-8"))
        ctx.client.disks.artifacts.upsert(
            ctx.disk_id,
            file=payload,
            file_path=normalized_path,
        )

        return f"Found {replacement_count} old_string in {normalized_path}{filename} and replaced it."


class ListArtifactsTool(BaseTool):
    """Tool for listing artifacts in a directory on the Acontext disk."""

    @property
    def name(self) -> str:
        return "list_artifacts"

    @property
    def description(self) -> str:
        return "List all artifacts (files) and directories in a specified path on the disk."

    @property
    def arguments(self) -> dict:
        return {
            "file_path": {
                "type": "string",
                "description": "Optional directory path to list, e.g. '/todo/' or '/notes/'. Root is '/'",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["file_path"]

    def execute(self, ctx: DiskContext, llm_arguments: dict) -> str:
        """List all artifacts in a specified path."""
        file_path = llm_arguments.get("file_path")
        normalized_path = _normalize_path(file_path)

        result = ctx.client.disks.artifacts.list(
            ctx.disk_id,
            path=normalized_path,
        )

        artifacts_list = [artifact.filename for artifact in result.artifacts]

        if not artifacts_list and not result.directories:
            return f"No artifacts or directories found in '{normalized_path}'"

        output_parts = []
        if artifacts_list:
            output_parts.append(f"Files: {', '.join(artifacts_list)}")
        if result.directories:
            output_parts.append(f"Directories: {', '.join(result.directories)}")

        ls_sect = "\n".join(output_parts)
        return f"""[Listing in {normalized_path}]
{ls_sect}"""


class DiskToolPool(BaseToolPool):
    """Tool pool for disk operations on Acontext disks."""

    def format_context(self, client: AcontextClient, disk_id: str) -> DiskContext:
        return DiskContext(client=client, disk_id=disk_id)


DISK_TOOLS = DiskToolPool()
DISK_TOOLS.add_tool(WriteFileTool())
DISK_TOOLS.add_tool(ReadFileTool())
DISK_TOOLS.add_tool(ReplaceStringTool())
DISK_TOOLS.add_tool(ListArtifactsTool())


if __name__ == "__main__":
    client = AcontextClient(
        api_key="sk-ac-your-root-api-bearer-token",
        base_url="http://localhost:8029/api/v1",
    )
    print(client.ping())
    new_disk = client.disks.create()

    ctx = DISK_TOOLS.format_context(client, new_disk.id)
    r = DISK_TOOLS.execute_tool(
        ctx,
        "write_file",
        {"filename": "test.txt", "file_path": "/try/", "content": "Hello, world!"},
    )
    print(r)
    r = DISK_TOOLS.execute_tool(
        ctx, "read_file", {"filename": "test.txt", "file_path": "/try/"}
    )
    print(r)
    r = DISK_TOOLS.execute_tool(ctx, "list_artifacts", {"file_path": "/"})
    print(r)

    r = DISK_TOOLS.execute_tool(
        ctx,
        "replace_string",
        {
            "filename": "test.txt",
            "file_path": "/try/",
            "old_string": "Hello",
            "new_string": "Hi",
        },
    )
    print(r)
    r = DISK_TOOLS.execute_tool(
        ctx, "read_file", {"filename": "test.txt", "file_path": "/try/"}
    )
    print(r)
