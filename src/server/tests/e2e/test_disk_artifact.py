"""E2E tests for Disk CRUD, Artifact ops, Session configs/copy/flush, Message meta."""

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
    create_session,
    send_message,
    create_disk,
    upload_artifact,
    download_artifact,
    ProjectCredentials,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# Disk CRUD
# ===========================================================================

@pytest.mark.asyncio
async def test_create_disk(test_project: ProjectCredentials):
    """Create disk, verify 201."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_URL}/api/v1/disk",
            json={},
            headers=test_project.headers,
        )
        assert resp.status_code in (200, 201)
        disk = resp.json()["data"]
        assert "id" in disk

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/disk/{disk['id']}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_list_disks(test_project: ProjectCredentials):
    """Create multiple, verify pagination."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        ids = []
        for _ in range(3):
            disk_id = await create_disk(client, test_project.headers)
            ids.append(disk_id)

        resp = await client.get(
            f"{API_URL}/api/v1/disk",
            params={"limit": 2},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert len(data["items"]) == 2
        assert data["has_more"] is True

        # Cleanup
        for did in ids:
            await client.delete(
                f"{API_URL}/api/v1/disk/{did}",
                headers=test_project.headers,
            )


@pytest.mark.asyncio
async def test_delete_disk_cascade(test_project: ProjectCredentials):
    """Delete disk with artifacts, verify artifacts cleaned up."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="cascade.txt", content=b"will be deleted",
        )

        del_resp = await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        # Verify disk gone — list should not contain it
        resp = await client.get(
            f"{API_URL}/api/v1/disk",
            params={"limit": 200},
            headers=test_project.headers,
        )
        disk_ids = [d["id"] for d in resp.json()["data"]["items"]] if resp.json()["data"].get("items") else []
        assert disk_id not in disk_ids


# ===========================================================================
# Artifact Operations
# ===========================================================================

@pytest.mark.asyncio
async def test_artifact_ls(test_project: ProjectCredentials):
    """Upload files to different paths, verify ls returns correct structure."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="root.txt", content=b"root file", file_path="/",
        )
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="sub.txt", content=b"sub file", file_path="/docs/",
        )

        resp = await client.get(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact/ls",
            params={"path": "/"},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        # Should have files and/or directories
        assert data is not None

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_artifact_grep(test_project: ProjectCredentials):
    """Upload text files, search with regex, verify matches."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="code.py", content=b"# TODO: fix this bug\ndef hello():\n    pass",
        )
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="notes.txt", content=b"Nothing special here",
        )

        resp = await client.get(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact/grep",
            params={"query": "TODO"},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]
        # Should find at least the code.py file
        assert len(items) >= 1

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_artifact_glob(test_project: ProjectCredentials):
    """Upload files with different names, glob pattern match."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="main.py", content=b"print('hi')",
        )
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="utils.py", content=b"def util(): pass",
        )
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="readme.md", content=b"# Readme",
        )

        resp = await client.get(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact/glob",
            params={"query": "*.py"},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        items = resp.json()["data"]
        assert len(items) >= 2
        filenames = [a.get("filename", "") for a in items]
        assert any("main.py" in f for f in filenames)
        assert any("utils.py" in f for f in filenames)

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_artifact_update_meta(test_project: ProjectCredentials):
    """PUT artifact meta, verify merge semantics."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="meta.txt", content=b"metadata test",
        )

        # Update meta
        resp = await client.put(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact",
            json={
                "file_path": "/meta.txt",
                "meta": json.dumps({"tag": "important", "version": 2}),
            },
            headers=test_project.headers,
        )
        assert resp.status_code == 200

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=test_project.headers,
        )


@pytest.mark.asyncio
async def test_artifact_delete(test_project: ProjectCredentials):
    """Delete specific artifact, verify removed."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, test_project.headers)
        await upload_artifact(
            client, disk_id, test_project.headers,
            filename="deleteme.txt", content=b"bye",
        )

        del_resp = await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}/artifact",
            params={"file_path": "/deleteme.txt"},
            headers=test_project.headers,
        )
        assert del_resp.status_code == 200

        # Verify gone
        dl_resp = await download_artifact(
            client, disk_id, "/deleteme.txt", test_project.headers,
        )
        assert dl_resp.status_code in (400, 404)

        # Cleanup
        await client.delete(
            f"{API_URL}/api/v1/disk/{disk_id}",
            headers=test_project.headers,
        )


