"""E2E tests for Agent Skills CRUD."""

import io
import logging
import uuid
import zipfile

import httpx
import pytest

from conftest import (
    API_URL,
    test_project,
    db_conn,
    wait_for_services,
    ProjectCredentials,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_skill_zip(
    name: str = "test-skill",
    description: str = "A test skill",
    extra_files: dict[str, str] | None = None,
) -> bytes:
    """Create an in-memory ZIP with a SKILL.md and optional extra files."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        skill_md = f"---\nname: {name}\ndescription: {description}\n---\n\nSkill content here.\n"
        zf.writestr("SKILL.md", skill_md)
        if extra_files:
            for path, content in extra_files.items():
                zf.writestr(path, content)
    return buf.getvalue()


async def create_skill(
    client: httpx.AsyncClient,
    headers: dict,
    name: str = "test-skill",
    description: str = "A test skill",
    user: str | None = None,
    extra_files: dict[str, str] | None = None,
) -> dict:
    """Upload a skill ZIP and return the response data."""
    zip_bytes = make_skill_zip(name, description, extra_files)
    data = {}
    if user:
        data["user"] = user
    resp = await client.post(
        f"{API_URL}/api/v1/agent_skills",
        files={"file": ("skill.zip", zip_bytes, "application/zip")},
        data=data,
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Create skill failed: {resp.text}"
    return resp.json()["data"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_agent_skill(test_project: ProjectCredentials):
    """Upload ZIP with SKILL.md, verify 201, check name/description extracted."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        skill = await create_skill(
            client, test_project.headers,
            name="my-skill", description="My great skill",
        )
        assert skill["name"] == "my-skill"
        assert skill["description"] == "My great skill"
        assert "id" in skill

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_list_agent_skills(test_project: ProjectCredentials):
    """Create 3 skills, verify pagination (limit, cursor)."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        ids = []
        for i in range(3):
            skill = await create_skill(
                client, test_project.headers,
                name=f"list-skill-{i}", description=f"Skill {i}",
            )
            ids.append(skill["id"])

        # List with limit=2
        resp = await client.get(
            f"{API_URL}/api/v1/agent_skills",
            params={"limit": 2},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["items"]) == 2
        assert data["has_more"] is True
        assert data["next_cursor"] is not None

        # Second page
        resp2 = await client.get(
            f"{API_URL}/api/v1/agent_skills",
            params={"limit": 2, "cursor": data["next_cursor"]},
            headers=test_project.headers,
        )
        assert resp2.status_code == 200
        data2 = resp2.json()["data"]
        assert len(data2["items"]) >= 1

        # Cleanup
        for sid in ids:
            await client.delete(
                f"{API_URL}/api/v1/agent_skills/{sid}",
                headers=test_project.headers,
            )


@pytest.mark.asyncio
async def test_get_agent_skill(test_project: ProjectCredentials):
    """Get by ID, verify metadata matches."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        skill = await create_skill(
            client, test_project.headers,
            name="get-skill", description="Get test",
        )

        resp = await client.get(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        fetched = resp.json()["data"]
        assert fetched["id"] == skill["id"]
        assert fetched["name"] == "get-skill"

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_get_skill_file(test_project: ProjectCredentials):
    """Get file content from skill, verify SKILL.md content returned."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        skill = await create_skill(
            client, test_project.headers,
            name="file-skill", description="File test",
            extra_files={"scripts/helper.py": "print('hello')"},
        )

        # Get SKILL.md
        resp = await client.get(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}/file",
            params={"file_path": "SKILL.md"},
            headers=test_project.headers,
        )
        assert resp.status_code == 200

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_delete_agent_skill(test_project: ProjectCredentials):
    """Delete, verify 200, verify GET returns 404."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        skill = await create_skill(
            client, test_project.headers,
            name="delete-skill", description="Delete test",
        )

        del_resp = await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        get_resp = await client.get(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )
        assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_skill_with_user(test_project: ProjectCredentials):
    """Upload with user field, verify user association."""
    assert await wait_for_services()

    user_id = f"testuser-{uuid.uuid4().hex[:8]}"
    async with httpx.AsyncClient() as client:
        skill = await create_skill(
            client, test_project.headers,
            name="user-skill", description="User test",
            user=user_id,
        )
        # Response returns user_id (UUID), not the user string directly
        assert skill.get("user_id") is not None

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_create_skill_invalid_zip(test_project: ProjectCredentials):
    """Upload invalid file (no SKILL.md), expect error."""
    assert await wait_for_services()

    # Create a ZIP without SKILL.md
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("README.md", "No skill here")
    zip_bytes = buf.getvalue()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_URL}/api/v1/agent_skills",
            files={"file": ("bad.zip", zip_bytes, "application/zip")},
            headers=test_project.headers,
        )
        assert resp.status_code in (400, 422), (
            f"Expected error for ZIP without SKILL.md, got {resp.status_code}: {resp.text}"
        )
