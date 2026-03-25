import asyncio
import asyncpg
import hashlib
import hmac
import httpx
import json
import logging
import os
import pytest
import uuid


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = os.getenv("API_URL", "http://api:8029")
CORE_URL = os.getenv("CORE_URL", "http://core:8000")
DB_URL = os.getenv("DB_URL", "postgresql://acontext:helloworld@pg:5432/acontext_test")
TEST_TOKEN_PREFIX = os.getenv("TEST_TOKEN_PREFIX", "sk-ac-")
PEPPER = os.getenv("AUTH_PEPPER", "test-pepper")
POLL_MAX_ITERATIONS = int(os.getenv("POLL_MAX_ITERATIONS", "60"))
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "2"))


def generate_hmac(secret: str, pepper: str) -> str:
    h = hmac.new(pepper.encode(), secret.encode(), hashlib.sha256)
    return h.hexdigest()


async def create_test_project(conn):
    project_id = uuid.uuid4()
    secret = str(uuid.uuid4())
    bearer_token = f"{TEST_TOKEN_PREFIX}{secret}"
    token_hmac = generate_hmac(secret, PEPPER)
    configs = {"project_session_message_buffer_max_turns": 1}
    await conn.execute(
        "INSERT INTO projects (id, secret_key_hmac, secret_key_hash_phc, configs) VALUES ($1, $2, $3, $4)",
        project_id, token_hmac, "dummy-phc", json.dumps(configs)
    )
    return project_id, {"Authorization": f"Bearer {bearer_token}"}


async def cleanup_test_project(conn, project_id: uuid.UUID) -> None:
    await conn.execute(
        "DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE project_id = $1)",
        project_id,
    )
    await conn.execute("DELETE FROM tasks WHERE project_id = $1", project_id)
    await conn.execute("DELETE FROM sessions WHERE project_id = $1", project_id)
    await conn.execute("DELETE FROM projects WHERE id = $1", project_id)


async def wait_for_services() -> None:
    async with httpx.AsyncClient() as client:
        for _ in range(POLL_MAX_ITERATIONS):
            try:
                if (
                    (await client.get(f"{API_URL}/health", timeout=2.0)).status_code == 200
                    and (await client.get(f"{CORE_URL}/health", timeout=2.0)).status_code == 200
                ):
                    return
            except (httpx.RequestError, httpx.TimeoutException):
                pass
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError("Services did not become healthy")


async def poll_message_status(conn, message_id: str) -> str:
    for _ in range(POLL_MAX_ITERATIONS):
        status = await conn.fetchval(
            "SELECT session_task_process_status FROM messages WHERE id = $1",
            uuid.UUID(message_id),
        )
        if status in ("success", "failed", "disable_tracking", "limit_exceed"):
            return status
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError("Message processing timed out")


async def poll_first_task_and_title(conn, session_id: str):
    for _ in range(POLL_MAX_ITERATIONS):
        row = await conn.fetchrow(
            """
            SELECT s.display_title, t.data->>'task_description' AS task_description
            FROM sessions s
            LEFT JOIN tasks t
              ON t.session_id = s.id
             AND t.is_planning = false
            WHERE s.id = $1
            ORDER BY t."order" ASC
            LIMIT 1
            """,
            uuid.UUID(session_id),
        )
        if row and row["display_title"] and row["task_description"]:
            return row["display_title"], row["task_description"]
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError("Task/title sync timed out")


@pytest.mark.asyncio
async def test_session_title_follows_first_task_description_with_mock():
    await wait_for_services()
    conn = await asyncpg.connect(DB_URL)
    project_id, headers = await create_test_project(conn)
    try:
        async with httpx.AsyncClient() as client:
            session_resp = await client.post(f"{API_URL}/api/v1/session", json={}, headers=headers)
            assert session_resp.status_code in (200, 201), session_resp.text
            session_id = session_resp.json()["data"]["id"]

            msg_resp = await client.post(
                f"{API_URL}/api/v1/session/{session_id}/messages",
                json={
                    "format": "acontext",
                    "blob": {
                        "role": "user",
                        "parts": [
                            {
                                "type": "text",
                                "text": "SESSION_TITLE_E2E please create one task for this request",
                            }
                        ],
                    },
                },
                headers=headers,
            )
            assert msg_resp.status_code in (200, 201), msg_resp.text
            message_id = msg_resp.json()["data"]["id"]

            status = await poll_message_status(conn, message_id)
            assert status == "success", status

            display_title, task_description = await poll_first_task_and_title(conn, session_id)
            assert task_description == "Mock session title task"
            assert display_title == task_description
            logger.info("display_title=%s", display_title)
    finally:
        await cleanup_test_project(conn, project_id)
        await conn.close()
