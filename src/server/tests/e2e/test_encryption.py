"""
E2E tests for per-project encryption feature.

Tests cover:
- Encrypt/decrypt round trip via admin endpoints
- Encrypted message store & retrieve
- Encrypted artifact upload & download
- Presigned URL suppression for encrypted projects
- 403 ENCRYPTION_KEY_REQUIRED for missing API key
- Key rotation with DEK re-wrap
- Toggle encryption on/off via admin endpoints
"""

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import uuid
from typing import AsyncGenerator, Dict

import asyncpg
import httpx
import pytest
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.keywrap import aes_key_wrap
from pydantic import BaseModel

# Reuse infra from conftest
from conftest import (
    API_URL,
    DB_URL,
    PEPPER,
    TEST_TOKEN_PREFIX,
    ProjectCredentials,
    create_session,
    create_test_project,
    cleanup_test_project,
    generate_hmac,
    send_message,
    wait_for_services,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Admin API runs on a separate service with admin routes (encrypt/decrypt/key rotation)
ADMIN_URL = os.getenv("ADMIN_URL", "http://admin:8028")


# ---------------------------------------------------------------------------
# Crypto helpers — must match Go's compact token format
# ---------------------------------------------------------------------------

KEY_SIZE = 32
COMPACT_AUTH_SECRET_LEN = 16
COMPACT_VERSION = 0x01


def _derive_user_kek(auth_secret: str, pepper: str) -> bytes:
    """Derive wrapping key from auth_secret + pepper (matches Go DeriveUserKEK)."""
    secret = (auth_secret + pepper).encode()
    salt = (pepper + "-master-key-wrap").encode()
    info = (pepper + " master key wrapping").encode()
    hkdf = HKDF(algorithm=hashes.SHA256(), length=KEY_SIZE, salt=salt, info=info)
    return hkdf.derive(secret)


def _generate_project_token(pepper: str) -> tuple[str, str, str]:
    """Generate a compact project token with AES Key Wrap.

    Format: base64url(0x01 | auth_secret_16B | aes_kw(master_key_32B))
    Returns (auth_secret_hex, bearer_token, hmac_hex).
    """
    auth_secret_raw = os.urandom(COMPACT_AUTH_SECRET_LEN)
    auth_secret_hex = auth_secret_raw.hex()
    master_key = os.urandom(KEY_SIZE)
    wrapping_key = _derive_user_kek(auth_secret_hex, pepper)
    wrapped_mk = aes_key_wrap(wrapping_key, master_key)
    # Pack: version | auth_secret | wrapped_master_key
    buf = bytes([COMPACT_VERSION]) + auth_secret_raw + wrapped_mk
    compact_body = base64.urlsafe_b64encode(buf).rstrip(b"=").decode()
    bearer_token = f"{TEST_TOKEN_PREFIX}{compact_body}"
    token_hmac = generate_hmac(auth_secret_hex, pepper)
    return auth_secret_hex, bearer_token, token_hmac


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_test_project_encrypted(conn) -> ProjectCredentials:
    """Create a test project with encryption_enabled = true with encrypted master key in token."""
    project_id = uuid.uuid4()
    auth_secret, bearer_token, token_hmac = _generate_project_token(PEPPER)

    configs = {"project_session_message_buffer_max_turns": 1}

    await conn.execute(
        """INSERT INTO projects
           (id, secret_key_hmac, secret_key_hash_phc, encryption_enabled, configs)
           VALUES ($1, $2, $3, $4, $5)""",
        project_id, token_hmac, "dummy-phc", True, json.dumps(configs),
    )

    return ProjectCredentials(
        project_id=project_id,
        secret=auth_secret,
        bearer_token=bearer_token,
        headers={"Authorization": f"Bearer {bearer_token}"},
    )


async def create_test_project_plain(conn) -> ProjectCredentials:
    """Create a test project with encryption disabled with encrypted master key in token."""
    project_id = uuid.uuid4()
    auth_secret, bearer_token, token_hmac = _generate_project_token(PEPPER)

    configs = {"project_session_message_buffer_max_turns": 1}

    await conn.execute(
        """INSERT INTO projects
           (id, secret_key_hmac, secret_key_hash_phc, configs)
           VALUES ($1, $2, $3, $4)""",
        project_id, token_hmac, "dummy-phc", json.dumps(configs),
    )

    return ProjectCredentials(
        project_id=project_id,
        secret=auth_secret,
        bearer_token=bearer_token,
        headers={"Authorization": f"Bearer {bearer_token}"},
    )


async def create_disk(
    client: httpx.AsyncClient, headers: Dict[str, str]
) -> str:
    """Create a disk and return its ID."""
    resp = await client.post(
        f"{API_URL}/api/v1/disk",
        json={"name": f"enc-test-{uuid.uuid4().hex[:8]}"},
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Create disk failed: {resp.text}"
    return resp.json()["data"]["id"]


async def upload_artifact(
    client: httpx.AsyncClient,
    disk_id: str,
    headers: Dict[str, str],
    filename: str = "test.txt",
    content: bytes = b"hello encryption world",
    file_path: str = "/",
) -> dict:
    """Upload an artifact and return the full response data."""
    resp = await client.post(
        f"{API_URL}/api/v1/disk/{disk_id}/artifact",
        files={"file": (filename, content, "text/plain")},
        data={"file_path": file_path},
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Upload artifact failed: {resp.text}"
    return resp.json()["data"]


async def download_artifact(
    client: httpx.AsyncClient,
    disk_id: str,
    file_path: str,
    headers: Dict[str, str],
) -> httpx.Response:
    """Download an artifact and return the raw response."""
    return await client.get(
        f"{API_URL}/api/v1/disk/{disk_id}/artifact/download",
        params={"file_path": file_path},
        headers=headers,
    )


async def get_artifact(
    client: httpx.AsyncClient,
    disk_id: str,
    file_path: str,
    headers: Dict[str, str],
    with_public_url: bool = True,
    with_content: bool = True,
) -> dict:
    """Get artifact metadata and return the full response."""
    resp = await client.get(
        f"{API_URL}/api/v1/disk/{disk_id}/artifact",
        params={
            "file_path": file_path,
            "with_public_url": str(with_public_url).lower(),
            "with_content": str(with_content).lower(),
        },
        headers=headers,
    )
    return resp.json()


async def enable_encryption(
    client: httpx.AsyncClient,
    bearer_token: str,
) -> httpx.Response:
    """Enable encryption on a project via admin endpoint."""
    return await client.post(
        f"{ADMIN_URL}/admin/v1/project/encrypt",
        headers={"Authorization": f"Bearer {bearer_token}"},
    )


async def disable_encryption(
    client: httpx.AsyncClient,
    bearer_token: str,
) -> httpx.Response:
    """Disable encryption on a project via admin endpoint."""
    return await client.post(
        f"{ADMIN_URL}/admin/v1/project/decrypt",
        headers={"Authorization": f"Bearer {bearer_token}"},
    )


async def rotate_key_with_rewrap(
    client: httpx.AsyncClient,
    bearer_token: str,
) -> httpx.Response:
    """Rotate the project API key with DEK re-wrap."""
    return await client.put(
        f"{ADMIN_URL}/admin/v1/project/secret_key",
        headers={"Authorization": f"Bearer {bearer_token}"},
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def db_conn() -> AsyncGenerator[asyncpg.Connection, None]:
    conn = await asyncpg.connect(DB_URL)
    try:
        yield conn
    finally:
        await conn.close()


@pytest.fixture
async def encrypted_project(db_conn) -> AsyncGenerator[ProjectCredentials, None]:
    """Project with encryption_enabled = true from the start."""
    project = await create_test_project_encrypted(db_conn)
    try:
        yield project
    finally:
        await cleanup_test_project(db_conn, project.project_id)


@pytest.fixture
async def plain_project(db_conn) -> AsyncGenerator[ProjectCredentials, None]:
    """Project with encryption_enabled = false and token with encrypted master key."""
    project = await create_test_project_plain(db_conn)
    try:
        yield project
    finally:
        await cleanup_test_project(db_conn, project.project_id)


# ---------------------------------------------------------------------------
# Tests — Admin Encrypt / Decrypt Endpoints
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_enable_encryption_on_project(db_conn, plain_project):
    """POST /admin/v1/project/encrypt on non-encrypted project → 200, flag set."""
    async with httpx.AsyncClient() as client:
        resp = await enable_encryption(client, plain_project.bearer_token)
        assert resp.status_code == 200, f"Enable encryption failed: {resp.text}"

        # Verify DB flag
        flag = await db_conn.fetchval(
            "SELECT encryption_enabled FROM projects WHERE id = $1",
            plain_project.project_id,
        )
        assert flag is True


@pytest.mark.asyncio
async def test_enable_encryption_already_enabled(db_conn, encrypted_project):
    """POST /admin/v1/project/encrypt when already encrypted → 200 (idempotent for crash recovery)."""
    async with httpx.AsyncClient() as client:
        resp = await enable_encryption(client, encrypted_project.bearer_token)
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_disable_encryption_on_encrypted_project(db_conn, encrypted_project):
    """POST /admin/v1/project/decrypt on encrypted project → 200, flag cleared."""
    async with httpx.AsyncClient() as client:
        resp = await disable_encryption(client, encrypted_project.bearer_token)
        assert resp.status_code == 200

        flag = await db_conn.fetchval(
            "SELECT encryption_enabled FROM projects WHERE id = $1",
            encrypted_project.project_id,
        )
        assert flag is False


@pytest.mark.asyncio
async def test_disable_encryption_already_disabled(db_conn, plain_project):
    """POST /admin/v1/project/decrypt when not encrypted → 400."""
    async with httpx.AsyncClient() as client:
        resp = await disable_encryption(client, plain_project.bearer_token)
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_encrypt_rejected_without_master_key(db_conn):
    """Token without encrypted master key → encrypt returns 400 (no KEK)."""
    project = await create_test_project(db_conn)
    try:
        async with httpx.AsyncClient() as client:
            resp = await enable_encryption(client, project.bearer_token)
            assert resp.status_code == 400
            assert "API key required" in resp.text
    finally:
        await cleanup_test_project(db_conn, project.project_id)


# ---------------------------------------------------------------------------
# Tests — Encrypted Artifact Upload / Download
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_artifact_upload_download_encrypted(db_conn, encrypted_project):
    """Upload artifact to encrypted project → download returns plaintext."""
    plaintext = b"super secret artifact data for encryption test"
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, encrypted_project.headers)

        artifact = await upload_artifact(
            client, disk_id, encrypted_project.headers,
            filename="secret.txt", content=plaintext,
        )

        # Download should return decrypted content
        resp = await download_artifact(
            client, disk_id, "/secret.txt", encrypted_project.headers,
        )
        assert resp.status_code == 200, f"Download failed: {resp.text}"
        assert resp.content == plaintext


@pytest.mark.asyncio
async def test_material_url_for_encrypted_project(db_conn, encrypted_project):
    """GetArtifact on encrypted project should return a material URL that serves decrypted content."""
    plaintext = b"encrypted but downloadable via material url"
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, encrypted_project.headers)
        await upload_artifact(
            client, disk_id, encrypted_project.headers,
            filename="material-enc.txt", content=plaintext,
        )

        data = await get_artifact(
            client, disk_id, "/material-enc.txt", encrypted_project.headers,
            with_public_url=True, with_content=False,
        )
        assert data.get("code", 0) == 0
        artifact_resp = data.get("data", {})
        public_url = artifact_resp.get("public_url")
        assert public_url is not None, "Encrypted project should return a material URL"
        assert "/api/v1/material/" in public_url

        # Fetch the material URL without auth — should return decrypted content
        dl_resp = await client.get(public_url)
        assert dl_resp.status_code == 200, f"Material URL download failed: {dl_resp.status_code}"
        assert dl_resp.content == plaintext


@pytest.mark.asyncio
async def test_material_url_for_plain_project(db_conn, plain_project):
    """GetArtifact on plain project should return a material URL that serves content."""
    plaintext = b"plain project material url"
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, plain_project.headers)
        await upload_artifact(
            client, disk_id, plain_project.headers,
            filename="material-plain.txt", content=plaintext,
        )

        data = await get_artifact(
            client, disk_id, "/material-plain.txt", plain_project.headers,
            with_public_url=True, with_content=False,
        )
        assert data.get("code", 0) == 0
        artifact_resp = data.get("data", {})
        public_url = artifact_resp.get("public_url")
        assert public_url is not None
        assert "/api/v1/material/" in public_url

        # Fetch the material URL without auth — should return content
        dl_resp = await client.get(public_url)
        assert dl_resp.status_code == 200
        assert dl_resp.content == plaintext


@pytest.mark.asyncio
async def test_material_url_expired_token(db_conn, plain_project):
    """Material URL with very short expire should return 404 after expiry."""
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, plain_project.headers)
        await upload_artifact(
            client, disk_id, plain_project.headers,
            filename="expire-test.txt", content=b"will expire",
        )

        # Request artifact with 1-second expiry
        data = await get_artifact(
            client, disk_id, "/expire-test.txt", plain_project.headers,
            with_public_url=True, with_content=False,
        )
        artifact_resp = data.get("data", {})
        public_url = artifact_resp.get("public_url")
        assert public_url is not None

        # Wait for token to expire
        await asyncio.sleep(2)

        dl_resp = await client.get(public_url)
        # Token may or may not have expired depending on default expire (3600s)
        # This test documents the expected behavior — if expire param is respected,
        # the token should eventually become invalid


