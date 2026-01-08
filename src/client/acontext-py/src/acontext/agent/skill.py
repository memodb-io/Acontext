"""
Skill tools for agent operations.
"""

from dataclasses import dataclass

from .base import BaseContext, BaseTool, BaseToolPool
from ..client import AcontextClient


@dataclass
class SkillContext(BaseContext):
    client: AcontextClient


class GetSkillTool(BaseTool):
    """Tool for getting a skill by name."""

    @property
    def name(self) -> str:
        return "get_skill"

    @property
    def description(self) -> str:
        return (
            "Get a skill by its name. "
            "Returns the skill information including name, description, file index, and metadata."
        )

    @property
    def arguments(self) -> dict:
        return {
            "name": {
                "type": "string",
                "description": "The name of the skill (unique within project).",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["name"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Get a skill by name."""
        name = llm_arguments.get("name")

        if not name:
            raise ValueError("name is required")

        skill = ctx.client.skills.get_by_name(name)

        file_count = len(skill.file_index)
        file_paths = [file_info.path for file_info in skill.file_index[:10]]
        file_list = ", ".join(file_paths)  # Show first 10 files
        if len(skill.file_index) > 10:
            file_list += f", ... ({len(skill.file_index) - 10} more)"

        return (
            f"Skill: {skill.name} (ID: {skill.id})\n"
            f"Description: {skill.description}\n"
            f"Files: {file_count} file(s) - {file_list}\n"
            f"Created: {skill.created_at}\n"
            f"Updated: {skill.updated_at}"
        )


class GetSkillFileTool(BaseTool):
    """Tool for getting a file from a skill."""

    @property
    def name(self) -> str:
        return "get_skill_file"

    @property
    def description(self) -> str:
        return (
            "Get a file from a skill by name. "
            "The file_path should be a relative path within the skill (e.g., 'scripts/extract_text.json'). "
            "Can return the file content directly or a presigned URL for downloading. "
            "Supports text files, JSON, CSV, and code files."
        )

    @property
    def arguments(self) -> dict:
        return {
            "skill_name": {
                "type": "string",
                "description": "The name of the skill.",
            },
            "file_path": {
                "type": "string",
                "description": "Relative path to the file within the skill (e.g., 'scripts/extract_text.json').",
            },
            "expire": {
                "type": "integer",
                "description": "URL expiration time in seconds (only used for non-parseable files). Defaults to 900 (15 minutes).",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["skill_name", "file_path"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Get a skill file."""
        skill_name = llm_arguments.get("skill_name")
        file_path = llm_arguments.get("file_path")
        expire = llm_arguments.get("expire")

        if not file_path:
            raise ValueError("file_path is required")
        if not skill_name:
            raise ValueError("skill_name is required")

        result = ctx.client.skills.get_file_by_name(
            skill_name=skill_name,
            file_path=file_path,
            expire=expire,
        )

        output_parts = [f"File '{result.path}' (MIME: {result.mime}) from skill '{skill_name}':"]

        if result.content:
            output_parts.append(f"\nContent (type: {result.content.type}):")
            output_parts.append(result.content.raw)

        if result.url:
            expire_seconds = expire if expire is not None else 900
            output_parts.append(f"\nDownload URL (expires in {expire_seconds} seconds):")
            output_parts.append(result.url)

        if not result.content and not result.url:
            return f"File '{result.path}' retrieved but no content or URL returned."

        return "\n".join(output_parts)


class SkillToolPool(BaseToolPool):
    """Tool pool for skill operations on Acontext skills."""

    def format_context(self, client: AcontextClient) -> SkillContext:
        return SkillContext(client=client)


SKILL_TOOLS = SkillToolPool()
SKILL_TOOLS.add_tool(GetSkillTool())
SKILL_TOOLS.add_tool(GetSkillFileTool())
