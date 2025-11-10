from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from ....schema.utils import asUUID
from ....schema.result import Result
from ....service.data import block_nav as BN
from ....service.data import block as BD
from ....service.data import block_write as BW
from ....schema.session.task import TaskStatus
from .ctx import SpaceCtx


async def _delete_block_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "page_path" not in llm_arguments or "block_index" not in llm_arguments:
        return Result.resolve("page_path and block_index are required")
    page_path = llm_arguments["page_path"]
    block_index: int = llm_arguments["block_index"]
    r = await ctx.find_block(page_path)
    if not r.ok():
        return Result.resolve(f"Page {page_path} not found: {r.error}")
    page_block = r.data
    if page_block.type != BLOCK_TYPE_PAGE:
        return Result.resolve(
            f"Page {page_path} is not a page (type: {page_block.type})"
        )
    if block_index < 0 or block_index >= len(page_block.children):
        return Result.resolve(f"Block index {block_index} out of range")
    r = await BN.get_block_by_sort(
        ctx.db_session, ctx.space_id, page_block.id, block_index - 1
    )
    if not r.ok():
        return Result.resolve(f"Failed to find the block: {r.error}")
    block = r.data
    r = await BD.delete_block_recursively(ctx.db_session, ctx.space_id, block.id)
    if not r.ok():
        return Result.resolve(f"Failed to delete block: {r.error}")
    return Result.resolve(f"Deleted block {block_index} from page {page_path}")


_delete_block_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "delete_content",
                "description": "Delete a content block from a page.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "page_path": {
                            "type": "string",
                            "description": "The absolute path of page that contains the block to delete",
                        },
                        "block_index": {
                            "type": "integer",
                            "description": "Block Index to delete",
                        },
                    },
                    "required": ["page_path", "block_index"],
                },
            },
        )
    )
    .use_handler(_delete_block_handler)
)
