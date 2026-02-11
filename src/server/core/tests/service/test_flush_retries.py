"""
Tests for Fix 2: Bounded flush retries in flush_session_message_blocking.

Verifies that the flush loop has a max retry count and returns Result.reject()
when exhausted, preventing infinite spin on a stuck Redis lock.
"""

import uuid
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from acontext_core.service.session_message import flush_session_message_blocking
from acontext_core.schema.result import Result


class TestFlushSucceedsWithinRetries:
    """Fix 2 — Flush succeeds within retries."""

    @pytest.mark.asyncio
    async def test_lock_acquired_on_first_attempt(self):
        """Lock acquired immediately — flush processes normally."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()

        with (
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.release_redis_lock",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.service.session_message.MC.process_session_pending_message",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await flush_session_message_blocking(project_id, session_id)

            assert result.ok()
            mock_lock.assert_called_once()

    @pytest.mark.asyncio
    async def test_lock_acquired_after_n_failures(self):
        """Lock fails N times then succeeds — flush eventually processes."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        fail_count = 5

        # Fail 5 times, then succeed
        lock_results = [False] * fail_count + [True]

        with (
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                side_effect=lock_results,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.release_redis_lock",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.service.session_message.MC.process_session_pending_message",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch("acontext_core.service.session_message.asyncio.sleep", new_callable=AsyncMock),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await flush_session_message_blocking(project_id, session_id)

            assert result.ok()
            assert mock_lock.call_count == fail_count + 1


class TestFlushExhaustsRetries:
    """Fix 2 — Flush exhausts retries."""

    @pytest.mark.asyncio
    async def test_returns_reject_after_max_retries(self):
        """Lock always fails — Result.reject() is returned after max_retries attempts."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        max_retries = 3

        with (
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,  # Always fail
            ) as mock_lock,
            patch("acontext_core.service.session_message.asyncio.sleep", new_callable=AsyncMock),
            patch(
                "acontext_core.service.session_message.DEFAULT_CORE_CONFIG"
            ) as mock_config,
        ):
            mock_config.session_message_flush_max_retries = max_retries
            mock_config.session_message_session_lock_wait_seconds = 0

            result = await flush_session_message_blocking(project_id, session_id)

            assert not result.ok()
            assert "retries" in result.error.errmsg.lower()
            assert mock_lock.call_count == max_retries

    @pytest.mark.asyncio
    async def test_release_lock_not_called_on_exhaust(self):
        """When retries exhaust, release_redis_lock should NOT be called
        (lock was never acquired)."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        max_retries = 2

        with (
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch(
                "acontext_core.service.session_message.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch("acontext_core.service.session_message.asyncio.sleep", new_callable=AsyncMock),
            patch(
                "acontext_core.service.session_message.DEFAULT_CORE_CONFIG"
            ) as mock_config,
        ):
            mock_config.session_message_flush_max_retries = max_retries
            mock_config.session_message_session_lock_wait_seconds = 0

            result = await flush_session_message_blocking(project_id, session_id)

            assert not result.ok()
            mock_release.assert_not_called()
