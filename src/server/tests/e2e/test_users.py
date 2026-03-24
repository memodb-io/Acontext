"""E2E tests for User listing, resource counts, cascade delete."""

import logging
import uuid

import httpx
import pytest

from conftest import (
    API_URL,
    test_project,
    db_conn,
    wait_for_services,
    create_session,
    create_disk,
    ProjectCredentials,
)
from test_agent_skills import create_skill

logger = logging.getLogger(__name__)

USER_PREFIX = "e2e-user"


def unique_user() -> str:
    return f"{USER_PREFIX}-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_users(test_project: ProjectCredentials):
    """Create sessions with different users, list users."""
    assert await wait_for_services()

    user1 = unique_user()
    user2 = unique_user()

    async with httpx.AsyncClient() as client:
        # Create sessions with different users
        for user in [user1, user2, user1]:
            resp = await client.post(
                f"{API_URL}/api/v1/session",
                json={"user": user},
                headers=test_project.headers,
            )
            assert resp.status_code in (200, 201)

        # List users
        resp = await client.get(
            f"{API_URL}/api/v1/user/ls",
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        user_identifiers = [u["identifier"] for u in data["items"]] if data.get("items") else []
        assert user1 in user_identifiers
        assert user2 in user_identifiers


@pytest.mark.asyncio
async def test_get_user_resources(test_project: ProjectCredentials):
    """Create user resources (sessions, disks, skills), verify counts."""
    assert await wait_for_services()

    user = unique_user()

    async with httpx.AsyncClient() as client:
        # Create session with user
        await client.post(
            f"{API_URL}/api/v1/session",
            json={"user": user},
            headers=test_project.headers,
        )

        # Create disk with user
        await create_disk(client, test_project.headers, user=user)

        # Create skill with user
        await create_skill(
            client, test_project.headers,
            name="user-res-skill", description="test",
            user=user,
        )

        # Get resources — response wraps counts in a "counts" key
        resp = await client.get(
            f"{API_URL}/api/v1/user/{user}/resources",
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        counts = resp.json()["data"]["counts"]
        assert counts["sessions_count"] >= 1
        assert counts["disks_count"] >= 1
        assert counts["skills_count"] >= 1


@pytest.mark.asyncio
async def test_delete_user_cascade(test_project: ProjectCredentials):
    """Delete user, verify sessions cleaned up."""
    assert await wait_for_services()

    user = unique_user()

    async with httpx.AsyncClient() as client:
        # Create a session with user
        sess_resp = await client.post(
            f"{API_URL}/api/v1/session",
            json={"user": user},
            headers=test_project.headers,
        )
        assert sess_resp.status_code in (200, 201)

        # Verify user has resources
        res_resp = await client.get(
            f"{API_URL}/api/v1/user/{user}/resources",
            headers=test_project.headers,
        )
        assert res_resp.status_code == 200
        counts = res_resp.json()["data"]["counts"]
        assert counts["sessions_count"] >= 1

        # Delete user
        del_resp = await client.delete(
            f"{API_URL}/api/v1/user/{user}",
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        # Verify user no longer appears in user list
        list_resp = await client.get(
            f"{API_URL}/api/v1/user/ls",
            headers=test_project.headers,
        )
        assert list_resp.status_code == 200
        user_ids = [u["identifier"] for u in list_resp.json()["data"]["items"]] if list_resp.json()["data"].get("items") else []
        assert user not in user_ids


@pytest.mark.asyncio
async def test_delete_nonexistent_user(test_project: ProjectCredentials):
    """Expect appropriate error for nonexistent user."""
    assert await wait_for_services()

    fake_user = f"nonexistent-{uuid.uuid4().hex}"
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{API_URL}/api/v1/user/{fake_user}",
            headers=test_project.headers,
        )
        # API may return 200 (no-op) or 404 depending on implementation
        assert resp.status_code in (200, 404), (
            f"Unexpected status {resp.status_code} for nonexistent user delete: {resp.text}"
        )
