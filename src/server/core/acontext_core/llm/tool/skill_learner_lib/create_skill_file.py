import hashlib
from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data.artifact import upsert_artifact, get_artifact_by_path
from .ctx import SkillLearnerCtx
from .get_skill_file import _validate_file_path, _split_file_path


async def create_skill_file_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    if not ctx.has_reported_thinking:
        return Result.resolve("You must call report_thinking before making edits.")

    skill_name = llm_arguments.get("skill_name")
    file_path = llm_arguments.get("file_path")
    content = llm_arguments.get("content")

    if not skill_name or not file_path or content is None:
        return Result.resolve(
            "You must provide skill_name, file_path, and content arguments."
        )

    err = _validate_file_path(file_path)
    if err:
        return Result.resolve(err)

    # Forbid creating SKILL.md — use str_replace_skill_file instead
    path, filename = _split_file_path(file_path)
    if filename == "SKILL.md":
        return Result.resolve(
            "Cannot create SKILL.md — it already exists. Use str_replace_skill_file to edit it."
        )

    skill = ctx.skills.get(skill_name)
    if skill is None:
        return Result.resolve(f"Skill '{skill_name}' not found.")

    # Check if file already exists — use str_replace_skill_file to edit existing files
    r = await get_artifact_by_path(ctx.db_session, skill.disk_id, path, filename)
    existing, _ = r.unpack()
    if existing is not None:
        return Result.resolve(
            f"File '{file_path}' already exists in skill '{skill_name}'. "
            f"Use str_replace_skill_file to edit it."
        )

    content_bytes = content.encode("utf-8")
    asset_meta = {
        "bucket": "",
        "s3_key": "",
        "etag": "",
        "sha256": hashlib.sha256(content_bytes).hexdigest(),
        "mime": "text/plain",
        "size_b": len(content_bytes),
        "content": content,
    }
    r = await upsert_artifact(ctx.db_session, skill.disk_id, path, filename, asset_meta)
    _, eil = r.unpack()
    if eil:
        return Result.resolve(f"Failed to create file: {eil}")

    # Update skill file_paths in context
    if file_path not in skill.file_paths:
        skill.file_paths.append(file_path)

    return Result.resolve(f"File '{file_path}' created in skill '{skill_name}'.")


_create_skill_file_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "create_skill_file",
                "description": "Create a new file in an existing skill. Cannot create SKILL.md (use str_replace_skill_file to edit it).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "The name of the skill.",
                        },
                        "file_path": {
                            "type": "string",
                            "description": "The file path to create (e.g., 'scripts/main.py').",
                        },
                        "content": {
                            "type": "string",
                            "description": "The content of the new file.",
                        },
                    },
                    "required": ["skill_name", "file_path", "content"],
                },
            }
        )
    )
    .use_handler(create_skill_file_handler)
)
