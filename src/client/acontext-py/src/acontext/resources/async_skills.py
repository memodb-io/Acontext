"""
Skills endpoints (async).
"""

from collections.abc import Mapping
from typing import Any, BinaryIO

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..types.skill import (
    GetSkillFileURLResp,
    ListSkillsOutput,
    Skill,
)
from ..uploads import FileUpload, normalize_file_upload


class AsyncSkillsAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def list(
        self,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSkillsOutput:
        """List all skills in the project.

        Args:
            limit: Maximum number of skills to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            ListSkillsOutput containing the list of skills and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request(
            "GET", "/agent_skills", params=params or None
        )
        return ListSkillsOutput.model_validate(data)

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
            import json
            from typing import cast

            form["meta"] = json.dumps(cast(Mapping[str, Any], meta))
        data = await self._requester.request(
            "POST",
            "/agent_skills",
            data=form or None,
            files=files,
        )
        return Skill.model_validate(data)

    async def get(self, skill_id: str) -> Skill:
        """Get a skill by its ID.

        Args:
            skill_id: The UUID of the skill.

        Returns:
            Skill containing the skill information.
        """
        data = await self._requester.request("GET", f"/agent_skills/{skill_id}")
        return Skill.model_validate(data)

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

    async def update(
        self,
        skill_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        meta: Mapping[str, Any] | None = None,
    ) -> Skill:
        """Update a skill's metadata.

        Args:
            skill_id: The UUID of the skill.
            name: Optional new name for the skill.
            description: Optional new description for the skill.
            meta: Optional custom metadata as JSON-serializable dict.

        Returns:
            Skill containing the updated skill information.
        """
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        if meta is not None:
            payload["meta"] = meta
        data = await self._requester.request(
            "PUT", f"/agent_skills/{skill_id}", json_data=payload
        )
        return Skill.model_validate(data)

    async def delete(self, skill_id: str) -> None:
        """Delete a skill by its ID.

        Args:
            skill_id: The UUID of the skill to delete.
        """
        await self._requester.request("DELETE", f"/agent_skills/{skill_id}")

    async def get_file_url(
        self,
        skill_id: str,
        *,
        file_path: str,
        expire: int | None = None,
    ) -> GetSkillFileURLResp:
        """Get a presigned URL to download a specific file from a skill.

        Args:
            skill_id: The UUID of the skill.
            file_path: Relative path to the file within the skill (e.g., 'scripts/extract_text.json').
            expire: URL expiration time in seconds. Defaults to 900 (15 minutes).

        Returns:
            GetSkillFileURLResp containing the presigned URL.
        """
        params = {"file_path": file_path}
        if expire is not None:
            params["expire"] = expire
        data = await self._requester.request(
            "GET", f"/agent_skills/{skill_id}/file", params=params
        )
        return GetSkillFileURLResp.model_validate(data)

