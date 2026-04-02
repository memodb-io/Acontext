from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from .ctx import TaskCtx


async def _append_messages_to_planning_section_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    message_order_indexes = llm_arguments.get("message_ids", [])
    actually_message_ids = [
        ctx.message_ids_index[i]
        for i in message_order_indexes
        if i < len(ctx.message_ids_index)
    ]
    if not actually_message_ids:
        return Result.resolve(
            f"No message ids to append, skip: {message_order_indexes}"
        )
    r = await TD.append_messages_to_planning_section(
        ctx.db_session,
        ctx.project_id,
        ctx.session_id,
        actually_message_ids,
    )
    return (
        Result.resolve(f"Messages {message_order_indexes} appended to planning section")
        if r.ok()
        else r
    )


_append_messages_to_planning_section_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "append_messages_to_planning_section",
                "description": """Save current branch-path messages to the planning section.
Use this when messages are about the agent/user is planning general plan, and those messages aren't related to any specific task execution.
The provided values are branch indexes from the current root-to-leaf path, not session-wide message IDs.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "List of branch indexes to append from the current root-to-leaf path.",
                        }
                    },
                    "required": ["message_ids"],
                },
            }
        )
    )
    .use_handler(_append_messages_to_planning_section_handler)
)
