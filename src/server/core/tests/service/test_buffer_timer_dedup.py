"""
Tests for Fix 3: Redis NX timer dedup + skip_latest_check flag.

Verifies that:
- Only one asyncio timer is created per session per TTL window
- Timer fires with skip_latest_check=True to bypass dedup
- Normal messages still get deduped
- Retries reset skip_latest_check to False
"""

import json
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from acontext_core.schema.mq.session import InsertNewMessage
from acontext_core.schema.result import Result
from acontext_core.schema.config import ProjectConfig
from acontext_core.service.session_message import (
    insert_new_message,
    buffer_new_message,
    waiting_for_message_notify,
)


def _make_project_config(**overrides) -> ProjectConfig:
    defaults = {
        "project_session_message_buffer_max_turns": 16,
        "project_session_message_buffer_max_overflow": 16,
        "project_session_message_buffer_ttl_seconds": 8,
    }
    defaults.update(overrides)
    return ProjectConfig(**defaults)


def _make_body(
    project_id=None, session_id=None, message_id=None, skip_latest_check=False
) -> InsertNewMessage:
    return InsertNewMessage(
        project_id=project_id or uuid.uuid4(),
        session_id=session_id or uuid.uuid4(),
        message_id=message_id or uuid.uuid4(),
        skip_latest_check=skip_latest_check,
    )


class TestFirstMessageCreatesTimer:
    """Fix 3 — First message creates timer."""

    @pytest.mark.asyncio
    async def test_timer_created_when_buffer_below_max(self):
        """Send a message when buffer < max_turns. Verify Redis key is set
        and asyncio task is created."""
        msg_id = uuid.uuid4()
        body = _make_body(message_id=msg_id)
        project_config = _make_project_config()

        created_tasks = []
        original_create_task = None

        def mock_create_task(coro):
            created_tasks.append(coro)
            # Cancel the coroutine to avoid it running
            coro.close()

        mock_message = MagicMock()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([msg_id]),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.session_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(3),  # Below max_turns=16
            ),
            patch(
                "acontext_core.service.session_message.check_buffer_timer_or_set",
                new_callable=AsyncMock,
                return_value=True,  # Key newly set — should create timer
            ) as mock_timer_set,
            patch("acontext_core.service.session_message.asyncio.create_task", side_effect=mock_create_task),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await insert_new_message(body, mock_message)

            mock_timer_set.assert_called_once_with(
                body.project_id,
                body.session_id,
                project_config.project_session_message_buffer_ttl_seconds,
            )
            assert len(created_tasks) == 1


class TestSubsequentMessagesSkipTimer:
    """Fix 3 — Subsequent messages skip timer."""

    @pytest.mark.asyncio
    async def test_no_new_timer_when_redis_key_exists(self):
        """Send a second message for the same session while Redis key exists.
        Verify no new asyncio task is created."""
        msg_id = uuid.uuid4()
        body = _make_body(message_id=msg_id)
        project_config = _make_project_config()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([msg_id]),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.session_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(3),
            ),
            patch(
                "acontext_core.service.session_message.check_buffer_timer_or_set",
                new_callable=AsyncMock,
                return_value=False,  # Key already exists — timer already scheduled
            ),
            patch("acontext_core.service.session_message.asyncio.create_task") as mock_create_task,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await insert_new_message(body, mock_message)

            mock_create_task.assert_not_called()


class TestDifferentSessionsGetOwnTimers:
    """Fix 3 — Different sessions get their own timers."""

    @pytest.mark.asyncio
    async def test_separate_timers_per_session(self):
        """Send messages for two different sessions. Verify both get their own
        Redis key and asyncio task."""
        session_id_1 = uuid.uuid4()
        session_id_2 = uuid.uuid4()
        project_id = uuid.uuid4()
        msg_id_1 = uuid.uuid4()
        msg_id_2 = uuid.uuid4()

        body1 = _make_body(project_id=project_id, session_id=session_id_1, message_id=msg_id_1)
        body2 = _make_body(project_id=project_id, session_id=session_id_2, message_id=msg_id_2)
        project_config = _make_project_config()
        mock_message = MagicMock()

        created_tasks = []

        def mock_create_task(coro):
            created_tasks.append(coro)
            coro.close()

        timer_set_calls = []

        async def fake_timer_set(proj_id, sess_id, ttl):
            timer_set_calls.append(sess_id)
            return True  # Both are new keys

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
            ) as mock_get_ids,
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.MD.session_message_length",
                new_callable=AsyncMock,
                return_value=Result.resolve(3),
            ),
            patch(
                "acontext_core.service.session_message.check_buffer_timer_or_set",
                side_effect=fake_timer_set,
            ),
            patch("acontext_core.service.session_message.asyncio.create_task", side_effect=mock_create_task),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            # Return matching message_id for each session
            mock_get_ids.side_effect = [
                Result.resolve([msg_id_1]),
                Result.resolve([msg_id_2]),
            ]

            await insert_new_message(body1, mock_message)
            await insert_new_message(body2, mock_message)

            assert len(timer_set_calls) == 2
            assert session_id_1 in timer_set_calls
            assert session_id_2 in timer_set_calls
            assert len(created_tasks) == 2


