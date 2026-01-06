"""
Skill tools for agent operations.
"""

from dataclasses import dataclass

from .base import BaseContext, BaseTool, BaseToolPool
from ..client import AcontextClient


@dataclass
class SkillContext(BaseContext):
    client: AcontextClient


class CreateSkillTool(BaseTool):
    """Tool for creating a new skill by uploading a ZIP file."""

    @property
    def name(self) -> str:
        return "create_skill"

    @property
    def description(self) -> str:
        return (
            "Create a new agent skill by uploading a ZIP file. "
            "The ZIP file must contain a SKILL.md file (case-insensitive) with YAML format "
            "containing 'name' and 'description' fields. "
            "Returns the created skill with its ID, name, description, and file index."
        )

    @property
    def arguments(self) -> dict:
        return {
            "file_path": {
                "type": "string",
                "description": "Local file path to the ZIP file containing the skill.",
            },
            "meta": {
                "type": "object",
                "description": "Optional custom metadata as a JSON object.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["file_path"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Create a new skill."""
        file_path = llm_arguments.get("file_path")
        meta = llm_arguments.get("meta")

        if not file_path:
            raise ValueError("file_path is required")

        # Read the ZIP file
        try:
            with open(file_path, "rb") as f:
                file_content = f.read()
        except FileNotFoundError:
            raise ValueError(f"File not found: {file_path}")
        except Exception as e:
            raise ValueError(f"Failed to read file: {e}")

        import os
        from ..uploads import FileUpload

        upload = FileUpload(
            filename=os.path.basename(file_path) or "skill.zip",
            content=file_content,
            content_type="application/zip",
        )

        skill = ctx.client.skills.create(file=upload, meta=meta)
        file_count = len(skill.file_index)
        return (
            f"Skill '{skill.name}' created successfully (ID: {skill.id}). "
            f"Description: {skill.description}. "
            f"Contains {file_count} file(s)."
        )


class GetSkillTool(BaseTool):
    """Tool for getting a skill by ID or name."""

    @property
    def name(self) -> str:
        return "get_skill"

    @property
    def description(self) -> str:
        return (
            "Get a skill by its ID or name. "
            "Returns the skill information including name, description, file index, and metadata."
        )

    @property
    def arguments(self) -> dict:
        return {
            "skill_id": {
                "type": "string",
                "description": "The UUID of the skill. Either skill_id or name must be provided.",
            },
            "name": {
                "type": "string",
                "description": "The name of the skill (unique within project). Either skill_id or name must be provided.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return []

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Get a skill by ID or name."""
        skill_id = llm_arguments.get("skill_id")
        name = llm_arguments.get("name")

        if not skill_id and not name:
            raise ValueError("Either skill_id or name must be provided")

        if skill_id:
            skill = ctx.client.skills.get(skill_id)
        else:
            skill = ctx.client.skills.get_by_name(name)

        file_count = len(skill.file_index)
        file_list = ", ".join(skill.file_index[:10])  # Show first 10 files
        if len(skill.file_index) > 10:
            file_list += f", ... ({len(skill.file_index) - 10} more)"

        return (
            f"Skill: {skill.name} (ID: {skill.id})\n"
            f"Description: {skill.description}\n"
            f"Files: {file_count} file(s) - {file_list}\n"
            f"Created: {skill.created_at}\n"
            f"Updated: {skill.updated_at}"
        )


class ListSkillsTool(BaseTool):
    """Tool for listing all skills in the project."""

    @property
    def name(self) -> str:
        return "list_skills"

    @property
    def description(self) -> str:
        return (
            "List all skills in the project. "
            "Returns a list of skills with their names, descriptions, and file counts."
        )

    @property
    def arguments(self) -> dict:
        return {
            "limit": {
                "type": "integer",
                "description": "Maximum number of skills to return. Defaults to 20.",
            },
            "time_desc": {
                "type": "boolean",
                "description": "Order by created_at descending if true, ascending if false. Defaults to false.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return []

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """List all skills."""
        limit = llm_arguments.get("limit", 20)
        time_desc = llm_arguments.get("time_desc", False)

        result = ctx.client.skills.list(limit=limit, time_desc=time_desc)

        if not result.items:
            return "No skills found in the project."

        output_parts = [
            f"Found {len(result.items)} skill(s):",
        ]
        for skill in result.items:
            file_count = len(skill.file_index)
            output_parts.append(
                f"  - {skill.name} (ID: {skill.id}): {skill.description} "
                f"({file_count} file(s))"
            )

        if result.has_more:
            output_parts.append(f"\n(More skills available, use cursor for pagination)")

        return "\n".join(output_parts)


class UpdateSkillTool(BaseTool):
    """Tool for updating a skill's metadata."""

    @property
    def name(self) -> str:
        return "update_skill"

    @property
    def description(self) -> str:
        return (
            "Update a skill's metadata (name, description, or custom metadata). "
            "Note: This only updates metadata, not the skill files themselves."
        )

    @property
    def arguments(self) -> dict:
        return {
            "skill_id": {
                "type": "string",
                "description": "The UUID of the skill to update.",
            },
            "name": {
                "type": "string",
                "description": "Optional new name for the skill.",
            },
            "description": {
                "type": "string",
                "description": "Optional new description for the skill.",
            },
            "meta": {
                "type": "object",
                "description": "Optional custom metadata as a JSON object.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["skill_id"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Update a skill."""
        skill_id = llm_arguments.get("skill_id")
        name = llm_arguments.get("name")
        description = llm_arguments.get("description")
        meta = llm_arguments.get("meta")

        if not skill_id:
            raise ValueError("skill_id is required")

        if not name and not description and not meta:
            raise ValueError("At least one of name, description, or meta must be provided")

        skill = ctx.client.skills.update(
            skill_id, name=name, description=description, meta=meta
        )

        return (
            f"Skill '{skill.name}' (ID: {skill.id}) updated successfully. "
            f"Description: {skill.description}"
        )


class DeleteSkillTool(BaseTool):
    """Tool for deleting a skill."""

    @property
    def name(self) -> str:
        return "delete_skill"

    @property
    def description(self) -> str:
        return (
            "Delete a skill by its ID. "
            "This will delete the skill and all its associated files from storage."
        )

    @property
    def arguments(self) -> dict:
        return {
            "skill_id": {
                "type": "string",
                "description": "The UUID of the skill to delete.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["skill_id"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Delete a skill."""
        skill_id = llm_arguments.get("skill_id")

        if not skill_id:
            raise ValueError("skill_id is required")

        # Get skill info before deletion for the response
        try:
            skill = ctx.client.skills.get(skill_id)
            skill_name = skill.name
        except Exception:
            skill_name = skill_id

        ctx.client.skills.delete(skill_id)

        return f"Skill '{skill_name}' (ID: {skill_id}) deleted successfully."


class GetSkillFileTool(BaseTool):
    """Tool for getting a presigned URL to download a file from a skill."""

    @property
    def name(self) -> str:
        return "get_skill_file"

    @property
    def description(self) -> str:
        return (
            "Get a presigned URL to download a specific file from a skill. "
            "The file_path should be a relative path within the skill (e.g., 'scripts/extract_text.json'). "
            "Returns a URL that can be used to download the file."
        )

    @property
    def arguments(self) -> dict:
        return {
            "skill_id": {
                "type": "string",
                "description": "The UUID of the skill.",
            },
            "file_path": {
                "type": "string",
                "description": "Relative path to the file within the skill (e.g., 'scripts/extract_text.json').",
            },
            "expire": {
                "type": "integer",
                "description": "URL expiration time in seconds. Defaults to 900 (15 minutes).",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["skill_id", "file_path"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Get a skill file URL."""
        skill_id = llm_arguments.get("skill_id")
        file_path = llm_arguments.get("file_path")
        expire = llm_arguments.get("expire")

        if not skill_id:
            raise ValueError("skill_id is required")
        if not file_path:
            raise ValueError("file_path is required")

        result = ctx.client.skills.get_file_url(
            skill_id, file_path=file_path, expire=expire
        )

        expire_seconds = expire if expire is not None else 900
        return (
            f"File URL for '{file_path}' in skill '{skill_id}':\n"
            f"{result.url}\n"
            f"(URL expires in {expire_seconds} seconds)"
        )


class SkillToolPool(BaseToolPool):
    """Tool pool for skill operations on Acontext skills."""

    def format_context(self, client: AcontextClient) -> SkillContext:
        return SkillContext(client=client)


SKILL_TOOLS = SkillToolPool()
SKILL_TOOLS.add_tool(CreateSkillTool())
SKILL_TOOLS.add_tool(GetSkillTool())
SKILL_TOOLS.add_tool(ListSkillsTool())
SKILL_TOOLS.add_tool(UpdateSkillTool())
SKILL_TOOLS.add_tool(DeleteSkillTool())
SKILL_TOOLS.add_tool(GetSkillFileTool())

