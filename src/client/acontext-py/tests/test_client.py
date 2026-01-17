import json
from dataclasses import asdict, dataclass
from typing import Any, Dict
from unittest.mock import patch

import httpx
import pytest

from acontext.client import AcontextClient, FileUpload  # noqa: E402
from acontext.messages import build_acontext_message  # noqa: E402
from acontext.errors import APIError, TransportError  # noqa: E402


def make_response(status: int, payload: Dict[str, Any]) -> httpx.Response:
    request = httpx.Request("GET", "https://api.acontext.test/resource")
    return httpx.Response(status, json=payload, request=request)


@pytest.fixture
def client() -> AcontextClient:
    client = AcontextClient(api_key="token")
    try:
        yield client
    finally:
        client.close()


def test_build_acontext_message_with_meta() -> None:
    message = build_acontext_message(
        role="assistant",
        parts=["hi"],
        meta={"name": "bot"},
    )

    assert message.role == "assistant"
    assert message.parts[0].text == "hi"
    assert message.meta == {"name": "bot"}
    assert asdict(message) == {
        "role": "assistant",
        "parts": [
            {"type": "text", "text": "hi", "meta": None, "file_field": None},
        ],
        "meta": {"name": "bot"},
    }


def test_handle_response_returns_data() -> None:
    resp = make_response(200, {"code": 200, "data": {"ok": True}})
    data = AcontextClient._handle_response(resp, unwrap=True)
    assert data == {"ok": True}


def test_handle_response_app_code_error() -> None:
    resp = make_response(200, {"code": 500, "msg": "failure"})
    with pytest.raises(APIError) as ctx:
        AcontextClient._handle_response(resp, unwrap=True)
    assert ctx.value.code == 500
    assert ctx.value.status_code == 200


@patch("acontext.client.httpx.Client.request")
def test_request_transport_error(mock_request) -> None:
    exc = httpx.ConnectError(
        "boom", request=httpx.Request("GET", "https://api.acontext.test/failure")
    )
    mock_request.side_effect = exc
    with AcontextClient(api_key="token") as client:
        with pytest.raises(TransportError):
            client.spaces.list()


@patch("acontext.client.AcontextClient.request")
def test_ping_returns_pong(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"code": 200, "msg": "pong"}

    result = client.ping()

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/ping"
    assert kwargs["unwrap"] is False
    assert result == "pong"


