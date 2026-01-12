"""
Disk and artifact endpoints (async).
"""

import json
from collections.abc import Mapping
from typing import Any, BinaryIO, cast

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.disk import (
    Artifact,
    Disk,
    GetArtifactResp,
    ListArtifactsResp,
    ListDisksOutput,
    UpdateArtifactResp,
)
from ..uploads import FileUpload, normalize_file_upload


class AsyncDisksAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester
        self.artifacts = AsyncDiskArtifactsAPI(requester)

    async def list(
        self,
        *,
        user: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListDisksOutput:
        """List all disks in the project.
        
        Args:
            user: Filter by user identifier. Defaults to None.
            limit: Maximum number of disks to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.
            
        Returns:
            ListDisksOutput containing the list of disks and pagination information.
        """
        params = build_params(user=user, limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request("GET", "/disk", params=params or None)
        return ListDisksOutput.model_validate(data)

    async def create(self, *, user: str | None = None) -> Disk:
        """Create a new disk.
        
        Args:
            user: Optional user identifier string. Defaults to None.
            
        Returns:
            The created Disk object.
        """
        payload: dict[str, Any] = {}
        if user is not None:
            payload["user"] = user
        data = await self._requester.request("POST", "/disk", json_data=payload or None)
        return Disk.model_validate(data)

    async def delete(self, disk_id: str) -> None:
        """Delete a disk by its ID.
        
        Args:
            disk_id: The UUID of the disk to delete.
        """
        await self._requester.request("DELETE", f"/disk/{disk_id}")


class AsyncDiskArtifactsAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def upsert(
        self,
        disk_id: str,
        *,
        file: FileUpload
        | tuple[str, BinaryIO | bytes]
        | tuple[str, BinaryIO | bytes, str],
        file_path: str | None = None,
        meta: Mapping[str, Any] | None = None,
    ) -> Artifact:
        """Upload a file to create or update an artifact.
        
        Args:
            disk_id: The UUID of the disk.
            file: The file to upload (FileUpload object or tuple format).
            file_path: Directory path (not including filename), defaults to "/".
            meta: Custom metadata as JSON-serializable dict, defaults to None.
            
        Returns:
            Artifact containing the created/updated artifact information.
        """
        upload = normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form: dict[str, Any] = {}
        if file_path:
            form["file_path"] = file_path
        if meta is not None:
            form["meta"] = json.dumps(cast(Mapping[str, Any], meta))
        data = await self._requester.request(
            "POST",
            f"/disk/{disk_id}/artifact",
            data=form or None,
            files=files,
        )
        return Artifact.model_validate(data)

    async def get(
        self,
        disk_id: str,
        *,
        file_path: str,
        filename: str,
        with_public_url: bool | None = None,
        with_content: bool | None = None,
        expire: int | None = None,
    ) -> GetArtifactResp:
        """Get an artifact by disk ID, file path, and filename.
        
        Args:
            disk_id: The UUID of the disk.
            file_path: Directory path (not including filename).
            filename: The filename of the artifact.
            with_public_url: Whether to include a presigned public URL. Defaults to None.
            with_content: Whether to include file content. Defaults to None.
            expire: URL expiration time in seconds. Defaults to None.
            
        Returns:
            GetArtifactResp containing the artifact and optionally public URL and content.
        """
        full_path = f"{file_path.rstrip('/')}/{filename}"
        params = build_params(
            file_path=full_path,
            with_public_url=with_public_url,
            with_content=with_content,
            expire=expire,
        )
        data = await self._requester.request("GET", f"/disk/{disk_id}/artifact", params=params)
        return GetArtifactResp.model_validate(data)

    async def update(
        self,
        disk_id: str,
        *,
        file_path: str,
        filename: str,
        meta: Mapping[str, Any],
    ) -> UpdateArtifactResp:
        """Update an artifact's metadata.
        
        Args:
            disk_id: The UUID of the disk.
            file_path: Directory path (not including filename).
            filename: The filename of the artifact.
            meta: Custom metadata as JSON-serializable dict.
            
        Returns:
            UpdateArtifactResp containing the updated artifact information.
        """
        full_path = f"{file_path.rstrip('/')}/{filename}"
        payload = {
            "file_path": full_path,
            "meta": json.dumps(cast(Mapping[str, Any], meta)),
        }
        data = await self._requester.request("PUT", f"/disk/{disk_id}/artifact", json_data=payload)
        return UpdateArtifactResp.model_validate(data)

    async def delete(
        self,
        disk_id: str,
        *,
        file_path: str,
        filename: str,
    ) -> None:
        """Delete an artifact by disk ID, file path, and filename.
        
        Args:
            disk_id: The UUID of the disk.
            file_path: Directory path (not including filename).
            filename: The filename of the artifact.
        """
        full_path = f"{file_path.rstrip('/')}/{filename}"
        params = {"file_path": full_path}
        await self._requester.request("DELETE", f"/disk/{disk_id}/artifact", params=params)

    async def list(
        self,
        disk_id: str,
        *,
        path: str | None = None,
    ) -> ListArtifactsResp:
        params: dict[str, Any] = {}
        if path is not None:
            params["path"] = path
        data = await self._requester.request("GET", f"/disk/{disk_id}/artifact/ls", params=params or None)
        return ListArtifactsResp.model_validate(data)

