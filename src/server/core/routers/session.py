from fastapi import APIRouter, Path
from acontext_core.env import LOG
from acontext_core.schema.api.response import Flag
from acontext_core.schema.utils import asUUID
from acontext_core.service.session_message import flush_session_message_blocking

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
