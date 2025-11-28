import asyncio
from contextlib import asynccontextmanager
from pydantic import ValidationError
from typing import Optional, List
from fastapi import FastAPI, Query, Path, Body
from fastapi.exceptions import HTTPException
from acontext_core.di import setup, cleanup, MQ_CLIENT, LOG, DB_CLIENT
from acontext_core.telemetry.otel import (
    setup_otel_tracing,
    instrument_fastapi,
    shutdown_otel_tracing,
)
from acontext_core.telemetry.config import TelemetryConfig
from acontext_core.schema.api.request import (
    SearchMode,
    ToolRenameRequest,
    InsertBlockRequest,
)
from acontext_core.schema.api.response import (
    SearchResultBlockItem,
    SpaceSearchResult,
    InsertBlockResponse,
    Flag,
    LearningStatusResponse,
)
from acontext_core.schema.tool.tool_reference import ToolReferenceData
from acontext_core.schema.utils import asUUID
from acontext_core.schema.block.sop_block import SOPData
from acontext_core.schema.orm.block import (
    BLOCK_TYPE_SOP,
    PATH_BLOCK,
)
from acontext_core.env import DEFAULT_CORE_CONFIG
from acontext_core.llm.agent import space_search as SS
from acontext_core.service.data import block as BB
from acontext_core.service.data import block_write as BW
from acontext_core.service.data import block_search as BS
from acontext_core.service.data import block_render as BR
from acontext_core.service.data import tool as TT
from acontext_core.service.data import session as SD
from acontext_core.service.session_message import flush_session_message_blocking
from acontext_core.schema.orm import Task
from sqlalchemy import select, func, cast, Integer


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await setup()

    # Setup OpenTelemetry tracing
    telemetry_config = TelemetryConfig.from_env()
    tracer_provider = None
    if telemetry_config.enabled:
        try:
            tracer_provider = setup_otel_tracing(
                service_name=telemetry_config.service_name,
                otlp_endpoint=telemetry_config.otlp_endpoint,
                sample_ratio=telemetry_config.sample_ratio,
                service_version=telemetry_config.service_version,
            )
            instrument_fastapi(app)
            LOG.info(
                f"OpenTelemetry tracing enabled: endpoint={telemetry_config.otlp_endpoint}, "
                f"sample_ratio={telemetry_config.sample_ratio}"
            )
        except Exception as e:
            LOG.warning(
                f"Failed to setup OpenTelemetry tracing, continuing without tracing: {e}",
                exc_info=True,
            )

    # Run consumer in the background
    asyncio.create_task(MQ_CLIENT.start())

    yield

    # Shutdown
    if tracer_provider:
        try:
            shutdown_otel_tracing()
            LOG.info("OpenTelemetry tracing shutdown")
        except Exception as e:
            LOG.warning(f"Failed to shutdown OpenTelemetry tracing: {e}", exc_info=True)

    await cleanup()


app = FastAPI(lifespan=lifespan)


async def semantic_grep_search_func(
    threshold: Optional[float], space_id: asUUID, query: str, limit: int
) -> List[SearchResultBlockItem]:
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
            r = await BR.render_content_block(db_session, space_id, block)
            if not r.ok():
                LOG.error(f"Render failed: {r.error}")
                raise HTTPException(status_code=500, detail=str(r.error))
            rendered_block = r.data
            if rendered_block.props is None:
                continue
            item = SearchResultBlockItem(
                block_id=block.id,
                title=block.title,
                type=block.type,
                props=rendered_block.props,
                distance=distance,
            )

            search_results.append(item)

        return search_results


@app.get("/api/v1/project/{project_id}/space/{space_id}/semantic_glob")
async def semantic_glob(
    project_id: asUUID = Path(..., description="Project ID to search within"),
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
                title=block.title,
                type=block.type,
                props=block.props,
                distance=distance,
            )

            search_results.append(item)

        return search_results


@app.get("/api/v1/project/{project_id}/space/{space_id}/semantic_grep")
async def semantic_grep(
    project_id: asUUID = Path(..., description="Project ID to search within"),
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
    return await semantic_grep_search_func(threshold, space_id, query, limit)


@app.get("/api/v1/project/{project_id}/space/{space_id}/experience_search")
async def search_space(
    project_id: asUUID = Path(..., description="Project ID to search within"),
    space_id: asUUID = Path(..., description="Space ID to search within"),
    query: str = Query(..., description="Search query for page/folder titles"),
    limit: int = Query(
        10, ge=1, le=50, description="Maximum number of results to return"
    ),
    mode: SearchMode = Query("fast", description="Search query for page/folder titles"),
    semantic_threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=2.0,
        description="Cosine distance threshold (0=identical, 2=opposite). Uses config default if not specified",
    ),
    max_iterations: int = Query(
        16,
        ge=1,
        le=100,
        description="Maximum number of iterations for agentic search",
    ),
) -> SpaceSearchResult:
    if mode == "fast":
        cited_blocks = await semantic_grep_search_func(
            semantic_threshold, space_id, query, limit
        )
        return SpaceSearchResult(cited_blocks=cited_blocks, final_answer=None)
    elif mode == "agentic":
        r = await SS.space_agent_search(
            project_id,
            space_id,
            query,
            limit,
            max_iterations=max_iterations,
        )
        if not r.ok():
            raise HTTPException(status_code=500, detail=r.error)
        cited_blocks = [
            SearchResultBlockItem(
                block_id=b.render_block.block_id,
                title=b.render_block.title,
                type=b.render_block.type,
                props=b.render_block.props,
                distance=None,
            )
            for b in r.data.located_content_blocks
        ]
        result = SpaceSearchResult(
            cited_blocks=cited_blocks, final_answer=r.data.final_answer
        )
        return result
    else:
        raise HTTPException(status_code=400, detail=f"Invalid search mode: {mode}")


