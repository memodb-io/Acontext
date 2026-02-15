from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from ....schema.session.task import TaskStatus
from .ctx import TaskCtx


async def _append_task_progress_handler(
    ctx: TaskCtx,
    llm_arguments: dict,
) -> Result[str]:
    task_order: int = llm_arguments.get("task_order", None)
    progress: str = llm_arguments.get("progress", None)

    if task_order is None:
        return Result.resolve(
            "You must provide a task_order argument. Appending progress failed."
        )
    if task_order > len(ctx.task_ids_index) or task_order < 1:
        return Result.resolve(
            f"Task order {task_order} is out of range, appending progress failed."
        )
    if not progress or not progress.strip():
        return Result.resolve(
            "You must provide a non-empty progress string. Appending progress failed."
        )

    actually_task_id = ctx.task_ids_index[task_order - 1]
    actually_task = ctx.task_index[task_order - 1]

    if actually_task.status in (TaskStatus.SUCCESS, TaskStatus.FAILED):
        return Result.resolve(
            f"Appending progress failed. Task {task_order} is already {actually_task.status}. Update its status to 'running' first then append progress."
        )

    r = await TD.append_progress_to_task(
        ctx.db_session, actually_task_id, progress
    )
    if not r.ok():
        return r
    return Result.resolve(
        f"Progress appended to task {task_order}"
    )


_append_task_progress_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "append_task_progress",
                "description": """Record a progress step for a task. Use this to log what the agent actually did at each step.
- Write concise, honest summaries of agent actions.
- Be specific with actual values and file paths.
- Cannot append progress to 'success' or 'failed' tasks — update status to 'running' first.""",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "task_order": {
                            "type": "integer",
                            "description": "The order number of the task to append progress to.",
                        },
                        "progress": {
                            "type": "string",
                            "description": "Concise, honest summary of what the agent did in this step. E.g. 'Created login component in src/Login.tsx'.",
                        },
                    },
                    "required": ["task_order", "progress"],
                },
            }
        )
    )
    .use_handler(_append_task_progress_handler)
)
