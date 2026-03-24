"""E2E tests for Learning Spaces CRUD + skill/session associations."""

import json
import logging
import uuid

import httpx
import pytest

from conftest import (
    API_URL,
    test_project,
    db_conn,
    wait_for_services,
    ProjectCredentials,
)
from test_agent_skills import create_skill

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_learning_space(
    client: httpx.AsyncClient,
    headers: dict,
    user: str | None = None,
    meta: dict | None = None,
) -> dict:
    """Create a learning space and return the response data."""
    body: dict = {}
    if user:
        body["user"] = user
    if meta:
        body["meta"] = meta
    resp = await client.post(
        f"{API_URL}/api/v1/learning_spaces",
        json=body,
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Create learning space failed: {resp.text}"
    return resp.json()["data"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_learning_space(test_project: ProjectCredentials):
    """Create with optional user/meta, verify 201."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(
            client, test_project.headers,
            user="alice@test.com",
            meta={"version": "1.0", "env": "test"},
        )
        assert "id" in space
        # Response returns user_id (UUID), not the user string directly
        assert space.get("user_id") is not None
        meta = space.get("meta") or {}
        assert meta.get("version") == "1.0"

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_list_learning_spaces(test_project: ProjectCredentials):
    """Create multiple, verify pagination."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        ids = []
        for i in range(3):
            space = await create_learning_space(
                client, test_project.headers,
                meta={"idx": i},
            )
            ids.append(space["id"])

        resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces",
            params={"limit": 2},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["items"]) == 2
        assert data["has_more"] is True

        # Cleanup
        for sid in ids:
            await client.delete(
                f"{API_URL}/api/v1/learning_spaces/{sid}",
                headers=test_project.headers,
            )


@pytest.mark.asyncio
async def test_get_learning_space(test_project: ProjectCredentials):
    """Get by ID."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(client, test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == space["id"]

        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_update_learning_space_meta(test_project: ProjectCredentials):
    """PATCH meta, verify merge semantics."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(
            client, test_project.headers,
            meta={"key1": "val1", "key2": "val2"},
        )

        # Patch: update key1, add key3
        resp = await client.patch(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            json={"meta": {"key1": "updated", "key3": "new"}},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        updated = resp.json()["data"]
        meta = updated.get("meta") or {}
        assert meta["key1"] == "updated"
        assert meta["key2"] == "val2"  # preserved
        assert meta["key3"] == "new"

        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_delete_learning_space(test_project: ProjectCredentials):
    """Delete, verify cascade."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(client, test_project.headers)

        del_resp = await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        get_resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_include_skill_in_space(test_project: ProjectCredentials):
    """Associate skill, verify 201."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(client, test_project.headers)
        skill = await create_skill(
            client, test_project.headers,
            name="space-skill", description="For space test",
        )

        resp = await client.post(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            json={"skill_id": skill["id"]},
            headers=test_project.headers,
        )
        assert resp.status_code in (200, 201), f"Include skill failed: {resp.text}"

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_list_skills_in_space(test_project: ProjectCredentials):
    """List associated skills."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(client, test_project.headers)
        skill = await create_skill(
            client, test_project.headers,
            name="list-space-skill", description="For list test",
        )

        # Include skill
        await client.post(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            json={"skill_id": skill["id"]},
            headers=test_project.headers,
        )

        # List skills in space (returns a flat array)
        resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        skills_list = resp.json()["data"]
        assert isinstance(skills_list, list)
        assert len(skills_list) >= 1

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_exclude_skill_from_space(test_project: ProjectCredentials):
    """Remove association."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(client, test_project.headers)
        skill = await create_skill(
            client, test_project.headers,
            name="exclude-skill", description="For exclude test",
        )

        # Include then exclude
        await client.post(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            json={"skill_id": skill["id"]},
            headers=test_project.headers,
        )

        del_resp = await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills/{skill['id']}",
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        # Verify skill no longer in space (returns a flat array)
        resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            headers=test_project.headers,
        )
        skills_list = resp.json()["data"]
        skill_ids = [s["id"] for s in skills_list] if skills_list else []
        assert skill["id"] not in skill_ids

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_include_duplicate_skill(test_project: ProjectCredentials):
    """Expect 409 for duplicate inclusion."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        space = await create_learning_space(client, test_project.headers)
        skill = await create_skill(
            client, test_project.headers,
            name="dup-skill", description="For dup test",
        )

        # Include first time
        resp1 = await client.post(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            json={"skill_id": skill["id"]},
            headers=test_project.headers,
        )
        assert resp1.status_code in (200, 201)

        # Include second time — should conflict
        resp2 = await client.post(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}/skills",
            json={"skill_id": skill["id"]},
            headers=test_project.headers,
        )
        assert resp2.status_code == 409, (
            f"Expected 409 for duplicate skill inclusion, got {resp2.status_code}: {resp2.text}"
        )

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{space['id']}",
            headers=test_project.headers,
        )
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_filter_by_meta(test_project: ProjectCredentials):
    """List with filter_by_meta JSONB containment."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        # Create spaces with different meta
        s1 = await create_learning_space(
            client, test_project.headers,
            meta={"env": "prod", "team": "alpha"},
        )
        s2 = await create_learning_space(
            client, test_project.headers,
            meta={"env": "staging", "team": "beta"},
        )
        s3 = await create_learning_space(
            client, test_project.headers,
            meta={"env": "prod", "team": "beta"},
        )

        # Filter for env=prod
        resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces",
            params={"filter_by_meta": json.dumps({"env": "prod"})},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]["items"]
        result_ids = {item["id"] for item in items}
        assert s1["id"] in result_ids
        assert s3["id"] in result_ids
        assert s2["id"] not in result_ids

        # Cleanup
        for sid in [s1["id"], s2["id"], s3["id"]]:
            await client.delete(
                f"{API_URL}/api/v1/learning_spaces/{sid}",
                headers=test_project.headers,
            )
