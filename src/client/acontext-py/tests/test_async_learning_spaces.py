"""
Async tests for the AsyncLearningSpacesAPI resource.
"""

import json
from unittest.mock import AsyncMock, patch

import pytest

from acontext.async_client import AcontextAsyncClient


# ---------------------------------------------------------------------------
# Sample data (same as sync tests)
# ---------------------------------------------------------------------------

SAMPLE_LS = {
    "id": "ls-1",
    "user_id": "user-1",
    "meta": {"version": "1.0"},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}

SAMPLE_LS_SESSION = {
    "id": "lss-1",
    "learning_space_id": "ls-1",
    "session_id": "sess-1",
    "status": "pending",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}

SAMPLE_LS_SKILL = {
    "id": "lsk-1",
    "learning_space_id": "ls-1",
    "skill_id": "skill-1",
    "created_at": "2024-01-01T00:00:00Z",
}

SAMPLE_SKILL = {
    "id": "skill-1",
    "name": "test-skill",
    "description": "A test skill",
    "disk_id": "disk-1",
    "file_index": [{"path": "SKILL.md", "mime": "text/markdown"}],
    "meta": {"version": "1.0"},
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
}


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_create_learning_space(mock_request) -> None:
    mock_request.return_value = SAMPLE_LS

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.create(user="alice", meta={"version": "1.0"})

    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/learning_spaces"
    assert kwargs["json_data"]["user"] == "alice"
    assert result.id == "ls-1"


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_create_learning_space_without_user(mock_request) -> None:
    mock_request.return_value = {**SAMPLE_LS, "user_id": None}

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.create()

    args, kwargs = mock_request.call_args
    assert "user" not in kwargs["json_data"]
    assert result.user_id is None


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_list_learning_spaces(mock_request) -> None:
    mock_request.return_value = {
        "items": [SAMPLE_LS],
        "next_cursor": None,
        "has_more": False,
    }

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.list(user="alice", limit=10)

    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/learning_spaces"
    assert kwargs["params"]["user"] == "alice"
    assert len(result.items) == 1


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_list_learning_spaces_filter_by_meta(mock_request) -> None:
    mock_request.return_value = {
        "items": [SAMPLE_LS],
        "next_cursor": None,
        "has_more": False,
    }

    async with AcontextAsyncClient(api_key="token") as client:
        await client.learning_spaces.list(filter_by_meta={"version": "1.0"})

    args, kwargs = mock_request.call_args
    assert kwargs["params"]["filter_by_meta"] == json.dumps({"version": "1.0"})


# ---------------------------------------------------------------------------
# Get
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_get_learning_space(mock_request) -> None:
    mock_request.return_value = SAMPLE_LS

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.get("ls-1")

    args, _ = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/learning_spaces/ls-1"
    assert result.id == "ls-1"


# ---------------------------------------------------------------------------
# Update
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_update_learning_space(mock_request) -> None:
    mock_request.return_value = {**SAMPLE_LS, "meta": {"version": "2.0"}}

    async with AcontextAsyncClient(api_key="token") as client:
        await client.learning_spaces.update("ls-1", meta={"version": "2.0"})

    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "PATCH"
    assert path == "/learning_spaces/ls-1"
    assert kwargs["json_data"]["meta"] == {"version": "2.0"}


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_delete_learning_space(mock_request) -> None:
    mock_request.return_value = None

    async with AcontextAsyncClient(api_key="token") as client:
        await client.learning_spaces.delete("ls-1")

    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    assert path == "/learning_spaces/ls-1"


# ---------------------------------------------------------------------------
# Learn
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_learn(mock_request) -> None:
    mock_request.return_value = SAMPLE_LS_SESSION

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.learn("ls-1", session_id="sess-1")

    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/learning_spaces/ls-1/learn"
    assert kwargs["json_data"]["session_id"] == "sess-1"
    assert result.status == "pending"


# ---------------------------------------------------------------------------
# List Sessions
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_list_sessions(mock_request) -> None:
    mock_request.return_value = [SAMPLE_LS_SESSION]

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.list_sessions("ls-1")

    args, _ = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/learning_spaces/ls-1/sessions"
    assert len(result) == 1
    assert result[0].status == "pending"


# ---------------------------------------------------------------------------
# Include Skill
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_include_skill(mock_request) -> None:
    mock_request.return_value = SAMPLE_LS_SKILL

    async with AcontextAsyncClient(api_key="token") as client:
        await client.learning_spaces.include_skill("ls-1", skill_id="skill-1")

    args, kwargs = mock_request.call_args
    method, path = args
    assert method == "POST"
    assert path == "/learning_spaces/ls-1/skills"
    assert kwargs["json_data"]["skill_id"] == "skill-1"


# ---------------------------------------------------------------------------
# List Skills
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_list_skills(mock_request) -> None:
    mock_request.return_value = [SAMPLE_SKILL]

    async with AcontextAsyncClient(api_key="token") as client:
        result = await client.learning_spaces.list_skills("ls-1")

    args, _ = mock_request.call_args
    method, path = args
    assert method == "GET"
    assert path == "/learning_spaces/ls-1/skills"
    assert len(result) == 1
    assert result[0].name == "test-skill"


# ---------------------------------------------------------------------------
# Exclude Skill
# ---------------------------------------------------------------------------


@patch("acontext.async_client.AcontextAsyncClient.request", new_callable=AsyncMock)
@pytest.mark.asyncio
async def test_async_exclude_skill(mock_request) -> None:
    mock_request.return_value = None

    async with AcontextAsyncClient(api_key="token") as client:
        await client.learning_spaces.exclude_skill("ls-1", skill_id="skill-1")

    args, _ = mock_request.call_args
    method, path = args
    assert method == "DELETE"
    assert path == "/learning_spaces/ls-1/skills/skill-1"
