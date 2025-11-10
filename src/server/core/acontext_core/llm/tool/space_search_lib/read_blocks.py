import json
from ..base import Tool, ToolPool
from ....env import DEFAULT_CORE_CONFIG
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


async def _read_blocks_handler(
    ctx: SpaceSearchCtx,
    llm_arguments: dict,
) -> Result[str]:
    # Validate required parameters
    if "page_path" not in llm_arguments:
        return Result.resolve("page_path is required")
    if "offset" not in llm_arguments:
        return Result.resolve("offset is required")
    if "limit" not in llm_arguments:
        return Result.resolve("limit is required")

    page_path = llm_arguments["page_path"]
    offset = llm_arguments["offset"]
    limit = llm_arguments["limit"]

    # Validate parameter types and values
    if not isinstance(offset, int) or offset < 0:
        return Result.resolve("offset must be a non-negative integer")
    if not isinstance(limit, int) or limit <= 0:
        return Result.resolve("limit must be a positive integer")

    # Find the page block by path
    r = await ctx.find_block(page_path)
    if not r.ok():
        return Result.resolve(f"Page {page_path} not found: {r.error}")

    page_block = r.data
    if page_block.type != BLOCK_TYPE_PAGE:
        return Result.resolve(
            f"Path {page_path} is not a page (type: {page_block.type})"
        )

    # Read all content blocks from the page
    r = await BN.read_blocks_from_par_id(
        ctx.db_session,
        ctx.space_id,
        page_block.id,
    )
    if not r.ok():
        return r

    all_blocks = r.data
    total_blocks = len(all_blocks)

    blocks_to_render = all_blocks[offset : offset + limit]

    # Render each block
    rendered_blocks = []
    for block in blocks_to_render:
        r = await BR.render_content_block(ctx.db_session, ctx.space_id, block)
        if not r.ok():
            return r
        rendered_block = r.data
        rendered_blocks.append(
            {
                "block_index": rendered_block.order + 1,
                "type": rendered_block.type,
                "content": rendered_block.props,
            }
        )

    # Format the response
    if not rendered_blocks:
        return Result.resolve(
            f"Page '{page_path}' has {total_blocks} blocks. "
            f"No blocks found in range [{offset}, {offset + limit})."
        )

    blocks_display = "\n".join(
        [json.dumps(block, ensure_ascii=False) for block in rendered_blocks]
    )

    return Result.resolve(
        f"Page '{page_path}' has {total_blocks} blocks total. "
        f"Showing blocks [{offset}, {min(offset + limit, total_blocks)}] in JSON: \n{blocks_display}"
    )


_read_blocks_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "read_content",
                "description": "Read the content blocks of a page.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "page_path": {
                            "type": "string",
                            "description": "The path of page you need to read",
                        },
                        "offset": {
                            "type": "integer",
                            "description": "Block index to start reading. 0 means reading from the first block",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "The maximum number of content blocks to return. Default to 20",
                        },
                    },
                    "required": ["page_path", "offset", "limit"],
                },
            },
        )
    )
    .use_handler(_read_blocks_handler)
)
