import asyncio
import httpx
import asyncpg
import os
import uuid
import hmac
import hashlib
import time

API_URL = os.getenv("API_URL", "http://api:8029")
CORE_URL = os.getenv("CORE_URL", "http://core:8000")
DB_URL = os.getenv("DB_URL", "postgresql://acontext:helloworld@pg:5432/acontext_test")
TEST_TOKEN_PREFIX = "sk-ac-"
PEPPER = "test-pepper" 

def generate_hmac(secret, pepper):
    h = hmac.new(pepper.encode(), secret.encode(), hashlib.sha256)
    return h.hexdigest()

async def wait_for_services():
    print("Waiting for API and Core health checks...")
    async with httpx.AsyncClient() as client:
        for i in range(30):
            try:
                api_resp = await client.get(f"{API_URL}/health", timeout=2.0)
                core_resp = await client.get(f"{CORE_URL}/health", timeout=2.0)
                if api_resp.status_code == 200 and core_resp.status_code == 200:
                    print("Both services are healthy!")
                    return True
                print(f"Waiting... API: {api_resp.status_code}, Core: {core_resp.status_code}")
            except Exception as e:
                print(f"Waiting... Error: {e}")
            await asyncio.sleep(2)
    print("Timeout waiting for services")
    return False

async def seed_project(conn, project_id, secret):
    print(f"Seeding project {project_id}...")
    token_hmac = generate_hmac(secret, PEPPER)
    await conn.execute(
        "INSERT INTO projects (id, secret_key_hmac, secret_key_hash_phc, configs) VALUES ($1, $2, $3, $4)",
        project_id, token_hmac, "dummy-phc", "{}"
    )

async def run_test():
    if not await wait_for_services():
        return False

    project_id = uuid.uuid4()
    secret = str(uuid.uuid4())
    bearer_token = f"{TEST_TOKEN_PREFIX}{secret}" # matching cfg.Root.ProjectBearerTokenPrefix "sk-ac-"

    print(f"Connecting to DB at {DB_URL}...")
    conn = await asyncpg.connect(DB_URL)
    try:
        await seed_project(conn, project_id, secret)

        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {bearer_token}"}
            
            # 1. Create session
            print("Creating session...")
            resp = await client.post(
                f"{API_URL}/api/v1/session",
                json={},
                headers=headers
            )
            print(f"Session Response: {resp.status_code}, {resp.text}")
            assert resp.status_code in (200, 201)
            session_id = resp.json()["data"]["id"]

            # 2. Store message
            print("Storing message...")
            resp = await client.post(
                f"{API_URL}/api/v1/session/{session_id}/messages",
                json={
                    "format": "acontext",
                    "blob": {
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hello, bot!"}]
                    }
                },
                headers=headers
            )
            print(f"Message Response: {resp.status_code}, {resp.text}")
            assert resp.status_code in (200, 201)
            message_id = resp.json()["data"]["id"]

            # 3. Poll for processing
            print("Polling for message processing (Python Core handshake)...")
            for i in range(30):
                status = await conn.fetchval(
                    "SELECT session_task_process_status FROM messages WHERE id = $1",
                    uuid.UUID(message_id)
                )
                print(f"Current status: {status}")
                if status in ("success", "failed"):
                    print(f"Handshake successful! Final status: {status}")
                    return True
                await asyncio.sleep(2)
            
            print("Timed out waiting for message processing")
            return False

    finally:
        await conn.close()

if __name__ == "__main__":
    success = asyncio.run(run_test())
    if not success:
        exit(1)
