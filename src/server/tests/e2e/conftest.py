"""Shared fixtures and helpers for e2e tests."""

import asyncio
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
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
API_URL = os.getenv("API_URL", "http://api:8029")
CORE_URL = os.getenv("CORE_URL", "http://core:8000")
DB_URL = os.getenv("DB_URL", "postgresql://acontext:helloworld@pg:5432/acontext_test")
TEST_TOKEN_PREFIX = os.getenv("TEST_TOKEN_PREFIX", "sk-ac-")
PEPPER = os.getenv("AUTH_PEPPER", "test-pepper")

# Polling configuration
POLL_MAX_ITERATIONS = int(os.getenv("POLL_MAX_ITERATIONS", "30"))
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "2"))


class ProjectCredentials(BaseModel):
    """Project credentials and metadata for testing"""
    project_id: uuid.UUID
    secret: str
    bearer_token: str
    headers: Dict[str, str]

    class Config:
        arbitrary_types_allowed = True


def generate_hmac(secret: str, pepper: str) -> str:
    """Generate HMAC for project authentication"""
    h = hmac.new(pepper.encode(), secret.encode(), hashlib.sha256)
    return h.hexdigest()


async def create_test_project(conn) -> ProjectCredentials:
    """Create a test project in the database and return credentials"""
    project_id = uuid.uuid4()
    secret = str(uuid.uuid4())
    bearer_token = f"{TEST_TOKEN_PREFIX}{secret}"
    token_hmac = generate_hmac(secret, PEPPER)

    configs = {
        "project_session_message_buffer_max_turns": 1,
    }

    await conn.execute(
        "INSERT INTO projects (id, secret_key_hmac, secret_key_hash_phc, configs) VALUES ($1, $2, $3, $4)",
        project_id, token_hmac, "dummy-phc", json.dumps(configs)
    )

    return ProjectCredentials(
        project_id=project_id,
        secret=secret,
        bearer_token=bearer_token,
        headers={"Authorization": f"Bearer {bearer_token}"}
    )


async def cleanup_test_project(conn, project_id: uuid.UUID) -> None:
    """Clean up test project data from database"""
    try:
        await conn.execute(
            "DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE project_id = $1)",
            project_id
        )
        await conn.execute("DELETE FROM sessions WHERE project_id = $1", project_id)
        await conn.execute("DELETE FROM projects WHERE id = $1", project_id)
    except Exception as e:
        logger.warning(f"Cleanup failed for project {project_id}: {e}")


async def wait_for_services(
    max_iterations: int = POLL_MAX_ITERATIONS,
    poll_interval: int = POLL_INTERVAL_SECONDS
) -> bool:
    """Wait for API and Core services to be healthy"""
    logger.info("Waiting for API and Core health checks...")
    async with httpx.AsyncClient() as client:
        for _ in range(max_iterations):
            try:
                api_resp = await client.get(f"{API_URL}/health", timeout=2.0)
                core_resp = await client.get(f"{CORE_URL}/health", timeout=2.0)
                if api_resp.status_code == 200 and core_resp.status_code == 200:
                    logger.info("Both services are healthy!")
                    return True
                logger.info(f"Waiting... API: {api_resp.status_code}, Core: {core_resp.status_code}")
            except (httpx.RequestError, httpx.TimeoutException) as e:
                logger.info(f"Waiting... Connection error: {e}")
            await asyncio.sleep(poll_interval)

    logger.warning("Timeout waiting for services")
    return False


async def poll_message_status(
    conn,
    message_id: str,
    max_iterations: int = POLL_MAX_ITERATIONS,
    poll_interval: int = POLL_INTERVAL_SECONDS
) -> str:
    """Poll database for message processing status"""
    try:
        msg_uuid = uuid.UUID(message_id)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid message ID format: {message_id}")

    for _ in range(max_iterations):
        status = await conn.fetchval(
            "SELECT session_task_process_status FROM messages WHERE id = $1",
            msg_uuid
        )
        if status in ("success", "failed", "disable_tracking", "limit_exceed"):
            return status
        await asyncio.sleep(poll_interval)

    raise TimeoutError(
        f"Message processing timed out after {max_iterations * poll_interval}s"
    )


# ---------------------------------------------------------------------------
# Session / Message helpers
# ---------------------------------------------------------------------------

async def create_session(
    client: httpx.AsyncClient, headers: Dict[str, str], **kwargs
) -> str:
    """Create a session and return session ID"""
    session_resp = await client.post(
        f"{API_URL}/api/v1/session",
        json=kwargs if kwargs else {},
        headers=headers
    )
    assert session_resp.status_code in (200, 201), f"Failed to create session: {session_resp.text}"
    return session_resp.json()["data"]["id"]


async def send_message(
    client: httpx.AsyncClient,
    session_id: str,
    text: str,
    headers: Dict[str, str]
) -> str:
    """Send a message and return message ID"""
    msg_resp = await client.post(
        f"{API_URL}/api/v1/session/{session_id}/messages",
        json={
            "format": "acontext",
            "blob": {
                "role": "user",
                "parts": [{"type": "text", "text": text}]
            }
        },
        headers=headers
    )
    assert msg_resp.status_code in (200, 201), f"Failed to send message: {msg_resp.text}"
    return msg_resp.json()["data"]["id"]


# ---------------------------------------------------------------------------
# Disk / Artifact helpers
# ---------------------------------------------------------------------------

async def create_disk(
    client: httpx.AsyncClient, headers: Dict[str, str], user: str | None = None
) -> str:
    """Create a disk and return its ID."""
    body: dict = {}
    if user:
        body["user"] = user
    resp = await client.post(
        f"{API_URL}/api/v1/disk",
        json=body,
        headers=headers,
    )
    assert resp.status_code in (200, 201), f"Create disk failed: {resp.text}"
    return resp.json()["data"]["id"]


async def upload_artifact(
    client: httpx.AsyncClient,
    disk_id: str,
    headers: Dict[str, str],
    filename: str = "test.txt",
    content: bytes = b"hello world",
    file_path: str = "/",
    meta: str | None = None,
) -> dict:
    """Upload an artifact and return the full response data."""
    data: dict = {"file_path": file_path}
    if meta:
        data["meta"] = meta
    resp = await client.post(
        f"{API_URL}/api/v1/disk/{disk_id}/artifact",
        files={"file": (filename, content, "text/plain")},
        data=data,
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


# ---------------------------------------------------------------------------
# Shared pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
async def db_conn() -> AsyncGenerator[asyncpg.Connection, None]:
    """Database connection fixture"""
    conn = await asyncpg.connect(DB_URL)
    try:
        yield conn
    finally:
        await conn.close()


@pytest.fixture
async def test_project(db_conn) -> AsyncGenerator[ProjectCredentials, None]:
    """Create a test project fixture with automatic cleanup"""
    project = await create_test_project(db_conn)
    try:
        yield project
    finally:
        await cleanup_test_project(db_conn, project.project_id)


@pytest.fixture
async def second_project(db_conn) -> AsyncGenerator[ProjectCredentials, None]:
    """Create a second test project for cross-project isolation tests"""
    project = await create_test_project(db_conn)
    try:
        yield project
    finally:
        await cleanup_test_project(db_conn, project.project_id)
