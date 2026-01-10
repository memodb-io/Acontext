"""
Skills endpoints (async).
"""

import json
from collections.abc import Mapping
from typing import Any, BinaryIO, cast

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.skill import (
    GetSkillFileResp,
    ListSkillsOutput,
    Skill,
    SkillCatalogItem,
    _ListSkillsResponse,
)
from ..uploads import FileUpload, normalize_file_upload


class AsyncSkillsAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def create(
        self,
        *,
        file: FileUpload
        | tuple[str, BinaryIO | bytes]
        | tuple[str, BinaryIO | bytes, str],
        meta: Mapping[str, Any] | None = None,
    ) -> Skill:
        """Create a new skill by uploading a ZIP file.

        The ZIP file must contain a SKILL.md file (case-insensitive) with YAML format
        containing 'name' and 'description' fields.

        Args:
            file: The ZIP file to upload (FileUpload object or tuple format).
            meta: Custom metadata as JSON-serializable dict, defaults to None.

        Returns:
            Skill containing the created skill information.
        """
        upload = normalize_file_upload(file)
        files = {"file": upload.as_httpx()}
        form: dict[str, Any] = {}
        if meta is not None:
            form["meta"] = json.dumps(cast(Mapping[str, Any], meta))
        data = await self._requester.request(
            "POST",
            "/agent_skills",
            data=form or None,
            files=files,
        )
        return Skill.model_validate(data)

    async def list_catalog(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSkillsOutput:
        """Get a catalog of skills (names and descriptions only) with pagination.

        Args:
            limit: Maximum number of skills per page (defaults to 100, max 200).
            cursor: Cursor for pagination to fetch the next page (optional).
            time_desc: Order by created_at descending if True, ascending if False (defaults to False).

        Returns:
            ListSkillsOutput containing skills with name and description for the current page,
            along with pagination information (next_cursor and has_more).
        """
        effective_limit = limit if limit is not None else 100
        params = build_params(limit=effective_limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request(
            "GET", "/agent_skills", params=params or None
        )
        api_response = _ListSkillsResponse.model_validate(data)

        # Convert to catalog format (name and description only)
        return ListSkillsOutput(
            items=[
                SkillCatalogItem(name=skill.name, description=skill.description)
                for skill in api_response.items
            ],
            next_cursor=api_response.next_cursor,
            has_more=api_response.has_more,
        )

    async def get_by_name(self, name: str) -> Skill:
        """Get a skill by its name.

        Args:
            name: The name of the skill (unique within project).

        Returns:
            Skill containing the skill information.
        """
        params = {"name": name}
        data = await self._requester.request(
            "GET", "/agent_skills/by_name", params=params
        )
        return Skill.model_validate(data)

    async def delete(self, skill_id: str) -> None:
        """Delete a skill by its ID.

        Args:
            skill_id: The UUID of the skill to delete.
        """
        await self._requester.request("DELETE", f"/agent_skills/{skill_id}")

    async def get_file_by_name(
        self,
        *,
        skill_name: str,
        file_path: str,
        expire: int | None = None,
    ) -> GetSkillFileResp:
        """Get a file from a skill by name.

        The backend automatically returns content for parseable text files, or a presigned URL
        for non-parseable files (binary, images, etc.).

        Args:
            skill_name: The name of the skill.
            file_path: Relative path to the file within the skill (e.g., 'scripts/extract_text.json').
            expire: URL expiration time in seconds. Defaults to 900 (15 minutes).

        Returns:
            GetSkillFileResp containing the file path, MIME type, and either content or URL.
        """
        endpoint = f"/agent_skills/by_name/{skill_name}/file"

        params = {"file_path": file_path}
        if expire is not None:
            params["expire"] = expire

        data = await self._requester.request("GET", endpoint, params=params)
        return GetSkillFileResp.model_validate(data)

