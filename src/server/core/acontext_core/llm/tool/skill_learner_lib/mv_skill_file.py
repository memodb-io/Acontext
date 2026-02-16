from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data.artifact import get_artifact_by_path, artifact_exists
from .ctx import SkillLearnerCtx
from .get_skill_file import _validate_file_path, _split_file_path


async def mv_skill_file_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    if not ctx.has_reported_thinking:
        return Result.resolve("You must call report_thinking before making edits.")

    skill_name = llm_arguments.get("skill_name")
    source_path = llm_arguments.get("source_path")
    destination_path = llm_arguments.get("destination_path")

    if not all([skill_name, source_path, destination_path]):
        return Result.resolve(
            "You must provide skill_name, source_path, and destination_path arguments."
        )

    if source_path == destination_path:
        return Result.resolve("source_path and destination_path are the same.")

    for p in (source_path, destination_path):
        err = _validate_file_path(p)
        if err:
            return Result.resolve(err)

    # Protect SKILL.md from being moved
    _, src_filename = _split_file_path(source_path)
    if src_filename == "SKILL.md":
        return Result.resolve("Cannot move SKILL.md — it is required at its current location.")

    _, dst_filename = _split_file_path(destination_path)
    if dst_filename == "SKILL.md":
        return Result.resolve("Cannot overwrite SKILL.md — use str_replace_skill_file to edit it.")

    skill = ctx.skills.get(skill_name)
    if skill is None:
        return Result.resolve(f"Skill '{skill_name}' not found.")

    # Get source artifact
    src_dir, src_file = _split_file_path(source_path)
    r = await get_artifact_by_path(ctx.db_session, skill.disk_id, src_dir, src_file)
    artifact, eil = r.unpack()
    if eil:
        return Result.resolve(
            f"Source file '{source_path}' not found in skill '{skill_name}'."
        )

    # Check destination doesn't already exist
    dst_dir, dst_file = _split_file_path(destination_path)
    if await artifact_exists(ctx.db_session, skill.disk_id, dst_dir, dst_file):
        return Result.resolve(
            f"Destination '{destination_path}' already exists in skill '{skill_name}'."
        )

    # Move by updating path and filename on the ORM object
    artifact.path = dst_dir
    artifact.filename = dst_file
    await ctx.db_session.flush()

    # Update file_paths in context
    if source_path in skill.file_paths:
        skill.file_paths.remove(source_path)
    if destination_path not in skill.file_paths:
        skill.file_paths.append(destination_path)

    return Result.resolve(
        f"File moved: '{source_path}' → '{destination_path}' in skill '{skill_name}'."
    )


_mv_skill_file_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "mv_skill_file",
                "description": "Move or rename a file within a skill. Cannot move SKILL.md.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "The name of the skill.",
                        },
                        "source_path": {
                            "type": "string",
                            "description": "Current file path (e.g., 'old-name.md' or 'docs/old.md').",
                        },
                        "destination_path": {
                            "type": "string",
                            "description": "New file path (e.g., 'new-name.md' or 'notes/new.md').",
                        },
                    },
                    "required": ["skill_name", "source_path", "destination_path"],
                },
            }
        )
    )
    .use_handler(mv_skill_file_handler)
)
