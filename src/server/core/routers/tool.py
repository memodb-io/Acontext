import json

from fastapi import APIRouter, Body, Path, Query
from fastapi.exceptions import HTTPException

from acontext_core.infra.db import DB_CLIENT
from acontext_core.schema.tool import (
    ListToolsResponse,
    SearchToolsResponse,
    ToolFormat,
    ToolUpsertRequest,
)
from acontext_core.schema.api.response import Flag
from acontext_core.schema.utils import asUUID
from acontext_core.service.data import tool as TOOL

router = APIRouter(prefix="/api/v1/project/{project_id}/tools", tags=["tools"])


@router.post("")
async def upsert_tool(
    project_id: asUUID = Path(..., description="Project ID"),
    request: ToolUpsertRequest = Body(..., description="Tool upsert request"),
    format: ToolFormat = Query("openai", description="Schema output format"),
):
    """
    Upsert (create or update) a tool for a given user under a project.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await TOOL.upsert_tool(
            db_session,
            project_id=project_id,
            user_id=request.user_id,
            openai_schema=request.openai_schema,
            config=request.config,
        )
        if not result.ok():
            raise HTTPException(
                status_code=result.error.status.value, detail=result.error.errmsg
            )
        return TOOL.to_tool_out(result.data, format)


@router.get("")
async def list_tools(
    project_id: asUUID = Path(..., description="Project ID"),
    user_id: asUUID | None = Query(None, description="Optional user ID (UUID)"),
    limit: int = Query(20, ge=1, le=200, description="Page size"),
    cursor: str | None = Query(None, description="Cursor for pagination"),
    time_desc: bool = Query(False, description="Order by created_at descending if true"),
    filter_config: str | None = Query(
        None, description="JSON-encoded object for JSONB containment filter"
    ),
    format: ToolFormat = Query("openai", description="Schema output format"),
) -> ListToolsResponse:
    """
    List tools for a given user under a project.
    """
    cfg = None
    if filter_config is not None:
        try:
            cfg = json.loads(filter_config)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"invalid filter_config: {e}")
        if cfg is not None and not isinstance(cfg, dict):
            raise HTTPException(
                status_code=400,
                detail="invalid filter_config: expected a JSON object",
            )

    async with DB_CLIENT.get_session_context() as db_session:
        result = await TOOL.list_tools(
            db_session,
            project_id=project_id,
            user_id=user_id,
            limit=limit,
            cursor=cursor,
            time_desc=time_desc,
            filter_config=cfg,
            fmt=format,
        )
        if not result.ok():
            raise HTTPException(
                status_code=result.error.status.value, detail=result.error.errmsg
            )
        return ListToolsResponse(**result.data)


@router.get("/search")
async def search_tools(
    project_id: asUUID = Path(..., description="Project ID"),
    user_id: asUUID | None = Query(None, description="Optional user ID (UUID)"),
    query: str = Query(..., description="Natural language search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results"),
    format: ToolFormat = Query("openai", description="Schema output format"),
) -> SearchToolsResponse:
    """
    Semantic search for tools (embedding similarity). Falls back to substring search
    if embeddings are unavailable.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await TOOL.search_tools(
            db_session,
            project_id=project_id,
            user_id=user_id,
            query=query,
            limit=limit,
            fmt=format,
        )
        if not result.ok():
            raise HTTPException(
                status_code=result.error.status.value, detail=result.error.errmsg
            )
        return SearchToolsResponse(items=result.data)


@router.delete("/{name}")
async def delete_tool(
    project_id: asUUID = Path(..., description="Project ID"),
    name: str = Path(..., description="Tool name to delete"),
    user_id: asUUID | None = Query(None, description="Optional user ID (UUID)"),
) -> Flag:
    """
    Delete a tool by name for a given user under a project.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await TOOL.delete_tool(
            db_session, project_id=project_id, user_id=user_id, name=name
        )
        if not result.ok():
            raise HTTPException(
                status_code=result.error.status.value, detail=result.error.errmsg
            )
        return Flag(status=0, errmsg="")
