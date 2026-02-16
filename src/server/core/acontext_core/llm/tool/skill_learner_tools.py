from .base import Tool, ToolPool
from ...schema.llm import ToolSchema
from ...schema.result import Result
from .util_lib.finish import _finish_tool
from .util_lib.think import _thinking_handler
from .skill_learner_lib.get_skill import _get_skill_tool
from .skill_learner_lib.get_skill_file import _get_skill_file_tool
from .skill_learner_lib.str_replace_skill_file import _str_replace_skill_file_tool
from .skill_learner_lib.create_skill_file import _create_skill_file_tool
from .skill_learner_lib.create_skill import _create_skill_tool
from .skill_learner_lib.delete_skill_file import _delete_skill_file_tool
from .skill_learner_lib.ctx import SkillLearnerCtx


async def _skill_learner_thinking_handler(
    ctx: SkillLearnerCtx,
    llm_arguments: dict,
) -> Result[str]:
    r = await _thinking_handler(ctx, llm_arguments)
    _, eil = r.unpack()
    if not eil:
        ctx.has_reported_thinking = True
    return r


_skill_learner_thinking_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "report_thinking",
                "description": "Use this tool to report your thinking step by step. You MUST call this before making any edits.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "thinking": {
                            "type": "string",
                            "description": "Report your thinking here.",
                        },
                    },
                    "required": ["thinking"],
                },
            }
        )
    )
    .use_handler(_skill_learner_thinking_handler)
)


SKILL_LEARNER_TOOLS: ToolPool = {}

SKILL_LEARNER_TOOLS[_get_skill_tool.schema.function.name] = _get_skill_tool
SKILL_LEARNER_TOOLS[_get_skill_file_tool.schema.function.name] = _get_skill_file_tool
SKILL_LEARNER_TOOLS[_str_replace_skill_file_tool.schema.function.name] = (
    _str_replace_skill_file_tool
)
SKILL_LEARNER_TOOLS[_create_skill_file_tool.schema.function.name] = (
    _create_skill_file_tool
)
SKILL_LEARNER_TOOLS[_create_skill_tool.schema.function.name] = _create_skill_tool
SKILL_LEARNER_TOOLS[_delete_skill_file_tool.schema.function.name] = (
    _delete_skill_file_tool
)
SKILL_LEARNER_TOOLS[_finish_tool.schema.function.name] = _finish_tool
SKILL_LEARNER_TOOLS[_skill_learner_thinking_tool.schema.function.name] = (
    _skill_learner_thinking_tool
)
