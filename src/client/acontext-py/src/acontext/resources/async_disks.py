"""
Disk and artifact endpoints (async).
"""

from __future__ import annotations

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
        params = build_params(
            user=user, limit=limit, cursor=cursor, time_desc=time_desc
        )
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
        file: (
            FileUpload
            | tuple[str, BinaryIO | bytes]
            | tuple[str, BinaryIO | bytes, str]
        ),
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
        data = await self._requester.request(
            "GET", f"/disk/{disk_id}/artifact", params=params
        )
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
        data = await self._requester.request(
            "PUT", f"/disk/{disk_id}/artifact", json_data=payload
        )
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
        await self._requester.request(
            "DELETE", f"/disk/{disk_id}/artifact", params=params
        )

    async def list(
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
        data = await self._requester.request(
            "GET", f"/disk/{disk_id}/artifact/ls", params=params or None
        )
        return ListArtifactsResp.model_validate(data)

    async def grep_artifacts(
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
            results = await client.disks.artifacts.grep_artifacts(
                disk_id="disk-uuid",
                query="TODO.*bug"
            )
        ```
        """
        params = build_params(query=query, limit=limit)
        data = await self._requester.request(
            "GET", f"/disk/{disk_id}/artifact/grep", params=params
        )
        return [Artifact.model_validate(item) for item in data]

    async def glob_artifacts(
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
            results = await client.disks.artifacts.glob_artifacts(
                disk_id="disk-uuid",
                query="**/*.py"
            )
        ```
        """
        params = build_params(query=query, limit=limit)
        data = await self._requester.request(
            "GET", f"/disk/{disk_id}/artifact/glob", params=params
        )
        return [Artifact.model_validate(item) for item in data]

    async def download_to_sandbox(
        self,
        disk_id: str,
        *,
        file_path: str,
        filename: str,
        sandbox_id: str,
        sandbox_path: str,
    ) -> bool:
        """Download an artifact from disk storage to a sandbox environment.

        Args:
            disk_id: The UUID of the disk containing the artifact.
            file_path: Directory path of the artifact (not including filename).
            filename: The filename of the artifact.
            sandbox_id: The UUID of the target sandbox.
            sandbox_path: Destination directory in the sandbox.

        Returns:
            True if the download was successful.

        Example:
        ```python
            success = await client.disks.artifacts.download_to_sandbox(
                disk_id="disk-uuid",
                file_path="/documents/",
                filename="report.pdf",
                sandbox_id="sandbox-uuid",
                sandbox_path="/home/user/"
            )
            print(f"Success: {success}")
        ```
        """
        payload = {
            "file_path": file_path,
            "filename": filename,
            "sandbox_id": sandbox_id,
            "sandbox_path": sandbox_path,
        }
        data = await self._requester.request(
            "POST",
            f"/disk/{disk_id}/artifact/download_to_sandbox",
            json_data=payload,
        )
        return bool(data.get("success", False))

    async def upload_from_sandbox(
        self,
        disk_id: str,
        *,
        sandbox_id: str,
        sandbox_path: str,
        sandbox_filename: str,
        file_path: str,
    ) -> Artifact:
        """Upload a file from a sandbox environment to disk storage as an artifact.

        Args:
            disk_id: The UUID of the target disk.
            sandbox_id: The UUID of the source sandbox.
            sandbox_path: Source directory in the sandbox (not including filename).
            sandbox_filename: Filename in the sandbox.
            file_path: Destination directory path on the disk.

        Returns:
            Artifact containing the created artifact information.

        Example:
        ```python
            artifact = await client.disks.artifacts.upload_from_sandbox(
                disk_id="disk-uuid",
                sandbox_id="sandbox-uuid",
                sandbox_path="/home/user/",
                sandbox_filename="output.txt",
                file_path="/results/"
            )
            print(f"Created: {artifact.path}{artifact.filename}")
        ```
        """
        payload = {
            "sandbox_id": sandbox_id,
            "sandbox_path": sandbox_path,
            "sandbox_filename": sandbox_filename,
            "file_path": file_path,
        }
        data = await self._requester.request(
            "POST",
            f"/disk/{disk_id}/artifact/upload_from_sandbox",
            json_data=payload,
        )
        return Artifact.model_validate(data)
