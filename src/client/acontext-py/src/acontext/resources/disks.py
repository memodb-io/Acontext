"""
Disk and artifact endpoints.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any, BinaryIO, cast

from pydantic import TypeAdapter

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
        data = self._requester.request("GET", f"/disk/{disk_id}/artifact", params=params)
        return GetArtifactResp.model_validate(data)

    def update(
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
        data = self._requester.request("PUT", f"/disk/{disk_id}/artifact", json_data=payload)
        return UpdateArtifactResp.model_validate(data)

    def delete(
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
        self._requester.request("DELETE", f"/disk/{disk_id}/artifact", params=params)

    def list(
        self,
        disk_id: str,
        *,
        path: str | None = None,
    ) -> ListArtifactsResp:
        """List artifacts in a disk at a specific path.
        
        Args:
            disk_id: The UUID of the disk.
            path: Directory path to list. Defaults to None (root).
            
        Returns:
            ListArtifactsResp containing the list of artifacts.
        """
        params: dict[str, Any] = {}
        if path is not None:
            params["path"] = path
        data = self._requester.request("GET", f"/disk/{disk_id}/artifact/ls", params=params or None)
        return ListArtifactsResp.model_validate(data)

    def grep_artifacts(
        self,
        disk_id: str,
        *,
        query: str,
        limit: int = 100,
    ) -> list[Artifact]:
        """Search artifact content using regex pattern.
        
        Args:
            disk_id: The disk ID to search in
            query: Regex pattern to search for in file content
            limit: Maximum number of results (default 100, max 1000)
            
        Returns:
            List of matching artifacts
            
        Example:
```python
            # Search for TODO comments in code
            results = client.disks.artifacts.grep_artifacts(
                disk_id="disk-uuid",
                query="TODO.*bug"
            )
```
        """
        params = build_params(query=query, limit=limit)
        data = self._requester.request(
            "GET",
            f"/disk/{disk_id}/artifact/grep",
            params=params
        )
        return TypeAdapter(list[Artifact]).validate_python(data)

    def glob_artifacts(
        self,
        disk_id: str,
        *,
        query: str,
        limit: int = 100,
    ) -> list[Artifact]:
        """Search artifact paths using glob pattern.
        
        Args:
            disk_id: The disk ID to search in
            query: Glob pattern (e.g., '**/*.py', '*.txt')
            limit: Maximum number of results (default 100, max 1000)
            
        Returns:
            List of matching artifacts
            
        Example:
```python
            # Find all Python files
            results = client.disks.artifacts.glob_artifacts(
                disk_id="disk-uuid",
                query="**/*.py"
            )
```
        """
        params = build_params(query=query, limit=limit)
        data = self._requester.request(
            "GET",
            f"/disk/{disk_id}/artifact/glob",
            params=params
        )
        return TypeAdapter(list[Artifact]).validate_python(data)
