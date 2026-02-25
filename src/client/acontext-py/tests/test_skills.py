"""Tests for skills.download() — sync and async."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from acontext.async_client import AcontextAsyncClient
from acontext.client import AcontextClient


SKILL_DATA = {
    "id": "skill-1",
    "name": "test-skill",
    "description": "A test skill",
    "disk_id": "disk-1",
    "file_index": [
        {"path": "SKILL.md", "mime": "text/markdown"},
        {"path": "scripts/main.py", "mime": "text/x-python"},
    ],
    "meta": None,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}

SKILL_DATA_WITH_BINARY = {
    **SKILL_DATA,
    "file_index": [
        {"path": "SKILL.md", "mime": "text/markdown"},
        {"path": "images/logo.png", "mime": "image/png"},
    ],
}

SKILL_DATA_NESTED = {
    **SKILL_DATA,
    "file_index": [
        {"path": "SKILL.md", "mime": "text/markdown"},
        {"path": "a/b/c/deep.txt", "mime": "text/plain"},
    ],
}

FILE_RESP_SKILL_MD = {
    "path": "SKILL.md",
    "mime": "text/markdown",
    "content": {"type": "text", "raw": "# My Skill"},
    "url": None,
}

FILE_RESP_MAIN_PY = {
    "path": "scripts/main.py",
    "mime": "text/x-python",
    "content": {"type": "code", "raw": "print('hello')"},
    "url": None,
}

FILE_RESP_BINARY = {
    "path": "images/logo.png",
    "mime": "image/png",
    "content": None,
    "url": "https://s3.example.com/logo.png?signed=1",
}

FILE_RESP_DEEP = {
    "path": "a/b/c/deep.txt",
    "mime": "text/plain",
    "content": {"type": "text", "raw": "deep content"},
    "url": None,
}


# ---------- sync ----------


@pytest.fixture
def client() -> AcontextClient:
    c = AcontextClient(api_key="token")
    try:
        yield c
    finally:
        c.close()


@patch("acontext.resources.skills.httpx.get")
@patch("acontext.client.AcontextClient.request")
def test_download_text_files(mock_request, mock_httpx_get, client, tmp_path):
    mock_request.side_effect = [SKILL_DATA, FILE_RESP_SKILL_MD, FILE_RESP_MAIN_PY]

    dest = tmp_path / "my-skill"
    result = client.skills.download(skill_id="skill-1", path=str(dest))

    assert result.name == "test-skill"
    assert result.description == "A test skill"
    assert result.dir_path == str(dest)
    assert result.files == ["SKILL.md", "scripts/main.py"]
    assert (dest / "SKILL.md").read_text() == "# My Skill"
    assert (dest / "scripts" / "main.py").read_text() == "print('hello')"
    mock_httpx_get.assert_not_called()


@patch("acontext.resources.skills.httpx.get")
@patch("acontext.client.AcontextClient.request")
def test_download_binary_from_url(mock_request, mock_httpx_get, client, tmp_path):
    mock_request.side_effect = [SKILL_DATA_WITH_BINARY, FILE_RESP_SKILL_MD, FILE_RESP_BINARY]

    fake_resp = MagicMock()
    fake_resp.content = b"\x89PNG fake binary"
    fake_resp.raise_for_status = MagicMock()
    mock_httpx_get.return_value = fake_resp

    dest = tmp_path / "my-skill"
    result = client.skills.download(skill_id="skill-1", path=str(dest))

    assert result.files == ["SKILL.md", "images/logo.png"]
    assert (dest / "SKILL.md").read_text() == "# My Skill"
    assert (dest / "images" / "logo.png").read_bytes() == b"\x89PNG fake binary"
    mock_httpx_get.assert_called_once_with("https://s3.example.com/logo.png?signed=1")
    fake_resp.raise_for_status.assert_called_once()


@patch("acontext.resources.skills.httpx.get")
@patch("acontext.client.AcontextClient.request")
def test_download_nested_dirs(mock_request, mock_httpx_get, client, tmp_path):
    mock_request.side_effect = [SKILL_DATA_NESTED, FILE_RESP_SKILL_MD, FILE_RESP_DEEP]

    dest = tmp_path / "nested"
    result = client.skills.download(skill_id="skill-1", path=str(dest))

    assert result.files == ["SKILL.md", "a/b/c/deep.txt"]
    assert (dest / "a" / "b" / "c" / "deep.txt").read_text() == "deep content"


@patch("acontext.client.AcontextClient.request")
def test_download_creates_dest_dir(mock_request, client, tmp_path):
    mock_request.side_effect = [SKILL_DATA, FILE_RESP_SKILL_MD, FILE_RESP_MAIN_PY]

    dest = tmp_path / "nonexistent" / "deep" / "path"
    assert not dest.exists()

    result = client.skills.download(skill_id="skill-1", path=str(dest))

    assert dest.exists()
    assert len(result.files) == 2


# ---------- async ----------


@pytest_asyncio.fixture
async def async_client() -> AcontextAsyncClient:
    c = AcontextAsyncClient(api_key="token")
    try:
        yield c
    finally:
        await c.aclose()


@patch("acontext.resources.async_skills.httpx.AsyncClient")
@patch(
    "acontext.async_client.AcontextAsyncClient.request",
    new_callable=AsyncMock,
)
@pytest.mark.asyncio
async def test_async_download_text_files(
    mock_request, mock_async_client_cls, async_client, tmp_path
):
    mock_request.side_effect = [SKILL_DATA, FILE_RESP_SKILL_MD, FILE_RESP_MAIN_PY]

    dest = tmp_path / "async-skill"
    result = await async_client.skills.download(skill_id="skill-1", path=str(dest))

    assert result.name == "test-skill"
    assert result.files == ["SKILL.md", "scripts/main.py"]
    assert (dest / "SKILL.md").read_text() == "# My Skill"
    assert (dest / "scripts" / "main.py").read_text() == "print('hello')"


@patch("acontext.resources.async_skills.httpx.AsyncClient")
@patch(
    "acontext.async_client.AcontextAsyncClient.request",
    new_callable=AsyncMock,
)
@pytest.mark.asyncio
async def test_async_download_binary_from_url(
    mock_request, mock_async_client_cls, async_client, tmp_path
):
    mock_request.side_effect = [
        SKILL_DATA_WITH_BINARY,
        FILE_RESP_SKILL_MD,
        FILE_RESP_BINARY,
    ]

    fake_resp = MagicMock()
    fake_resp.content = b"\x89PNG fake binary"
    fake_resp.raise_for_status = MagicMock()

    mock_http = AsyncMock()
    mock_http.get = AsyncMock(return_value=fake_resp)
    mock_http.__aenter__ = AsyncMock(return_value=mock_http)
    mock_http.__aexit__ = AsyncMock(return_value=False)
    mock_async_client_cls.return_value = mock_http

    dest = tmp_path / "async-skill-bin"
    result = await async_client.skills.download(skill_id="skill-1", path=str(dest))

    assert result.files == ["SKILL.md", "images/logo.png"]
    assert (dest / "images" / "logo.png").read_bytes() == b"\x89PNG fake binary"
    mock_http.get.assert_awaited_once_with("https://s3.example.com/logo.png?signed=1")
