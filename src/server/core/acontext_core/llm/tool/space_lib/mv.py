from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....schema.block.path_node import repr_path_tree
from ....service.data import block_nav as BN
from ....service.data import block as BK
from ....schema.session.task import TaskStatus
from .ctx import SpaceCtx


async def _move_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "from_path" not in llm_arguments or "to_folder" not in llm_arguments:
        return Result.resolve("From path and to folder are required")
    from_path = llm_arguments["from_path"]
    to_folder = llm_arguments["to_folder"]

    r = await ctx.find_block(from_path)
    if not r.ok():
        return Result.resolve(f"Path {from_path} not found, with error {r.error}")
    from_path_block = r.data

    r = await ctx.find_block(to_folder)
    if not r.ok():
        return Result.resolve(
            f"Destination folder {to_folder} not found, with error {r.error}"
        )
    to_path_block = r.data

    if to_path_block.type != BLOCK_TYPE_FOLDER:
        return Result.resolve(f"Destination folder {to_folder} is not a folder")
    r = await BK.move_path_block_to_new_parent(
        ctx.db_session, ctx.space_id, from_path_block.id, to_path_block.id
    )
    if not r.ok():
        return Result.resolve(
            f"Unable to move '{from_path}' to '{to_folder}', with error {r.error}"
        )

    # update path caches
    ctx.path_2_block_ids[f"{to_folder}{from_path_block.title}"] = from_path_block
    return Result.resolve(f"'{from_path}' moved to '{to_folder}'")


_move_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "move",
                "description": "Move Page or Dir to a existing folder",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "from_path": {
                            "type": "string",
                            "description": "Absolute path to the page/folder to move",
                        },
                        "to_folder": {
                            "type": "string",
                            "description": "Destination Folder to place it under. Must be a folder",
                        },
                    },
                    "required": ["from_path", "to_folder"],
                },
            },
        )
    )
    .use_handler(_move_handler)
)
