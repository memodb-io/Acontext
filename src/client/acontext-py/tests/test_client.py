import json
import sys
import types
import unittest
from pathlib import Path
from typing import Any, Dict, Tuple

PROJECT_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PROJECT_SRC) not in sys.path:
    sys.path.insert(0, str(PROJECT_SRC))

# ---------------------------------------------------------------------------
# Minimal httpx stub for offline unit testing.
# ---------------------------------------------------------------------------

httpx_stub = types.ModuleType("httpx")


class URL:
    def __init__(self, value: str = "") -> None:
        self.value = value

    def __str__(self) -> str:
        return self.value

    def __repr__(self) -> str:  # pragma: no cover - debugging helper
        return f"URL({self.value!r})"

    def __eq__(self, other: object) -> bool:
        if isinstance(other, URL):
            return self.value == other.value
        if isinstance(other, str):
            return self.value == other
        return False


class HTTPError(Exception):
    pass


class ConnectError(HTTPError):
    def __init__(self, message: str, request: "Request") -> None:
        super().__init__(message)
        self.request = request


class Request:
    def __init__(self, method: str, url: str) -> None:
        self.method = method
        self.url = url


class Response:
    _REASON_MAP = {200: "OK", 201: "Created", 400: "Bad Request", 500: "Internal Server Error"}

    def __init__(
        self,
        status_code: int,
        *,
        json_data: Dict[str, Any] | None = None,
        headers: Dict[str, str] | None = None,
        request: Request | None = None,
    ) -> None:
        self.status_code = status_code
        self._json = json_data
        if headers is not None:
            self.headers = headers
        elif json_data is not None:
            self.headers = {"content-type": "application/json"}
        else:
            self.headers = {}
        self.request = request
        self.reason_phrase = self._REASON_MAP.get(status_code, "OK")
        self.text = "" if json_data is None else json.dumps(json_data)

    def json(self) -> Dict[str, Any]:
        if self._json is None:
            raise ValueError("response does not contain JSON")
        return self._json


class Timeout(float):
    pass


class Client:
    def __init__(self, *, base_url: str | URL = "", headers: Dict[str, str] | None = None, timeout: Any = None) -> None:
        self.base_url = URL(base_url) if not isinstance(base_url, URL) else base_url
        self.headers = dict(headers or {})
        self.timeout = timeout

    def request(self, method: str, url: str, **kwargs: Any) -> Response:  # pragma: no cover - overridden in tests
        raise NotImplementedError

    def close(self) -> None:
        pass


httpx_stub.URL = URL
httpx_stub.Client = Client
httpx_stub.Response = Response
httpx_stub.Request = Request
httpx_stub.HTTPError = HTTPError
httpx_stub.ConnectError = ConnectError
httpx_stub.Timeout = Timeout

sys.modules.setdefault("httpx", httpx_stub)

# ---------------------------------------------------------------------------
# Imports using the stubbed httpx module.
# ---------------------------------------------------------------------------

import httpx  # type: ignore  # noqa: E402  (import after stub definition)

from acontext import AcontextClient, FileUpload, MessagePart  # type: ignore  # noqa: E402
from acontext_py.messages import build_message_payload  # noqa: E402
from acontext_py.errors import APIError, TransportError  # noqa: E402
from acontext import AcontextClient as CompatClient  # type: ignore  # noqa: E402


class DummyClient(httpx.Client):
    def __init__(self, response: httpx.Response | None = None, *, exc: Exception | None = None) -> None:
        super().__init__(base_url="https://api.acontext.test")
        self._response = response
        self._exc = exc
        self.calls: list[Tuple[str, str, Dict[str, Any]]] = []

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:  # type: ignore[override]
        self.calls.append((method, url, kwargs))
        if self._exc:
            raise self._exc
        assert self._response is not None, "DummyClient requires response or exc"
        return self._response


def make_response(status: int, payload: Dict[str, Any]) -> httpx.Response:
    request = httpx.Request("GET", "https://api.acontext.test/resource")
    return httpx.Response(status, json_data=payload, request=request)


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
        dummy = DummyClient(exc=exc)
        client = AcontextClient(api_key="token", client=dummy)
        try:
            with self.assertRaises(TransportError):
                client.spaces.list()
        finally:
            client.close()

    def test_send_message_with_files_uses_multipart_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"message": "ok"}})
        dummy = DummyClient(response)
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

        self.assertTrue(dummy.calls, "Expected at least one HTTP request")
        method, url, kwargs = dummy.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "/session/session-id/messages")
        self.assertIn("files", kwargs)
        self.assertIn("data", kwargs)

        payload_json = json.loads(kwargs["data"]["payload"])
        self.assertEqual(payload_json["role"], "user")
        self.assertEqual(payload_json["parts"][0]["text"], "hello")
        self.assertEqual(payload_json["parts"][1]["file_field"], "file_1")

    def test_pages_create_builds_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"id": "page"}})
        dummy = DummyClient(response)
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

        method, url, kwargs = dummy.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "/space/space-id/page")
        self.assertEqual(
            kwargs["json"],
            {"parent_id": "parent-id", "title": "Title", "props": {"foo": "bar"}},
        )

    def test_pages_move_requires_payload(self) -> None:
        response = make_response(200, {"code": 200, "data": {}})
        dummy = DummyClient(response)
        client = AcontextClient(api_key="token", client=dummy)
        try:
            with self.assertRaises(ValueError):
                client.pages.move("space-id", "page-id")
        finally:
            client.close()

    def test_blocks_list_requires_parent(self) -> None:
        response = make_response(200, {"code": 200, "data": {}})
        dummy = DummyClient(response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            with self.assertRaises(ValueError):
                client.blocks.list("space-id", parent_id="")
        finally:
            client.close()

    def test_blocks_create_builds_payload(self) -> None:
        response = make_response(201, {"code": 201, "data": {"id": "block"}})
        dummy = DummyClient(response)
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

        method, url, kwargs = dummy.calls[0]
        self.assertEqual(method, "POST")
        self.assertEqual(url, "/space/space-id/block")
        self.assertEqual(
            kwargs["json"],
            {"parent_id": "parent-id", "type": "text", "title": "Block Title", "props": {"key": "value"}},
        )

    def test_blocks_update_properties_requires_payload(self) -> None:
        response = make_response(200, {"code": 200, "data": {}})
        dummy = DummyClient(response)
        client = AcontextClient(api_key="token", client=dummy)

        try:
            with self.assertRaises(ValueError):
                client.blocks.update_properties("space-id", "block-id")
        finally:
            client.close()

    def test_compat_import_exposes_same_client(self) -> None:
        self.assertIs(CompatClient, AcontextClient)

if __name__ == "__main__":  # pragma: no cover
    unittest.main()
