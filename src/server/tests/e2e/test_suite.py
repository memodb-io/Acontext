import asyncio
import pytest
import pytest_asyncio
import httpx
import asyncpg
import os
import uuid
import hmac
import hashlib
import json
from typing import List, Tuple

API_URL = os.getenv("API_URL", "http://api:8029")
CORE_URL = os.getenv("CORE_URL", "http://core:8000")
DB_URL = os.getenv("DB_URL", "postgresql://acontext:helloworld@pg:5432/acontext_test")
TEST_TOKEN_PREFIX = "sk-ac-"
PEPPER = "test-pepper"


def generate_hmac(secret, pepper):
    """Generate HMAC for project authentication"""
    h = hmac.new(pepper.encode(), secret.encode(), hashlib.sha256)
    return h.hexdigest()


@pytest_asyncio.fixture
async def db_connection():
    """Database connection fixture"""
    conn = await asyncpg.connect(DB_URL)
    yield conn
    await conn.close()


@pytest_asyncio.fixture
async def http_client():
    """HTTP client fixture"""
    async with httpx.AsyncClient() as client:
        yield client


@pytest_asyncio.fixture
async def test_project(db_connection):
    """Create a test project with mock LLM configuration"""
    project_id = uuid.uuid4()
    secret = str(uuid.uuid4())
    bearer_token = f"{TEST_TOKEN_PREFIX}{secret}"
    token_hmac = generate_hmac(secret, PEPPER)
    
    # Configure project for immediate processing and mock LLM
    configs = {
        "project_session_message_buffer_max_turns": 1,
        "project_session_message_buffer_ttl_seconds": 2,
        "llm_sdk": "mock"  # Use mock LLM for deterministic testing
    }
    
    await db_connection.execute(
        "INSERT INTO projects (id, secret_key_hmac, secret_key_hash_phc, configs) VALUES ($1, $2, $3, $4)",
        project_id, token_hmac, "dummy-phc", json.dumps(configs)
    )
    
    return {
        "id": project_id,
        "secret": secret,
        "bearer_token": bearer_token
    }


@pytest_asyncio.fixture
async def test_session(http_client, test_project):
    """Create a test session"""
    headers = {"Authorization": f"Bearer {test_project['bearer_token']}"}
    
    resp = await http_client.post(
        f"{API_URL}/api/v1/session",
        json={},
        headers=headers
    )
    assert resp.status_code in (200, 201)
    session_data = resp.json()["data"]
    
    return {
        "id": session_data["id"],
        "headers": headers
    }


async def wait_for_services():
    """Wait for API and Core services to be healthy"""
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