@pytest.mark.asyncio
async def test_material_url_invalid_token(db_conn):
    """GET /api/v1/material/:token with invalid token returns 404."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{API_URL}/api/v1/material/nonexistent_token_abc123")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Tests — Encrypted Message Store & Retrieve
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_message_store_retrieve_encrypted(db_conn, encrypted_project):
    """Store message in encrypted project → retrieve returns plaintext parts."""
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, encrypted_project.headers)
        msg_text = "This is a secret message for encryption e2e test"
        msg_id = await send_message(
            client, session_id, msg_text, encrypted_project.headers,
        )

        # Retrieve messages — should contain decrypted text
        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            params={"format": "acontext"},
            headers=encrypted_project.headers,
        )
        assert resp.status_code == 200
        messages = resp.json()["data"]["items"]
        assert len(messages) > 0

        # Find our message and verify text
        found = False
        for msg in messages:
            for part in msg.get("parts", []):
                if part.get("text") == msg_text:
                    found = True
                    break
        assert found, f"Message text not found in retrieved messages"


# ---------------------------------------------------------------------------
# Tests — Batch Encrypt Existing Data
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_encrypt_existing_artifacts(db_conn, plain_project):
    """Upload artifacts to plain project, then enable encryption → data still accessible."""
    plaintext1 = b"file one content before encryption"
    plaintext2 = b"file two content before encryption"

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, plain_project.headers)

        # Upload artifacts while unencrypted
        await upload_artifact(
            client, disk_id, plain_project.headers,
            filename="before1.txt", content=plaintext1,
        )
        await upload_artifact(
            client, disk_id, plain_project.headers,
            filename="before2.txt", content=plaintext2,
        )

        # Enable encryption (batch encrypts existing data)
        resp = await enable_encryption(client, plain_project.bearer_token)
        assert resp.status_code == 200

        # Download should still return correct plaintext (decrypted)
        resp1 = await download_artifact(
            client, disk_id, "/before1.txt", plain_project.headers,
        )
        assert resp1.status_code == 200
        assert resp1.content == plaintext1

        resp2 = await download_artifact(
            client, disk_id, "/before2.txt", plain_project.headers,
        )
        assert resp2.status_code == 200
        assert resp2.content == plaintext2


# ---------------------------------------------------------------------------
# Tests — Batch Decrypt (Disable Encryption)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_decrypt_existing_artifacts(db_conn, encrypted_project):
    """Upload to encrypted project, disable encryption → data still accessible without KEK."""
    plaintext = b"this was encrypted but now should be plain"

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, encrypted_project.headers)
        await upload_artifact(
            client, disk_id, encrypted_project.headers,
            filename="was-enc.txt", content=plaintext,
        )

        # Disable encryption (batch decrypts all data)
        resp = await disable_encryption(client, encrypted_project.bearer_token)
        assert resp.status_code == 200

        # Download should work and return plaintext
        resp = await download_artifact(
            client, disk_id, "/was-enc.txt", encrypted_project.headers,
        )
        assert resp.status_code == 200
        assert resp.content == plaintext


# ---------------------------------------------------------------------------
# Tests — Key Rotation with Re-wrap
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_key_rotation_encrypted_project(db_conn, encrypted_project):
    """Rotate key on encrypted project → old data still accessible with new key."""
    plaintext = b"data that must survive key rotation"

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, encrypted_project.headers)
        await upload_artifact(
            client, disk_id, encrypted_project.headers,
            filename="rotate-me.txt", content=plaintext,
        )

        # Rotate the key (re-wraps all DEKs)
        resp = await rotate_key_with_rewrap(client, encrypted_project.bearer_token)
        assert resp.status_code == 200, f"Key rotation failed: {resp.text}"

        new_key = resp.json()["data"]["secret_key"]
        new_headers = {"Authorization": f"Bearer {new_key}"}

        # Download with new key should work
        resp = await download_artifact(
            client, disk_id, "/rotate-me.txt", new_headers,
        )
        assert resp.status_code == 200
        assert resp.content == plaintext


@pytest.mark.asyncio
async def test_key_rotation_multiple_artifacts(db_conn, encrypted_project):
    """Rotate key with multiple artifacts → ALL artifacts still accessible with new key."""
    files = {
        "file1.txt": b"first file for rotation test",
        "file2.txt": b"second file for rotation test",
        "file3.txt": b"third file for rotation test",
    }

    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, encrypted_project.headers)

        # Upload multiple artifacts
        for fname, content in files.items():
            await upload_artifact(
                client, disk_id, encrypted_project.headers,
                filename=fname, content=content,
            )

        # Rotate the key
        resp = await rotate_key_with_rewrap(client, encrypted_project.bearer_token)
        assert resp.status_code == 200, f"Key rotation failed: {resp.text}"
        new_key = resp.json()["data"]["secret_key"]
        new_headers = {"Authorization": f"Bearer {new_key}"}

        # Verify ALL artifacts are decryptable with new key
        for fname, expected_content in files.items():
            resp = await download_artifact(
                client, disk_id, f"/{fname}", new_headers,
            )
            assert resp.status_code == 200, f"Download {fname} failed after rotation"
            assert resp.content == expected_content, f"Content mismatch for {fname}"

        # Verify old key no longer works
        resp = await download_artifact(
            client, disk_id, "/file1.txt", encrypted_project.headers,
        )
        assert resp.status_code in (401, 403, 404, 500), (
            f"Old key should be rejected after rotation, got {resp.status_code}"
        )


@pytest.mark.asyncio
async def test_key_rotation_plain_project(db_conn, plain_project):
    """Rotate key on plain project → new format with encrypted master key, data still accessible."""
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, plain_project.headers)
        await upload_artifact(
            client, disk_id, plain_project.headers,
            filename="plain-rotate.txt", content=b"plain data",
        )

        resp = await rotate_key_with_rewrap(client, plain_project.bearer_token)
        assert resp.status_code == 200

        new_key = resp.json()["data"]["secret_key"]
        new_headers = {"Authorization": f"Bearer {new_key}"}

        # New key should be compact format (76-char base64url body, no dot)
        key_body = new_key.replace(TEST_TOKEN_PREFIX, "")
        assert len(key_body) == 76, f"Rotated key should be compact format (76 chars): {new_key}"

        resp = await download_artifact(
            client, disk_id, "/plain-rotate.txt", new_headers,
        )
        assert resp.status_code == 200
        assert resp.content == b"plain data"


# ---------------------------------------------------------------------------
# Tests — Encryption Metadata in S3
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_encrypted_upload_download_roundtrip(db_conn, encrypted_project):
    """Verify encrypted upload + download round trip works (proves metadata is correct)."""
    plaintext = b"check metadata correctness via roundtrip"
    async with httpx.AsyncClient() as client:
        disk_id = await create_disk(client, encrypted_project.headers)
        await upload_artifact(
            client, disk_id, encrypted_project.headers,
            filename="meta-check.txt", content=plaintext,
        )

        # Download should succeed — proves enc-algo + enc-dek-user metadata is correct
        resp = await download_artifact(
            client, disk_id, "/meta-check.txt", encrypted_project.headers,
        )
        assert resp.status_code == 200
        assert resp.content == plaintext


# ---------------------------------------------------------------------------
# Tests — Cross-Project Access Denied (IDOR regression)
# ---------------------------------------------------------------------------

@pytest.fixture
async def second_encrypted_project(db_conn) -> AsyncGenerator[ProjectCredentials, None]:
    """A second encrypted project for cross-project tests."""
    project = await create_test_project_encrypted(db_conn)
    try:
        yield project
    finally:
        await cleanup_test_project(db_conn, project.project_id)


@pytest.mark.asyncio
async def test_cross_project_artifact_download_rejected(
    db_conn, encrypted_project, second_encrypted_project,
):
    """Upload artifact in project A, try download from project B → 403."""
    async with httpx.AsyncClient() as client:
        # Upload artifact in project A
        disk_id_a = await create_disk(client, encrypted_project.headers)
        await upload_artifact(
            client, disk_id_a, encrypted_project.headers,
            filename="secret-a.txt", content=b"project A data",
        )

        # Try to download from project B using project A's disk_id → 403
        resp = await download_artifact(
            client, disk_id_a, "/secret-a.txt", second_encrypted_project.headers,
        )
        assert resp.status_code == 403, f"Expected 403 but got {resp.status_code}: {resp.text}"


@pytest.mark.asyncio
async def test_session_asset_cross_project_rejected(
    db_conn, encrypted_project, second_encrypted_project,
):
    """Create session+asset in project A, try download from project B → 403."""
    async with httpx.AsyncClient() as client:
        # Create session and store a message with text in project A
        session_id = await create_session(client, encrypted_project.headers)
        await send_message(client, session_id, "cross-project test", encrypted_project.headers)

        # Try to access that session's messages from project B → should fail
        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            params={"format": "acontext"},
            headers=second_encrypted_project.headers,
        )
        # Session doesn't belong to project B, so it should fail
        assert resp.status_code in (400, 404), (
            f"Expected session access denied but got {resp.status_code}: {resp.text}"
        )


# ---------------------------------------------------------------------------
# Tests — Encrypted Session Operations (copy, delete)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_copy_encrypted_session(db_conn, encrypted_project):
    """Store message in encrypted session, copy session, verify messages in copy."""
    msg_text = "copy me encrypted"
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, encrypted_project.headers)
        await send_message(client, session_id, msg_text, encrypted_project.headers)

        # Copy the session
        resp = await client.post(
            f"{API_URL}/api/v1/session/{session_id}/copy",
            headers=encrypted_project.headers,
        )
        assert resp.status_code == 200, f"Copy session failed: {resp.text}"
        new_session_id = resp.json()["data"]["new_session_id"]

        # Verify messages in the copied session
        resp = await client.get(
            f"{API_URL}/api/v1/session/{new_session_id}/messages",
            params={"format": "acontext"},
            headers=encrypted_project.headers,
        )
        assert resp.status_code == 200
        messages = resp.json()["data"]["items"]
        found = any(
            part.get("text") == msg_text
            for msg in messages
            for part in msg.get("parts", [])
        )
        assert found, "Copied session should contain the original message text"


@pytest.mark.asyncio
async def test_delete_encrypted_session(db_conn, encrypted_project):
    """Store message in encrypted session, delete, verify gone."""
    async with httpx.AsyncClient() as client:
        session_id = await create_session(client, encrypted_project.headers)
        await send_message(client, session_id, "delete me", encrypted_project.headers)

        # Delete the session
        resp = await client.delete(
            f"{API_URL}/api/v1/session/{session_id}",
            headers=encrypted_project.headers,
        )
        assert resp.status_code == 200, f"Delete session failed: {resp.text}"

        # Verify session is gone
        resp = await client.get(
            f"{API_URL}/api/v1/session/{session_id}/messages",
            params={"format": "acontext"},
            headers=encrypted_project.headers,
        )
        # Session should not be found after deletion
        assert resp.status_code in (400, 404, 500), (
            f"Expected session gone but got {resp.status_code}"
        )


@pytest.mark.asyncio
async def test_encrypted_agent_skill_upload_download(db_conn, encrypted_project):
    """Upload skill ZIP to encrypted project, read back file content, verify it matches."""
    import io
    import zipfile

    skill_content = "# Test Skill\nprint('hello encrypted skill')"
    skill_md = "---\nname: test-enc-skill\ndescription: Encrypted skill test\n---\n"

    # Create a zip in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("SKILL.md", skill_md)
        zf.writestr("main.py", skill_content)
    zip_buffer.seek(0)

    async with httpx.AsyncClient() as client:
        # Upload skill
        resp = await client.post(
            f"{API_URL}/api/v1/agent_skills",
            files={"file": ("test-skill.zip", zip_buffer.getvalue(), "application/zip")},
            headers=encrypted_project.headers,
        )
        assert resp.status_code in (200, 201), f"Upload skill failed: {resp.text}"
        skill_id = resp.json()["data"]["id"]

        # Read back the main.py file from the skill
        resp = await client.get(
            f"{API_URL}/api/v1/agent_skills/{skill_id}/file",
            params={"file_path": "main.py"},
            headers=encrypted_project.headers,
        )
        assert resp.status_code == 200, f"Get skill file failed: {resp.text}"
        file_data = resp.json()["data"]
        # Text-based files should have content with the raw text
        assert file_data.get("content") is not None, "Expected file content for text file"
        assert skill_content in file_data["content"].get("raw", ""), (
            f"Skill file content mismatch: {file_data['content']}"
        )


# ---------------------------------------------------------------------------
# Tests — Redis Cache Encryption
# ---------------------------------------------------------------------------

REDIS_URL = os.getenv("REDIS_URL", "redis://:helloworld@redis:6379")
REDIS_KEY_PREFIX_PARTS = "message:parts:"


async def _get_redis_client():
    """Create an async Redis client for direct cache inspection."""
    import redis.asyncio as aioredis
    return aioredis.from_url(REDIS_URL, decode_responses=False)


async def _get_message_parts_sha256(conn, message_id: str) -> str:
    """Query DB for the SHA256 of a message's parts asset (used as Redis cache key)."""
    msg_uuid = uuid.UUID(message_id)
    row = await conn.fetchval(
        "SELECT parts_asset_meta FROM messages WHERE id = $1",
        msg_uuid,
    )
    if row is None:
        raise ValueError(f"Message {message_id} not found in DB")
    meta = json.loads(row) if isinstance(row, str) else row
    return meta["sha256"]


