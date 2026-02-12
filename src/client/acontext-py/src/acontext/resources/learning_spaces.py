"""
Learning Spaces endpoints.
"""

from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..types.learning_space import (
    LearningSpace,
    LearningSpaceSession,
    LearningSpaceSkill,
    ListLearningSpacesOutput,
)
from ..types.skill import Skill


class LearningSpacesAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def create(
        self,
        *,
        user: str | None = None,
        meta: Mapping[str, Any] | None = None,
    ) -> LearningSpace:
        """Create a new learning space.

        Args:
            user: Optional user identifier string. Defaults to None.
            meta: Custom metadata as JSON-serializable dict, defaults to None.

        Returns:
            LearningSpace containing the created learning space information.
        """
        payload: dict[str, Any] = {}
        if user is not None:
            payload["user"] = user
        if meta is not None:
            payload["meta"] = dict(meta)
        data = self._requester.request("POST", "/learning_spaces", json_data=payload)
        return LearningSpace.model_validate(data)

    def list(
        self,
        *,
        user: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
        filter_by_meta: Mapping[str, Any] | None = None,
    ) -> ListLearningSpacesOutput:
        """List learning spaces with optional filters and pagination.

        Args:
            user: Filter by user identifier. Defaults to None.
            limit: Maximum number of items per page (default 20, max 200).
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True. Defaults to None.
            filter_by_meta: JSONB containment filter for meta. Defaults to None.

        Returns:
            ListLearningSpacesOutput with items, next_cursor, and has_more.
        """
        effective_limit = limit if limit is not None else 20
        params = build_params(
            user=user, limit=effective_limit, cursor=cursor, time_desc=time_desc
        )
        if filter_by_meta is not None and len(filter_by_meta) > 0:
            params["filter_by_meta"] = json.dumps(dict(filter_by_meta))
        data = self._requester.request(
            "GET", "/learning_spaces", params=params or None
        )
        return ListLearningSpacesOutput.model_validate(data)

    def get(self, space_id: str) -> LearningSpace:
        """Get a learning space by ID.

        Args:
            space_id: The UUID of the learning space.

        Returns:
            LearningSpace with full information.
        """
        data = self._requester.request("GET", f"/learning_spaces/{space_id}")
        return LearningSpace.model_validate(data)

    def update(
        self,
        space_id: str,
        *,
        meta: Mapping[str, Any],
    ) -> LearningSpace:
        """Update a learning space by merging meta into existing meta.

        Args:
            space_id: The UUID of the learning space.
            meta: Metadata to merge into existing meta.

        Returns:
            LearningSpace with updated information.
        """
        payload: dict[str, Any] = {"meta": dict(meta)}
        data = self._requester.request(
            "PATCH", f"/learning_spaces/{space_id}", json_data=payload
        )
        return LearningSpace.model_validate(data)

    def delete(self, space_id: str) -> None:
        """Delete a learning space by ID.

        Args:
            space_id: The UUID of the learning space to delete.
        """
        self._requester.request("DELETE", f"/learning_spaces/{space_id}")

    def learn(
        self,
        space_id: str,
        *,
        session_id: str,
    ) -> LearningSpaceSession:
        """Create an async learning record from a session.

        Args:
            space_id: The UUID of the learning space.
            session_id: The UUID of the session to learn from.

        Returns:
            LearningSpaceSession with pending status.
        """
        payload: dict[str, Any] = {"session_id": session_id}
        data = self._requester.request(
            "POST", f"/learning_spaces/{space_id}/learn", json_data=payload
        )
        return LearningSpaceSession.model_validate(data)

    def list_sessions(self, space_id: str) -> list[LearningSpaceSession]:
        """List all learning session records for a space.

        Args:
            space_id: The UUID of the learning space.

        Returns:
            List of LearningSpaceSession records.
        """
        data = self._requester.request(
            "GET", f"/learning_spaces/{space_id}/sessions"
        )
        return [LearningSpaceSession.model_validate(item) for item in data]

    def include_skill(
        self,
        space_id: str,
        *,
        skill_id: str,
    ) -> LearningSpaceSkill:
        """Include a skill in a learning space.

        Args:
            space_id: The UUID of the learning space.
            skill_id: The UUID of the skill to include.

        Returns:
            LearningSpaceSkill junction record.
        """
        payload: dict[str, Any] = {"skill_id": skill_id}
        data = self._requester.request(
            "POST", f"/learning_spaces/{space_id}/skills", json_data=payload
        )
        return LearningSpaceSkill.model_validate(data)

    def list_skills(self, space_id: str) -> list[Skill]:
        """List all skills in a learning space.

        Args:
            space_id: The UUID of the learning space.

        Returns:
            List of full Skill objects.
        """
        data = self._requester.request(
            "GET", f"/learning_spaces/{space_id}/skills"
        )
        return [Skill.model_validate(item) for item in data]

    def exclude_skill(
        self,
        space_id: str,
        *,
        skill_id: str,
    ) -> None:
        """Remove a skill from a learning space. Idempotent.

        Args:
            space_id: The UUID of the learning space.
            skill_id: The UUID of the skill to exclude.
        """
        self._requester.request(
            "DELETE", f"/learning_spaces/{space_id}/skills/{skill_id}"
        )
