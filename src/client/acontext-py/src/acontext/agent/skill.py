"""
Skill tools for agent operations.
"""

from dataclasses import dataclass, field

from .base import BaseContext, BaseTool, BaseToolPool
from ..client import AcontextClient
from ..async_client import AcontextAsyncClient
from ..types.skill import Skill


@dataclass
class SkillContext(BaseContext):
    """Context for skill tools with preloaded skill name mapping."""

    client: AcontextClient
    skills: dict[str, Skill] = field(default_factory=dict)

    def get_context_prompt(self) -> str:
        """Return available skills formatted as XML."""
        if not self.skills:
            return ""

        lines = ["<available_skills>"]
        for skill_name, skill in self.skills.items():
            lines.append("<skill>")
            lines.append(f"<name>{skill_name}</name>")
            lines.append(f"<description>{skill.description}</description>")
            lines.append("</skill>")
        lines.append("</available_skills>")
        return "\n".join(lines)

    @classmethod
    def create(cls, client: AcontextClient, skill_ids: list[str]) -> "SkillContext":
        """Create a SkillContext by preloading skills from a list of skill IDs.

        Args:
            client: The Acontext client instance.
            skill_ids: List of skill UUIDs to preload.

        Returns:
            SkillContext with preloaded skills mapped by name.

        Raises:
            ValueError: If duplicate skill names are found.
        """
        skills: dict[str, Skill] = {}
        for skill_id in skill_ids:
            skill = client.skills.get(skill_id)
            if skill.name in skills:
                raise ValueError(
                    f"Duplicate skill name '{skill.name}' found. "
                    f"Existing ID: {skills[skill.name].id}, New ID: {skill.id}"
                )
            skills[skill.name] = skill
        return cls(client=client, skills=skills)

    def get_skill(self, skill_name: str) -> Skill:
        """Get a skill by name from the preloaded skills.

        Args:
            skill_name: The name of the skill.

        Returns:
            The Skill object.

        Raises:
            ValueError: If the skill is not found in the context.
        """
        if skill_name not in self.skills:
            available = ", ".join(self.skills.keys()) if self.skills else "[none]"
            raise ValueError(
                f"Skill '{skill_name}' not found in context. Available skills: {available}"
            )
        return self.skills[skill_name]

    def list_skill_names(self) -> list[str]:
        """Return list of available skill names in this context."""
        return list(self.skills.keys())


@dataclass
class AsyncSkillContext(BaseContext):
    """Async context for skill tools with preloaded skill name mapping."""

    client: AcontextAsyncClient
    skills: dict[str, Skill] = field(default_factory=dict)

    def get_context_prompt(self) -> str:
        """Return available skills formatted as XML."""
        if not self.skills:
            return ""

        lines = ["<available_skills>"]
        for skill_name, skill in self.skills.items():
            lines.append("<skill>")
            lines.append(f"<name>{skill_name}</name>")
            lines.append(f"<description>{skill.description}</description>")
            lines.append("</skill>")
        lines.append("</available_skills>")
        skill_section = "\n".join(lines)
        return f"""<skill_view>
Use get_skill and get_skill_file to view the available skills and their contexts.
Below is the list of available skills:
{skill_section}        
</skill_view>
"""

    @classmethod
    async def create(
        cls, client: AcontextAsyncClient, skill_ids: list[str]
    ) -> "AsyncSkillContext":
        """Create an AsyncSkillContext by preloading skills from a list of skill IDs.

        Args:
            client: The Acontext async client instance.
            skill_ids: List of skill UUIDs to preload.

        Returns:
            AsyncSkillContext with preloaded skills mapped by name.

        Raises:
            ValueError: If duplicate skill names are found.
        """
        skills: dict[str, Skill] = {}
        for skill_id in skill_ids:
            skill = await client.skills.get(skill_id)
            if skill.name in skills:
                raise ValueError(
                    f"Duplicate skill name '{skill.name}' found. "
                    f"Existing ID: {skills[skill.name].id}, New ID: {skill.id}"
                )
            skills[skill.name] = skill
        return cls(client=client, skills=skills)

    def get_skill(self, skill_name: str) -> Skill:
        """Get a skill by name from the preloaded skills.

        Args:
            skill_name: The name of the skill.

        Returns:
            The Skill object.

        Raises:
            ValueError: If the skill is not found in the context.
        """
        if skill_name not in self.skills:
            available = ", ".join(self.skills.keys()) if self.skills else "[none]"
            raise ValueError(
                f"Skill '{skill_name}' not found in context. Available skills: {available}"
            )
        return self.skills[skill_name]

    def list_skill_names(self) -> list[str]:
        """Return list of available skill names in this context."""
        return list(self.skills.keys())


