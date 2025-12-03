import json
from ..base import Tool
from ....env import DEFAULT_CORE_CONFIG
from ....schema.llm import ToolSchema
from ....schema.result import Result
from ....service.data import block_search as BS
from ....service.data import block_render as BR
from .ctx import SpaceSearchCtx


async def _search_content_handler(
    ctx: SpaceSearchCtx,
    llm_arguments: dict,
) -> Result[str]:
    if "query" not in llm_arguments:
        return Result.resolve("Query for search_path are required")
    query = llm_arguments["query"]
    limit = llm_arguments.get("limit", 10)
    r = await BS.search_content_blocks(
        ctx.db_session,
        ctx.project_id,
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
        r = await BR.render_content_block(ctx.db_session, ctx.space_id, b)
        if not r.ok():
            return r
        content_block = r.data
        r = await ctx.find_path_by_id(content_block.parent_id)
        if not r.ok():
            return r
        path, _ = r.data
        display_results.append(
            json.dumps(
                {
                    "page_path": path,
                    "block_index": content_block.order + 1,
                    "content": content_block.props,
                },
                ensure_ascii=False,
            )
        )
    display_section = "\n".join(display_results)
    return Result.resolve(
        f"Found {len(block_distances)} blocks, display in JSON: \n{display_section}"
    )


_search_content_tool = (
    Tool()
    .use_schema(
        ToolSchema(
            function={
                "name": "search_content",
                "description": "Search the content blocks with query",
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
    .use_handler(_search_content_handler)
)
