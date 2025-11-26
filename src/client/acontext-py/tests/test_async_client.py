import json
from dataclasses import dataclass
from typing import Any, Dict
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import pytest_asyncio

from acontext.async_client import AcontextAsyncClient
from acontext.client import FileUpload
from acontext.messages import build_acontext_message
from acontext.errors import APIError, TransportError


def make_response(status: int, payload: Dict[str, Any]) -> httpx.Response:
    request = httpx.Request("GET", "https://api.acontext.test/resource")
    return httpx.Response(status, json=payload, request=request)


@pytest_asyncio.fixture
async def async_client() -> AcontextAsyncClient:
    client = AcontextAsyncClient(api_key="token")
    try:
        yield client
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_async_handle_response_returns_data() -> None:
    resp = make_response(200, {"code": 200, "data": {"ok": True}})
    data = AcontextAsyncClient._handle_response(resp, unwrap=True)
    assert data == {"ok": True}


@pytest.mark.asyncio
async def test_async_handle_response_app_code_error() -> None:
    resp = make_response(200, {"code": 500, "msg": "failure"})
    with pytest.raises(APIError) as ctx:
        AcontextAsyncClient._handle_response(resp, unwrap=True)
    assert ctx.value.code == 500
    assert ctx.value.status_code == 200


@patch("acontext.async_client.httpx.AsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_request_transport_error(mock_request) -> None:
    exc = httpx.ConnectError(
        "boom", request=httpx.Request("GET", "https://api.acontext.test/failure")
    )
    mock_request.side_effect = exc
    async with AcontextAsyncClient(api_key="token") as client:
        with pytest.raises(TransportError):
            await client.spaces.list()


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_ping_returns_pong(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {"code": 200, "msg": "pong"}

    result = await async_client.ping()

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/ping"
    assert kwargs["unwrap"] is False
    assert result == "pong"


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_with_files_uses_multipart_payload(
    mock_request, async_client: AcontextAsyncClient
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

    await async_client.sessions.send_message(
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


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_allows_nullable_blob_for_other_formats(
    mock_request, async_client: AcontextAsyncClient
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

    await async_client.sessions.send_message("session-id", format="openai", blob=None)  # type: ignore[arg-type]

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["blob"] is None


@pytest.mark.asyncio
async def test_async_send_message_rejects_unknown_format(
    async_client: AcontextAsyncClient,
) -> None:
    with pytest.raises(ValueError, match="format must be one of"):
        await async_client.sessions.send_message(
            "session-id",
            blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
            format="legacy",  # type: ignore[arg-type]
        )


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_explicit_format_still_supported(
    mock_request, async_client: AcontextAsyncClient
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

    await async_client.sessions.send_message(
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


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_handles_openai_model_dump(
    mock_request, async_client: AcontextAsyncClient
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
    await async_client.sessions.send_message(
        "session-id",
        blob=message,  # type: ignore[arg-type]
        format="openai",
    )

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "openai"
    assert kwargs["json_data"]["blob"] is message


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_handles_anthropic_model_dump(
    mock_request, async_client: AcontextAsyncClient
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
    await async_client.sessions.send_message(
        "session-id",
        blob=message,  # type: ignore[arg-type]
        format="anthropic",
    )

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "anthropic"
    assert kwargs["json_data"]["blob"] is message


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_accepts_acontext_message(
    mock_request, async_client: AcontextAsyncClient
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
    await async_client.sessions.send_message("session-id", blob=blob, format="acontext")

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "acontext"


@pytest.mark.asyncio
async def test_async_send_message_requires_file_field_when_file_provided(
    async_client: AcontextAsyncClient,
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
        await async_client.sessions.send_message(
            "session-id",
            blob=blob,
            format="acontext",
            file=upload,
        )


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_rejects_file_for_non_acontext_format(
    mock_request, async_client: AcontextAsyncClient
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
        await async_client.sessions.send_message(
            "session-id",
            blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
            format="openai",
            file=upload,
            file_field="attachment",
        )

    mock_request.assert_not_called()


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_send_message_rejects_file_field_for_non_acontext_format(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    with pytest.raises(
        ValueError,
        match="file and file_field parameters are only supported when format is 'acontext'",
    ):
        await async_client.sessions.send_message(
            "session-id",
            blob={"role": "user", "content": "hi"},  # type: ignore[arg-type]
            format="openai",
            file_field="attachment",
        )

    mock_request.assert_not_called()


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_sessions_get_messages_forwards_format(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {"items": [], "has_more": False}

    result = await async_client.sessions.get_messages(
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


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_sessions_get_tasks_without_filters(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {"items": [], "has_more": False}

    result = await async_client.sessions.get_tasks("session-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/task"
    assert kwargs["params"] is None
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_sessions_get_tasks_with_filters(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {"items": [], "has_more": False}

    result = await async_client.sessions.get_tasks(
        "session-id", limit=10, cursor="cursor"
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/task"
    assert kwargs["params"] == {"limit": 10, "cursor": "cursor"}
    # Verify it returns a Pydantic model
    assert hasattr(result, "items")
    assert hasattr(result, "has_more")


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_sessions_get_learning_status(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {
        "space_digested_count": 5,
        "not_space_digested_count": 3,
    }

    result = await async_client.sessions.get_learning_status("session-id")

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


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_sessions_get_token_counts(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {
        "total_tokens": 1234,
    }

    result = await async_client.sessions.get_token_counts("session-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/token_counts"
    # Verify it returns a Pydantic model
    assert hasattr(result, "total_tokens")
    assert result.total_tokens == 1234


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_blocks_list_without_filters(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = []

    result = await async_client.blocks.list("space-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/block"
    assert kwargs["params"] is None
    # Verify it returns a list of Pydantic models
    assert isinstance(result, list)


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_blocks_list_with_filters(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = []

    result = await async_client.blocks.list(
        "space-id", parent_id="parent-id", block_type="page"
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/block"
    assert kwargs["params"] == {"parent_id": "parent-id", "type": "page"}
    # Verify it returns a list of Pydantic models
    assert isinstance(result, list)


# NOTE: Block creation tests are commented out because API passes through to core
# @patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
# @pytest.mark.asyncio
# async def test_async_blocks_create_root_payload(mock_request, async_client: AcontextAsyncClient) -> None:
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
#     result = await async_client.blocks.create(
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
# @patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
# @pytest.mark.asyncio
# async def test_async_blocks_create_with_parent_payload(mock_request, async_client: AcontextAsyncClient) -> None:
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
#     result = await async_client.blocks.create(
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


@pytest.mark.asyncio
async def test_async_blocks_move_requires_payload(
    async_client: AcontextAsyncClient,
) -> None:
    with pytest.raises(ValueError):
        await async_client.blocks.move("space-id", "block-id")


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_blocks_move_with_parent(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {"status": "ok"}

    await async_client.blocks.move("space-id", "block-id", parent_id="parent-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PUT"
    assert path == "/space/space-id/block/block-id/move"
    assert kwargs["json_data"] == {"parent_id": "parent-id"}


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_blocks_move_with_sort(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {"status": "ok"}

    await async_client.blocks.move("space-id", "block-id", sort=42)

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PUT"
    assert path == "/space/space-id/block/block-id/move"
    assert kwargs["json_data"] == {"sort": 42}


@pytest.mark.asyncio
async def test_async_blocks_update_properties_requires_payload(
    async_client: AcontextAsyncClient,
) -> None:
    with pytest.raises(ValueError):
        await async_client.blocks.update_properties("space-id", "block-id")


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_disks_create_hits_disk_endpoint(
    mock_request, async_client: AcontextAsyncClient
) -> None:
    mock_request.return_value = {
        "id": "disk",
        "project_id": "project-id",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }

    result = await async_client.disks.create()

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/disk"
    # Verify it returns a Pydantic model
    assert hasattr(result, "id")
    assert result.id == "disk"


@pytest.mark.asyncio
async def test_async_artifacts_aliases_disk_artifacts(
    async_client: AcontextAsyncClient,
) -> None:
    assert async_client.artifacts is async_client.disks.artifacts


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_disk_artifacts_upsert_uses_multipart_payload(
    mock_request, async_client: AcontextAsyncClient
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

    await async_client.disks.artifacts.upsert(
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


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_disk_artifacts_get_translates_query_params(
    mock_request, async_client: AcontextAsyncClient
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

    await async_client.disks.artifacts.get(
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