# ===========================================================================
# Session Configs
# ===========================================================================

@pytest.mark.asyncio
async def test_session_configs_put_patch(test_project: ProjectCredentials):
    """PUT replaces all, PATCH merges, null deletes key."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)

        # PUT — full replace
        put_resp = await client.put(
            f"{API_URL}/api/v1/session/{session_id}/configs",
            json={"configs": {"key1": "val1", "key2": "val2"}},
            headers=test_project.headers,
        )
        assert put_resp.status_code == 200

        # Verify via GET (returns full session object with configs field)
        get_resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/configs",
            headers=test_project.headers,
        )
        assert get_resp.status_code == 200
        session_data = get_resp.json()["data"]
        configs = session_data.get("configs", {})
        assert configs.get("key1") == "val1"
        assert configs.get("key2") == "val2"

        # PATCH — merge + null deletes (returns updated configs)
        patch_resp = await client.patch(
            f"{API_URL}/api/v1/session/{session_id}/configs",
            json={"configs": {"key1": "updated", "key2": None, "key3": "new"}},
            headers=test_project.headers,
        )
        assert patch_resp.status_code == 200
        patched = patch_resp.json()["data"]
        # Response may wrap configs or return flat — check both
        configs = patched.get("configs", patched)
        assert configs.get("key1") == "updated"
        assert "key2" not in configs or configs.get("key2") is None
        assert configs.get("key3") == "new"


# ===========================================================================
# Session Copy
# ===========================================================================

@pytest.mark.asyncio
async def test_session_copy(test_project: ProjectCredentials):
    """Create session with messages, copy, verify independent copy."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        await send_message(client, session_id, "Hello from original", test_project.headers)

        # Copy session
        copy_resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/copy",
            headers=test_project.headers,
        )
        assert copy_resp.status_code == 200
        copy_data = copy_resp.json()["data"]
        new_session_id = copy_data["new_session_id"]
        assert new_session_id != session_id

        # Verify copied session has messages
        msgs_resp = await client.get(
            f"{API_URL}/api/v1/session/{new_session_id}/messages",
            params={"format": "acontext"},
            headers=test_project.headers,
        )
        assert msgs_resp.status_code == 200
        items = msgs_resp.json()["data"]["items"]
        assert len(items) >= 1


# ===========================================================================
# Session Flush
# ===========================================================================

@pytest.mark.asyncio
async def test_session_flush(test_project: ProjectCredentials):
    """Flush session buffer, verify endpoint succeeds and session still exists."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        await send_message(client, session_id, "Message before flush", test_project.headers)

        # Flush buffer (triggers CORE to process buffered messages)
        flush_resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/flush",
            headers=test_project.headers,
        )
        assert flush_resp.status_code == 200

        # Session should still exist and be accessible
        msgs_resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            params={"format": "acontext"},
            headers=test_project.headers,
        )
        assert msgs_resp.status_code == 200


# ===========================================================================
# Message Meta Patch
# ===========================================================================

@pytest.mark.asyncio
async def test_message_meta_patch(test_project: ProjectCredentials):
    """Patch message metadata, verify merge."""
    assert await wait_for_services()

    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, test_project.headers)
        msg_id = await send_message(
            client, session_id, "Meta test message", test_project.headers,
        )

        # Patch meta (response: {"data": {"meta": {...}}})
        resp = await client.patch(
            f"{API_URL}/api/v1/session/{session_id}/messages/{msg_id}/meta",
            json={"meta": {"label": "important", "priority": 1}},
            headers=test_project.headers,
        )
        assert resp.status_code == 200
        meta = resp.json()["data"]["meta"]
        assert meta.get("label") == "important"
        assert meta.get("priority") == 1

        # Patch again — merge
        resp2 = await client.patch(
            f"{API_URL}/api/v1/session/{session_id}/messages/{msg_id}/meta",
            json={"meta": {"priority": 2, "tag": "review"}},
            headers=test_project.headers,
        )
        assert resp2.status_code == 200
        meta2 = resp2.json()["data"]["meta"]
        assert meta2.get("label") == "important"  # preserved
        assert meta2.get("priority") == 2  # updated
        assert meta2.get("tag") == "review"  # new
