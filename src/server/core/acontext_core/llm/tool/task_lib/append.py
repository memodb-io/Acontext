from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from ....schema.session.task import TaskStatus
from .ctx import TaskCtx


async def _append_messages_to_task_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    task_order: int = llm_arguments.get("task_order", None)
    message_id_range: list = llm_arguments.get("message_id_range", None)

    if task_order is None:
        return Result.resolve(
            "You must provide a task order argument, so that we can attach messages to the task. Appending failed."
        )
    if task_order > len(ctx.task_ids_index) or task_order < 1:
        return Result.resolve(
            f"Task order {task_order} is out of range, appending failed."
        )
    if (
        not message_id_range
        or not isinstance(message_id_range, list)
        or len(message_id_range) != 2
    ):
        return Result.resolve(
            "message_id_range must be a 2-element array [start, end]. Appending failed."
        )
    start_id, end_id = message_id_range[0], message_id_range[1]
    if not isinstance(start_id, int) or not isinstance(end_id, int) or start_id > end_id:
        return Result.resolve(
            f"Invalid range [{start_id}, {end_id}]. start must be <= end. Appending failed."
        )
    message_order_indexes = list(range(start_id, end_id + 1))
    actually_task_id = ctx.task_ids_index[task_order - 1]
    actually_task = ctx.task_index[task_order - 1]
    actually_message_ids = [
        ctx.message_ids_index[i]
        for i in message_order_indexes
        if i < len(ctx.message_ids_index)
    ]
    if not actually_message_ids:
        return Result.resolve(
            f"No message ids to append, skip: range [{start_id}, {end_id}]"
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
    if actually_task.status != TaskStatus.RUNNING:
        r = await TD.update_task(
            ctx.db_session,
            actually_task_id,
            status="running",
        )
        if not r.ok():
            return r
    return Result.resolve(
        f"Messages [{start_id}..{end_id}] linked to task {task_order}"
    )


_append_messages_to_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "append_messages_to_task",
                "description": """Link a range of message ids to a task. This tool ONLY links messages and auto-sets the task status to 'running'.
- Use separate tools for recording progress (append_task_progress) and user preferences (set_task_user_preference).
- If you decide to link messages to a task marked as 'success' or 'failed', update its status to 'running' first.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_order": {
                            "type": "integer",
                            "description": "The order number of the task to link messages to.",
                        },
                        "message_id_range": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "minItems": 2,
                            "maxItems": 2,
                            "description": "Inclusive range [start, end] of message IDs to link. E.g. [2, 8] links messages 2,3,4,5,6,7,8.",
                        },
                    },
                    "required": ["task_order", "message_id_range"],
                },
            }
        )
    )
    .use_handler(_append_messages_to_task_handler)
)
