from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data.artifact import get_artifact_by_path, upsert_artifact, upload_and_build_artifact_meta
from ....service.data.agent_skill import _parse_skill_md, _sanitize_name, get_agent_skill
from .ctx import SkillLearnerCtx
from .get_skill_file import _validate_file_path, _split_file_path


async def str_replace_skill_file_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    if not ctx.has_reported_thinking:
        return Result.resolve("You must call report_thinking before making edits.")

    skill_name = llm_arguments.get("skill_name")
    file_path = llm_arguments.get("file_path")
    old_string = llm_arguments.get("old_string")
    new_string = llm_arguments.get("new_string")

    if not skill_name or not file_path or old_string is None or new_string is None:
        return Result.resolve(
            "You must provide skill_name, file_path, old_string, and new_string arguments."
        )

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
    count = content.count(old_string)
    if count == 0:
        return Result.resolve(
            f"old_string not found in '{file_path}'. Make sure it matches exactly."
        )
    if count > 1:
        return Result.resolve(
            f"old_string found {count} times in '{file_path}'. Provide more context to make it unique."
        )

    new_content = content.replace(old_string, new_string, 1)

    # If editing SKILL.md, validate YAML before writing
    _parsed_description = None
    if filename == "SKILL.md":
        try:
            parsed_name, _parsed_description = _parse_skill_md(new_content)
        except Exception as e:
            return Result.resolve(f"Edit rejected: {e}")

        if _sanitize_name(parsed_name) != skill.name:
            return Result.resolve(
                f"Edit rejected: changing skill name is forbidden "
                f"(was '{skill.name}', got '{parsed_name}')"
            )

    asset_meta, new_artifact_info_meta = await upload_and_build_artifact_meta(
        ctx.project_id, path, filename, new_content
    )
    merged_meta = dict(artifact.meta) if artifact.meta else {}
    merged_meta.update(new_artifact_info_meta)
    r = await upsert_artifact(ctx.db_session, skill.disk_id, path, filename, asset_meta, meta=merged_meta)
    _, eil = r.unpack()
    if eil:
        return Result.resolve(f"Failed to save file: {eil}")

    # Update AgentSkill.description only after artifact upsert succeeds
    if _parsed_description is not None:
        r = await get_agent_skill(ctx.db_session, ctx.project_id, skill.id)
        agent_skill, eil = r.unpack()
        if eil:
            return Result.resolve(f"Failed to fetch AgentSkill: {eil}")
        agent_skill.description = _parsed_description
        skill.description = _parsed_description

    return Result.resolve(f"File '{file_path}' in skill '{skill_name}' updated successfully.")


_str_replace_skill_file_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "str_replace_skill_file",
                "description": "Edit a file in a skill by replacing a string. The old_string must appear exactly once in the file.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "The name of the skill.",
                        },
                        "file_path": {
                            "type": "string",
                            "description": "The file path within the skill.",
                        },
                        "old_string": {
                            "type": "string",
                            "description": "The exact string to find and replace.",
                        },
                        "new_string": {
                            "type": "string",
                            "description": "The replacement string.",
                        },
                    },
                    "required": ["skill_name", "file_path", "old_string", "new_string"],
                },
            }
        )
    )
    .use_handler(str_replace_skill_file_handler)
)
