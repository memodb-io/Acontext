from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....service.data import task as TD
from ....schema.session.task import TaskStatus
from .ctx import SpaceCtx


async def _append_messages_to_task_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    pass
    return Result.resolve("fool")


_append_messages_to_task_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "ls",
                "description": "List pages and folders",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_path": {
                            "type": "string",
                            "description": "The folder to list. Root is '/'",
                        },
                        "depth": {
                            "type": "integer",
                            "description": "Maximum path depth to list. Default to 3",
                        },
                    },
                    "required": ["folder_path"],
                },
            },
        )
    )
    .use_handler(_append_messages_to_task_handler)
)