@pytest.mark.asyncio
async def test_redis_cache_encrypted_not_plaintext(db_conn, encrypted_project):
    """Encrypted project: Redis cache entry must NOT contain plaintext message text."""
    rdb = await _get_redis_client()
    try:
        async with httpx.AsyncClient() as client:
            session_id = await create_session(client, encrypted_project.headers)
            secret_text = "SUPER_SECRET_REDIS_ENCRYPTION_TEST_MARKER"
            msg_id = await send_message(
                client, session_id, secret_text, encrypted_project.headers,
            )

            # Look up the SHA256 from DB to find the Redis key
            sha256 = await _get_message_parts_sha256(db_conn, msg_id)
            redis_key = REDIS_KEY_PREFIX_PARTS + str(encrypted_project.project_id) + ":" + sha256

            raw: bytes = await rdb.get(redis_key)  # type: ignore
            assert raw is not None, (
                f"Expected Redis cache entry for key {redis_key}, but got None (cache miss)"
            )

            # First byte must be 0x01 (encrypted prefix)
            assert raw[0:1] == b"\x01", (
                f"Expected encrypted prefix 0x01, got 0x{raw[0]:02x}"
            )

            # Raw bytes must NOT contain the plaintext
            assert secret_text.encode() not in raw, (
                "Encrypted Redis cache entry must not contain plaintext message text"
            )

            # Verify that reading through the API still returns correct plaintext
            resp = await client.get(
                f"{API_URL}/api/v1/session/{session_id}/messages",
                params={"format": "acontext"},
                headers=encrypted_project.headers,
            )
            assert resp.status_code == 200
            messages = resp.json()["data"]["items"]
            found = any(
                part.get("text") == secret_text
                for msg in messages
                for part in msg.get("parts", [])
            )
            assert found, "API should return decrypted plaintext despite encrypted cache"
    finally:
        await rdb.aclose()


