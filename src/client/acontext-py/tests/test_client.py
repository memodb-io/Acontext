import json
import sys
import unittest
from pathlib import Path
from typing import Any, Dict
from unittest import mock

import httpx

PROJECT_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PROJECT_SRC) not in sys.path:
    sys.path.insert(0, str(PROJECT_SRC))

from acontext.client import AcontextClient, FileUpload, MessagePart  # noqa: E402
from acontext.messages import build_message_payload  # noqa: E402
from acontext.errors import APIError, TransportError  # noqa: E402


def make_response(status: int, payload: Dict[str, Any]) -> httpx.Response:
    request = httpx.Request("GET", "https://api.acontext.test/resource")
    return httpx.Response(status, json=payload, request=request)


def make_mock_client(
    *,
    response: httpx.Response | None = None,
    exc: Exception | None = None,
) -> mock.MagicMock:
    client = mock.MagicMock()
    client.base_url = httpx.URL("https://api.acontext.test")
    client.headers = {}
    if exc is not None:
        client.request.side_effect = exc
    else:
        client.request.return_value = response
    return client


class ClientTests(unittest.TestCase):
    def test_build_message_payload_with_file(self) -> None:
        file_part = MessagePart.file_part(
            ("document.txt", b"hello world", "text/plain"),
            meta={"source": "unit-test"},
        )
        parts = [MessagePart.text_part("hi"), file_part]

        payload, files = build_message_payload(parts)

        self.assertEqual(
            payload,
            [
                {"type": "text", "text": "hi"},
                {"type": "file", "meta": {"source": "unit-test"}, "file_field": "file_1"},
            ],
        )

        self.assertIn("file_1", files)
        filename, stream, content_type = files["file_1"]
        self.assertEqual(filename, "document.txt")
        self.assertEqual(content_type, "text/plain")
        self.assertEqual(stream.read(), b"hello world")

    def test_handle_response_returns_data(self) -> None:
        resp = make_response(200, {"code": 200, "data": {"ok": True}})
        data = AcontextClient._handle_response(resp, unwrap=True)
        self.assertEqual(data, {"ok": True})

    def test_handle_response_app_code_error(self) -> None:
        resp = make_response(200, {"code": 500, "msg": "failure"})
        with self.assertRaises(APIError) as ctx:
            AcontextClient._handle_response(resp, unwrap=True)
        self.assertEqual(ctx.exception.code, 500)
        self.assertEqual(ctx.exception.status_code, 200)

    def test_request_transport_error(self) -> None:
        exc = httpx.ConnectError("boom", request=httpx.Request("GET", "https://api.acontext.test/failure"))
        dummy = make_mock_client(exc=exc)
        client = AcontextClient(api_key="token", client=dummy)
        try:
            with self.assertRaises(TransportError):
                client.spaces.list()
        finally:
            client.close()

    def test_send_message_with_files_uses_multipart_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"message": "ok"}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            file_upload = FileUpload(filename="image.png", content=b"bytes", content_type="image/png")
            client.sessions.send_message(
                "session-id",
                role="user",
                parts=[MessagePart.text_part("hello"), MessagePart.file_part(file_upload)],
            )
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        method = kwargs["method"]
        url = kwargs["url"]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "/session/session-id/messages")
        self.assertIn("files", kwargs)
        self.assertIn("data", kwargs)

        payload_json = json.loads(kwargs["data"]["payload"])
        self.assertEqual(payload_json["role"], "user")
        self.assertEqual(payload_json["parts"][0]["text"], "hello")
        self.assertEqual(payload_json["parts"][1]["file_field"], "file_1")

    def test_send_message_can_include_format(self) -> None:
        response = make_response(201, {"code": 201, "data": {"message": "ok"}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            client.sessions.send_message(
                "session-id",
                role="user",
                parts=[MessagePart.text_part("hello")],
                format="anthropic",
            )
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        self.assertIn("json", kwargs)
        self.assertEqual(kwargs["json"]["format"], "anthropic")

    def test_pages_create_builds_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"id": "page"}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            client.pages.create(
                "space-id",
                parent_id="parent-id",
                title="Title",
                props={"foo": "bar"},
            )
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        method = kwargs["method"]
        url = kwargs["url"]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "/space/space-id/page")
        self.assertEqual(
            kwargs["json"],
            {"parent_id": "parent-id", "title": "Title", "props": {"foo": "bar"}},
        )

    def test_pages_move_requires_payload(self) -> None:
        response = make_response(200, {"code": 200, "data": {}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)
        try:
            with self.assertRaises(ValueError):
                client.pages.move("space-id", "page-id")
        finally:
            client.close()
        dummy.request.assert_not_called()

    def test_folders_create_builds_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"id": "folder"}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            client.folders.create(
                "space-id",
                parent_id="parent-id",
                title="Folder Title",
                props={"foo": "bar"},
            )
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        self.assertEqual(kwargs["method"], "POST")
        self.assertEqual(kwargs["url"], "/space/space-id/folder")
        self.assertEqual(
            kwargs["json"],
            {"parent_id": "parent-id", "title": "Folder Title", "props": {"foo": "bar"}},
        )

    def test_spaces_semantic_queries_require_query_param(self) -> None:
        response = make_response(200, {"code": 200, "data": {"result": "ok"}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            client.spaces.get_semantic_answer("space-id", query="what happened?")
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        self.assertEqual(kwargs["method"], "GET")
        self.assertEqual(kwargs["url"], "/space/space-id/semantic_answer")
        self.assertEqual(kwargs["params"], {"query": "what happened?"})

    def test_sessions_get_messages_forwards_format(self) -> None:
        response = make_response(200, {"code": 200, "data": {"items": []}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            client.sessions.get_messages("session-id", format="acontext")
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        self.assertEqual(kwargs["method"], "GET")
        self.assertEqual(kwargs["url"], "/session/session-id/messages")
        self.assertEqual(kwargs["params"], {"format": "acontext"})

    def test_blocks_list_requires_parent(self) -> None:
        response = make_response(200, {"code": 200, "data": {}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            with self.assertRaises(ValueError):
                client.blocks.list("space-id", parent_id="")
        finally:
            client.close()
        dummy.request.assert_not_called()

    def test_blocks_create_builds_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"id": "block"}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            client.blocks.create(
                "space-id",
                parent_id="parent-id",
                block_type="text",
                title="Block Title",
                props={"key": "value"},
            )
        finally:
            client.close()

        dummy.request.assert_called_once()
        _, kwargs = dummy.request.call_args
        method = kwargs["method"]
        url = kwargs["url"]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "/space/space-id/block")
        self.assertEqual(
            kwargs["json"],
            {"parent_id": "parent-id", "type": "text", "title": "Block Title", "props": {"key": "value"}},
        )

    def test_blocks_update_properties_requires_payload(self) -> None:
        response = make_response(200, {"code": 200, "data": {}})
        dummy = make_mock_client(response=response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            with self.assertRaises(ValueError):
                client.blocks.update_properties("space-id", "block-id")
        finally:
            client.close()
        dummy.request.assert_not_called()

if __name__ == "__main__":  # pragma: no cover
    unittest.main()
