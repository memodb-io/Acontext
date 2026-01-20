"""
Skills endpoints.
"""

import json
from collections.abc import Mapping
from typing import Any, BinaryIO, cast

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..types.skill import (
    DownloadSkillToSandboxResp,
    GetSkillFileResp,
    ListSkillsOutput,
    Skill,
)
from ..uploads import FileUpload, normalize_file_upload


class SkillsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def create(
        self,
        *,
        file: (
            FileUpload
            | tuple[str, BinaryIO | bytes]
            | tuple[str, BinaryIO | bytes, str]
        ),
        user: str | None = None,
        meta: Mapping[str, Any] | None = None,
    ) -> Skill:
        """Create a new skill by uploading a ZIP file.

        The ZIP file must contain a SKILL.md file (case-insensitive) with YAML format
        containing 'name' and 'description' fields.

        Args:
            file: The ZIP file to upload (FileUpload object or tuple format).
            user: Optional user identifier string. Defaults to None.
            meta: Custom metadata as JSON-serializable dict, defaults to None.

        Returns:
            Skill containing the created skill information.
        """
        upload = normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form: dict[str, Any] = {}
        if user is not None:
            form["user"] = user
        if meta is not None:
            form["meta"] = json.dumps(cast(Mapping[str, Any], meta))
        data = self._requester.request(
            "POST",
            "/agent_skills",
            data=form or None,
            files=files,
        )
        return Skill.model_validate(data)

    def list_catalog(
        self,
        *,
        user: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSkillsOutput:
        """Get a catalog of skills (names and descriptions only) with pagination.

        Args:
            user: Filter by user identifier. Defaults to None.
            limit: Maximum number of skills per page (defaults to 100, max 200).
            cursor: Cursor for pagination to fetch the next page (optional).
            time_desc: Order by created_at descending if True, ascending if False (defaults to False).

        Returns:
            ListSkillsOutput containing skills with name and description for the current page,
            along with pagination information (next_cursor and has_more).
        """
        effective_limit = limit if limit is not None else 100
        params = build_params(
            user=user, limit=effective_limit, cursor=cursor, time_desc=time_desc
        )
        data = self._requester.request("GET", "/agent_skills", params=params or None)
        # Pydantic ignores extra fields, so ListSkillsOutput directly extracts name/description
        return ListSkillsOutput.model_validate(data)

    def get(self, skill_id: str) -> Skill:
        """Get a skill by its ID.

        Args:
            skill_id: The UUID of the skill.

        Returns:
            Skill containing the full skill information including file_index.
        """
        data = self._requester.request("GET", f"/agent_skills/{skill_id}")
        return Skill.model_validate(data)

    def delete(self, skill_id: str) -> None:
        """Delete a skill by its ID.

        Args:
            skill_id: The UUID of the skill to delete.
        """
        self._requester.request("DELETE", f"/agent_skills/{skill_id}")

    def get_file(
        self,
        *,
        skill_id: str,
        file_path: str,
        expire: int | None = None,
    ) -> GetSkillFileResp:
        """Get a file from a skill by skill ID.

        The backend automatically returns content for parseable text files, or a presigned URL
        for non-parseable files (binary, images, etc.).

        Args:
            skill_id: The UUID of the skill.
            file_path: Relative path to the file within the skill (e.g., 'scripts/extract_text.json').
            expire: URL expiration time in seconds. Defaults to 900 (15 minutes).

        Returns:
            GetSkillFileResp containing the file path, MIME type, and either content or URL.
        """
        endpoint = f"/agent_skills/{skill_id}/file"

        params: dict[str, Any] = {"file_path": file_path}
        if expire is not None:
            params["expire"] = expire

        data = self._requester.request("GET", endpoint, params=params)
        return GetSkillFileResp.model_validate(data)

    def download_to_sandbox(
        self,
        *,
        skill_id: str,
        sandbox_id: str,
    ) -> DownloadSkillToSandboxResp:
        """Download all files from a skill to a sandbox environment.

        Files are placed at /skills/{skill_name}/.

        Args:
            skill_id: The UUID of the skill to download.
            sandbox_id: The UUID of the target sandbox.

        Returns:
            DownloadSkillToSandboxResp containing success status and the directory path
            where the skill was installed in the sandbox.

        Example:
        ```python
            result = client.skills.download_to_sandbox(
                skill_id="skill-uuid",
                sandbox_id="sandbox-uuid"
            )
            print(f"Success: {result.success}")
            print(f"Skill installed at: {result.dir_path}")
        ```
        """
        payload: dict[str, Any] = {"sandbox_id": sandbox_id}

        data = self._requester.request(
            "POST",
            f"/agent_skills/{skill_id}/download_to_sandbox",
            json_data=payload,
        )
        return DownloadSkillToSandboxResp.model_validate(data)
