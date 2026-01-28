"""Sessions endpoints (async)."""

import json
from collections.abc import Mapping
from dataclasses import asdict
from typing import Any, BinaryIO, Literal, Optional, List

from .._utils import build_params
from ..client_types import AsyncRequesterProtocol
from ..messages import AcontextMessage
from ..types.session import (
    EditStrategy,
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
    ) -> ListSessionsOutput:
        """List all sessions in the project.

        Args:
            user: Filter by user identifier. Defaults to None.
            limit: Maximum number of sessions to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.

        Returns:
            ListSessionsOutput containing the list of sessions and pagination information.
        """
        params: dict[str, Any] = {}
        if user:
            params["user"] = user
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
    ) -> Session:
        """Create a new session.

        Args:
            user: Optional user identifier string. Defaults to None.
            disable_task_tracking: Whether to disable task tracking for this session. Defaults to None (server default: False).
            configs: Optional session configuration dictionary. Defaults to None.

        Returns:
            The created Session object.
        """
        payload: dict[str, Any] = {}
        if user:
            payload["user"] = user
        if disable_task_tracking is not None:
            payload["disable_task_tracking"] = disable_task_tracking
        if configs is not None:
            payload["configs"] = configs
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
            file_field: The field name for file upload. Only used when format is "acontext".
                Required if file is provided. Defaults to None.
            file: Optional file upload. Only used when format is "acontext". Defaults to None.

        Returns:
            The created Message object.

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
                    - Middle out: [{"type": "middle_out", "params": {"token_reduce_to": 5000}}]
                    - Token limit: [{"type": "token_limit", "params": {"limit_tokens": 20000}}]
                Defaults to None.
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
            params["edit_strategies"] = json.dumps(edit_strategies)
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
