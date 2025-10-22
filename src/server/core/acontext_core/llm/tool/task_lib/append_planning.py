from typing import Any
from ....infra.db import AsyncSession
from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....service.data import task as TD
from ....env import LOG
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
                "description": """Save current message ids to the planning section.
Use this when messages are about the agent/user is planning general plan, and those messages aren't related to any specific task execution.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "message_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "List of message IDs to append to the planning section.",
                        }
                    },
                    "required": ["message_ids"],
                },
            }
        )
    )
    .use_handler(_append_messages_to_planning_section_handler)
)