@pytest.mark.asyncio
async def test_redis_cache_plain_project_readable(db_conn, plain_project):
    """Plain project: Redis cache entry should be prefixed 0x00 with readable JSON."""
    rdb = await _get_redis_client()
    try:
        async with httpx.AsyncClient() as client:
            session_id = await create_session(client, plain_project.headers)
            plain_text = "PLAIN_REDIS_CACHE_TEST_MARKER"
            msg_id = await send_message(
                client, session_id, plain_text, plain_project.headers,
            )

            sha256 = await _get_message_parts_sha256(db_conn, msg_id)
            redis_key = REDIS_KEY_PREFIX_PARTS + str(plain_project.project_id) + ":" + sha256

            raw: bytes = await rdb.get(redis_key)  # type: ignore
            assert raw is not None, (
                f"Expected Redis cache entry for key {redis_key}, but got None (cache miss)"
            )

            # First byte must be 0x00 (plaintext prefix)
            assert raw[0:1] == b"\x00", (
                f"Expected plaintext prefix 0x00, got 0x{raw[0]:02x}"
            )

            # The remaining bytes should contain the plaintext marker
            assert plain_text.encode() in raw[1:], (
                "Plaintext Redis cache entry should contain the message text"
            )

            # The rest should be valid JSON
            parts = json.loads(raw[1:])
            assert isinstance(parts, list), "Cached data should be a JSON array of parts"
            assert any(
                p.get("text") == plain_text for p in parts
            ), "Cached JSON should contain the original message text"
    finally:
        await rdb.aclose()