class GetSkillTool(BaseTool):
    """Tool for getting a skill by name."""

    @property
    def name(self) -> str:
        return "get_skill"

    @property
    def description(self) -> str:
        return (
            "Get a skill by its name. Returns the skill information including "
            "the relative paths of the files and their mime type categories."
        )

    @property
    def arguments(self) -> dict:
        return {
            "skill_name": {
                "type": "string",
                "description": "The name of the skill.",
            },
        }

    @property
    def required_arguments(self) -> list[str]:
        return ["skill_name"]

    def execute(self, ctx: SkillContext, llm_arguments: dict) -> str:
        """Get a skill by name."""
        skill_name = llm_arguments.get("skill_name")

        if not skill_name:
            raise ValueError("skill_name is required")

        skill = ctx.get_skill(skill_name)

        file_count = len(skill.file_index)

        # Format all files with path and MIME type
        if skill.file_index:
            file_list = "\n".join(
                [
                    f"  - {file_info.path} ({file_info.mime})"
                    for file_info in skill.file_index
                ]
            )
        else:
            file_list = "  [NO FILES]"

        return (
            f"Skill: {skill.name} (ID: {skill.id})\n"
            f"Description: {skill.description}\n"
            f"Files: {file_count} file(s)\n"
            f"{file_list}"
        )

    async def async_execute(self, ctx: AsyncSkillContext, llm_arguments: dict) -> str:
        """Get a skill by name (async)."""
        skill_name = llm_arguments.get("skill_name")

        if not skill_name:
            raise ValueError("skill_name is required")

        skill = ctx.get_skill(skill_name)

        file_count = len(skill.file_index)

        # Format all files with path and MIME type
        if skill.file_index:
            file_list = "\n".join(
                [
                    f"  - {file_info.path} ({file_info.mime})"
                    for file_info in skill.file_index
                ]
            )
        else:
            file_list = "  [NO FILES]"

        return (
            f"Skill: {skill.name} (ID: {skill.id})\n"
            f"Description: {skill.description}\n"
            f"Files: {file_count} file(s)\n"
            f"{file_list}"
        )


class GetSkillFileTool(BaseTool):
    """Tool for getting a file from a skill."""

    @property
    def name(self) -> str:
        return "get_skill_file"

    @property
    def description(self) -> str:
        return (
            "Get a file from a skill by name. The file_path should be a relative "
            "path within the skill (e.g., 'scripts/extract_text.json')."
            "Tips: SKILL.md is the first file you should read to understand the full picture of this skill's content."
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
                "type": ["integer", "null"],
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

        if not skill_name:
            raise ValueError("skill_name is required")
        if not file_path:
            raise ValueError("file_path is required")

        skill = ctx.get_skill(skill_name)

        result = ctx.client.skills.get_file(
            skill_id=skill.id,
            file_path=file_path,
            expire=expire,
        )

        output_parts = [
            f"File '{result.path}' (MIME: {result.mime}) from skill '{skill_name}':"
        ]

        if result.content:
            output_parts.append(f"\nContent (type: {result.content.type}):")
            output_parts.append(result.content.raw)

        if result.url:
            expire_seconds = expire if expire is not None else 900
            output_parts.append(
                f"\nDownload URL (expires in {expire_seconds} seconds):"
            )
            output_parts.append(result.url)

        if not result.content and not result.url:
            return f"File '{result.path}' retrieved but no content or URL returned."

        return "\n".join(output_parts)

    async def async_execute(self, ctx: AsyncSkillContext, llm_arguments: dict) -> str:
        """Get a skill file (async)."""
        skill_name = llm_arguments.get("skill_name")
        file_path = llm_arguments.get("file_path")
        expire = llm_arguments.get("expire")

        if not skill_name:
            raise ValueError("skill_name is required")
        if not file_path:
            raise ValueError("file_path is required")

        skill = ctx.get_skill(skill_name)

        result = await ctx.client.skills.get_file(
            skill_id=skill.id,
            file_path=file_path,
            expire=expire,
        )

        output_parts = [
            f"File '{result.path}' (MIME: {result.mime}) from skill '{skill_name}':"
        ]

        if result.content:
            output_parts.append(f"\nContent (type: {result.content.type}):")
            output_parts.append(result.content.raw)

        if result.url:
            expire_seconds = expire if expire is not None else 900
            output_parts.append(
                f"\nDownload URL (expires in {expire_seconds} seconds):"
            )
            output_parts.append(result.url)

        if not result.content and not result.url:
            return f"File '{result.path}' retrieved but no content or URL returned."

        return "\n".join(output_parts)


class SkillToolPool(BaseToolPool):
    """Tool pool for skill operations on Acontext skills."""

    def format_context(
        self, client: AcontextClient, skill_ids: list[str]
    ) -> SkillContext:
        """Create a SkillContext by preloading skills from a list of skill IDs.

        Args:
            client: The Acontext client instance.
            skill_ids: List of skill UUIDs to preload.

        Returns:
            SkillContext with preloaded skills mapped by name.
        """
        return SkillContext.create(client=client, skill_ids=skill_ids)

    async def async_format_context(
        self, client: AcontextAsyncClient, skill_ids: list[str]
    ) -> AsyncSkillContext:
        """Create an AsyncSkillContext by preloading skills from a list of skill IDs.

        Args:
            client: The Acontext async client instance.
            skill_ids: List of skill UUIDs to preload.

        Returns:
            AsyncSkillContext with preloaded skills mapped by name.
        """
        return await AsyncSkillContext.create(client=client, skill_ids=skill_ids)


SKILL_TOOLS = SkillToolPool()
SKILL_TOOLS.add_tool(GetSkillTool())
SKILL_TOOLS.add_tool(GetSkillFileTool())
