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


async def _attach_related_block_handler(
    ctx: SpaceSearchCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "page_path" not in llm_arguments:
        return Result.resolve("page_path is required")
    if "block_index" not in llm_arguments:
        return Result.resolve("block_index is required")
    page_path: str = llm_arguments["page_path"]
    block_index: int = llm_arguments["block_index"]
    r = await ctx.find_block(page_path)
    if not r.ok():
        return Result.resolve(f"Page {page_path} not found: {r.error}")

    page_block = r.data
    if page_block.type != BLOCK_TYPE_PAGE:
        return Result.resolve(
            f"Page {page_path} is not a page (type: {page_block.type})"
        )
    r = await BN.get_block_by_sort(
        ctx.db_session, ctx.space_id, page_block.id, block_index - 1
    )
    if not r.ok():
        return Result.resolve(f"Failed to find the block: {r.error}")
    block = r.data
    r = await BR.render_content_block(ctx.db_session, ctx.space_id, block)
    if not r.ok():
        return Result.resolve(f"Failed to render the block: {r.error}")
    rendered_block = r.data
    ctx.located_content_blocks.append(
        LocatedContentBlock(
            path=page_path,
            render_block=rendered_block,
        )
    )
    if len(ctx.located_content_blocks) >= ctx.block_limit:
        return Result.resolve(
            f"You have reached the limit to attach more blocks, you have to stop search and submit final answer right now!"
        )

    return Result.resolve(
        f"Attached the block, you have attached {len(ctx.located_content_blocks)} blocks now"
    )


_attach_related_block_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "attach_related_block",
                "description": "Attach the content blocks that related to the search query",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "page_path": {
                            "type": "string",
                            "description": "The path of page of block",
                        },
                        "block_index": {
                            "type": "integer",
                            "description": "Block index to attach",
                        },
                    },
                    "required": ["page_path", "block_index"],
                },
            },
        )
    )
    .use_handler(_attach_related_block_handler)
)
