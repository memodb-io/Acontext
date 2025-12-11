"""
FastAPI endpoint tests.

This test module uses two auto-use fixtures to enable testing:
1. mock_lifespan: Prevents the FastAPI app's lifespan from initializing infrastructure
2. mock_get_embedding: Provides deterministic embeddings for predictable search results

Test Strategy:
- Uses httpx.AsyncClient with ASGITransport to test the async ASGI app
- AsyncClient runs the app in the same event loop, avoiding thread/loop conflicts
- Each test creates its own local DatabaseClient for isolation
- The api.DB_CLIENT is patched so the endpoint uses the test's database
- This allows proper async database operations without event loop mismatches
"""

import pytest
import numpy as np
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from uuid import uuid4

from api import app
from acontext_core.schema.orm import (
    Project,
    Space,
    Session,
    Task,
)
from acontext_core.infra.db import DatabaseClient
from acontext_core.env import DEFAULT_CORE_CONFIG
from acontext_core.schema.result import Result
from acontext_core.schema.embedding import EmbeddingReturn


@pytest.fixture(autouse=True)
def mock_lifespan():
    """
    Mock the FastAPI app lifespan to prevent multiple initializations.

    This fixture:
    - Patches setup() and cleanup() to avoid conflicts with test database clients
    - Applies automatically to all tests (autouse=True)
    """

    async def mock_setup():
        pass

    async def mock_cleanup():
        pass

    with patch("api.setup", side_effect=mock_setup), patch(
        "api.cleanup", side_effect=mock_cleanup
    ), patch("api.MQ_CLIENT.start", side_effect=lambda: None):
        yield


@pytest.fixture(autouse=True)
def mock_get_embedding():
    """
    Automatically mock get_embedding for all API tests.

    This fixture:
    - Applies automatically to all tests (autouse=True)
    - Returns deterministic embeddings based on text content
    - Allows tests to have predictable search results
    """
    with patch("acontext_core.service.data.block_search.get_embedding") as mock:

        async def get_mock_embedding(texts, phase="document"):
            """Generate deterministic embeddings based on text content"""
            text = texts[0].lower() if texts else ""

            # Create a deterministic embedding based on text content
            base_vector = np.zeros(
                DEFAULT_CORE_CONFIG.block_embedding_dim, dtype=np.float32
            )

            # Set different values based on keywords to create meaningful similarities
            if "python" in text or "programming" in text:
                base_vector[0] = 0.8
                base_vector[1] = 0.2
                base_vector[2] = 0.1
            elif "javascript" in text or "js" in text:
                base_vector[0] = 0.1
                base_vector[1] = 0.8
                base_vector[2] = 0.5
            else:
                # Default random embedding for unknown queries
                base_vector = np.random.rand(
                    DEFAULT_CORE_CONFIG.block_embedding_dim
                ).astype(np.float32)

            mock_embedding_return = EmbeddingReturn(
                embedding=base_vector.reshape(1, -1),
                prompt_tokens=10,
                total_tokens=10,
            )
            return Result.resolve(mock_embedding_return)

        mock.side_effect = get_mock_embedding
        yield mock


