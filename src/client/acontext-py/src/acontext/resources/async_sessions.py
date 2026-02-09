"""Sessions endpoints (async)."""

import json
from collections.abc import Mapping
from dataclasses import asdict
from typing import Any, BinaryIO, Literal, Optional, List

from .._utils import build_params, validate_edit_strategies
from ..client_types import AsyncRequesterProtocol
from ..messages import AcontextMessage
from ..types.session import (
    EditStrategy,
    CopySessionResult,
    GetMessagesOutput,
    GetTasksOutput,
    ListSessionsOutput,
    Message,
    MessageObservingStatus,
    Session,
    TokenCounts,
)
from ..uploads import FileUpload, normalize_file_upload
from pydantic import BaseModel
from openai.types.chat import ChatCompletionMessageParam
from anthropic.types import MessageParam

UploadPayload = (
    FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None]
)
MessageBlob = AcontextMessage | ChatCompletionMessageParam | MessageParam


class AsyncSessionsAPI:
    def __init__(self, requester: AsyncRequesterProtocol) -> None:
        self._requester = requester

    async def list(
        self,
        *,
        user: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
        filter_by_configs: Mapping[str, Any] | None = None,
    ) -> ListSessionsOutput:
        """List all sessions in the project.

        Args:
            user: Filter by user identifier. Defaults to None.
            limit: Maximum number of sessions to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.
            filter_by_configs: Filter by session configs using JSONB containment.
                Only sessions where configs contains all key-value pairs in this
                dict will be returned. Supports nested objects.
                Note: Matching is case-sensitive and type-sensitive.
                Sessions with NULL configs are excluded from filtered results.
                Defaults to None.

        Returns:
            ListSessionsOutput containing the list of sessions and pagination information.

        Example:
            >>> sessions = await client.sessions.list(filter_by_configs={"agent": "bot1"})
        """
        params: dict[str, Any] = {}
        if user:
            params["user"] = user
        # Handle filter_by_configs - JSON encode, skip empty dict
        if filter_by_configs is not None and len(filter_by_configs) > 0:
            params["filter_by_configs"] = json.dumps(filter_by_configs)
        params.update(
            build_params(
                limit=limit,
                cursor=cursor,
                time_desc=time_desc,
            )
        )
        data = await self._requester.request("GET", "/session", params=params or None)
        return ListSessionsOutput.model_validate(data)

    async def create(
        self,
        *,
        user: str | None = None,
        disable_task_tracking: bool | None = None,
        configs: Mapping[str, Any] | None = None,
        use_uuid: str | None = None,
    ) -> Session:
        """Create a new session.

        Args:
            user: Optional user identifier string. Defaults to None.
            disable_task_tracking: Whether to disable task tracking for this session. Defaults to None (server default: False).
            configs: Optional session configuration dictionary. Defaults to None.
            use_uuid: Optional UUID string to use as the session ID. If not provided, a UUID will be auto-generated.
                If a session with this UUID already exists, a 409 Conflict error will be raised.

        Returns:
            The created Session object.

        Raises:
            AcontextAPIError: If use_uuid is invalid or a session with this UUID already exists.
        """
        payload: dict[str, Any] = {}
        if user:
            payload["user"] = user
        if disable_task_tracking is not None:
            payload["disable_task_tracking"] = disable_task_tracking
        if configs is not None:
            payload["configs"] = configs
        if use_uuid is not None:
            payload["use_uuid"] = use_uuid
        data = await self._requester.request("POST", "/session", json_data=payload)
        return Session.model_validate(data)

    async def delete(self, session_id: str) -> None:
        """Delete a session by its ID.

        Args:
            session_id: The UUID of the session to delete.
        """
        await self._requester.request("DELETE", f"/session/{session_id}")

    async def update_configs(
        self,
        session_id: str,
        *,
        configs: Mapping[str, Any],
    ) -> None:
        """Update session configurations.

        Args:
            session_id: The UUID of the session.
            configs: Session configuration dictionary.
        """
        payload = {"configs": configs}
        await self._requester.request(
            "PUT", f"/session/{session_id}/configs", json_data=payload
        )

    async def get_configs(self, session_id: str) -> Session:
        """Get session configurations.

        Args:
            session_id: The UUID of the session.

        Returns:
            Session object containing the configurations.
        """
        data = await self._requester.request("GET", f"/session/{session_id}/configs")
        return Session.model_validate(data)

    async def get_tasks(
        self,
        session_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> GetTasksOutput:
        """Get tasks for a session.

        Args:
            session_id: The UUID of the session.
            limit: Maximum number of tasks to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            GetTasksOutput containing the list of tasks and pagination information.
        """
        params = build_params(limit=limit, cursor=cursor, time_desc=time_desc)
        data = await self._requester.request(
            "GET",
            f"/session/{session_id}/task",
            params=params or None,
        )
        return GetTasksOutput.model_validate(data)

    async def get_session_summary(
        self,
        session_id: str,
        *,
        limit: int | None = None,
    ) -> str:
        """Get a summary of all tasks in a session as a formatted string.

        Args:
            session_id: The UUID of the session.
            limit: Maximum number of tasks to include in the summary. Defaults to None (all tasks).

        Returns:
            A formatted string containing the session summary with all task information.
        """
        tasks_output = await self.get_tasks(session_id, limit=limit, time_desc=False)
        tasks = tasks_output.items

        if not tasks:
            return ""

        parts: list[str] = []
        for task in tasks:
            task_lines = [
                f'<task id="{task.order}" description="{task.data.task_description}">'
            ]
            if task.data.progresses:
                task_lines.append("<progress>")
                for i, p in enumerate(task.data.progresses, 1):
                    task_lines.append(f"{i}. {p}")
                task_lines.append("</progress>")
            if task.data.user_preferences:
                task_lines.append("<user_preference>")
                for i, pref in enumerate(task.data.user_preferences, 1):
                    task_lines.append(f"{i}. {pref}")
                task_lines.append("</user_preference>")
            task_lines.append("</task>")
            parts.append("\n".join(task_lines))

        return "\n".join(parts)

    async def store_message(
        self,
        session_id: str,
        *,
        blob: MessageBlob,
        format: Literal["acontext", "openai", "anthropic", "gemini"] = "openai",
        meta: dict[str, Any] | None = None,
        file_field: str | None = None,
        file: (
            FileUpload
            | tuple[str, BinaryIO | bytes]
            | tuple[str, BinaryIO | bytes, str]
            | None
        ) = None,
    ) -> Message:
        """Store a message to a session.

        Args:
            session_id: The UUID of the session.
            blob: The message blob in Acontext, OpenAI, Anthropic, or Gemini format.
            format: The format of the message blob. Defaults to "openai".
            meta: Optional user-provided metadata for the message. This metadata is stored
                separately from the message content and can be retrieved via get_messages().metas
                or updated via patch_message_meta(). Works with all formats.
            file_field: The field name for file upload. Only used when format is "acontext".
                Required if file is provided. Defaults to None.
            file: Optional file upload. Only used when format is "acontext". Defaults to None.

        Returns:
            The created Message object. The msg.meta field contains only user-provided metadata.

        Raises:
            ValueError: If format is invalid, file/file_field provided for non-acontext format,
                or file is provided without file_field for acontext format.
        """
        if format not in {"acontext", "openai", "anthropic", "gemini"}:
            raise ValueError(
                "format must be one of {'acontext', 'openai', 'anthropic', 'gemini'}"
            )

        # File upload is only supported for acontext format
        if format != "acontext" and (file is not None or file_field is not None):
            raise ValueError(
                "file and file_field parameters are only supported when format is 'acontext'"
            )
        if isinstance(blob, BaseModel):
            blob = blob.model_dump()
        payload: dict[str, Any] = {
            "format": format,
        }
        if meta is not None:
            payload["meta"] = meta

        if format == "acontext":
            if isinstance(blob, Mapping):
                payload["blob"] = blob
            elif isinstance(blob, AcontextMessage):
                payload["blob"] = asdict(blob)
            else:
                raise ValueError(
                    f"Invalid blob type: {type(blob)} when format is 'acontext'. Expected Mapping or AcontextMessage"
                )

            # Handle file upload for acontext format
            file_payload: dict[str, tuple[str, BinaryIO, str]] | None = None
            if file is not None:
                if file_field is None:
                    raise ValueError("file_field is required when file is provided")
                # only support upload one file now
                upload = normalize_file_upload(file)
                file_payload = {file_field: upload.as_httpx()}

            if file_payload:
                form_data = {"payload": json.dumps(payload)}
                data = await self._requester.request(
                    "POST",
                    f"/session/{session_id}/messages",
                    data=form_data,
                    files=file_payload,
                )
            else:
                data = await self._requester.request(
                    "POST",
                    f"/session/{session_id}/messages",
                    json_data=payload,
                )
        else:
            payload["blob"] = blob  # type: ignore

            data = await self._requester.request(
                "POST",
                f"/session/{session_id}/messages",
                json_data=payload,
            )
        return Message.model_validate(data)

    async def get_messages(
        self,
        session_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        with_asset_public_url: bool | None = None,
        format: Literal["acontext", "openai", "anthropic", "gemini"] = "openai",
        time_desc: bool | None = None,
        edit_strategies: Optional[List[EditStrategy]] = None,
        # editing_trigger triggers edit_strategies (v0 supports {"token_gte": int}).
        editing_trigger: dict[str, Any] | None = None,
        pin_editing_strategies_at_message: str | None = None,
    ) -> GetMessagesOutput:
        """Get messages for a session.

        Args:
            session_id: The UUID of the session.
            limit: Maximum number of messages to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            with_asset_public_url: Whether to include presigned URLs for assets. Defaults to None.
            format: The format of the messages. Defaults to "openai". Supports "acontext", "openai", "anthropic", or "gemini".
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.
            edit_strategies: Optional list of edit strategies to apply before format conversion.
                Each strategy is a dict with 'type' and 'params' keys.
                Examples:
                    - Remove tool results: [{"type": "remove_tool_result", "params": {"keep_recent_n_tool_results": 3}}]
                    - Remove large tool results: [{"type": "remove_tool_result", "params": {"gt_token": 100}}]
                    - Remove large tool call params: [{"type": "remove_tool_call_params", "params": {"gt_token": 100}}]
                    - Middle out: [{"type": "middle_out", "params": {"token_reduce_to": 5000}}]
                    - Token limit: [{"type": "token_limit", "params": {"limit_tokens": 20000}}]
                Defaults to None.
            editing_trigger: Trigger config for edit_strategies, e.g. {"token_gte": 30000}. Defaults to None.
            pin_editing_strategies_at_message: Message ID to pin editing strategies at.
                When provided, strategies are only applied to messages up to and including
                this message ID, keeping subsequent messages unchanged. This helps maintain
                prompt cache stability by preserving a stable prefix. The response includes
                edit_at_message_id indicating where strategies were applied. Pass this value
                in subsequent requests to maintain cache hits. Defaults to None.

        Returns:
            GetMessagesOutput containing the list of messages and pagination information.
        """
        params: dict[str, Any] = {}
        if format is not None:
            params["format"] = format
        params.update(
            build_params(
                limit=limit,
                cursor=cursor,
                with_asset_public_url=with_asset_public_url,
                time_desc=time_desc,
            )
        )
        if edit_strategies is not None:
            validate_edit_strategies(edit_strategies)
            params["edit_strategies"] = json.dumps(edit_strategies)
        if editing_trigger is not None:
            if isinstance(editing_trigger, BaseModel):
                editing_trigger = editing_trigger.model_dump()
            params["editing_trigger"] = json.dumps(editing_trigger)
        if pin_editing_strategies_at_message is not None:
            params["pin_editing_strategies_at_message"] = (
                pin_editing_strategies_at_message
            )
        data = await self._requester.request(
            "GET", f"/session/{session_id}/messages", params=params or None
        )
        return GetMessagesOutput.model_validate(data)

    async def flush(self, session_id: str) -> dict[str, Any]:
        """Flush the session buffer for a given session.

        Args:
            session_id: The UUID of the session.

        Returns:
            Dictionary containing status and errmsg fields.
        """
        data = await self._requester.request("POST", f"/session/{session_id}/flush")
        return data  # type: ignore

    async def get_token_counts(self, session_id: str) -> TokenCounts:
        """Get total token counts for all text and tool-call parts in a session.

        Args:
            session_id: The UUID of the session.

        Returns:
            TokenCounts object containing total_tokens.
        """
        data = await self._requester.request(
            "GET", f"/session/{session_id}/token_counts"
        )
        return TokenCounts.model_validate(data)

    async def messages_observing_status(
        self, session_id: str
    ) -> MessageObservingStatus:
        """Get message observing status counts for a session.

        Returns the count of messages by their observing status:
        observed, in_process, and pending.

        Args:
            session_id: The UUID of the session.

        Returns:
            MessageObservingStatus object containing observed, in_process,
            pending counts and updated_at timestamp.
        """
        data = await self._requester.request(
            "GET", f"/session/{session_id}/observing_status"
        )
        return MessageObservingStatus.model_validate(data)

    async def patch_message_meta(
        self,
        session_id: str,
        message_id: str,
        *,
        meta: dict[str, Any],
    ) -> dict[str, Any]:
        """Update message metadata using patch semantics.

        Only updates keys present in the meta dict. Existing keys not in the request
        are preserved. To delete a key, pass None as its value.

        Args:
            session_id: The UUID of the session.
            message_id: The UUID of the message.
            meta: Dictionary of metadata keys to add, update, or delete.
                Pass None as a value to delete that key.

        Returns:
            The complete user metadata after the patch operation.

        Example:
            >>> # Add/update keys
            >>> updated = await client.sessions.patch_message_meta(
            ...     session_id, message_id,
            ...     meta={"status": "processed", "score": 0.95}
            ... )
            >>> # Delete a key
            >>> updated = await client.sessions.patch_message_meta(
            ...     session_id, message_id,
            ...     meta={"old_key": None}  # Deletes "old_key"
            ... )
        """
        payload = {"meta": meta}
        data = await self._requester.request(
            "PATCH",
            f"/session/{session_id}/messages/{message_id}/meta",
            json_data=payload,
        )
        return data.get("meta", {})  # type: ignore

    async def patch_configs(
        self,
        session_id: str,
        *,
        configs: dict[str, Any],
    ) -> dict[str, Any]:
        """Update session configs using patch semantics.

        Only updates keys present in the configs dict. Existing keys not in the request
        are preserved. To delete a key, pass None as its value.

        Args:
            session_id: The UUID of the session.
            configs: Dictionary of config keys to add, update, or delete.
                Pass None as a value to delete that key.

        Returns:
            The complete configs after the patch operation.

        Example:
            >>> # Add/update keys
            >>> updated = await client.sessions.patch_configs(
            ...     session_id,
            ...     configs={"agent": "bot2", "temperature": 0.8}
            ... )
            >>> # Delete a key
            >>> updated = await client.sessions.patch_configs(
            ...     session_id,
            ...     configs={"old_key": None}  # Deletes "old_key"
            ... )
        """
        payload = {"configs": configs}
        data = await self._requester.request(
            "PATCH",
            f"/session/{session_id}/configs",
            json_data=payload,
        )
        return data.get("configs", {})  # type: ignore

    async def copy(self, session_id: str) -> CopySessionResult:
        """Copy (duplicate) a session with all its messages and tasks.

        Creates a complete copy of the session including all messages, tasks, and configurations.
        The copied session will be independent and modifications to it won't affect the original.

        Args:
            session_id: The UUID of the session to copy.

        Returns:
            CopySessionResult containing the original and new session IDs.

        Raises:
            APIError: If the request fails, session is not found, or session exceeds
                the maximum copyable size (5000 messages).

        Example:
            >>> result = await client.sessions.copy(session_id)
            >>> print(f"Copied session: {result.new_session_id}")
            >>> print(f"Original session: {result.old_session_id}")
        """
        data = await self._requester.request("POST", f"/session/{session_id}/copy")
        return CopySessionResult.model_validate(data)
