from ..base import Tool
from ....schema.llm import ToolSchema
from ....schema.orm.block import BLOCK_TYPE_FOLDER
from ....schema.result import Result
from ....schema.block.path_node import PathNode
from ....service.data import block_nav as BN
from .ctx import SpaceCtx
from ....service.data import block as BD


async def _create_folder_handler(
    ctx: SpaceCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "folder_path" not in llm_arguments or "title" not in llm_arguments:
        return Result.resolve("Folder path and title are required")
    folder_path = llm_arguments["folder_path"]
    title = BD._normalize_path_block_title(llm_arguments["title"])
    view_when = llm_arguments.get("view_when", "")

    r = await ctx.find_block(folder_path)
    if not r.ok():
        return Result.resolve(f"Path {folder_path} not found, with error {r.error}")
    path_block = r.data

    if path_block is not None and path_block.type != BLOCK_TYPE_FOLDER:
        return Result.resolve(
            f"Path {folder_path} is not a folder, can't have sub-folder"
        )
    folder_block_id = path_block.id if path_block is not None else None
    r = await BD.create_new_path_block(
        ctx.db_session,
        ctx.space_id,
        title,
        props={"view_when": view_when},
        par_block_id=folder_block_id,
        type=BLOCK_TYPE_FOLDER,
    )
    if not r.ok():
        return r
    folder = r.data
    ctx.path_2_block_ids[f"{folder_path}{folder.title}/"] = PathNode(
        id=folder.id,
        title=folder.title,
        type=BLOCK_TYPE_FOLDER,
    )
    return Result.resolve(f"Folder {folder.title} created under {folder_path}")


_create_folder_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "create_folder",
                "description": "Create a new folder under a folder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "folder_path": {
                            "type": "string",
                            "description": "The absolute path to the parent folder. Root is '/'. Folder path must end with '/'",
                        },
                        "title": {
                            "type": "string",
                            "description": "Folder Title. Use Snake Case naming convention. Maximum 5 words. Title can't contain '/'.",
                        },
                        "view_when": {
                            "type": "string",
                            "description": "A expandsion of the title in 1-2 sentences. Only pass this when you find the title is too short to cover the meaning of this folder, otherwise leave it empty string.",
                        },
                    },
                    "required": ["folder_path", "title"],
                },
            },
        )
    )
    .use_handler(_create_folder_handler)
)
