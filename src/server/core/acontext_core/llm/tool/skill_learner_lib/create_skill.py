from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data.agent_skill import create_skill as db_create_skill
from ....service.data.learning_space import add_skill_to_learning_space, SkillInfo, join_artifact_path
from ....service.data.artifact import list_artifacts_by_path
from .ctx import SkillLearnerCtx


async def create_skill_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    if not ctx.has_reported_thinking:
        return Result.resolve("You must call report_thinking before making edits.")

    skill_md_content = llm_arguments.get("skill_md_content")
    if not skill_md_content:
        return Result.resolve("You must provide skill_md_content argument.")

    # Create skill (Disk + AgentSkill + SKILL.md artifact)
    r = await db_create_skill(
        ctx.db_session,
        ctx.project_id,
        skill_md_content,
        user_id=ctx.user_id,
    )
    skill, eil = r.unpack()
    if eil:
        return Result.resolve(f"Failed to create skill: {eil}")

    # Add to learning space
    r = await add_skill_to_learning_space(
        ctx.db_session, ctx.learning_space_id, skill.id
    )
    _, eil = r.unpack()
    if eil:
        return Result.resolve(f"Failed to add skill to learning space: {eil}")

    # Collect file paths
    r = await list_artifacts_by_path(ctx.db_session, skill.disk_id)
    artifacts, eil = r.unpack()
    file_paths = []
    if not eil:
        file_paths = [join_artifact_path(a.path, a.filename) for a in artifacts]

    # Register in context so agent can use it immediately
    ctx.skills[skill.name] = SkillInfo(
        id=skill.id,
        disk_id=skill.disk_id,
        name=skill.name,
        description=skill.description,
        file_paths=file_paths,
    )

    return Result.resolve(
        f"Skill '{skill.name}' created and added to learning space. "
        f"You can now use get_skill_file to read or str_replace_skill_file to edit its files."
    )


_create_skill_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "create_skill",
                "description": "Create a brand new skill in the learning space. Provide the full SKILL.md content with valid YAML front matter (name and description fields).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_md_content": {
                            "type": "string",
                            "description": "The full content of SKILL.md with YAML front matter containing 'name' and 'description' fields.",
                        },
                    },
                    "required": ["skill_md_content"],
                },
            }
        )
    )
    .use_handler(create_skill_handler)
)