@patch("acontext.client.AcontextClient.request")
def test_store_message_with_files_uses_multipart_payload(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "msg-id",
        "session_id": "session-id",
        "role": "user",
        "meta": {},
        "parts": [],
        "session_task_process_status": "pending",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    blob = build_acontext_message(role="user", parts=["hello"])

    class _DummyStream:
        def read(self) -> bytes:
            return b"bytes"

    dummy_stream = _DummyStream()
    upload = FileUpload(
        filename="image.png", content=dummy_stream, content_type="image/png"
    )

    client.sessions.store_message(
        "session-id",
        blob=blob,
        format="acontext",
        file_field="attachment",
        file=upload,
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/session/session-id/messages"
    assert kwargs["data"] is not None
    assert "files" in kwargs

    payload_json = json.loads(kwargs["data"]["payload"])
    assert payload_json["format"] == "acontext"
    message_blob = payload_json["blob"]
    assert message_blob["role"] == "user"
    assert message_blob["parts"][0]["text"] == "hello"
    assert message_blob["parts"][0]["type"] == "text"
    assert message_blob["parts"][0]["meta"] is None
    assert message_blob["parts"][0]["file_field"] is None

    files_payload = kwargs["files"]
    assert isinstance(files_payload, dict)
    attachment = files_payload["attachment"]
    assert attachment[0] == "image.png"
    assert attachment[1] is dummy_stream
    assert attachment[2] == "image/png"


@patch("acontext.client.AcontextClient.request")
def test_store_message_allows_nullable_blob_for_other_formats(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "msg-id",
        "session_id": "session-id",
        "role": "user",
        "meta": {},
        "parts": [],
        "session_task_process_status": "pending",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    client.sessions.store_message("session-id", format="openai", blob=None)  # type: ignore[arg-type]

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["blob"] is None


@patch("acontext.client.AcontextClient.request")
def test_store_message_requires_format_when_cannot_infer(
    mock_request, client: AcontextClient
) -> None:
    # Type checker will catch this, but at runtime we need format
    with pytest.raises((TypeError, ValueError)):
        client.sessions.store_message(
            "session-id",
            blob={"message": "hi"},  # type: ignore[arg-type]
        )


@patch("acontext.client.AcontextClient.request")
def test_store_message_rejects_unknown_format(
    mock_request, client: AcontextClient
) -> None:
    with pytest.raises(ValueError, match="format must be one of"):
        client.sessions.store_message(
            "session-id",
            blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
            format="legacy",  # type: ignore[arg-type]
        )


@patch("acontext.client.AcontextClient.request")
def test_store_message_explicit_format_still_supported(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "msg-id",
        "session_id": "session-id",
        "role": "user",
        "meta": {},
        "parts": [],
        "session_task_process_status": "pending",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    client.sessions.store_message(
        "session-id",
        blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
        format="openai",
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/session/session-id/messages"
    assert "json_data" in kwargs
    assert kwargs["json_data"]["format"] == "openai"
    assert kwargs["json_data"]["blob"]["content"] == "hi"


@dataclass
class _FakeOpenAIMessage:
    __module__ = "openai.types.chat"

    role: str

    def model_dump(self) -> dict[str, Any]:
        return {"role": self.role, "content": "hello"}


@dataclass
class _FakeAnthropicMessage:
    __module__ = "anthropic.types.messages"

    role: str

    def model_dump(self) -> dict[str, Any]:
        return {"role": self.role, "content": [{"type": "text", "text": "hi"}]}


@patch("acontext.client.AcontextClient.request")
def test_store_message_handles_openai_model_dump(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "msg-id",
        "session_id": "session-id",
        "role": "user",
        "meta": {},
        "parts": [],
        "session_task_process_status": "pending",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    message = _FakeOpenAIMessage(role="user")
    client.sessions.store_message(
        "session-id",
        blob=message,  # type: ignore[arg-type]
        format="openai",
    )

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "openai"
    assert kwargs["json_data"]["blob"] is message


@patch("acontext.client.AcontextClient.request")
def test_store_message_handles_anthropic_model_dump(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "msg-id",
        "session_id": "session-id",
        "role": "user",
        "meta": {},
        "parts": [],
        "session_task_process_status": "pending",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    message = _FakeAnthropicMessage(role="user")
    client.sessions.store_message(
        "session-id",
        blob=message,  # type: ignore[arg-type]
        format="anthropic",
    )

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "anthropic"
    assert kwargs["json_data"]["blob"] is message


@patch("acontext.client.AcontextClient.request")
def test_store_message_accepts_acontext_message(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "msg-id",
        "session_id": "session-id",
        "role": "assistant",
        "meta": {},
        "parts": [],
        "session_task_process_status": "pending",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    blob = build_acontext_message(role="assistant", parts=["hi"])
    client.sessions.store_message("session-id", blob=blob, format="acontext")

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "acontext"


@patch("acontext.client.AcontextClient.request")
def test_store_message_requires_file_field_when_file_provided(
    mock_request, client: AcontextClient
) -> None:
    blob = build_acontext_message(role="user", parts=["hello"])

    class _DummyStream:
        def read(self) -> bytes:
            return b"bytes"

    upload = FileUpload(
        filename="image.png", content=_DummyStream(), content_type="image/png"
    )

    with pytest.raises(
        ValueError, match="file_field is required when file is provided"
    ):
        client.sessions.store_message(
            "session-id",
            blob=blob,
            format="acontext",
            file=upload,
        )

    mock_request.assert_not_called()


@patch("acontext.client.AcontextClient.request")
def test_store_message_rejects_file_for_non_acontext_format(
    mock_request, client: AcontextClient
) -> None:
    class _DummyStream:
        def read(self) -> bytes:
            return b"bytes"

    upload = FileUpload(
        filename="image.png", content=_DummyStream(), content_type="image/png"
    )

    with pytest.raises(
        ValueError,
        match="file and file_field parameters are only supported when format is 'acontext'",
    ):
        client.sessions.store_message(
            "session-id",
            blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
            format="openai",
            file=upload,
            file_field="attachment",
        )

    mock_request.assert_not_called()


@patch("acontext.client.AcontextClient.request")
def test_store_message_rejects_file_field_for_non_acontext_format(
    mock_request, client: AcontextClient
) -> None:
    with pytest.raises(
        ValueError,
        match="file and file_field parameters are only supported when format is 'acontext'",
    ):
        client.sessions.store_message(
            "session-id",
            blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
            format="openai",
            file_field="attachment",
        )

    mock_request.assert_not_called()


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_messages_forwards_format(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "items": [],
        "ids": [],
        "has_more": False,
        "this_time_tokens": 0,
    }

    result = client.sessions.get_messages(
        "session-id", format="acontext", time_desc=True
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/messages"
    assert kwargs["params"] == {"format": "acontext", "time_desc": "true"}
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_messages_with_edit_strategies(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "items": [],
        "ids": [],
        "has_more": False,
        "this_time_tokens": 0,
    }

    edit_strategies = [
        {"type": "remove_tool_result", "params": {"keep_recent_n_tool_results": 3}}
    ]
    result = client.sessions.get_messages(
        "session-id", format="openai", edit_strategies=edit_strategies
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/messages"
    assert "edit_strategies" in kwargs["params"]
    # Verify it's JSON encoded
    import json

    decoded_strategies = json.loads(kwargs["params"]["edit_strategies"])
    assert decoded_strategies == edit_strategies
    assert kwargs["params"]["format"] == "openai"
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_messages_without_edit_strategies(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "items": [],
        "ids": [],
        "has_more": False,
        "this_time_tokens": 0,
    }

    result = client.sessions.get_messages("session-id", format="openai")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/messages"
    # edit_strategies should not be in params when not provided
    assert "edit_strategies" not in kwargs["params"]
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_tasks_without_filters(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {"items": [], "ids": [], "has_more": False}

    result = client.sessions.get_tasks("session-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/task"
    assert kwargs["params"] is None
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_tasks_with_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"items": [], "ids": [], "has_more": False}

    result = client.sessions.get_tasks("session-id", limit=10, cursor="cursor")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/task"
    assert kwargs["params"] == {"limit": 10, "cursor": "cursor"}
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_tasks_with_task_data(
    mock_request, client: AcontextClient
) -> None:
    """Test that get_tasks properly deserializes TaskData with structured fields."""
    mock_request.return_value = {
        "items": [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "session_id": "123e4567-e89b-12d3-a456-426614174001",
                "project_id": "123e4567-e89b-12d3-a456-426614174002",
                "order": 1,
                "data": {
                    "task_description": "Implement user authentication",
                    "progresses": ["Created login form", "Added JWT validation"],
                    "user_preferences": ["Use OAuth2", "Enable 2FA"],
                    "sop_thinking": "Follow security best practices",
                },
                "status": "running",
                "is_planning": False,
                "space_digested": True,
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            }
        ],
        "has_more": False,
    }

    result = client.sessions.get_tasks("session-id")

    mock_request.assert_called_once()
    # Verify the result structure
    assert len(result.items) == 1
    task = result.items[0]

    # Verify Task fields
    assert task.id == "123e4567-e89b-12d3-a456-426614174000"
    assert task.status == "running"
    assert task.order == 1

    # Verify TaskData is properly typed and accessible
    assert task.data.task_description == "Implement user authentication"
    assert task.data.progresses == ["Created login form", "Added JWT validation"]
    assert task.data.user_preferences == ["Use OAuth2", "Enable 2FA"]
    assert task.data.sop_thinking == "Follow security best practices"


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_learning_status(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "space_digested_count": 5,
        "not_space_digested_count": 3,
    }

    result = client.sessions.get_learning_status("session-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/get_learning_status"
    # Verify it returns a Pydantic model
    assert hasattr(result, "space_digested_count")
    assert hasattr(result, "not_space_digested_count")
    assert result.space_digested_count == 5
    assert result.not_space_digested_count == 3


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_token_counts(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "total_tokens": 1234,
    }

    result = client.sessions.get_token_counts("session-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/token_counts"
    # Verify it returns a Pydantic model
    assert hasattr(result, "total_tokens")
    assert result.total_tokens == 1234


@patch("acontext.client.AcontextClient.request")
def test_blocks_list_without_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = []

    result = client.blocks.list("space-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/block"
    assert kwargs["params"] is None
    # Verify it returns a list of Pydantic models
    assert isinstance(result, list)


@patch("acontext.client.AcontextClient.request")
def test_blocks_list_with_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = []

    result = client.blocks.list("space-id", parent_id="parent-id", block_type="page")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/block"
    assert kwargs["params"] == {"parent_id": "parent-id", "type": "page"}
    # Verify it returns a list of Pydantic models
    assert isinstance(result, list)


# NOTE: Block creation tests are commented out because API passes through to core
# @patch("acontext.client.AcontextClient.request")
# def test_blocks_create_root_payload(mock_request, client: AcontextClient) -> None:
#     mock_request.return_value = {
#         "id": "block",
#         "space_id": "space-id",
#         "type": "folder",
#         "title": "Folder Title",
#         "props": {},
#         "sort": 0,
#         "is_archived": False,
#         "created_at": "2024-01-01T00:00:00Z",
#         "updated_at": "2024-01-01T00:00:00Z",
#     }
#
#     result = client.blocks.create(
#         "space-id",
#         block_type="folder",
#         title="Folder Title",
#     )
#
#     mock_request.assert_called_once()
#     args, kwargs = mock_request.call_args
#     method, path = args
#     assert method == "POST"
#     assert path == "/space/space-id/block"
#     assert kwargs["json_data"] == {
#         "type": "folder",
#         "title": "Folder Title",
#     }
#     # Verify it returns a Pydantic model
#     assert hasattr(result, "id")
#     assert result.id == "block"


# NOTE: Block creation tests are commented out because API passes through to core
# @patch("acontext.client.AcontextClient.request")
# def test_blocks_create_with_parent_payload(
#     mock_request, client: AcontextClient
# ) -> None:
#     mock_request.return_value = {
#         "id": "block",
#         "space_id": "space-id",
#         "type": "text",
#         "parent_id": "parent-id",
#         "title": "Block Title",
#         "props": {"key": "value"},
#         "sort": 0,
#         "is_archived": False,
#         "created_at": "2024-01-01T00:00:00Z",
#         "updated_at": "2024-01-01T00:00:00Z",
#     }
#
#     result = client.blocks.create(
#         "space-id",
#         parent_id="parent-id",
#         block_type="text",
#         title="Block Title",
#         props={"key": "value"},
#     )
#
#     mock_request.assert_called_once()
#     args, kwargs = mock_request.call_args
#     method, path = args
#     assert method == "POST"
#     assert path == "/space/space-id/block"
#     assert kwargs["json_data"] == {
#         "parent_id": "parent-id",
#         "type": "text",
#         "title": "Block Title",
#         "props": {"key": "value"},
#     }
#     # Verify it returns a Pydantic model
#     assert hasattr(result, "id")
#     assert result.id == "block"


# Removed test_blocks_create_requires_type - validation removed as type annotation guarantees non-empty str


@patch("acontext.client.AcontextClient.request")
def test_blocks_move_requires_payload(mock_request, client: AcontextClient) -> None:
    with pytest.raises(ValueError):
        client.blocks.move("space-id", "block-id")

    mock_request.assert_not_called()


@patch("acontext.client.AcontextClient.request")
def test_blocks_move_with_parent(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"status": "ok"}

    client.blocks.move("space-id", "block-id", parent_id="parent-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PUT"
    assert path == "/space/space-id/block/block-id/move"
    assert kwargs["json_data"] == {"parent_id": "parent-id"}


@patch("acontext.client.AcontextClient.request")
def test_blocks_move_with_sort(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"status": "ok"}

    client.blocks.move("space-id", "block-id", sort=42)

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PUT"
    assert path == "/space/space-id/block/block-id/move"
    assert kwargs["json_data"] == {"sort": 42}


@patch("acontext.client.AcontextClient.request")
def test_blocks_update_properties_requires_payload(
    mock_request, client: AcontextClient
) -> None:
    with pytest.raises(ValueError):
        client.blocks.update_properties("space-id", "block-id")

    mock_request.assert_not_called()


@patch("acontext.client.AcontextClient.request")
def test_disks_create_hits_disk_endpoint(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "id": "disk",
        "project_id": "project-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    result = client.disks.create()

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/disk"
    # Verify it returns a Pydantic model
    assert hasattr(result, "id")
    assert result.id == "disk"


def test_artifacts_aliases_disk_artifacts(client: AcontextClient) -> None:
    assert client.artifacts is client.disks.artifacts


@patch("acontext.client.AcontextClient.request")
def test_disk_artifacts_upsert_uses_multipart_payload(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "artifact",
        "disk_id": "disk-id",
        "path": "/folder/file.txt",
        "filename": "file.txt",
        "meta": {},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    client.disks.artifacts.upsert(
        "disk-id",
        file=FileUpload(
            filename="file.txt", content=b"data", content_type="text/plain"
        ),
        file_path="/folder",
        meta={"source": "unit-test"},
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/disk/disk-id/artifact"
    assert "files" in kwargs
    assert "data" in kwargs
    assert kwargs["data"]["file_path"] == "/folder"
    meta = json.loads(kwargs["data"]["meta"])
    assert meta["source"] == "unit-test"
    filename, stream, content_type = kwargs["files"]["file"]
    assert filename == "file.txt"
    assert content_type == "text/plain"
    assert stream.read() == b"data"


@patch("acontext.client.AcontextClient.request")
def test_disk_artifacts_get_translates_query_params(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "artifact": {
            "id": "artifact",
            "disk_id": "disk-id",
            "path": "/folder/file.txt",
            "filename": "file.txt",
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
    }

    client.disks.artifacts.get(
        "disk-id",
        file_path="/folder",
        filename="file.txt",
        with_public_url=False,
        with_content=True,
        expire=900,
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/disk/disk-id/artifact"
    assert kwargs["params"] == {
        "file_path": "/folder/file.txt",
        "with_public_url": "false",
        "with_content": "true",
        "expire": 900,
    }


@patch("acontext.client.AcontextClient.request")
def test_skills_create_uses_multipart_payload(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "skill-1",
        "name": "test-skill",
        "description": "Test skill",
        "file_index": [{"path": "SKILL.md", "mime": "text/markdown"}],
        "meta": {"version": "1.0"},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    client.skills.create(
        file=FileUpload(
            filename="skill.zip", content=b"zip content", content_type="application/zip"
        ),
        meta={"version": "1.0"},
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/agent_skills"
    assert "files" in kwargs
    assert "data" in kwargs
    meta = json.loads(kwargs["data"]["meta"])
    assert meta["version"] == "1.0"
    filename, stream, content_type = kwargs["files"]["file"]
    assert filename == "skill.zip"
    assert content_type == "application/zip"
    assert stream.read() == b"zip content"


@patch("acontext.client.AcontextClient.request")
def test_skills_get_hits_id_endpoint(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "skill-1",
        "name": "test-skill",
        "description": "Test skill",
        "file_index": [{"path": "SKILL.md", "mime": "text/markdown"}],
        "meta": {},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    result = client.skills.get("skill-1")

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/agent_skills/skill-1"
    assert result.id == "skill-1"
    assert result.name == "test-skill"


@patch("acontext.client.AcontextClient.request")
def test_skills_delete_hits_skills_endpoint(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = None

    client.skills.delete("skill-1")

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    assert path == "/agent_skills/skill-1"


@patch("acontext.client.AcontextClient.request")
def test_skills_list_returns_catalog_dict(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "items": [
            {
                "id": "skill-1",
                "name": "test-skill-1",
                "description": "Test skill 1",
                "file_index": [{"path": "SKILL.md", "mime": "text/markdown"}],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            {
                "id": "skill-2",
                "name": "test-skill-2",
                "description": "Test skill 2",
                "file_index": [
                    {"path": "SKILL.md", "mime": "text/markdown"},
                    {"path": "scripts/main.py", "mime": "text/x-python"},
                ],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
        ],
        "next_cursor": None,
        "has_more": False,
    }

    result = client.skills.list_catalog(limit=100)

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/agent_skills"
    assert kwargs["params"] == {"limit": 100}
    assert len(result.items) == 2
    assert result.items[0].name == "test-skill-1"
    assert result.items[0].description == "Test skill 1"
    assert result.items[1].name == "test-skill-2"
    assert result.items[1].description == "Test skill 2"
    # Verify pagination information (mock data indicates no more pages)
    assert result.next_cursor is None
    assert result.has_more is False


@patch("acontext.client.AcontextClient.request")
def test_skills_get_file_hits_id_endpoint(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "path": "scripts/main.py",
        "mime": "text/x-python",
        "content": {"type": "code", "raw": "print('Hello, World!')"},
    }

    result = client.skills.get_file(
        skill_id="skill-1",
        file_path="scripts/main.py",
        expire=1800,
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/agent_skills/skill-1/file"
    assert kwargs["params"]["file_path"] == "scripts/main.py"
    assert kwargs["params"]["expire"] == 1800
    assert result.path == "scripts/main.py"
    assert result.mime == "text/x-python"
    assert result.content is not None
    assert result.content.raw == "print('Hello, World!')"


@patch("acontext.client.AcontextClient.request")
def test_spaces_experience_search_with_fast_mode(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "cited_blocks": [
            {
                "block_id": "block-1",
                "title": "Auth Guide",
                "type": "page",
                "props": {"text": "Authentication guide content"},
                "distance": 0.23,
            }
        ],
        "final_answer": "To implement authentication...",
    }

    result = client.spaces.experience_search(
        "space-id",
        query="How to implement authentication?",
        limit=5,
        mode="fast",
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/experience_search"
    assert kwargs["params"] == {
        "query": "How to implement authentication?",
        "limit": 5,
        "mode": "fast",
    }
    # Verify response structure
    assert hasattr(result, "cited_blocks")
    assert hasattr(result, "final_answer")
    assert len(result.cited_blocks) == 1
    assert result.cited_blocks[0].title == "Auth Guide"
    assert result.final_answer == "To implement authentication..."


@patch("acontext.client.AcontextClient.request")
def test_spaces_experience_search_with_agentic_mode(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "cited_blocks": [],
        "final_answer": None,
    }

    result = client.spaces.experience_search(
        "space-id",
        query="API security best practices",
        limit=10,
        mode="agentic",
        semantic_threshold=0.8,
        max_iterations=20,
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/experience_search"
    assert kwargs["params"] == {
        "query": "API security best practices",
        "limit": 10,
        "mode": "agentic",
        "semantic_threshold": 0.8,
        "max_iterations": 20,
    }
    assert result.cited_blocks == []
    assert result.final_answer is None


@patch("acontext.client.AcontextClient.request")
def test_spaces_get_unconfirmed_experiences(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "items": [
            {
                "id": "exp-1",
                "space_id": "space-id",
                "task_id": "task-id",
                "experience_data": {"type": "sop", "data": {"action": "test"}},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            {
                "id": "exp-2",
                "space_id": "space-id",
                "task_id": None,
                "experience_data": {"type": "other", "data": {}},
                "created_at": "2024-01-02T00:00:00Z",
                "updated_at": "2024-01-02T00:00:00Z",
            },
        ],
        "next_cursor": "cursor-123",
        "has_more": True,
    }

    result = client.spaces.get_unconfirmed_experiences(
        "space-id", limit=20, cursor="cursor-456", time_desc=True
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/experience_confirmations"
    print(kwargs["params"])
    assert kwargs["params"] == {
        "limit": 20,
        "cursor": "cursor-456",
        "time_desc": "true",
    }
    # Verify response structure
    assert hasattr(result, "items")
    assert hasattr(result, "next_cursor")
    assert hasattr(result, "has_more")
    assert len(result.items) == 2
    assert result.items[0].id == "exp-1"
    assert result.items[0].task_id == "task-id"
    assert result.items[1].task_id is None
    assert result.next_cursor == "cursor-123"
    assert result.has_more is True


@patch("acontext.client.AcontextClient.request")
def test_spaces_get_unconfirmed_experiences_without_options(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "items": [],
        "has_more": False,
    }

    result = client.spaces.get_unconfirmed_experiences("space-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/experience_confirmations"
    assert kwargs["params"] is None
    assert len(result.items) == 0
    assert result.has_more is False


@patch("acontext.client.AcontextClient.request")
def test_spaces_confirm_experience_with_save(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "id": "exp-1",
        "space_id": "space-id",
        "task_id": "task-id",
        "experience_data": {"type": "sop", "data": {"action": "test"}},
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    result = client.spaces.confirm_experience("space-id", "exp-1", save=True)

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PUT"
    assert path == "/space/space-id/experience_confirmations/exp-1"
    assert kwargs["json_data"] == {"save": True}
    # Verify response structure
    assert result is not None
    assert hasattr(result, "id")
    assert result.id == "exp-1"
    assert result.space_id == "space-id"
    assert result.experience_data == {"type": "sop", "data": {"action": "test"}}


@patch("acontext.client.AcontextClient.request")
def test_spaces_confirm_experience_without_save(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = None

    result = client.spaces.confirm_experience("space-id", "exp-1", save=False)

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PUT"
    assert path == "/space/space-id/experience_confirmations/exp-1"
    assert kwargs["json_data"] == {"save": False}
    assert result is None


@patch("acontext.client.AcontextClient.request")
def test_users_list_without_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "items": [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "project_id": "123e4567-e89b-12d3-a456-426614174001",
                "identifier": "alice@acontext.io",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            {
                "id": "223e4567-e89b-12d3-a456-426614174000",
                "project_id": "123e4567-e89b-12d3-a456-426614174001",
                "identifier": "bob@acontext.io",
                "created_at": "2024-01-02T00:00:00Z",
                "updated_at": "2024-01-02T00:00:00Z",
            },
        ],
        "has_more": False,
    }

    result = client.users.list()

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/user/ls"
    assert kwargs["params"] is None
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")
    assert len(result.items) == 2
    assert result.items[0].identifier == "alice@acontext.io"
    assert result.items[1].identifier == "bob@acontext.io"


@patch("acontext.client.AcontextClient.request")
def test_users_list_with_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "items": [
            {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "project_id": "123e4567-e89b-12d3-a456-426614174001",
                "identifier": "alice@acontext.io",
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
        ],
        "next_cursor": "cursor-123",
        "has_more": True,
    }

    result = client.users.list(limit=10, cursor="cursor-456", time_desc=True)

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/user/ls"
    assert kwargs["params"] == {"limit": 10, "cursor": "cursor-456", "time_desc": "true"}
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")
    assert hasattr(result, "next_cursor")
    assert len(result.items) == 1
    assert result.items[0].identifier == "alice@acontext.io"
    assert result.next_cursor == "cursor-123"
    assert result.has_more is True


@patch("acontext.client.AcontextClient.request")
def test_users_get_resources(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "counts": {
            "spaces_count": 5,
            "sessions_count": 10,
            "disks_count": 3,
            "skills_count": 2,
        }
    }

    result = client.users.get_resources("alice@acontext.io")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/user/alice%40acontext.io/resources"
    # Verify it returns a Pydantic model
    assert hasattr(result, "counts")
    assert result.counts.spaces_count == 5
    assert result.counts.sessions_count == 10
    assert result.counts.disks_count == 3
    assert result.counts.skills_count == 2


@patch("acontext.client.AcontextClient.request")
def test_users_get_resources_url_encodes_identifier(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = {
        "counts": {
            "spaces_count": 0,
            "sessions_count": 0,
            "disks_count": 0,
            "skills_count": 0,
        }
    }

    result = client.users.get_resources("user/with/slashes")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    # Verify the identifier is URL encoded
    assert path == "/user/user%2Fwith%2Fslashes/resources"
    assert result.counts.spaces_count == 0


@patch("acontext.client.AcontextClient.request")
def test_users_delete(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = None

    client.users.delete("alice@acontext.io")

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    assert path == "/user/alice%40acontext.io"


@patch("acontext.client.AcontextClient.request")
def test_users_delete_url_encodes_identifier(
    mock_request, client: AcontextClient
) -> None:
    mock_request.return_value = None

    client.users.delete("user/with/special@chars")

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    # Verify the identifier is URL encoded
    assert path == "/user/user%2Fwith%2Fspecial%40chars"


# ===== Sandbox API Tests =====


@patch("acontext.client.AcontextClient.request")
def test_sandboxes_create(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "sandbox_id": "sandbox-123",
        "sandbox_status": "running",
        "sandbox_created_at": "2024-01-01T00:00:00Z",
        "sandbox_expires_at": "2024-01-01T01:00:00Z",
    }

    result = client.sandboxes.create()

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/sandbox"
    # Verify it returns a Pydantic model with correct fields
    assert hasattr(result, "sandbox_id")
    assert hasattr(result, "sandbox_status")
    assert hasattr(result, "sandbox_created_at")
    assert hasattr(result, "sandbox_expires_at")
    assert result.sandbox_id == "sandbox-123"
    assert result.sandbox_status == "running"


@patch("acontext.client.AcontextClient.request")
def test_sandboxes_exec_command(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "stdout": "Hello, World!",
        "stderr": "",
        "exit_code": 0,
    }

    result = client.sandboxes.exec_command(
        sandbox_id="sandbox-123",
        command="echo 'Hello, World!'",
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/sandbox/sandbox-123/exec"
    assert kwargs["json_data"] == {"command": "echo 'Hello, World!'"}
    # Verify it returns a Pydantic model with correct fields
    assert hasattr(result, "stdout")
    assert hasattr(result, "stderr")
    assert hasattr(result, "exit_code")
    assert result.stdout == "Hello, World!"
    assert result.stderr == ""
    assert result.exit_code == 0


@patch("acontext.client.AcontextClient.request")
def test_sandboxes_exec_command_with_error(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "stdout": "",
        "stderr": "command not found: invalid_cmd",
        "exit_code": 127,
    }

    result = client.sandboxes.exec_command(
        sandbox_id="sandbox-123",
        command="invalid_cmd",
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/sandbox/sandbox-123/exec"
    assert kwargs["json_data"] == {"command": "invalid_cmd"}
    assert result.stdout == ""
    assert result.stderr == "command not found: invalid_cmd"
    assert result.exit_code == 127


@patch("acontext.client.AcontextClient.request")
def test_sandboxes_kill(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "status": 0,
        "errmsg": "",
    }

    result = client.sandboxes.kill("sandbox-123")

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    assert path == "/sandbox/sandbox-123"
    # Verify it returns a FlagResponse
    assert hasattr(result, "status")
    assert hasattr(result, "errmsg")
    assert result.status == 0
    assert result.errmsg == ""


@patch("acontext.client.AcontextClient.request")
def test_sandboxes_kill_with_error(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {
        "status": 1,
        "errmsg": "sandbox not found",
    }

    result = client.sandboxes.kill("nonexistent-sandbox")

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    assert path == "/sandbox/nonexistent-sandbox"
    assert result.status == 1
    assert result.errmsg == "sandbox not found"
