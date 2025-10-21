from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....schema.block.sop_block import SOPData
from ....service.data import task as TD
from ....env import LOG
from .ctx import SOPCtx


async def submit_sop_handler(ctx: SOPCtx, llm_arguments: dict) -> Result[str]:
    pass


_submit_sop_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "submit_sop",
                "description": "Create a new task by inserting it after the specified task order. This is used when identifying new tasks from conversation messages.",
                "parameters": SOPData.model_json_schema(),
            }
        )
    )
    .use_handler(submit_sop_handler)
)