@app.post("/api/v1/project/{project_id}/space/{space_id}/insert_block")
async def insert_new_block(
    project_id: asUUID = Path(..., description="Project ID to search within"),
    space_id: asUUID = Path(..., description="Space ID to search within"),
    request: InsertBlockRequest = Body(..., description="Request to insert new block"),
) -> InsertBlockResponse:
    if request.type == BLOCK_TYPE_SOP:

        try:
            sop_data = SOPData.model_validate(
                {**request.props, "use_when": request.title}
            )
        except ValidationError as e:
            raise HTTPException(status_code=500, detail=str(e))
        async with DB_CLIENT.get_session_context() as db_session:
            r = await BW.write_sop_block_to_parent(
                db_session, space_id, request.parent_id, sop_data
            )
            if not r.ok():
                raise HTTPException(status_code=500, detail=str(r.error))
        return InsertBlockResponse(id=r.data)
    elif request.type in PATH_BLOCK:
        async with DB_CLIENT.get_session_context() as db_session:
            r = await BB.create_new_path_block(
                db_session,
                space_id,
                request.title,
                request.props,
                request.parent_id,
                request.type,
            )
            if not r.ok():
                raise HTTPException(status_code=500, detail=str(r.error))
            return InsertBlockResponse(id=r.data.id)
    else:
        raise HTTPException(
            status_code=500, detail=f"Invalid block type: {request.type}"
        )


@app.post("/api/v1/project/{project_id}/session/{session_id}/flush")
async def session_flush(
    project_id: asUUID = Path(..., description="Project ID to search within"),
    session_id: asUUID = Path(..., description="Session ID to flush"),
) -> Flag:
    """
    Flush the session buffer for a given session.
    """
    LOG.info(f"Flushing session {session_id} for project {project_id}")
    r = await flush_session_message_blocking(project_id, session_id)
    return Flag(status=r.error.status.value, errmsg=r.error.errmsg)


@app.post("/api/v1/project/{project_id}/tool/rename")
async def project_tool_rename(
    project_id: asUUID = Path(..., description="Project ID to rename tool within"),
    request: ToolRenameRequest = Body(..., description="Request to rename tool"),
) -> Flag:
    rename_list = [(t.old_name.strip(), t.new_name.strip()) for t in request.rename]
    async with DB_CLIENT.get_session_context() as db_session:
        r = await TT.rename_tool(db_session, project_id, rename_list)
    return Flag(status=r.error.status.value, errmsg=r.error.errmsg)


@app.get("/api/v1/project/{project_id}/tool/name")
async def get_project_tool_names(
    project_id: asUUID = Path(..., description="Project ID to get tool names within"),
) -> List[ToolReferenceData]:
    async with DB_CLIENT.get_session_context() as db_session:
        r = await TT.get_tool_names(db_session, project_id)
        if not r.ok():
            raise HTTPException(status_code=500, detail=r.error)
    return r.data


@app.get("/api/v1/project/{project_id}/session/{session_id}/get_learning_status")
async def get_learning_status(
    project_id: asUUID = Path(..., description="Project ID"),
    session_id: asUUID = Path(..., description="Session ID"),
) -> LearningStatusResponse:
    """
    Get learning status for a session.
    Returns the count of space digested tasks and not space digested tasks.
    If the session is not connected to a space, returns 0 and 0.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        # Fetch the session to check if it's connected to a space
        r = await SD.fetch_session(db_session, session_id)
        if not r.ok():
            raise HTTPException(status_code=404, detail=str(r.error))

        session = r.data

        # If session is not connected to a space, return 0 and 0
        if session.space_id is None:
            return LearningStatusResponse(
                space_digested_count=0,
                not_space_digested_count=0,
            )

        # Get all tasks for this session and count space_digested status
        # Use cast to convert boolean to int for counting
        # For not_digested, use (1 - cast) to count False values
        query = (
            select(
                func.sum(cast(Task.space_digested, Integer)).label("digested_count"),
                func.sum(1 - cast(Task.space_digested, Integer)).label(
                    "not_digested_count"
                ),
            )
            .where(Task.session_id == session_id)
            .where(Task.is_planning == False)  # noqa: E712
            .where(Task.status == "success")  # only count successful tasks
        )

        result = await db_session.execute(query)
        row = result.first()

        if row is None:
            # No tasks found
            return LearningStatusResponse(
                space_digested_count=0,
                not_space_digested_count=0,
            )

        digested_count = int(row.digested_count or 0)
        not_digested_count = int(row.not_digested_count or 0)

        return LearningStatusResponse(
            space_digested_count=digested_count,
            not_space_digested_count=not_digested_count,
        )
