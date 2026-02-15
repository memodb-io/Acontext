from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from .ctx import TaskCtx


async def _set_task_user_preference_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    task_order: int = llm_arguments.get("task_order", None)
    user_preference: str = llm_arguments.get("user_preference", None)

    if task_order is None:
        return Result.resolve(
            "You must provide a task_order argument. Setting user preference failed."
        )
    if task_order > len(ctx.task_ids_index) or task_order < 1:
        return Result.resolve(
            f"Task order {task_order} is out of range, setting user preference failed."
        )
    if not user_preference or not user_preference.strip():
        return Result.resolve(
            "You must provide a non-empty user_preference string. Setting user preference failed."
        )

    actually_task_id = ctx.task_ids_index[task_order - 1]

    r = await TD.set_user_preference_for_task(
        ctx.db_session, actually_task_id, user_preference
    )
    if not r.ok():
        return r
    return Result.resolve(
        f"User preference set for task {task_order}"
    )


_set_task_user_preference_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "set_task_user_preference",
                "description": """Set or replace the user preference for a task. This REPLACES the entire preference — provide the complete, updated preference string.
- If the user's new preference conflicts with the existing one, write a merged/resolved version that reflects the user's latest intent.
- Include relevant user info (email, tech stack choices, constraints, etc.).
- Can be set on any task status (no restriction).""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_order": {
                            "type": "integer",
                            "description": "The order number of the task to set the preference for.",
                        },
                        "user_preference": {
                            "type": "string",
                            "description": "The complete, rewritten preference string that replaces all prior preferences for this task.",
                        },
                    },
                    "required": ["task_order", "user_preference"],
                },
            }
        )
    )
    .use_handler(_set_task_user_preference_handler)
)