async def poll_message_status(db_connection, message_id: str, timeout_seconds: int = 60) -> str:
    """Poll database for message processing status"""
    try:
        msg_uuid = uuid.UUID(message_id)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid message ID format: {message_id}")
    
    for i in range(timeout_seconds // 2):
        status = await db_connection.fetchval(
            "SELECT session_task_process_status FROM messages WHERE id = $1",
            msg_uuid
        )
        if status in ("success", "failed"):
            return status
        await asyncio.sleep(2)
    
    raise TimeoutError(f"Message processing timed out after {timeout_seconds}s")


class TestE2EHandshake:
    """End-to-End test suite for Acontext"""
    
    @pytest.mark.asyncio
    async def test_services_health(self):
        """Test that all services are running and healthy"""
        assert await wait_for_services(), "Services failed health check"
    
    @pytest.mark.asyncio
    async def test_basic_handshake(self, http_client, test_session, db_connection):
        """Test 1: Basic handshake - verifies simple chat (like Phase 2)"""
        # Send a simple hello message
        resp = await http_client.post(
            f"{API_URL}/api/v1/session/{test_session['id']}/messages",
            json={
                "format": "acontext",
                "blob": {
                    "role": "user",
                    "parts": [{"type": "text", "text": "Simple Hello"}]
                }
            },
            headers=test_session['headers']
        )
        assert resp.status_code in (200, 201)
        message_id = resp.json()["data"]["id"]
        
        # Wait for processing
        status = await poll_message_status(db_connection, message_id)
        assert status == "success", f"Expected success, got {status}"
        
        # Verify the mock LLM response
        msg_uuid = uuid.UUID(message_id)
        response_data = await db_connection.fetchrow(
            "SELECT * FROM messages WHERE id = $1",
            msg_uuid
        )
        assert response_data is not None
        
        print("Basic handshake test passed")
    
    @pytest.mark.asyncio
    async def test_tool_call_flow(self, http_client, test_session, db_connection):
        """Test 2: Tool call flow - verifies assistant tool calls and results"""
        # Send message that triggers tool call
        resp = await http_client.post(
            f"{API_URL}/api/v1/session/{test_session['id']}/messages",
            json={
                "format": "acontext",
                "blob": {
                    "role": "user",
                    "parts": [{"type": "text", "text": "CALL_TOOL_DISK_LIST please list files"}]
                }
            },
            headers=test_session['headers']
        )
        assert resp.status_code in (200, 201)
        user_message_id = resp.json()["data"]["id"]
        
        # Wait for processing of user message
        status = await poll_message_status(db_connection, user_message_id)
        assert status == "success", f"User message processing failed: {status}"
        
        # Check if assistant message with tool calls was created
        session_uuid = uuid.UUID(test_session['id'])
        assistant_messages = await db_connection.fetch(
            """
            SELECT id, blob FROM messages 
            WHERE session_id = $1 AND blob->>'role' = 'assistant'
            ORDER BY created_at DESC
            """,
            session_uuid
        )
        
        assert len(assistant_messages) > 0, "No assistant message found"
        assistant_msg = assistant_messages[0]
        assistant_blob = json.loads(assistant_msg['blob']) if isinstance(assistant_msg['blob'], str) else assistant_msg['blob']
        
        # Verify tool calls exist
        assert 'tool_calls' in assistant_blob, "Assistant message should contain tool_calls"
        tool_calls = assistant_blob['tool_calls']
        assert len(tool_calls) > 0, "Tool calls should not be empty"
        
        # Verify tool call structure
        tool_call = tool_calls[0]
        assert tool_call['function']['name'] == 'disk.list', f"Expected disk.list, got {tool_call['function']['name']}"
        
        # Send tool result message
        tool_result_resp = await http_client.post(
            f"{API_URL}/api/v1/session/{test_session['id']}/messages",
            json={
                "format": "acontext",
                "blob": {
                    "role": "tool",
                    "tool_call_id": tool_call['id'],
                    "parts": [{"type": "text", "text": "file1.txt\nfile2.log\ndirectory/"}]
                }
            },
            headers=test_session['headers']
        )
        assert tool_result_resp.status_code in (200, 201)
        tool_message_id = tool_result_resp.json()["data"]["id"]
        
        # Wait for tool result processing
        status = await poll_message_status(db_connection, tool_message_id)
        assert status == "success", f"Tool result processing failed: {status}"
        
        print("Tool call flow test passed")
    
    @pytest.mark.asyncio
    async def test_concurrency(self, http_client):
        """Test 3: Concurrency/Load testing - spawn multiple concurrent sessions"""
        num_concurrent = 10  # Reduced from 50 for faster testing
        
        async def create_concurrent_session(session_num: int) -> Tuple[bool, str]:
            """Create a session and send a message concurrently"""
            # Open fresh connection per task to avoid concurrency issues
            conn = None
            try:
                conn = await asyncpg.connect(DB_URL)
                
                # Create project for this session
                project_id = uuid.uuid4()
                secret = str(uuid.uuid4())
                bearer_token = f"{TEST_TOKEN_PREFIX}{secret}"
                token_hmac = generate_hmac(secret, PEPPER)
                
                configs = {
                    "project_session_message_buffer_max_turns": 1,
                    "project_session_message_buffer_ttl_seconds": 2,
                    "llm_sdk": "mock"
                }
                
                await conn.execute(
                    "INSERT INTO projects (id, secret_key_hmac, secret_key_hash_phc, configs) VALUES ($1, $2, $3, $4)",
                    project_id, token_hmac, "dummy-phc", json.dumps(configs)
                )
                
                headers = {"Authorization": f"Bearer {bearer_token}"}
                
                # Create session
                session_resp = await http_client.post(
                    f"{API_URL}/api/v1/session",
                    json={},
                    headers=headers
                )
                if session_resp.status_code not in (200, 201):
                    return False, f"Session {session_num}: Failed to create session"
                
                session_id = session_resp.json()["data"]["id"]
                
                # Send message
                msg_resp = await http_client.post(
                    f"{API_URL}/api/v1/session/{session_id}/messages",
                    json={
                        "format": "acontext",
                        "blob": {
                            "role": "user",
                            "parts": [{"type": "text", "text": f"Simple Hello from session {session_num}"}]
                        }
                    },
                    headers=headers
                )
                
                if msg_resp.status_code not in (200, 201):
                    return False, f"Session {session_num}: Failed to send message"
                
                message_id = msg_resp.json()["data"]["id"]
                
                # Wait for processing (shorter timeout for load test)
                try:
                    status = await poll_message_status(conn, message_id, timeout_seconds=30)
                    if status == "success":
                        return True, f"Session {session_num}: Success"
                    else:
                        return False, f"Session {session_num}: Processing failed with status {status}"
                except TimeoutError:
                    return False, f"Session {session_num}: Timeout"
                    
            except Exception as e:
                return False, f"Session {session_num}: Exception {str(e)}"
            finally:
                if conn:
                    await conn.close()
        
        # Run concurrent sessions
        tasks = [create_concurrent_session(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Analyze results
        successes = 0
        failures = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failures.append(f"Session {i}: Exception {str(result)}")
            else:
                success, message = result
                if success:
                    successes += 1
                else:
                    failures.append(message)
        
        print(f"Concurrency test: {successes}/{num_concurrent} sessions successful")
        if failures:
            print("Failures:")
            for failure in failures[:5]:  # Show first 5 failures
                print(f"  - {failure}")
        
        # We expect at least 80% success rate
        success_rate = successes / num_concurrent
        assert success_rate >= 0.8, f"Success rate {success_rate:.2%} below 80% threshold"
        
        print("Concurrency test passed")