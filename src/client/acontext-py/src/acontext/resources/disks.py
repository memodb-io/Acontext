"""
Disk and artifact endpoints.
"""

import json
from collections.abc import Mapping, MutableMapping
from typing import Any, BinaryIO, cast

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..types.disk import (
    Artifact,
    Disk,
    GetArtifactResp,
    ListArtifactsResp,
    ListDisksOutput,
    UpdateArtifactResp,
)
from ..uploads import FileUpload, normalize_file_upload


class DisksAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester
        self.artifacts = DiskArtifactsAPI(requester)

    def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListDisksOutput:
        """List all disks in the project.
        
        Args:
            limit: Maximum number of disks to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.
            
        Returns:
            ListDisksOutput containing the list of disks and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = self._requester.request("GET", "/disk", params=params or None)
        return ListDisksOutput.model_validate(data)

    def create(self) -> Disk:
        """Create a new disk.
        
        Returns:
            The created Disk object.
        """
        data = self._requester.request("POST", "/disk")
        return Disk.model_validate(data)

    def delete(self, disk_id: str) -> None:
        """Delete a disk by its ID.
        
        Args:
            disk_id: The UUID of the disk to delete.
        """
        self._requester.request("DELETE", f"/disk/{disk_id}")


class DiskArtifactsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def upsert(
        self,
        disk_id: str,
        *,
        file: FileUpload
        | tuple[str, BinaryIO | bytes]
        | tuple[str, BinaryIO | bytes, str | None],
        file_path: str | None = None,
        meta: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Artifact:
        upload = normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form: dict[str, Any] = {}
        if file_path:
            form["file_path"] = file_path
        if meta is not None:
            form["meta"] = json.dumps(cast(Mapping[str, Any], meta))
        data = self._requester.request(
            "POST",
            f"/disk/{disk_id}/artifact",
            data=form or None,
            files=files,
        )
        return Artifact.model_validate(data)

    def get(
        self,
        disk_id: str,
        *,
        file_path: str,
        with_public_url: bool | None = None,
        with_content: bool | None = None,
        expire: int | None = None,
    ) -> GetArtifactResp:
        """Get an artifact by disk ID and file path.
        
        Args:
            disk_id: The UUID of the disk.
            file_path: The path of the file within the disk.
            with_public_url: Whether to include a presigned public URL. Defaults to None.
            with_content: Whether to include file content. Defaults to None.
            expire: URL expiration time in seconds. Defaults to None.
            
        Returns:
            GetArtifactResp containing the artifact and optionally public URL and content.
        """
        params = build_params(
            file_path=file_path,
            with_public_url=with_public_url,
            with_content=with_content,
            expire=expire,
        )
        data = self._requester.request("GET", f"/disk/{disk_id}/artifact", params=params)
        return GetArtifactResp.model_validate(data)

    def update(
        self,
        disk_id: str,
        *,
        file_path: str,
        meta: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> UpdateArtifactResp:
        payload = {
            "file_path": file_path,
            "meta": json.dumps(cast(Mapping[str, Any], meta)),
        }
        data = self._requester.request("PUT", f"/disk/{disk_id}/artifact", json_data=payload)
        return UpdateArtifactResp.model_validate(data)

    def delete(
        self,
        disk_id: str,
        *,
        file_path: str,
    ) -> None:
        params = {"file_path": file_path}
        self._requester.request("DELETE", f"/disk/{disk_id}/artifact", params=params)

    def list(
        self,
        disk_id: str,
        *,
        path: str | None = None,
    ) -> ListArtifactsResp:
        params: dict[str, Any] = {}
        if path is not None:
            params["path"] = path
        data = self._requester.request("GET", f"/disk/{disk_id}/artifact/ls", params=params or None)
        return ListArtifactsResp.model_validate(data)
