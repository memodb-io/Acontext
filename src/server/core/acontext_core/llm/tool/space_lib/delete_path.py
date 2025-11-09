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


async def _delete_path_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "path" not in llm_arguments:
        return Result.resolve("page_path and block_index are required")
    path = llm_arguments["page_path"]
    r = await ctx.find_block(path)
    if not r.ok():
        return Result.resolve(f"Path {path} not found: {r.error}")
    path_block = r.data
    r = await BD.delete_block_recursively(ctx.db_session, ctx.space_id, path_block.id)
    if not r.ok():
        return Result.resolve(f"Failed to delete block: {r.error}")
    return Result.resolve(f"Deleted path {path}")


_delete_path_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "delete_path",
                "description": "Delete a path, can be a page or a folder. This tool is recursive and can't be undone! Make sure you call report_thinking tool to think about if you should delete the path",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "The absolute path to delete",
                        }
                    },
                    "required": ["path"],
                },
            },
        )
    )
    .use_handler(_delete_path_handler)
)
