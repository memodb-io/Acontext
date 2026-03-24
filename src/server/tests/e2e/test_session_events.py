"""E2E tests for session events feature."""

import logging
import pytest
import httpx
import uuid
from typing import Dict

from conftest import (
    API_URL,
    db_conn,
    test_project,
    wait_for_services,
    create_session,
    ProjectCredentials,
)

logger = logging.getLogger(__name__)


async def add_event(
    client: httpx.AsyncClient,
    session_id: str,
    event_type: str,
    data: dict,
    headers: Dict[str, str],
) -> dict:
    """Add an event to a session and return the event data."""
    resp = await client.post(
        f"{API_URL}/api/v1/session/{session_id}/events",
        json={"type": event_type, "data": data},
        headers=headers,
    )
    assert resp.status_code == 200, f"Failed to add event: {resp.text}"
    return resp.json()["data"]


async def get_events(
    client: httpx.AsyncClient,
    session_id: str,
    headers: Dict[str, str],
    limit: int = 50,
    cursor: str | None = None,
    time_desc: bool = False,
) -> dict:
    """Get events for a session."""
    params = {"limit": limit, "time_desc": str(time_desc).lower()}
    if cursor:
        params["cursor"] = cursor
    resp = await client.get(
        f"{API_URL}/api/v1/session/{session_id}/events",
        params=params,
        headers=headers,
    )
    assert resp.status_code == 200, f"Failed to get events: {resp.text}"
    return resp.json()["data"]


@pytest.mark.asyncio
async def test_create_disk_event(test_project: ProjectCredentials):
    """Test creating a disk_event."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        event = await add_event(
            client,
            session_id,
            "disk_event",
            {"disk_id": str(uuid.uuid4()), "path": "/data/report.csv", "note": "Uploaded"},
            test_project.headers,
        )

        assert event["type"] == "disk_event"
        assert event["session_id"] == session_id
        assert event["project_id"] == str(test_project.project_id)
        assert event["data"]["path"] == "/data/report.csv"
        assert "id" in event
        assert "created_at" in event


@pytest.mark.asyncio
async def test_create_text_event(test_project: ProjectCredentials):
    """Test creating a text_event."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        event = await add_event(
            client,
            session_id,
            "text_event",
            {"text": "User switched to dark mode"},
            test_project.headers,
        )

        assert event["type"] == "text_event"
        assert event["data"]["text"] == "User switched to dark mode"


@pytest.mark.asyncio
async def test_list_events_with_pagination(test_project: ProjectCredentials):
    """Test listing events with pagination."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        # Create 3 events
        for i in range(3):
            await add_event(
                client,
                session_id,
                "text_event",
                {"text": f"Event {i}"},
                test_project.headers,
            )

        # Get with limit=2
        result = await get_events(client, session_id, test_project.headers, limit=2)
        assert len(result["items"]) == 2
        assert result["has_more"] is True
        assert result["next_cursor"] is not None

        # Get next page
        result2 = await get_events(
            client, session_id, test_project.headers, limit=2, cursor=result["next_cursor"]
        )
        assert len(result2["items"]) == 1
        assert result2["has_more"] is False


@pytest.mark.asyncio
async def test_events_with_messages(test_project: ProjectCredentials):
    """Test that events are returned with messages when with_events=true."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        # Store a message
        msg_resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            json={
                "blob": {"role": "user", "content": "Hello"},
                "format": "openai",
            },
            headers=test_project.headers,
        )
        assert msg_resp.status_code in (200, 201)

        # Add an event
        await add_event(
            client,
            session_id,
            "text_event",
            {"text": "Event during conversation"},
            test_project.headers,
        )

        # Send a second message so the event falls within the time window
        # (events query uses [first_msg.created_at, last_msg.created_at])
        msg_resp2 = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            json={
                "blob": {"role": "user", "content": "Second message"},
                "format": "openai",
            },
            headers=test_project.headers,
        )
        assert msg_resp2.status_code in (200, 201)

        # Get messages with events
        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            params={"format": "acontext", "with_events": "true"},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert "events" in data
        assert len(data["events"]) >= 1

        # Get messages without events (default)
        resp2 = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            params={"format": "acontext"},
            headers=test_project.headers,
        )
        assert resp2.status_code == 200
        data2 = resp2.json()["data"]
        # events should be null/empty when not requested
        assert data2.get("events") is None or len(data2.get("events", [])) == 0


@pytest.mark.asyncio
async def test_events_cascade_delete(test_project: ProjectCredentials, db_conn):
    """Test that events are deleted when session is deleted."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        event = await add_event(
            client,
            session_id,
            "text_event",
            {"text": "Will be deleted"},
            test_project.headers,
        )
        event_id = event["id"]

        # Delete session
        del_resp = await client.delete(
            f"{API_URL}/api/v1/session/{session_id}",
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        # Verify event is gone
        count = await db_conn.fetchval(
            "SELECT COUNT(*) FROM session_events WHERE id = $1",
            uuid.UUID(event_id),
        )
        assert count == 0


@pytest.mark.asyncio
async def test_create_event_nonexistent_session(test_project: ProjectCredentials):
    """Test creating event for non-existent session returns error."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        fake_session_id = str(uuid.uuid4())
        resp = await client.post(
            f"{API_URL}/api/v1/session/{fake_session_id}/events",
            json={"type": "text_event", "data": {"text": "Should fail"}},
            headers=test_project.headers,
        )
        assert resp.status_code in (400, 404)


@pytest.mark.asyncio
async def test_create_event_missing_type(test_project: ProjectCredentials):
    """Test creating event with missing type returns 400."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/events",
            json={"data": {"text": "Missing type"}},
            headers=test_project.headers,
        )
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_event_missing_data(test_project: ProjectCredentials):
    """Test creating event with missing data returns 400."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/events",
            json={"type": "text_event"},
            headers=test_project.headers,
        )
        assert resp.status_code == 400
