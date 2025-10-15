"""
Artifact and file endpoints.
"""

from __future__ import annotations

import json
from typing import Any, BinaryIO, Mapping, MutableMapping

from ..client_types import RequesterProtocol
from ..uploads import FileUpload, normalize_file_upload

__all__ = ["ArtifactsAPI", "ArtifactFilesAPI"]


class ArtifactsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester
        self.files = ArtifactFilesAPI(requester)

    def list(self) -> Any:
        return self._requester.request("GET", "/artifact")

    def create(self) -> Any:
        return self._requester.request("POST", "/artifact")

    def delete(self, artifact_id: str) -> None:
        self._requester.request("DELETE", f"/artifact/{artifact_id}")


class ArtifactFilesAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def upload(
        self,
        artifact_id: str,
        *,
        file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
        file_path: str | None = None,
        meta: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Any:
        upload = normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form: dict[str, Any] = {}
        if file_path:
            form["file_path"] = file_path
        if meta is not None:
            form["meta"] = json.dumps(meta)
        return self._requester.request(
            "POST",
            f"/artifact/{artifact_id}/file",
            data=form or None,
            files=files,
        )

    def update(
        self,
        artifact_id: str,
        *,
        file_path: str,
        file: FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None],
    ) -> Any:
        upload = normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form = {"file_path": file_path}
        return self._requester.request(
            "PUT",
            f"/artifact/{artifact_id}/file",
            data=form,
            files=files,
        )

    def delete(self, artifact_id: str, *, file_path: str) -> None:
        params = {"file_path": file_path}
        self._requester.request("DELETE", f"/artifact/{artifact_id}/file", params=params)

    def get(
        self,
        artifact_id: str,
        *,
        file_path: str,
        with_public_url: bool | None = None,
        expire: int | None = None,
    ) -> Any:
        params: dict[str, Any] = {"file_path": file_path}
        if with_public_url is not None:
            params["with_public_url"] = "true" if with_public_url else "false"
        if expire is not None:
            params["expire"] = expire
        return self._requester.request("GET", f"/artifact/{artifact_id}/file", params=params)

    def list(
        self,
        artifact_id: str,
        *,
        path: str | None = None,
    ) -> Any:
        params: dict[str, Any] = {}
        if path is not None:
            params["path"] = path
        return self._requester.request("GET", f"/artifact/{artifact_id}/file/ls", params=params or None)
