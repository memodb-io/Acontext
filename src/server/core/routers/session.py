from typing import List
from fastapi import APIRouter, Path, Query
from fastapi.exceptions import HTTPException
from pydantic import BaseModel

from acontext_core.env import LOG
from acontext_core.schema.api.response import Flag
from acontext_core.schema.utils import asUUID
from acontext_core.service.session_message import flush_session_message_blocking
from acontext_core.service.data.session_search_service import search_sessions_by_task_query
from acontext_core.infra.db import DB_CLIENT

router = APIRouter(prefix="/api/v1/project/{project_id}/session/{session_id}", tags=["session"])


@router.post("/flush")
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


# Search router for project-level session search
class SessionSearchResponse(BaseModel):
    session_ids: List[str]


search_router = APIRouter(prefix="/api/v1/sessions", tags=["session_search"])


@search_router.get("/search")
async def session_search(
    user_id: asUUID = Query(..., description="User ID to search within"),
    query: str = Query(..., description="Search query text"),
    limit: int = Query(10, ge=1, le=100, description="Maximum results to return"),
) -> SessionSearchResponse:
    """
    Uses vector embeddings on Tasks to find sessions with relevant context.
    """
    LOG.info(f"Searching sessions in user {user_id} with query: {query[:50]}...")

    async with DB_CLIENT.get_session_context() as db_session:
        result = await search_sessions_by_task_query(
            db_session,
            user_id,
            query,
            topk=limit,
        )

        if not result.ok():
            raise HTTPException(status_code=500, detail=result.error.errmsg)

        session_ids = [str(sid) for sid in result.data]
        return SessionSearchResponse(session_ids=session_ids)
