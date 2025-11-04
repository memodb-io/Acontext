from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....schema.block.path_node import repr_path_tree
from ....service.data import block_nav as BN
from ....service.data import block as BD
from ....schema.session.task import TaskStatus
from .ctx import SpaceCtx


async def _rename_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "path" not in llm_arguments or "new_title" not in llm_arguments:
        return Result.resolve("Path and new title are required")
    path = llm_arguments["path"]
    new_title = llm_arguments["new_title"]
    r = await ctx.find_block(path)
    if not r.ok():
        return Result.resolve(f"Path {path} not found, with error {r.error}")
    path_block = r.data

    r = await BD.update_block(
        ctx.db_session, ctx.space_id, path_block.id, title=new_title
    )
    if not r.ok():
        return r
    path_block = r.data

    # Update path cache
    new_title = path_block.title
    new_path = "/" + "/".join(BN.path_to_parts(path)[:-1] + [new_title])
    path_block.title = new_title
    ctx.path_2_block_ids[new_path] = path_block
    return Result.resolve(f"'{path}' renamed to '{new_title}'")


_rename_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "rename",
                "description": "Rename base name of a page or folder. For example, /a/b/c -> /a/b/c1. Title can't contain '/'.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Absolute path to the page/folder to rename",
                        },
                        "new_title": {
                            "type": "string",
                            "description": "New title for the page or folder. Title can't contain '/'. Use Snake Case naming convention",
                        },
                    },
                    "required": ["path", "new_title"],
                },
            },
        )
    )
    .use_handler(_rename_handler)
)
