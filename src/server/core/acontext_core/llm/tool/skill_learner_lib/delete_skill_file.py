from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data.artifact import delete_artifact_by_path
from .ctx import SkillLearnerCtx
from .get_skill_file import _validate_file_path, _split_file_path


async def delete_skill_file_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    if not ctx.has_reported_thinking:
        return Result.resolve("You must call report_thinking before making edits.")

    skill_name = llm_arguments.get("skill_name")
    file_path = llm_arguments.get("file_path")

    if not all([skill_name, file_path]):
        return Result.resolve("You must provide skill_name and file_path arguments.")

    err = _validate_file_path(file_path)
    if err:
        return Result.resolve(err)

    path, filename = _split_file_path(file_path)
    if filename == "SKILL.md":
        return Result.resolve("Cannot delete SKILL.md — it is required for the skill to exist.")

    skill = ctx.skills.get(skill_name)
    if skill is None:
        return Result.resolve(f"Skill '{skill_name}' not found.")

    r = await delete_artifact_by_path(ctx.db_session, skill.disk_id, path, filename)
    _, eil = r.unpack()
    if eil:
        return Result.resolve(f"Failed to delete file: {eil}")

    # Update skill file_paths in context
    if file_path in skill.file_paths:
        skill.file_paths.remove(file_path)

    return Result.resolve(f"File '{file_path}' deleted from skill '{skill_name}'.")


_delete_skill_file_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "delete_skill_file",
                "description": "Delete a file from a skill. Cannot delete SKILL.md.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "The name of the skill.",
                        },
                        "file_path": {
                            "type": "string",
                            "description": "The file path to delete.",
                        },
                    },
                    "required": ["skill_name", "file_path"],
                },
            }
        )
    )
    .use_handler(delete_skill_file_handler)
)
