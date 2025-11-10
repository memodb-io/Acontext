"""Sessions endpoints."""

import json
from collections.abc import Mapping, MutableMapping
from dataclasses import asdict
from typing import Any, BinaryIO, Literal

from .._utils import build_params
from ..client_types import RequesterProtocol
from ..messages import AcontextMessage
from ..types.session import (
    GetMessagesOutput,
    GetTasksOutput,
    ListSessionsOutput,
    Message,
    Session,
)
from ..uploads import FileUpload
from openai.types.chat import ChatCompletionMessageParam
from anthropic.types import MessageParam

UploadPayload = (
    FileUpload | tuple[str, BinaryIO | bytes] | tuple[str, BinaryIO | bytes, str | None]
)
MessageBlob = AcontextMessage | ChatCompletionMessageParam | MessageParam


class SessionsAPI:
    def __init__(self, requester: RequesterProtocol) -> None:
        self._requester = requester

    def list(
        self,
        *,
        space_id: str | None = None,
        not_connected: bool | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        time_desc: bool | None = None,
    ) -> ListSessionsOutput:
        """List all sessions in the project.
        
        Args:
            space_id: Filter sessions by space ID. Defaults to None.
            not_connected: Filter sessions that are not connected to a space. Defaults to None.
            limit: Maximum number of sessions to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.
            
        Returns:
            ListSessionsOutput containing the list of sessions and pagination information.
        """
        params: dict[str, Any] = {}
        if space_id:
            params["space_id"] = space_id
        params.update(build_params(not_connected=not_connected, limit=limit, cursor=cursor, time_desc=time_desc))
        data = self._requester.request("GET", "/session", params=params or None)
        return ListSessionsOutput.model_validate(data)

    def create(
        self,
        *,
        space_id: str | None = None,
        configs: Mapping[str, Any] | MutableMapping[str, Any] | None = None,
    ) -> Session:
        """Create a new session.
        
        Args:
            space_id: Optional space ID to associate with the session. Defaults to None.
            configs: Optional session configuration dictionary. Defaults to None.
            
        Returns:
            The created Session object.
        """
        payload: dict[str, Any] = {}
        if space_id:
            payload["space_id"] = space_id
        if configs is not None:
            payload["configs"] = configs
        data = self._requester.request("POST", "/session", json_data=payload)
        return Session.model_validate(data)

    def delete(self, session_id: str) -> None:
        """Delete a session by its ID.
        
        Args:
            session_id: The UUID of the session to delete.
        """
        self._requester.request("DELETE", f"/session/{session_id}")

    def update_configs(
        self,
        session_id: str,
        *,
        configs: Mapping[str, Any] | MutableMapping[str, Any],
    ) -> None:
        """Update session configurations.
        
        Args:
            session_id: The UUID of the session.
            configs: Session configuration dictionary.
        """
        payload = {"configs": configs}
        self._requester.request(
            "PUT", f"/session/{session_id}/configs", json_data=payload
        )

    def get_configs(self, session_id: str) -> Session:
        """Get session configurations.
        
        Args:
            session_id: The UUID of the session.
            
        Returns:
            Session object containing the configurations.
        """
        data = self._requester.request("GET", f"/session/{session_id}/configs")
        return Session.model_validate(data)

    def connect_to_space(self, session_id: str, *, space_id: str) -> None:
        """Connect a session to a space.
        
        Args:
            session_id: The UUID of the session.
            space_id: The UUID of the space to connect to.
        """
        payload = {"space_id": space_id}
        self._requester.request(
            "POST", f"/session/{session_id}/connect_to_space", json_data=payload
        )

    def get_tasks(
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
        data = self._requester.request(
            "GET",
            f"/session/{session_id}/task",
            params=params or None,
        )
        return GetTasksOutput.model_validate(data)

    def send_message(
        self,
        session_id: str,
        *,
        blob: MessageBlob,
        format: Literal["acontext", "openai", "anthropic"] = "openai",
        file_field: str | None = None,
        file: FileUpload | None = None,
    ) -> Message:
        """Send a message to a session.
        
        Args:
            session_id: The UUID of the session.
            blob: The message blob in Acontext, OpenAI, or Anthropic format.
            format: The format of the message blob. Defaults to "openai".
            file_field: The field name for file upload. Required if file is provided. Defaults to None.
            file: Optional file upload. Defaults to None.
            
        Returns:
            The created Message object.
            
        Raises:
            ValueError: If format is invalid or file is provided without file_field.
        """
        if format not in {"acontext", "openai", "anthropic"}:
            raise ValueError(
                "format must be one of {'acontext', 'openai', 'anthropic'}"
            )
        
        if file and not file_field:
            raise ValueError("file_field is required when file is provided")

        payload = {
            "format": format,
        }
        if format == "acontext":
            payload["blob"] = asdict(blob)
        else:
            payload["blob"] = blob

        file_payload: dict[str, tuple[str, BinaryIO, str | None]] | None = None
        if file:
            # only support upload one file now
            file_payload = {file_field: file.as_httpx()}

        if file_payload:
            form_data = {"payload": json.dumps(payload)}
            data = self._requester.request(
                "POST",
                f"/session/{session_id}/messages",
                data=form_data,
                files=file_payload,
            )
        else:
            data = self._requester.request(
                "POST",
                f"/session/{session_id}/messages",
                json_data=payload,
            )
        return Message.model_validate(data)

    def get_messages(
        self,
        session_id: str,
        *,
        limit: int | None = None,
        cursor: str | None = None,
        with_asset_public_url: bool | None = None,
        format: Literal["acontext", "openai", "anthropic"] = "acontext",
        time_desc: bool | None = None,
    ) -> GetMessagesOutput:
        """Get messages for a session.
        
        Args:
            session_id: The UUID of the session.
            limit: Maximum number of messages to return. Defaults to None.
            cursor: Cursor for pagination. Defaults to None.
            with_asset_public_url: Whether to include presigned URLs for assets. Defaults to None.
            format: The format of the messages. Defaults to "acontext".
            time_desc: Order by created_at descending if True, ascending if False. Defaults to None.
            
        Returns:
            GetMessagesOutput containing the list of messages and pagination information.
        """
        params: dict[str, Any] = {}
        if format is not None:
            params["format"] = format
        params.update(build_params(
            limit=limit,
            cursor=cursor,
            with_asset_public_url=with_asset_public_url,
            time_desc=time_desc,
        ))
        data = self._requester.request(
            "GET", f"/session/{session_id}/messages", params=params or None
        )
        return GetMessagesOutput.model_validate(data)
