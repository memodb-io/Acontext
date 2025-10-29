import json
from dataclasses import asdict, dataclass
from typing import Any, Dict
from unittest.mock import patch

import httpx
import pytest

from acontext.client import AcontextClient, FileUpload, MessagePart  # noqa: E402
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
        parts=[MessagePart.text_part("hi")],
        meta={"name": "bot"},
    )

    assert message.role == "assistant"
    assert message.parts[0].text == "hi"
    assert message.meta == {"name": "bot"}
    assert asdict(message) == {
        "role": "assistant",
        "parts": [{"type": "text", "text": "hi"}],
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
    exc = httpx.ConnectError("boom", request=httpx.Request("GET", "https://api.acontext.test/failure"))
    mock_request.side_effect = exc
    with AcontextClient(api_key="token") as client:
        with pytest.raises(TransportError):
            client.spaces.list()


@patch("acontext.client.AcontextClient.request")
def test_send_message_with_files_uses_multipart_payload(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"message": "ok"}

    blob = build_acontext_message(role="user", parts=[MessagePart.text_part("hello")])
    blob_payload = asdict(blob)

    class _DummyStream:
        def read(self) -> bytes:
            return b"bytes"

    dummy_stream = _DummyStream()
    upload = FileUpload(filename="image.png", content=dummy_stream, content_type="image/png")

    client.sessions.send_message(
        "session-id",
        blob=blob_payload,
        format="acontext",
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

    files_payload = kwargs["files"]
    assert isinstance(files_payload, set)
    assert "image.png" in files_payload
    assert "image/png" in files_payload
    assert dummy_stream in files_payload


@patch("acontext.client.AcontextClient.request")
def test_send_message_requires_blob(mock_request, client: AcontextClient) -> None:
    with pytest.raises(ValueError):
        client.sessions.send_message("session-id", format="openai", blob=None, file=None)


@patch("acontext.client.AcontextClient.request")
def test_send_message_requires_format_when_cannot_infer(mock_request, client: AcontextClient) -> None:
    with pytest.raises(ValueError):
        client.sessions.send_message(
            "session-id",
            blob={"message": "hi"},
            file=None,
        )


@patch("acontext.client.AcontextClient.request")
def test_send_message_rejects_unknown_format(mock_request, client: AcontextClient) -> None:
    with pytest.raises(ValueError):
        client.sessions.send_message(
            "session-id",
            blob={"role": "user", "content": "hi"},
            format="legacy",
            file=None,
        )


@patch("acontext.client.AcontextClient.request")
def test_send_message_explicit_format_still_supported(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"message": "ok"}

    client.sessions.send_message(
        "session-id",
        blob={"role": "user", "content": "hi"},
        format="openai",
        file=None,
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
def test_send_message_infers_openai_format(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"message": "ok"}

    client.sessions.send_message(
        "session-id",
        blob=_FakeOpenAIMessage(role="user"),
        file=None,
    )

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "openai"
    assert kwargs["json_data"]["blob"]["content"] == "hello"


@patch("acontext.client.AcontextClient.request")
def test_send_message_infers_anthropic_format(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"message": "ok"}

    client.sessions.send_message(
        "session-id",
        blob=_FakeAnthropicMessage(role="user"),
        file=None,
    )

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "anthropic"
    assert kwargs["json_data"]["blob"]["content"][0]["text"] == "hi"


@patch("acontext.client.AcontextClient.request")
def test_send_message_infers_acontext_format(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"message": "ok"}

    blob = {"role": "assistant", "parts": [{"type": "text", "text": "hi"}]}
    client.sessions.send_message("session-id", blob=blob, file=None)

    mock_request.assert_called_once()
    _, kwargs = mock_request.call_args
    assert kwargs["json_data"]["format"] == "acontext"


@patch("acontext.client.AcontextClient.request")
def test_spaces_semantic_queries_require_query_param(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"result": "ok"}

    client.spaces.get_semantic_answer("space-id", query="what happened?")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/semantic_answer"
    assert kwargs["params"] == {"query": "what happened?"}


@patch("acontext.client.AcontextClient.request")
def test_sessions_get_messages_forwards_format(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"items": []}

    client.sessions.get_messages("session-id", format="acontext")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/session/session-id/messages"
    assert kwargs["params"] == {"format": "acontext"}


@patch("acontext.client.AcontextClient.request")
def test_blocks_list_without_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"items": []}

    client.blocks.list("space-id")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/block"
    assert kwargs["params"] is None


@patch("acontext.client.AcontextClient.request")
def test_blocks_list_with_filters(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"items": []}

    client.blocks.list("space-id", parent_id="parent-id", block_type="page")

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/space/space-id/block"
    assert kwargs["params"] == {"parent_id": "parent-id", "type": "page"}


@patch("acontext.client.AcontextClient.request")
def test_blocks_create_root_payload(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"id": "block"}

    client.blocks.create(
        "space-id",
        block_type="folder",
        title="Folder Title",
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/space/space-id/block"
    assert kwargs["json_data"] == {
        "type": "folder",
        "title": "Folder Title",
    }


@patch("acontext.client.AcontextClient.request")
def test_blocks_create_with_parent_payload(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"id": "block"}

    client.blocks.create(
        "space-id",
        parent_id="parent-id",
        block_type="text",
        title="Block Title",
        props={"key": "value"},
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/space/space-id/block"
    assert kwargs["json_data"] == {
        "parent_id": "parent-id",
        "type": "text",
        "title": "Block Title",
        "props": {"key": "value"},
    }


def test_blocks_create_requires_type(client: AcontextClient) -> None:
    with pytest.raises(ValueError):
        client.blocks.create("space-id", block_type="")


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
def test_blocks_update_properties_requires_payload(mock_request, client: AcontextClient) -> None:
    with pytest.raises(ValueError):
        client.blocks.update_properties("space-id", "block-id")

    mock_request.assert_not_called()


@patch("acontext.client.AcontextClient.request")
def test_disks_create_hits_disk_endpoint(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"id": "disk"}

    client.disks.create()

    mock_request.assert_called_once()
    args, _ = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/disk"


def test_artifacts_aliases_disk_artifacts(client: AcontextClient) -> None:
    assert client.artifacts is client.disks.artifacts


@patch("acontext.client.AcontextClient.request")
def test_disk_artifacts_upsert_uses_multipart_payload(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"id": "artifact"}

    client.disks.artifacts.upsert(
        "disk-id",
        file=FileUpload(filename="file.txt", content=b"data", content_type="text/plain"),
        file_path="/folder/file.txt",
        meta={"source": "unit-test"},
    )

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/disk/disk-id/artifact"
    assert "files" in kwargs
    assert "data" in kwargs
    assert kwargs["data"]["file_path"] == "/folder/file.txt"
    meta = json.loads(kwargs["data"]["meta"])
    assert meta["source"] == "unit-test"
    filename, stream, content_type = kwargs["files"]["file"]
    assert filename == "file.txt"
    assert content_type == "text/plain"
    assert stream.read() == b"data"


@patch("acontext.client.AcontextClient.request")
def test_disk_artifacts_get_translates_query_params(mock_request, client: AcontextClient) -> None:
    mock_request.return_value = {"artifact": {}}

    client.disks.artifacts.get(
        "disk-id",
        file_path="/folder/file.txt",
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
