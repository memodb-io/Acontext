from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from .ctx import SkillLearnerCtx


async def get_skill_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    skill_name = llm_arguments.get("skill_name")
    if not skill_name:
        return Result.resolve("You must provide a skill_name argument.")

    skill = ctx.skills.get(skill_name)
    if skill is None:
        available = ", ".join(ctx.skills.keys())
        return Result.resolve(
            f"Skill '{skill_name}' not found. Available skills: {available}"
        )

    files_str = "\n".join(f"  - {fp}" for fp in skill.file_paths)
    return Result.resolve(
        f"Skill: {skill.name}\n"
        f"Description: {skill.description}\n"
        f"Files:\n{files_str}"
    )


_get_skill_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "get_skill",
                "description": "Get skill info including its description and file list.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "skill_name": {
                            "type": "string",
                            "description": "The name of the skill to inspect.",
                        },
                    },
                    "required": ["skill_name"],
                },
            }
        )
    )
    .use_handler(get_skill_handler)
)
