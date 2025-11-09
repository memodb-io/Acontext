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


async def _insert_data_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "page_path" not in llm_arguments:
        return Result.resolve("page_path is required")
    if "after_block_index" not in llm_arguments:
        return Result.resolve("after_block_index is required")
    if "candidate_index" not in llm_arguments:
        return Result.resolve("candidate_index is required")
    page_path = llm_arguments["page_path"]
    after_block_index: int = llm_arguments["after_block_index"]
    candidate_index: int = llm_arguments["candidate_index"]

    if candidate_index < 0 or candidate_index >= len(ctx.candidate_data):
        return Result.resolve(f"Invalid candidate_index: {candidate_index}")
    if candidate_index in ctx.already_inserted_candidate_data:
        return Result.resolve(f"Candidate data {candidate_index} already inserted")
    ctx.already_inserted_candidate_data.add(candidate_index)
    insert_data = ctx.candidate_data[candidate_index]
    r = await ctx.find_block(page_path)
    if not r.ok():
        return Result.resolve(f"Page {page_path} not found: {r.error}")
    page_block = r.data
    if page_block.type != BLOCK_TYPE_PAGE:
        return Result.resolve(
            f"Path {page_path} is not a page (type: {page_block.type})"
        )
    r = await BW.write_block_to_page(
        ctx.db_session,
        ctx.space_id,
        page_block.id,
        insert_data,
        after_block_index=after_block_index,
    )
    if not r.ok():
        return Result.resolve(f"Failed to insert candidate data: {r.error}")
    return Result.resolve(
        f"Inserted candidate data {candidate_index} to page {page_path} after block index {after_block_index}"
    )


_insert_candidate_data_as_content_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "insert_candidate_data_as_content",
                "description": "Insert candidate data to a page as a block.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "page_path": {
                            "type": "string",
                            "description": "The absolute path of page to insert",
                        },
                        "after_block_index": {
                            "type": "integer",
                            "description": "Block Index in this page to insert after. 0 means inserting at the first position",
                        },
                        "candidate_index": {
                            "type": "integer",
                            "description": "The candidate index of the data to insert",
                        },
                    },
                    "required": ["page_path", "after_block_index", "candidate_index"],
                },
            },
        )
    )
    .use_handler(_insert_data_handler)
)
