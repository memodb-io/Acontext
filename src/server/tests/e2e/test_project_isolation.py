"""E2E tests for cross-project isolation.

Every test creates a resource in project A and then attempts to access it
with project B's credentials, asserting that it fails with 400/403/404.
"""

import io
import logging
import uuid
import zipfile

import httpx
import pytest

from conftest import (
    API_URL,
    db_conn,
    test_project,
    wait_for_services,
    create_session,
    send_message,
    create_disk,
    upload_artifact,
    download_artifact,
    ProjectCredentials,
)

logger = logging.getLogger(__name__)

DENIED_STATUSES = {400, 403, 404}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_skill_zip(name: str = "iso-skill") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("SKILL.md", f"---\nname: {name}\ndescription: isolation test\n---\nContent.\n")
    return buf.getvalue()


# ===========================================================================
# Session endpoints
# ===========================================================================

@pytest.mark.asyncio
async def test_cross_project_get_messages(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        await send_message(client, session_id, "hello", test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_store_message(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            json={"format": "acontext", "blob": {"role": "user", "parts": [{"type": "text", "text": "x"}]}},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_delete_session(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.delete(
            f"{API_URL}/api/v1/session/{session_id}",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_get_configs(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/configs",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_update_configs(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.put(
            f"{API_URL}/api/v1/session/{session_id}/configs",
            json={"configs": {"key": "val"}},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_patch_configs(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.patch(
            f"{API_URL}/api/v1/session/{session_id}/configs",
            json={"configs": {"key": "val"}},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_copy_session(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/copy",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_patch_message_meta(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        msg_id = await send_message(client, session_id, "hello", test_project.headers)

        resp = await client.patch(
            f"{API_URL}/api/v1/session/{session_id}/messages/{msg_id}/meta",
            json={"meta": {"x": 1}},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_download_asset(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/asset/download",
            params={"s3_key": f"assets/{test_project.project_id}/fake.bin"},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_flush_session(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/flush",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


# ===========================================================================
# Session events
# ===========================================================================

@pytest.mark.asyncio
async def test_cross_project_add_event(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/events",
            json={"type": "test_event", "data": {"x": 1}},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


@pytest.mark.asyncio
async def test_cross_project_get_events(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/events",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


# ===========================================================================
# Disk / Artifact
# ===========================================================================

@pytest.mark.asyncio
async def test_cross_project_delete_disk(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)

        resp = await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        # Cleanup
        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_upload_artifact(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact",
            files={"file": ("test.txt", b"data", "text/plain")},
            data={"file_path": "/"},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_upload_from_sandbox(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact/upload_from_sandbox",
            json={
                "sandbox_id": str(uuid.uuid4()),
                "sandbox_path": "/tmp",
                "sandbox_filename": "test.txt",
                "file_path": "/",
            },
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_download_artifact(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(client, disk_id, test_project.headers)

        resp = await download_artifact(client, disk_id, "/test.txt", second_project.headers)
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_list_artifacts(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact/ls",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_delete_artifact(test_project: ProjectCredentials, second_project: ProjectCredentials):
    """V2: DELETE /disk/:id/artifact must check disk ownership."""
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(client, disk_id, test_project.headers)

        resp = await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact",
            params={"file_path": "/test.txt"},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        # Verify artifact still exists for the real owner
        get_resp = await client.get(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact",
            params={"file_path": "/test.txt"},
            headers=test_project.headers,
        )
        assert get_resp.status_code == 200

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_update_artifact(test_project: ProjectCredentials, second_project: ProjectCredentials):
    """V3: PUT /disk/:id/artifact must check disk ownership."""
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(client, disk_id, test_project.headers)

        resp = await client.put(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact",
            json={"file_path": "/test.txt", "meta": '{"evil": true}'},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_download_to_sandbox(test_project: ProjectCredentials, second_project: ProjectCredentials):
    """V5: POST /disk/:id/artifact/download_to_sandbox must check disk ownership."""
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(client, disk_id, test_project.headers)

        resp = await client.post(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact/download_to_sandbox",
            json={
                "file_path": "/",
                "filename": "test.txt",
                "sandbox_id": str(uuid.uuid4()),
                "sandbox_path": "/tmp",
            },
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/disk/{disk_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_get_tasks(test_project: ProjectCredentials, second_project: ProjectCredentials):
    """V1: GET /session/:id/task must check session ownership."""
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/task",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES


# ===========================================================================
# Agent Skills
# ===========================================================================

@pytest.mark.asyncio
async def test_cross_project_get_skill(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        zip_bytes = make_skill_zip("iso-get")
        create_resp = await client.post(
            f"{API_URL}/api/v1/agent_skills",
            files={"file": ("skill.zip", zip_bytes, "application/zip")},
            headers=test_project.headers,
        )
        assert create_resp.status_code in (200, 201)
        skill_id = create_resp.json()["data"]["id"]

        resp = await client.get(
            f"{API_URL}/api/v1/agent_skills/{skill_id}",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/agent_skills/{skill_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_delete_skill(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        zip_bytes = make_skill_zip("iso-del")
        create_resp = await client.post(
            f"{API_URL}/api/v1/agent_skills",
            files={"file": ("skill.zip", zip_bytes, "application/zip")},
            headers=test_project.headers,
        )
        assert create_resp.status_code in (200, 201)
        skill_id = create_resp.json()["data"]["id"]

        resp = await client.delete(
            f"{API_URL}/api/v1/agent_skills/{skill_id}",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/agent_skills/{skill_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_get_skill_file(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        zip_bytes = make_skill_zip("iso-file")
        create_resp = await client.post(
            f"{API_URL}/api/v1/agent_skills",
            files={"file": ("skill.zip", zip_bytes, "application/zip")},
            headers=test_project.headers,
        )
        assert create_resp.status_code in (200, 201)
        skill_id = create_resp.json()["data"]["id"]

        resp = await client.get(
            f"{API_URL}/api/v1/agent_skills/{skill_id}/files/SKILL.md",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/agent_skills/{skill_id}", headers=test_project.headers)


# ===========================================================================
# Learning Spaces
# ===========================================================================

@pytest.mark.asyncio
async def test_cross_project_get_learning_space(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        create_resp = await client.post(
            f"{API_URL}/api/v1/learning_spaces",
            json={},
            headers=test_project.headers,
        )
        assert create_resp.status_code in (200, 201)
        ls_id = create_resp.json()["data"]["id"]

        resp = await client.get(
            f"{API_URL}/api/v1/learning_spaces/{ls_id}",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/learning_spaces/{ls_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_update_learning_space(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        create_resp = await client.post(
            f"{API_URL}/api/v1/learning_spaces",
            json={},
            headers=test_project.headers,
        )
        assert create_resp.status_code in (200, 201)
        ls_id = create_resp.json()["data"]["id"]

        resp = await client.put(
            f"{API_URL}/api/v1/learning_spaces/{ls_id}",
            json={"meta": {"env": "hack"}},
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        await client.delete(f"{API_URL}/api/v1/learning_spaces/{ls_id}", headers=test_project.headers)


@pytest.mark.asyncio
async def test_cross_project_delete_learning_space(test_project: ProjectCredentials, second_project: ProjectCredentials):
    assert await wait_for_services()
    async with httpx.AsyncClient() as client:
        create_resp = await client.post(
            f"{API_URL}/api/v1/learning_spaces",
            json={},
            headers=test_project.headers,
        )
        assert create_resp.status_code in (200, 201)
        ls_id = create_resp.json()["data"]["id"]

        resp = await client.delete(
            f"{API_URL}/api/v1/learning_spaces/{ls_id}",
            headers=second_project.headers,
        )
        assert resp.status_code in DENIED_STATUSES

        # Cleanup with correct project
        await client.delete(f"{API_URL}/api/v1/learning_spaces/{ls_id}", headers=test_project.headers)
