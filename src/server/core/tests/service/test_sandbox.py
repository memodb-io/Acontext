"""
Tests for sandbox service with mock backend.
"""

import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from acontext_core.service.data import sandbox as SB
from acontext_core.schema.orm import Project, SandboxLog
from acontext_core.schema.sandbox import (
    SandboxCreateConfig,
    SandboxUpdateConfig,
    SandboxRuntimeInfo,
    SandboxCommandOutput,
    SandboxStatus,
)
from acontext_core.infra.db import DatabaseClient
from acontext_core.infra.sandbox.backend.base import SandboxBackend


class MockSandboxBackend(SandboxBackend):
    """Mock sandbox backend for testing."""

    type = "mock"

    def __init__(self):
        self._sandboxes: dict[str, SandboxRuntimeInfo] = {}
        self._command_history: dict[str, list[dict]] = {}

    @classmethod
    def from_default(cls):
        return cls()

    async def start_sandbox(
        self, create_config: SandboxCreateConfig
    ) -> SandboxRuntimeInfo:
        backend_id = f"mock-sandbox-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc)
        info = SandboxRuntimeInfo(
            sandbox_id=backend_id,
            sandbox_status=SandboxStatus.RUNNING,
            sandbox_created_at=now,
            sandbox_expires_at=now,
        )
        self._sandboxes[backend_id] = info
        self._command_history[backend_id] = []
        return info

    async def kill_sandbox(self, sandbox_id: str) -> bool:
        if sandbox_id in self._sandboxes:
            del self._sandboxes[sandbox_id]
            return True
        return False

    async def get_sandbox(self, sandbox_id: str) -> SandboxRuntimeInfo:
        if sandbox_id not in self._sandboxes:
            raise ValueError(f"Sandbox {sandbox_id} not found")
        return self._sandboxes[sandbox_id]

    async def update_sandbox(
        self, sandbox_id: str, update_config: SandboxUpdateConfig
    ) -> SandboxRuntimeInfo:
        if sandbox_id not in self._sandboxes:
            raise ValueError(f"Sandbox {sandbox_id} not found")
        return self._sandboxes[sandbox_id]

    async def exec_command(self, sandbox_id: str, command: str) -> SandboxCommandOutput:
        if sandbox_id not in self._sandboxes:
            raise ValueError(f"Sandbox {sandbox_id} not found")
        output = SandboxCommandOutput(
            stdout=f"executed: {command}",
            stderr="",
            exit_code=0,
        )
        self._command_history[sandbox_id].append({"command": command, "exit_code": 0})
        return output

    async def download_file(
        self, sandbox_id: str, from_sandbox_file: str, download_to_s3_key: str
    ) -> bool:
        if sandbox_id not in self._sandboxes:
            raise ValueError(f"Sandbox {sandbox_id} not found")
        return True

    async def upload_file(
        self, sandbox_id: str, from_s3_key: str, upload_to_sandbox_file: str
    ) -> bool:
        if sandbox_id not in self._sandboxes:
            raise ValueError(f"Sandbox {sandbox_id} not found")
        return True


@pytest.fixture
def mock_sandbox_backend():
    """Create a mock sandbox backend and patch SANDBOX_CLIENT."""
    backend = MockSandboxBackend()
    with patch("acontext_core.service.data.sandbox.SANDBOX_CLIENT") as mock_client:
        mock_client.use_backend.return_value = backend
        yield backend


class TestSandboxIdMapping:
    """Test that sandbox IDs are correctly mapped between unified UUID and backend ID."""

    @pytest.mark.asyncio
    async def test_create_sandbox_returns_unified_uuid(self, mock_sandbox_backend):
        """Test that create_sandbox returns unified UUID, not backend sandbox ID."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test project
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Create sandbox
            config = SandboxCreateConfig()
            result = await SB.create_sandbox(session, project.id, config)

            assert result.ok()
            info = result.data

            # The returned sandbox_id should be a valid UUID (unified ID)
            unified_id = uuid.UUID(info.sandbox_id)

            # Verify SandboxLog was created with correct mapping
            sandbox_log = await session.get(SandboxLog, unified_id)
            assert sandbox_log is not None
            assert sandbox_log.backend_type == "mock"
            assert sandbox_log.backend_sandbox_id.startswith("mock-sandbox-")
            assert sandbox_log.project_id == project.id

            # The backend sandbox ID should be different from unified ID
            assert sandbox_log.backend_sandbox_id != str(unified_id)

            # Clean up - delete the project (cascades to sandbox_log)
            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_sandbox_returns_unified_uuid(self, mock_sandbox_backend):
        """Test that get_sandbox returns the unified UUID in the response."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test project
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Create sandbox
            config = SandboxCreateConfig()
            create_result = await SB.create_sandbox(session, project.id, config)
            assert create_result.ok()
            unified_id = uuid.UUID(create_result.data.sandbox_id)

            # Get sandbox
            get_result = await SB.get_sandbox(session, unified_id)
            assert get_result.ok()

            # The returned sandbox_id should be the unified UUID
            assert get_result.data.sandbox_id == str(unified_id)

            # Clean up
            await session.delete(project)


