from pydantic import ValidationError
from ....infra.async_mq import MQ_CLIENT
from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....schema.block.sop_block import SOPData
from ....service.data import task as TD
from ....env import LOG
from .ctx import SOPCtx


async def submit_sop_handler(ctx: SOPCtx, llm_arguments: dict) -> Result[str]:

    print(llm_arguments)
    try:
        sop_data = SOPData.model_validate(llm_arguments)
    except ValidationError as e:
        return Result.reject(f"Invalid SOP data: {str(e)}")
    if not len(sop_data.tool_sops) and not len(sop_data.preferences.strip()):
        LOG.info("Agent submitted an empty SOP, drop")
        return Result.resolve("SOP submitted")
    # await MQ_CLIENT.publish()
    return Result.resolve("SOP submitted")


_submit_sop_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "submit_sop",
                "description": "Submit a new tool-calling SOP.",
                "parameters": SOPData.model_json_schema(),
            }
        )
    )
    .use_handler(submit_sop_handler)
)
