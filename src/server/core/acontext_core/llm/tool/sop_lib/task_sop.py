from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....schema.orm import Task
from ....service.data import task as TD
from ....env import LOG
from .ctx import SOPCtx


async def generate_tool_calling_sop_handler(
    ctx: SOPCtx, llm_arguments: dict
) -> Result[str]:
    pass


_insert_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "insert_task",
                "description": "Create a new task by inserting it after the specified task order. This is used when identifying new tasks from conversation messages.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "after_task_order": {
                            "type": "integer",
                            "description": "The task order after which to insert the new task. Use 0 to insert at the beginning.",
                        },
                        "task_description": {
                            "type": "string",
                            "description": "A clear, concise description of the task, of what's should be done and what's the expected result if any.",
                        },
                    },
                    "required": ["after_task_order", "task_description"],
                },
            }
        )
    )
    .use_handler(generate_tool_calling_sop_handler)
)