class TestExecCommandLogging:
    """Test that exec_command correctly logs commands to history_commands."""

    @pytest.mark.asyncio
    async def test_exec_command_logs_to_history(self, mock_sandbox_backend):
        """Test that executed commands are logged to history_commands JSONB."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test project
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Create sandbox
            config = SandboxCreateConfig()
            create_result = await SB.create_sandbox(session, project.id, config)
            assert create_result.ok()
            unified_id = uuid.UUID(create_result.data.sandbox_id)

            # Execute commands
            result1 = await SB.exec_command(session, unified_id, "echo hello")
            assert result1.ok()
            assert result1.data.stdout == "executed: echo hello"

            result2 = await SB.exec_command(session, unified_id, "ls -la")
            assert result2.ok()

            # Refresh the sandbox log to get updated history_commands
            await session.commit()
            sandbox_log = await SB.get_sandbox_log(session, unified_id)
            assert sandbox_log.ok()

            # Verify history_commands contains both commands
            history = sandbox_log.data.history_commands
            assert len(history) == 2
            assert history[0]["command"] == "echo hello"
            assert history[0]["exit_code"] == 0
            assert history[1]["command"] == "ls -la"
            assert history[1]["exit_code"] == 0

            # Clean up
            await session.delete(project)

    @pytest.mark.asyncio
    async def test_exec_command_handles_empty_history(self, mock_sandbox_backend):
        """Test that exec_command works when history_commands starts as empty list."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test project
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Create sandbox
            config = SandboxCreateConfig()
            create_result = await SB.create_sandbox(session, project.id, config)
            assert create_result.ok()
            unified_id = uuid.UUID(create_result.data.sandbox_id)

            # Execute first command (history starts empty)
            result = await SB.exec_command(session, unified_id, "pwd")
            assert result.ok()

            await session.commit()
            sandbox_log = await SB.get_sandbox_log(session, unified_id)
            assert sandbox_log.ok()
            assert len(sandbox_log.data.history_commands) == 1

            # Clean up
            await session.delete(project)


class TestDownloadFileLogging:
    """Test that download_file correctly logs files to generated_files."""

    @pytest.mark.asyncio
    async def test_download_file_logs_to_generated_files(self, mock_sandbox_backend):
        """Test that downloaded files are logged to generated_files JSONB."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test project
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Create sandbox
            config = SandboxCreateConfig()
            create_result = await SB.create_sandbox(session, project.id, config)
            assert create_result.ok()
            unified_id = uuid.UUID(create_result.data.sandbox_id)

            # Download files
            result1 = await SB.download_file(
                session, unified_id, "/app/output.txt", "project/outputs/output.txt"
            )
            assert result1.ok()
            assert result1.data is True

            result2 = await SB.download_file(
                session, unified_id, "/app/report.pdf", "project/reports/report.pdf"
            )
            assert result2.ok()

            # Refresh and verify
            await session.commit()
            sandbox_log = await SB.get_sandbox_log(session, unified_id)
            assert sandbox_log.ok()

            # Verify generated_files contains both files
            files = sandbox_log.data.generated_files
            assert len(files) == 2
            assert files[0]["sandbox_path"] == "/app/output.txt"
            assert files[0]["s3_path"] == "project/outputs/output.txt"
            assert files[1]["sandbox_path"] == "/app/report.pdf"
            assert files[1]["s3_path"] == "project/reports/report.pdf"

            # Clean up
            await session.delete(project)


class TestSandboxNotFound:
    """Test error handling when sandbox is not found."""

    @pytest.mark.asyncio
    async def test_operations_on_nonexistent_sandbox(self, mock_sandbox_backend):
        """Test that operations on non-existent sandbox return proper errors."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            fake_id = uuid.uuid4()

            # All operations should fail gracefully
            result = await SB.get_sandbox(session, fake_id)
            assert not result.ok()
            assert "not found" in result.error.errmsg.lower()

            result = await SB.kill_sandbox(session, fake_id)
            assert not result.ok()

            result = await SB.exec_command(session, fake_id, "test")
            assert not result.ok()

            result = await SB.download_file(session, fake_id, "/a", "/b")
            assert not result.ok()

            result = await SB.upload_file(session, fake_id, "/a", "/b")
            assert not result.ok()


class TestKillSandbox:
    """Test kill_sandbox functionality."""

    @pytest.mark.asyncio
    async def test_kill_sandbox_success(self, mock_sandbox_backend):
        """Test that kill_sandbox works correctly."""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test project
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            # Create sandbox
            config = SandboxCreateConfig()
            create_result = await SB.create_sandbox(session, project.id, config)
            assert create_result.ok()
            unified_id = uuid.UUID(create_result.data.sandbox_id)

            # Kill sandbox
            kill_result = await SB.kill_sandbox(session, unified_id)
            assert kill_result.ok()
            assert kill_result.data is True

            # Clean up
            await session.delete(project)