class TestTimerFiresWithSkipLatestCheck:
    """Fix 3 — Timer fires with skip_latest_check=True."""

    @pytest.mark.asyncio
    async def test_buffer_consumer_bypasses_dedup_with_flag(self):
        """Timer fires after multiple messages arrived. Verify buffer_new_message
        receives skip_latest_check=True, bypasses dedup check, and proceeds."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        old_msg_id = uuid.uuid4()  # Timer's message_id — no longer the latest
        latest_msg_id = uuid.uuid4()  # The actual latest

        body = _make_body(
            project_id=project_id,
            session_id=session_id,
            message_id=old_msg_id,
            skip_latest_check=True,
        )
        project_config = _make_project_config()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([latest_msg_id]),  # latest != old_msg_id
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,  # Lock acquired
            ),
            patch(
                "acontext_core.service.session_message.release_redis_lock",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.session_message.MC.process_session_pending_message",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_process,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await buffer_new_message(body, mock_message)

            # Despite old_msg_id != latest_msg_id, processing happened because
            # skip_latest_check=True bypasses the dedup
            mock_process.assert_called_once()


class TestNormalMessageStillDeduped:
    """Fix 3 — Normal message still deduped."""

    @pytest.mark.asyncio
    async def test_non_latest_message_skipped_in_insert(self):
        """A real message arrives at insert_new_message with skip_latest_check=False
        (default) but is not the latest pending. Verify it is skipped."""
        old_msg_id = uuid.uuid4()
        latest_msg_id = uuid.uuid4()

        body = _make_body(message_id=old_msg_id, skip_latest_check=False)
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([latest_msg_id]),  # old != latest
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
            patch("acontext_core.service.session_message.asyncio.create_task") as mock_create_task,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await insert_new_message(body, mock_message)

            # Should have returned early — no lock check, no task creation
            mock_lock.assert_not_called()
            mock_create_task.assert_not_called()

    @pytest.mark.asyncio
    async def test_non_latest_message_skipped_in_buffer(self):
        """A real message arrives at buffer_new_message with skip_latest_check=False
        but is not the latest pending. Verify it is skipped."""
        old_msg_id = uuid.uuid4()
        latest_msg_id = uuid.uuid4()

        body = _make_body(message_id=old_msg_id, skip_latest_check=False)
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([latest_msg_id]),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.MC.process_session_pending_message",
                new_callable=AsyncMock,
            ) as mock_process,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await buffer_new_message(body, mock_message)

            mock_lock.assert_not_called()
            mock_process.assert_not_called()


class TestTimerRetryPath:
    """Fix 3 — Timer retry path: buffer_new_message can't get lock, retries with
    skip_latest_check reset to False."""

    @pytest.mark.asyncio
    async def test_retry_resets_skip_latest_check(self):
        """Timer fires, buffer_new_message can't get lock, retries via MQ.
        Verify the retried body has skip_latest_check=False."""
        msg_id = uuid.uuid4()
        latest_msg_id = msg_id  # Same so dedup doesn't skip
        body = _make_body(message_id=msg_id, skip_latest_check=True)
        project_config = _make_project_config()
        mock_message = MagicMock()

        published_bodies = []

        async def capture_publish(**kwargs):
            published_bodies.append(kwargs.get("body"))

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([latest_msg_id]),
            ),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(project_config),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,  # Lock NOT acquired — triggers retry
            ),
            patch(
                "acontext_core.service.session_message.publish_mq",
                side_effect=capture_publish,
            ),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await buffer_new_message(body, mock_message)

            assert len(published_bodies) == 1
            retried = json.loads(published_bodies[0])
            assert retried["skip_latest_check"] is False


class TestTimerFiresWithNoPendingMessages:
    """Fix 3 — Timer fires with no pending messages."""

    @pytest.mark.asyncio
    async def test_early_return_on_empty_pending(self):
        """All messages already processed by the time timer fires. Verify
        buffer_new_message returns early on the `not len(message_ids)` check."""
        body = _make_body(skip_latest_check=True)
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.session_message.MD.get_message_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),  # No pending messages
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.MC.process_session_pending_message",
                new_callable=AsyncMock,
            ) as mock_process,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(return_value=MagicMock())
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)

            await buffer_new_message(body, mock_message)

            # Early return — no lock attempt, no processing
            mock_lock.assert_not_called()
            mock_process.assert_not_called()


class TestWaitingForMessageNotify:
    """Fix 3 — waiting_for_message_notify publishes with skip_latest_check=True."""

    @pytest.mark.asyncio
    async def test_timer_publishes_with_flag_true(self):
        """Verify that the timer function publishes with skip_latest_check=True."""
        body = _make_body(skip_latest_check=False)  # Original body has False

        published_bodies = []

        async def capture_publish(**kwargs):
            published_bodies.append(kwargs.get("body"))

        with (
            patch("acontext_core.service.session_message.asyncio.sleep", new_callable=AsyncMock),
            patch("acontext_core.service.session_message.publish_mq", side_effect=capture_publish),
        ):
            await waiting_for_message_notify(8, body)

            assert len(published_bodies) == 1
            published = json.loads(published_bodies[0])
            assert published["skip_latest_check"] is True
            assert published["project_id"] == str(body.project_id)
            assert published["session_id"] == str(body.session_id)
            assert published["message_id"] == str(body.message_id)
