"""
Skills endpoints.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, BinaryIO

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..types.skill import (
    GetSkillFileResp,
    ListSkillsOutput,
    Skill,
    SkillCatalogItem,
)
from ..uploads import FileUpload, normalize_file_upload


class SkillsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def create(
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
            import json
            from typing import cast

            form["meta"] = json.dumps(cast(Mapping[str, Any], meta))
        data = self._requester.request(
            "POST",
            "/agent_skills",
            data=form or None,
            files=files,
        )
        return Skill.model_validate(data)

    def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSkillsOutput:
        """Get a catalog of all skills (names and descriptions only).

        Automatically fetches all skills across all pages and returns them as a catalog.

        Args:
            limit: Maximum number of skills per page (used for pagination, defaults to API default).
            cursor: Cursor for pagination (usually not needed, as all results are fetched).
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            ListSkillsOutput containing all skills with name and description, total count.
            Note: next_cursor and has_more will be None/False since all results are included.
        """
        from pydantic import BaseModel

        class _ListSkillsResponse(BaseModel):
            items: list[Skill]
            next_cursor: str | None = None
            has_more: bool = False

        # Collect all skills across all pages
        all_skills: list[Skill] = []
        current_cursor = cursor
        page_limit = limit if limit is not None else 200  # Use max limit to minimize requests

        while True:
            params = build_params(limit=page_limit, cursor=current_cursor, time_desc=time_desc)
            data = self._requester.request("GET", "/agent_skills", params=params or None)
            api_response = _ListSkillsResponse.model_validate(data)

            all_skills.extend(api_response.items)

            # If no more pages, break
            if not api_response.has_more or api_response.next_cursor is None:
                break

            current_cursor = api_response.next_cursor

        # Convert to catalog format (name and description only)
        return ListSkillsOutput(
            items=[
                SkillCatalogItem(name=skill.name, description=skill.description)
                for skill in all_skills
            ],
            total=len(all_skills),
            next_cursor=None,  # All results included, no pagination needed
            has_more=False,  # All results included
        )

    def get_by_name(self, name: str) -> Skill:
        """Get a skill by its name.

        Args:
            name: The name of the skill (unique within project).

        Returns:
            Skill containing the skill information.
        """
        params = {"name": name}
        data = self._requester.request("GET", "/agent_skills/by_name", params=params)
        return Skill.model_validate(data)

    def delete(self, skill_id: str) -> None:
        """Delete a skill by its ID.

        Args:
            skill_id: The UUID of the skill to delete.
        """
        self._requester.request("DELETE", f"/agent_skills/{skill_id}")

    def get_file_by_name(
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

        data = self._requester.request("GET", endpoint, params=params)
        return GetSkillFileResp.model_validate(data)

