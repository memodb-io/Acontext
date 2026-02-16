import os
from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data.artifact import get_artifact_by_path
from .ctx import SkillLearnerCtx


def _validate_file_path(file_path: str) -> str | None:
    """Validate file path. Returns error message if invalid, None if valid."""
    if ".." in file_path:
        return "Path traversal (..) is not allowed."
    if os.path.isabs(file_path):
        return "Absolute paths are not allowed."
    return None


def _split_file_path(file_path: str) -> tuple[str, str]:
    """Split file_path into (path, filename) for artifact query."""
    if "/" in file_path:
        parts = file_path.rsplit("/", 1)
        return f"{parts[0]}/", parts[1]
    return "/", file_path


async def get_skill_file_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    skill_name = llm_arguments.get("skill_name")
    file_path = llm_arguments.get("file_path")
    if not skill_name or not file_path:
        return Result.resolve("You must provide both skill_name and file_path arguments.")

    err = _validate_file_path(file_path)
    if err:
        return Result.resolve(err)

    skill = ctx.skills.get(skill_name)
    if skill is None:
        return Result.resolve(f"Skill '{skill_name}' not found.")

    path, filename = _split_file_path(file_path)
    r = await get_artifact_by_path(ctx.db_session, skill.disk_id, path, filename)
    artifact, eil = r.unpack()
    if eil:
        return Result.resolve(f"File '{file_path}' not found in skill '{skill_name}'.")

    content = artifact.asset_meta.get("content", "")
    return Result.resolve(content)


_get_skill_file_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "get_skill_file",
                "description": "Read the content of a file in a skill.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "The name of the skill.",
                        },
                        "file_path": {
                            "type": "string",
                            "description": "The file path within the skill (e.g., 'SKILL.md', 'scripts/main.py').",
                        },
                    },
                    "required": ["skill_name", "file_path"],
                },
            }
        )
    )
    .use_handler(get_skill_file_handler)
)
