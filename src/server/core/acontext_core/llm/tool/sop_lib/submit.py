from pydantic import ValidationError
from ..base import Tool
from ....service.constants import EX, RK
from ....infra.async_mq import MQ_CLIENT
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....schema.block.sop_block import SubmitSOPData, SOPData
from ....schema.mq.sop import SOPComplete
from ....env import LOG
from .ctx import SOPCtx


async def submit_sop_handler(ctx: SOPCtx, llm_arguments: dict) -> Result[str]:
    is_easy_task = llm_arguments.get("is_easy_task", False)
    try:
        sop_data = SOPData.model_validate(llm_arguments)
    except ValidationError as e:
        return Result.reject(f"Invalid SOP data: {str(e)}")
    if not len(sop_data.tool_sops) and not len(sop_data.preferences.strip()):
        LOG.info("Agent submitted an empty SOP, drop")
        return Result.resolve("SOP submitted")
    if is_easy_task:
        # easy task should not have any tool_sops
        sop_data.tool_sops = []
    sop_complete_message = SOPComplete(
        project_id=ctx.project_id,
        space_id=ctx.space_id,
        task_id=ctx.task.id,
        sop_data=sop_data,
    )
    await MQ_CLIENT.publish(
        exchange_name=EX.space_task,
        routing_key=RK.space_task_sop_complete,
        body=sop_complete_message.model_dump_json(),
    )
    return Result.resolve("SOP submitted")


_submit_sop_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "submit_sop",
                "description": "Submit a new tool-calling SOP.",
                "parameters": SubmitSOPData.model_json_schema(),
            }
        )
    )
    .use_handler(submit_sop_handler)
)
