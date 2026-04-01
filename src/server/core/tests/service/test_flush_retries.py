"""
Tests for branch-aware flush behavior in flush_session_message_blocking.

Verifies:
- flush processes pending messages one by one through process_inserted_message
- flush uses branch-specific message lock keys
- flush retries when pending messages remain but branch locks are busy
- flush returns bounded retry errors when no branch can be processed
"""

import uuid
import pytest
from unittest.mock import ANY, AsyncMock, MagicMock, patch, call

from acontext_core.service.session_message import flush_session_message_blocking
from acontext_core.schema.result import Result


def _mock_db():
    mock_db = MagicMock()
    mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
        return_value=MagicMock()
    )
    mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_db


def _branch_message(message_id, session_id, status="pending", parent_id=None):
    message = MagicMock()
    message.id = message_id
    message.parent_id = parent_id
    message.session_id = session_id
    message.session_task_process_status = status
    return message


class TestFlushBranchAwareProcessing:
    @pytest.mark.asyncio
    async def test_processes_each_pending_message_individually(self):
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        message_a = uuid.uuid4()
        message_b = uuid.uuid4()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.service.session_message._get_pending_session_message_ids",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve([message_a, message_b]),
                    Result.resolve([]),
                ],
            ),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.MD.fetch_message_branch_path_messages",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve([_branch_message(message_a, session_id)]),
                    Result.resolve([_branch_message(message_b, session_id)]),
                ],
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
            result = await flush_session_message_blocking(project_id, session_id)

            assert result.ok()
            assert mock_process.call_args_list == [
                call(ANY, project_id, session_id, message_a),
                call(ANY, project_id, session_id, message_b),
            ]
            assert mock_lock.call_args_list == [
                call(project_id, f"session.message.insert.{session_id}.{message_a}"),
                call(project_id, f"session.message.insert.{session_id}.{message_b}"),
            ]
            assert mock_release.call_args_list == [
                call(project_id, f"session.message.insert.{session_id}.{message_a}"),
                call(project_id, f"session.message.insert.{session_id}.{message_b}"),
            ]

    @pytest.mark.asyncio
    async def test_retries_when_branch_lock_is_busy_then_processes(self):
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        message_id = uuid.uuid4()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.service.session_message._get_pending_session_message_ids",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve([message_id]),
                    Result.resolve([message_id]),
                    Result.resolve([]),
                ],
            ),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.MD.fetch_message_branch_path_messages",
                new_callable=AsyncMock,
                return_value=Result.resolve([_branch_message(message_id, session_id)]),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                side_effect=[False, True],
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
            patch(
                "acontext_core.service.session_message.asyncio.sleep",
                new_callable=AsyncMock,
            ) as mock_sleep,
        ):
            result = await flush_session_message_blocking(project_id, session_id)

            assert result.ok()
            assert mock_lock.call_count == 2
            mock_sleep.assert_called_once()
            mock_process.assert_called_once()
            mock_release.assert_called_once_with(
                project_id, f"session.message.insert.{session_id}.{message_id}"
            )


class TestFlushBranchAwareRetries:
    @pytest.mark.asyncio
    async def test_returns_reject_after_max_retries_when_branch_locks_stay_busy(self):
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        message_id = uuid.uuid4()
        max_retries = 3

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.service.session_message._get_pending_session_message_ids",
                new_callable=AsyncMock,
                side_effect=[Result.resolve([message_id])] * max_retries,
            ),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.MD.fetch_message_branch_path_messages",
                new_callable=AsyncMock,
                return_value=Result.resolve([_branch_message(message_id, session_id)]),
            ),
            patch(
                "acontext_core.service.session_message.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ) as mock_lock,
            patch(
                "acontext_core.service.session_message.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.session_message.asyncio.sleep",
                new_callable=AsyncMock,
            ),
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
            mock_release.assert_not_called()


class TestFlushSharedBranchLocking:
    @pytest.mark.asyncio
    async def test_same_branch_messages_share_one_lock_boundary(self):
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        root_id = uuid.uuid4()
        branch_id = uuid.uuid4()
        leaf_id = uuid.uuid4()

        with (
            patch("acontext_core.service.session_message.DB_CLIENT", _mock_db()),
            patch(
                "acontext_core.service.session_message.PD.get_project_config",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.service.session_message._get_pending_session_message_ids",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve([branch_id, leaf_id]),
                    Result.resolve([]),
                ],
            ),
            patch(
                "acontext_core.service.session_message.MD.check_session_message_status",
                new_callable=AsyncMock,
                return_value=Result.resolve("pending"),
            ),
            patch(
                "acontext_core.service.session_message.MD.fetch_message_branch_path_messages",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve(
                        [
                            _branch_message(root_id, session_id, status="success"),
                            _branch_message(
                                branch_id,
                                session_id,
                                status="pending",
                                parent_id=root_id,
                            ),
                        ]
                    ),
                    Result.resolve(
                        [
                            _branch_message(root_id, session_id, status="success"),
                            _branch_message(
                                branch_id,
                                session_id,
                                status="pending",
                                parent_id=root_id,
                            ),
                            _branch_message(
                                leaf_id,
                                session_id,
                                status="pending",
                                parent_id=branch_id,
                            ),
                        ]
                    ),
                ],
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
            result = await flush_session_message_blocking(project_id, session_id)

            assert result.ok()
            expected_key = f"session.message.insert.{session_id}.{branch_id}"
            assert mock_lock.call_args_list == [
                call(project_id, expected_key),
                call(project_id, expected_key),
            ]
            assert mock_release.call_args_list == [
                call(project_id, expected_key),
                call(project_id, expected_key),
            ]
            assert mock_process.call_args_list == [
                call(ANY, project_id, session_id, branch_id),
                call(ANY, project_id, session_id, leaf_id),
            ]