class TestGetLearningStatusEndpoint:
    """Test the /api/v1/project/{project_id}/session/{session_id}/get_learning_status endpoint"""

    @pytest.mark.asyncio
    async def test_get_learning_status_with_digested_tasks(self):
        """Test learning status with space digested and non-digested tasks"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        # Create test data
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create tasks with different space_digested status
            task1 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=1,
                data={"task_description": "Task 1"},
                status="success",
                space_digested=True,
            )
            task2 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=2,
                data={"task_description": "Task 2"},
                status="success",
                space_digested=True,
            )
            task3 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=3,
                data={"task_description": "Task 3"},
                status="success",
                space_digested=False,
            )
            session.add_all([task1, task2, task3])
            await session.commit()

            project_id = project.id
            session_id = test_session.id

        # Test the API endpoint
        with patch("api.DB_CLIENT", db_client):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    f"/api/v1/project/{project_id}/session/{session_id}/get_learning_status"
                )

                assert response.status_code == 200
                data = response.json()
                assert "space_digested_count" in data
                assert "not_space_digested_count" in data
                assert data["space_digested_count"] == 2
                assert data["not_space_digested_count"] == 1

                print("✓ Learning status with digested tasks test passed")

        # Cleanup
        async with db_client.get_session_context() as session:
            project = await session.get(Project, project_id)
            await session.delete(project)
            await session.commit()

    @pytest.mark.asyncio
    async def test_get_learning_status_no_tasks(self):
        """Test learning status when session has no tasks"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        # Create test data
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac2", secret_key_hash_phc="test_key_hash2"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.commit()

            project_id = project.id
            session_id = test_session.id

        # Test the API endpoint
        with patch("api.DB_CLIENT", db_client):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    f"/api/v1/project/{project_id}/session/{session_id}/get_learning_status"
                )

                assert response.status_code == 200
                data = response.json()
                assert data["space_digested_count"] == 0
                assert data["not_space_digested_count"] == 0

                print("✓ Learning status with no tasks test passed")

        # Cleanup
        async with db_client.get_session_context() as session:
            project = await session.get(Project, project_id)
            await session.delete(project)
            await session.commit()

    @pytest.mark.asyncio
    async def test_get_learning_status_session_not_connected_to_space(self):
        """Test learning status when session is not connected to a space"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        # Create test data
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac3", secret_key_hash_phc="test_key_hash3"
            )
            session.add(project)
            await session.flush()

            # Create session without space_id
            test_session = Session(project_id=project.id, space_id=None)
            session.add(test_session)
            await session.flush()

            # Create some tasks anyway
            task1 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=1,
                data={"task_description": "Task 1"},
                status="success",
                space_digested=True,
            )
            task2 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=2,
                data={"task_description": "Task 2"},
                status="pending",
                space_digested=False,
            )
            session.add_all([task1, task2])
            await session.commit()

            project_id = project.id
            session_id = test_session.id

        # Test the API endpoint
        with patch("api.DB_CLIENT", db_client):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    f"/api/v1/project/{project_id}/session/{session_id}/get_learning_status"
                )

                assert response.status_code == 200
                data = response.json()
                # Should return 0 and 0 when session is not connected to space
                assert data["space_digested_count"] == 0
                assert data["not_space_digested_count"] == 0

                print(
                    "✓ Learning status for session not connected to space test passed"
                )

        # Cleanup
        async with db_client.get_session_context() as session:
            project = await session.get(Project, project_id)
            await session.delete(project)
            await session.commit()

    @pytest.mark.asyncio
    async def test_get_learning_status_invalid_session_id(self):
        """Test learning status with invalid session ID"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        # Create test data
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac_api_invalid", secret_key_hash_phc="test_key_hash_api_invalid"
            )
            session.add(project)
            await session.commit()

            project_id = project.id
            invalid_session_id = str(uuid4())

        # Test the API endpoint
        with patch("api.DB_CLIENT", db_client):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    f"/api/v1/project/{project_id}/session/{invalid_session_id}/get_learning_status"
                )

                # Should return 404 for non-existent session
                assert response.status_code == 404

                print("✓ Invalid session ID test passed")

        # Cleanup
        async with db_client.get_session_context() as session:
            project = await session.get(Project, project_id)
            await session.delete(project)
            await session.commit()

    @pytest.mark.asyncio
    async def test_get_learning_status_all_digested(self):
        """Test learning status when all tasks are space digested"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        # Create test data
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac5", secret_key_hash_phc="test_key_hash5"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            test_session = Session(project_id=project.id, space_id=space.id)
            session.add(test_session)
            await session.flush()

            # Create all digested tasks
            task1 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=1,
                data={"task_description": "Task 1"},
                status="success",
                space_digested=True,
            )
            task2 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=2,
                data={"task_description": "Task 2"},
                status="success",
                space_digested=True,
            )
            task3 = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=3,
                data={"task_description": "Task 3"},
                status="success",
                space_digested=True,
            )
            session.add_all([task1, task2, task3])
            await session.commit()

            project_id = project.id
            session_id = test_session.id

        # Test the API endpoint
        with patch("api.DB_CLIENT", db_client):
            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as client:
                response = await client.get(
                    f"/api/v1/project/{project_id}/session/{session_id}/get_learning_status"
                )

                assert response.status_code == 200
                data = response.json()
                assert data["space_digested_count"] == 3
                assert data["not_space_digested_count"] == 0

                print("✓ All tasks digested test passed")

        # Cleanup
        async with db_client.get_session_context() as session:
            project = await session.get(Project, project_id)
            await session.delete(project)
            await session.commit()
