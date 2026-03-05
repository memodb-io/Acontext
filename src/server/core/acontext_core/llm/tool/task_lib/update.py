from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from .ctx import TaskCtx


async def update_task_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    task_order = llm_arguments.get("task_order", None)
    if task_order is None:
        return Result.resolve(
            "You must provide a task order argument, so that we can update the task. Updating failed."
        )
    if task_order > len(ctx.task_ids_index) or task_order < 1:
        return Result.resolve(
            f"Task order {task_order} is out of range, updating failed."
        )
    actually_task_id = ctx.task_ids_index[task_order - 1]
    task_status = llm_arguments.get("task_status", None)
    task_description = llm_arguments.get("task_description", None)

    status_skipped = False
    if ctx.disable_task_status_change and task_status in ("success", "failed"):
        task_status = None
        status_skipped = True

    r = await TD.update_task(
        ctx.db_session,
        actually_task_id,
        status=task_status,
        patch_data=(
            {
                "task_description": task_description,
            }
            if task_description
            else None
        ),
    )
    t, eil = r.unpack()
    if eil:
        return r
    if not status_skipped and task_status in ("success", "failed"):
        ctx.learning_task_ids.append(actually_task_id)
    return Result.resolve(f"Task {t.order} updated")


_update_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "update_task",
                "description": """Update an existing task's description and/or status. 
Use this when task progress changes or task details need modification.
Mostly use it to update the task status, if you're confident about a task is running, completed or failed.
Only when the conversation explicitly mention certain task's purpose should be modified, then use this tool to update the task description.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_order": {
                            "type": "integer",
                            "description": "The order number of the task to update.",
                        },
                        "task_status": {
                            "type": "string",
                            "enum": ["pending", "running", "success", "failed"],
                            "description": "New status for the task. (optional).",
                        },
                        "task_description": {
                            "type": "string",
                            "description": "Reflect the user's updated query or intent. Use the user's words, not agent-invented descriptions. (optional).",
                        },
                    },
                    "required": ["task_order"],
                },
            }
        )
    )
    .use_handler(update_task_handler)
)
