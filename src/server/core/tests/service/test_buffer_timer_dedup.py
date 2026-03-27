"""
Tests for the simplified message processing handler.

Verifies:
- Message not pending: returns early (staleness check for all messages)
- Buffer full (pending >= 16): processes immediately
- Buffer not full: every message publishes its own delay
- Delay fires (process_rightnow=True, message still pending): processes
- Lock contention: retries via retry queue, preserves process_rightnow flag
"""

import json
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from acontext_core.schema.mq.session import InsertNewMessage
from acontext_core.schema.result import Result
from acontext_core.schema.config import ProjectConfig
from acontext_core.service.session_message import insert_new_message


def _make_project_config(**overrides) -> ProjectConfig:
    defaults = {
        "project_session_message_buffer_max_turns": 16,
        "project_session_message_buffer_max_overflow": 16,
    }
    defaults.update(overrides)
    return ProjectConfig(**defaults)


def _make_body(
    project_id=None, session_id=None, message_id=None, process_rightnow=False
) -> InsertNewMessage:
    return InsertNewMessage(
        project_id=project_id or uuid.uuid4(),
        session_id=session_id or uuid.uuid4(),
        message_id=message_id or uuid.uuid4(),
        process_rightnow=process_rightnow,
    )


def _mock_db():
    mock_db = MagicMock()
    mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
    mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_db


class TestMessageNotPending:
    @pytest.mark.asyncio
    async def test_skips_when_message_already_processed(self):
        """Message status is 'running' (already processed): return early."""
        body = _make_body()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("running"),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
        ):
            await insert_new_message(body, MagicMock())
            mock_lock.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_message_status_query_fails(self):
        """Message status query error: return early."""
        body = _make_body()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.reject("db error"),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
        ):
            await insert_new_message(body, MagicMock())
            mock_lock.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_stale_delay(self):
        """Delay fires but message already processed: return early."""
        body = _make_body(process_rightnow=True)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("running"),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.MC.process_inserted_message",
                new_callable=AsyncMock,
            ) as mock_process,
        ):
            await insert_new_message(body, MagicMock())
            mock_lock.assert_not_called()
            mock_process.assert_not_called()


class TestBufferWait:
    @pytest.mark.asyncio
    async def test_every_message_publishes_delay(self):
        """pending < 16: every message publishes to delay queue."""
        body = _make_body()
        project_config = _make_project_config()
        published = []

        async def capture_publish(**kwargs):
            published.append(kwargs)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(3),
            ),
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await insert_new_message(body, MagicMock())

            assert len(published) == 1
            assert published[0]["routing_key"] == "session.message.insert.delay"
            msg = json.loads(published[0]["body"])
            assert msg["process_rightnow"] is True

    @pytest.mark.asyncio
    async def test_multiple_messages_each_publish_delay(self):
        """Two messages in same session both publish their own delay."""
        session_id = uuid.uuid4()
        body1 = _make_body(session_id=session_id)
        body2 = _make_body(session_id=session_id)
        project_config = _make_project_config()
        published = []

        async def capture_publish(**kwargs):
            published.append(kwargs)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(3),
            ),
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await insert_new_message(body1, MagicMock())
            await insert_new_message(body2, MagicMock())

            assert len(published) == 2
            msg1 = json.loads(published[0]["body"])
            msg2 = json.loads(published[1]["body"])
            assert msg1["message_id"] == str(body1.message_id)
            assert msg2["message_id"] == str(body2.message_id)


class TestBufferFull:
    @pytest.mark.asyncio
    async def test_processes_immediately_when_at_threshold(self):
        """pending >= 16: skip buffer, acquire lock, process."""
        body = _make_body()
        project_config = _make_project_config()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(16),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.session_message.MC.process_inserted_message",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_process,
        ):
            await insert_new_message(body, MagicMock())
            mock_process.assert_called_once()
            expected_key = f"session.message.insert.{body.session_id}.{body.message_id}"
            mock_lock.assert_called_once_with(body.project_id, expected_key)
            mock_release.assert_called_once_with(body.project_id, expected_key)


class TestDelayFires:
    @pytest.mark.asyncio
    async def test_processes_when_message_still_pending(self):
        """Delay fires, message still pending: processes."""
        body = _make_body(process_rightnow=True)
        project_config = _make_project_config()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(2),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch("acontext_core.service.session_message.release_redis_lock", new_callable=AsyncMock),
            patch(
                "acontext_core.service.session_message.MC.process_inserted_message",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_process,
        ):
            await insert_new_message(body, MagicMock())
            mock_process.assert_called_once()


class TestLockContention:
    @pytest.mark.asyncio
    async def test_retry_preserves_process_rightnow(self):
        """Lock contention with process_rightnow=True: retry keeps the flag."""
        body = _make_body(process_rightnow=True)
        project_config = _make_project_config()
        published = []

        async def capture_publish(**kwargs):
            published.append(kwargs)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(2),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await insert_new_message(body, MagicMock())

            assert len(published) == 1
            assert published[0]["routing_key"] == "session.message.insert.retry"
            msg = json.loads(published[0]["body"])
            assert msg["process_rightnow"] is True
            assert msg["lock_retry_count"] == 1

    @pytest.mark.asyncio
    async def test_retry_with_buffer_full(self):
        """Lock contention with pending >= 16: retry keeps process_rightnow=False."""
        body = _make_body(process_rightnow=False)
        project_config = _make_project_config()
        published = []

        async def capture_publish(**kwargs):
            published.append(kwargs)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(20),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await insert_new_message(body, MagicMock())

            assert len(published) == 1
            msg = json.loads(published[0]["body"])
            assert msg["process_rightnow"] is False


class TestSeparateTimersPerSession:
    @pytest.mark.asyncio
    async def test_different_sessions_get_own_delays(self):
        """Two sessions each below threshold: each publishes its own delay."""
        project_id = uuid.uuid4()
        body1 = _make_body(project_id=project_id)
        body2 = _make_body(project_id=project_id)
        project_config = _make_project_config()
        published = []

        async def capture_publish(**kwargs):
            published.append(kwargs)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(3),
            ),
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await insert_new_message(body1, MagicMock())
            await insert_new_message(body2, MagicMock())

            assert len(published) == 2
            msg1 = json.loads(published[0]["body"])
            msg2 = json.loads(published[1]["body"])
            assert msg1["session_id"] != msg2["session_id"]


class TestBranchAwareCount:
    @pytest.mark.asyncio
    async def test_consumer_uses_branch_pending_count_not_session_count(self):
        """Buffering uses branch count and never calls the old session-wide counter."""
        body = _make_body()
        project_config = _make_project_config()
        published = []

        async def capture_publish(**kwargs):
            published.append(kwargs)

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(1),
            ),
            patch(
                "acontext_core.service.session_message.MD.session_message_length",
                new_callable=AsyncMock,
            ) as mock_session_count,
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await insert_new_message(body, MagicMock())

            mock_session_count.assert_not_called()
            assert len(published) == 1
            assert published[0]["routing_key"] == "session.message.insert.delay"


class TestBranchLockKey:
    @pytest.mark.asyncio
    async def test_retry_uses_branch_specific_lock_key(self):
        """Lock key for insert processing includes the message id."""
        body = _make_body(process_rightnow=True)
        project_config = _make_project_config()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.branch_pending_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(16),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ) as mock_lock,
            patch("acontext_core.service.session_message.publish_mq", new_callable=AsyncMock),
        ):
            await insert_new_message(body, MagicMock())

            expected_key = f"session.message.insert.{body.session_id}.{body.message_id}"
            mock_lock.assert_called_once_with(body.project_id, expected_key)
