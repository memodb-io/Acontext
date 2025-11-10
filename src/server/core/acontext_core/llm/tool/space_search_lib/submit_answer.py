from ..base import Tool, ToolPool
from ....env import DEFAULT_CORE_CONFIG
from ....schema.block.general import LocatedContentBlock
from ....schema.llm import ToolSchema
from ....schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....schema.block.path_node import repr_path_tree
from ....service.data import block_search as BS
from ....service.data import block_nav as BN
from ....service.data import block_render as BR
from ....service.data import block as BD
from ....schema.session.task import TaskStatus
from .ctx import SpaceSearchCtx


async def _submit_answer_handler(
    ctx: SpaceSearchCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "answer" not in llm_arguments:
        return Result.resolve("Answer is required")
    answer: str = llm_arguments["answer"]
    ctx.final_answer = answer
    return Result.resolve(f"Submitted the answer")


_submit_answer_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "submit_final_answer",
                "description": "Submit the final answer to the user",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "answer": {
                            "type": "string",
                            "description": "The final answer to the user's query",
                        },
                    },
                    "required": ["answer"],
                },
            },
        )
    )
    .use_handler(_submit_answer_handler)
)
