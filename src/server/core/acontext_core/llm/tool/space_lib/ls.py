from ..base import Tool, ToolPool
from ....schema.llm import ToolSchema
from ....schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from ....schema.utils import asUUID
from ....schema.result import Result
from ....schema.orm import Task
from ....schema.block.path_node import repr_path_tree
from ....service.data import block_nav as BN
from ....schema.session.task import TaskStatus
from .ctx import SpaceCtx


async def _ls_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    depth = llm_arguments.get("depth", 1)
    folder_path = llm_arguments.get("folder_path", "/")

    r = await ctx.find_block(folder_path)
    if not r.ok():
        return Result.resolve(f"Path {folder_path} not found, with error {r.error}")
    path_block = r.data

    if path_block is not None and path_block.type != BLOCK_TYPE_FOLDER:
        return Result.resolve(f"Path {folder_path} is not a folder, can't be listed")

    r = await BN.list_paths_under_block(
        ctx.db_session,
        ctx.space_id,
        path_block.id if path_block is not None else None,
        path_prefix=folder_path,
        depth=depth,
    )
    if not r.ok():
        return r
    path_caches, sub_page_num, sub_folder_num = r.data
    ctx.path_2_block_ids.update(path_caches)

    repr_tree = repr_path_tree(path_caches)
    return Result.resolve(
        f"""'{folder_path}' has {sub_page_num} pages and {sub_folder_num} folders:
{repr_tree}
"""
    )


_ls_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "ls",
                "description": "List pages and folders",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_path": {
                            "type": "string",
                            "description": "The absolute path to the folder to list. Root is '/'",
                        },
                        "depth": {
                            "type": "integer",
                            "description": """Maximum path depth to list. 
Default to 1, meaning list the sub-paths of sub-folders. 2 means list the sub-paths of sub-folders of sub-folders, etc.""",
                        },
                    },
                    "required": ["folder_path", "depth"],
                },
            },
        )
    )
    .use_handler(_ls_handler)
)
