import asyncio
from contextlib import asynccontextmanager
from re import search
from typing import Optional, List
from fastapi import FastAPI, Query, Path
from fastapi.exceptions import HTTPException
from acontext_core.di import setup, cleanup, MQ_CLIENT, LOG, DB_CLIENT, S3_CLIENT
from acontext_core.schema.api.response import SearchResultBlockItem
from acontext_core.schema.utils import asUUID
from acontext_core.env import DEFAULT_CORE_CONFIG
from acontext_core.service.data import block_search as BS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await setup()
    # Run consumer in the background
    asyncio.create_task(MQ_CLIENT.start())
    yield
    # Shutdown
    await cleanup()


app = FastAPI(lifespan=lifespan)


@app.get("/api/v1/space/{space_id}/semantic_glob")
async def semantic_global(
    space_id: asUUID = Path(..., description="Space ID to search within"),
    query: str = Query(..., description="Search query for page/folder titles"),
    limit: int = Query(
        10, ge=1, le=50, description="Maximum number of results to return"
    ),
    threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=2.0,
        description="Cosine distance threshold (0=identical, 2=opposite). Uses config default if not specified",
    ),
) -> List[SearchResultBlockItem]:
    """
    Search for pages and folders by title using semantic vector similarity.

    - **space_id**: UUID of the space to search in
    - **query**: Search query text
    - **limit**: Maximum number of results (1-100, default 10)
    - **threshold**: Optional distance threshold (uses config default if not provided)
    """
    # Use config default if threshold not specified
    search_threshold = (
        threshold
        if threshold is not None
        else DEFAULT_CORE_CONFIG.block_embedding_search_cosine_distance_threshold
    )

    # Get database session
    async with DB_CLIENT.get_session_context() as db_session:
        # Perform search
        result = await BS.search_path_blocks(
            db_session,
            space_id,
            query,
            topk=limit,
            threshold=search_threshold,
        )

        # Check if search was successful
        if not result.ok():
            LOG.error(f"Search failed: {result.error}")
            raise HTTPException(status_code=500, detail=str(result.error))

        # Format results
        block_distances = result.data
        search_results = []

        for block, distance in block_distances:
            item = SearchResultBlockItem(
                block_id=block.id,
                distance=distance,
            )

            search_results.append(item)

        return search_results


@app.get("/api/v1/space/{space_id}/semantic_grep")
async def semantic_global(
    space_id: asUUID = Path(..., description="Space ID to search within"),
    query: str = Query(..., description="Search query for content blocks"),
    limit: int = Query(
        10, ge=1, le=50, description="Maximum number of results to return"
    ),
    threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=2.0,
        description="Cosine distance threshold (0=identical, 2=opposite). Uses config default if not specified",
    ),
) -> List[SearchResultBlockItem]:
    """
    Search for pages and folders by title using semantic vector similarity.

    - **space_id**: UUID of the space to search in
    - **query**: Search query text
    - **limit**: Maximum number of results (1-100, default 10)
    - **threshold**: Optional distance threshold (uses config default if not provided)
    """
    # Use config default if threshold not specified
    search_threshold = (
        threshold
        if threshold is not None
        else DEFAULT_CORE_CONFIG.block_embedding_search_cosine_distance_threshold
    )

    # Get database session
    async with DB_CLIENT.get_session_context() as db_session:
        # Perform search
        result = await BS.search_content_blocks(
            db_session,
            space_id,
            query,
            topk=limit,
            threshold=search_threshold,
        )

        # Check if search was successful
        if not result.ok():
            LOG.error(f"Search failed: {result.error}")
            raise HTTPException(status_code=500, detail=str(result.error))

        # Format results
        block_distances = result.data
        search_results = []

        for block, distance in block_distances:
            item = SearchResultBlockItem(
                block_id=block.id,
                distance=distance,
            )

            search_results.append(item)

        return search_results
