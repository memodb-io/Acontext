from typing import Any
from ....infra.db import AsyncSession
from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....service.data import task as TD
from ....schema.session.task import TaskStatus
from .ctx import TaskCtx


async def _append_messages_to_task_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    task_order: int = llm_arguments.get("task_order", None)
    message_order_indexes = llm_arguments.get("message_ids", [])
    progress_note = llm_arguments.get("progress", None)
    user_preference = llm_arguments.get("user_preference", "").strip()

    if not task_order:
        return Result.resolve(
            f"You must provide a task order argument, so that we can attach messages to the task. Appending failed."
        )
    if task_order > len(ctx.task_ids_index) or task_order < 1:
        return Result.resolve(
            f"Task order {task_order} is out of range, appending failed."
        )
    actually_task_id = ctx.task_ids_index[task_order - 1]
    actually_task = ctx.task_index[task_order - 1]
    actually_message_ids = [
        ctx.message_ids_index[i]
        for i in message_order_indexes
        if i < len(ctx.message_ids_index)
    ]
    if not actually_message_ids:
        return Result.resolve(
            f"No message ids to append, skip: {message_order_indexes}"
        )
    if actually_task.status in (TaskStatus.SUCCESS, TaskStatus.FAILED):
        return Result.resolve(
            f"Appending failed. Task {task_order} is already {actually_task.status}. Update its status to 'running' first then append messages."
        )
    r = await TD.append_messages_to_task(
        ctx.db_session,
        actually_message_ids,
        actually_task_id,
    )
    if not r.ok():
        return r
    if progress_note is not None:
        r = await TD.append_progress_to_task(
            ctx.db_session, actually_task_id, progress_note, user_preference or None
        )
        if not r.ok():
            return r
    return Result.resolve(
        f"Messages {message_order_indexes} and progress are appended to task {task_order}"
    )


_append_messages_to_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "append_messages_to_task",
                "description": """Link relevant message ids to a task for tracking progress and context. Use this to associate relevant messages with a task.
- Mark the progress and learnings that relevant messages have contributed to the task.
- Make sure you append messages first(if any), then update the task status.
- If you decide to append message to a task marked as 'success' or 'failed', update it's status to 'running' first""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_order": {
                            "type": "integer",
                            "description": "The order number of the task to link messages to.",
                        },
                        "progress": {
                            "type": "string",
                            "description": "The progress and learnings from relevant messages. Narrate progress in the first person as the agent.",
                        },
                        "user_preference": {
                            "type": "string",
                            "description": "Any user-mentioned preference on this task. If None, an empty string is expected.",
                        },
                        "message_ids": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "List of message IDs to append to the task.",
                        },
                    },
                    "required": ["task_order", "progress", "message_ids"],
                },
            }
        )
    )
    .use_handler(_append_messages_to_task_handler)
)
