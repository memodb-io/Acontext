import asyncio
from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import task as TD
from ....constants import MetricTags
from ....telemetry.capture_metrics import capture_increment
from .ctx import TaskCtx


async def insert_task_handler(ctx: TaskCtx, llm_arguments: dict) -> Result[str]:
    r = await TD.insert_task(
        ctx.db_session,
        ctx.project_id,
        ctx.session_id,
        after_order=llm_arguments["after_task_order"],
        data={
            "task_description": llm_arguments["task_description"],
            "user_preferences": [],
            "progresses": [],
        },
    )
    t, eil = r.unpack()
    if eil:
        return r
    asyncio.create_task(
        capture_increment(
            project_id=ctx.project_id,
            tag=MetricTags.new_task_created,
        )
    )
    return Result.resolve(f"Task {t.order} created")


_insert_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "insert_task",
                "description": "Create a new task by inserting it after the specified task order. Each task represents ONE user request — do NOT create separate tasks for agent execution sub-steps.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "after_task_order": {
                            "type": "integer",
                            "description": "The task order after which to insert the new task. Use 0 to insert at the beginning.",
                        },
                        "task_description": {
                            "type": "string",
                            "description": "The user's query or request verbatim, or closely paraphrased. Do NOT split into agent sub-steps or invent descriptions from agent planning.",
                        },
                    },
                    "required": ["after_task_order", "task_description"],
                },
            }
        )
    )
    .use_handler(insert_task_handler)
)
