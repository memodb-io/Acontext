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
from ....service.data import block as BD
from ....schema.session.task import TaskStatus
from .ctx import SpaceSearchCtx


async def _search_title_handler(
    ctx: SpaceSearchCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "query" not in llm_arguments:
        return Result.resolve("Query for search_path are required")
    query = llm_arguments["query"]
    limit = llm_arguments.get("limit", 10)
    r = await BS.search_path_blocks(
        ctx.db_session,
        ctx.space_id,
        query,
        topk=limit,
        threshold=DEFAULT_CORE_CONFIG.block_embedding_search_cosine_distance_threshold,
    )
    if not r.ok():
        return r
    block_distances = r.data
    display_results = []
    for b, d in block_distances:
        r = await ctx.find_path_by_id(b.id)
        if not r.ok():
            return r
        path, path_node = r.data
        if path_node.type == BLOCK_TYPE_PAGE:
            display_results.append(f"- ({d:.3f})  {path} (page)")
        if path_node.type == BLOCK_TYPE_FOLDER:
            display_results.append(
                f"- ({d:.3f}) {path} (folder, has {path_node.sub_page_num} pages & {path_node.sub_folder_num} folders)"
            )
    display_section = "\n".join(display_results)
    return Result.resolve(f"Found {len(block_distances)}: \n{display_section}")


_search_title_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "search_title",
                "description": "Search the titles of pages and folders with query",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Query/keywords/purpose description to search",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Limit the number of results. Default to 10",
                        },
                    },
                    "required": ["query"],
                },
            },
        )
    )
    .use_handler(_search_title_handler)
)
