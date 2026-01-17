from fastapi import APIRouter, Path, Body
from fastapi.exceptions import HTTPException
from acontext_core.infra.db import DB_CLIENT
from acontext_core.schema.api.request import (
    SandboxExecRequest,
    SandboxDownloadRequest,
    SandboxUploadRequest,
)
from acontext_core.schema.api.response import Flag, SandboxFileTransferResponse
from acontext_core.schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
)
from acontext_core.schema.utils import asUUID
from acontext_core.service.data import sandbox as SB

router = APIRouter(prefix="/api/v1/project/{project_id}/sandbox", tags=["sandbox"])


@router.post("")
async def start_sandbox(
    project_id: asUUID = Path(..., description="Project ID"),
) -> SandboxRuntimeInfo:
    """
    Create and start a new sandbox.
    """
    config = SandboxCreateConfig()
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.create_sandbox(db_session, project_id, config)
        if not result.ok():
            raise HTTPException(status_code=503, detail=result.error.errmsg)
        return result.data


@router.delete("/{sandbox_id}")
async def kill_sandbox(
    project_id: asUUID = Path(..., description="Project ID"),
    sandbox_id: asUUID = Path(..., description="Sandbox ID to kill"),
) -> Flag:
    """
    Kill a running sandbox.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.kill_sandbox(db_session, sandbox_id)
        if not result.ok():
            raise HTTPException(status_code=503, detail=result.error.errmsg)
        if result.data:
            return Flag(status=0, errmsg="")
        return Flag(status=1, errmsg="Failed to kill sandbox")


@router.get("/{sandbox_id}")
async def get_sandbox(
    project_id: asUUID = Path(..., description="Project ID"),
    sandbox_id: asUUID = Path(..., description="Sandbox ID to query"),
) -> SandboxRuntimeInfo:
    """
    Get runtime information about a sandbox.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.get_sandbox(db_session, sandbox_id)
        if not result.ok():
            raise HTTPException(status_code=404, detail=result.error.errmsg)
        return result.data


@router.patch("/{sandbox_id}")
async def update_sandbox(
    project_id: asUUID = Path(..., description="Project ID"),
    sandbox_id: asUUID = Path(..., description="Sandbox ID to update"),
    config: SandboxUpdateConfig = Body(..., description="Sandbox update configuration"),
) -> SandboxRuntimeInfo:
    """
    Update sandbox configuration (e.g., extend timeout).
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.update_sandbox(db_session, sandbox_id, config)
        if not result.ok():
            raise HTTPException(status_code=404, detail=result.error.errmsg)
        return result.data


@router.post("/{sandbox_id}/exec")
async def exec_sandbox_command(
    project_id: asUUID = Path(..., description="Project ID"),
    sandbox_id: asUUID = Path(..., description="Sandbox ID to execute command in"),
    request: SandboxExecRequest = Body(..., description="Command execution request"),
) -> SandboxCommandOutput:
    """
    Execute a shell command in the sandbox.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.exec_command(db_session, sandbox_id, request.command)
        if not result.ok():
            raise HTTPException(status_code=404, detail=result.error.errmsg)
        return result.data


@router.post("/{sandbox_id}/download")
async def download_sandbox_file(
    project_id: asUUID = Path(..., description="Project ID"),
    sandbox_id: asUUID = Path(..., description="Sandbox ID to download from"),
    request: SandboxDownloadRequest = Body(..., description="File download request"),
) -> SandboxFileTransferResponse:
    """
    Download a file from the sandbox and upload it to S3.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.download_file(
            db_session,
            sandbox_id,
            request.from_sandbox_file,
            request.download_to_s3_path,
        )
        if not result.ok():
            raise HTTPException(status_code=404, detail=result.error.errmsg)
        return SandboxFileTransferResponse(success=result.data)


@router.post("/{sandbox_id}/upload")
async def upload_sandbox_file(
    project_id: asUUID = Path(..., description="Project ID"),
    sandbox_id: asUUID = Path(..., description="Sandbox ID to upload to"),
    request: SandboxUploadRequest = Body(..., description="File upload request"),
) -> SandboxFileTransferResponse:
    """
    Download a file from S3 and upload it to the sandbox.
    """
    async with DB_CLIENT.get_session_context() as db_session:
        result = await SB.upload_file(
            db_session, sandbox_id, request.from_s3_file, request.upload_to_sandbox_path
        )
        if not result.ok():
            raise HTTPException(status_code=404, detail=result.error.errmsg)
        return SandboxFileTransferResponse(success=result.data)
