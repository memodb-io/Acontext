"""
Skills endpoints.
"""

from collections.abc import Mapping
from typing import Any, BinaryIO

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..types.skill import (
    GetSkillFileResp,
    ListSkillsOutput,
    Skill,
)
from ..uploads import FileUpload, normalize_file_upload


class SkillsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def list(
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
        data = self._requester.request("GET", "/agent_skills", params=params or None)
        return ListSkillsOutput.model_validate(data)

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

    def get(self, skill_id: str) -> Skill:
        """Get a skill by its ID.

        Args:
            skill_id: The UUID of the skill.

        Returns:
            Skill containing the skill information.
        """
        data = self._requester.request("GET", f"/agent_skills/{skill_id}")
        return Skill.model_validate(data)

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

    def update(
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
        data = self._requester.request(
            "PUT", f"/agent_skills/{skill_id}", json_data=payload
        )
        return Skill.model_validate(data)

    def delete(self, skill_id: str) -> None:
        """Delete a skill by its ID.

        Args:
            skill_id: The UUID of the skill to delete.
        """
        self._requester.request("DELETE", f"/agent_skills/{skill_id}")

    def get_file(
        self,
        skill_id: str | None = None,
        skill_name: str | None = None,
        *,
        file_path: str,
        expire: int | None = None,
    ) -> GetSkillFileResp:
        """Get a file from a skill by ID or name.

        The backend automatically returns content for parseable text files, or a presigned URL
        for non-parseable files (binary, images, etc.).

        Args:
            skill_id: The UUID of the skill. Either skill_id or skill_name must be provided.
            skill_name: The name of the skill. Either skill_id or skill_name must be provided.
            file_path: Relative path to the file within the skill (e.g., 'scripts/extract_text.json').
            expire: URL expiration time in seconds. Defaults to 900 (15 minutes).

        Returns:
            GetSkillFileResp containing the file path, MIME type, and either content or URL.
        """
        if not skill_id and not skill_name:
            raise ValueError("Either skill_id or skill_name must be provided")

        # Use by_name endpoint if skill_name is provided
        if skill_name:
            endpoint = f"/agent_skills/by_name/{skill_name}/file"
        else:
            # For skill_id, use the existing endpoint (which only returns URL)
            endpoint = f"/agent_skills/{skill_id}/file"

        params = {"file_path": file_path}
        if expire is not None:
            params["expire"] = expire

        data = self._requester.request("GET", endpoint, params=params)

        # Handle different response formats:
        # - /agent_skills/by_name/{name}/file returns {path, mime, content?, url?}
        # - /agent_skills/{id}/file returns {url: "..."}
        if "path" in data and "mime" in data:
            # New format from GetFile endpoint
            return GetSkillFileResp.model_validate(data)
        elif "url" in data:
            # Old format from GetFileURL endpoint (only URL)
            # We need to construct a minimal response
            return GetSkillFileResp(
                path=file_path,
                mime="",  # Not available from old endpoint
                url=data.get("url"),
                content=None,
            )
        else:
            # Fallback: try to parse as GetSkillFileResp
            return GetSkillFileResp.model_validate(data)

