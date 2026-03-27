"""
Tests for process_inserted_message.

Covers:
- success path with branch-only messages
- branch-load error rollback
- task-agent exception rollback
"""

import asyncio
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.schema.session.task import TaskStatus
from acontext_core.service.controller.message import process_inserted_message


MODULE = "acontext_core.service.controller.message"

_PROJECT_ID = uuid.uuid4()
_SESSION_ID = uuid.uuid4()
_MESSAGE_ID = uuid.uuid4()


def _mock_db():
    mock_db = MagicMock()
    mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
        return_value=MagicMock()
    )
    mock_db.get_session_context.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_db


def _mock_project_config():
    config = MagicMock()
    config.default_task_agent_max_iterations = 3
    config.default_task_agent_previous_progress_num = 5
    config.task_success_criteria = []
    config.task_failure_criteria = []
    return config


def _make_message(message_id: uuid.UUID, role: str, parent_id: uuid.UUID | None = None):
    message = MagicMock()
    message.id = message_id
    message.parent_id = parent_id
    message.role = role
    message.parts = []
    message.task_id = None
    return message


class TestProcessInsertedMessage:
    @pytest.mark.asyncio
    async def test_marks_inserted_message_running_then_success(self):
        update_status = AsyncMock()
        root_id = uuid.uuid4()
        branch_messages = [
            _make_message(root_id, "user"),
            _make_message(_MESSAGE_ID, "assistant", parent_id=root_id),
        ]

        with (
            patch(f"{MODULE}.DB_CLIENT", _mock_db()),
            patch(f"{MODULE}.get_metrics", new_callable=AsyncMock, return_value=False),
            patch(f"{MODULE}.get_wide_event", MagicMock(return_value={})),
            patch(
                f"{MODULE}.MD.update_message_status_to",
                update_status,
            ),
            patch(
                f"{MODULE}.MD.fetch_message_branch_path_data",
                new_callable=AsyncMock,
                return_value=Result.resolve(branch_messages),
            ),
            patch(
                f"{MODULE}.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                f"{MODULE}.AT.task_agent_curd",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_task_agent,
        ):
            result = await process_inserted_message(
                _mock_project_config(),
                _PROJECT_ID,
                _SESSION_ID,
                _MESSAGE_ID,
            )

            assert result.ok()
            assert update_status.call_args_list[0].args[1:] == (
                [_MESSAGE_ID],
                TaskStatus.RUNNING,
            )
            assert update_status.call_args_list[-1].args[1:] == (
                [_MESSAGE_ID],
                TaskStatus.SUCCESS,
            )

            task_messages = mock_task_agent.call_args.args[2]
            assert [message.message_id for message in task_messages] == [
                branch_messages[0].id,
                branch_messages[1].id,
            ]
            assert [message.parent_id for message in task_messages] == [
                None,
                root_id,
            ]

    @pytest.mark.asyncio
    async def test_branch_load_error_rolls_back_only_inserted_message(self):
        update_status = AsyncMock()

        with (
            patch(f"{MODULE}.DB_CLIENT", _mock_db()),
            patch(f"{MODULE}.get_metrics", new_callable=AsyncMock, return_value=False),
            patch(f"{MODULE}.get_wide_event", MagicMock(return_value={})),
            patch(
                f"{MODULE}.MD.update_message_status_to",
                update_status,
            ),
            patch(
                f"{MODULE}.MD.fetch_message_branch_path_data",
                new_callable=AsyncMock,
                return_value=Result.reject("branch lookup failed"),
            ),
            patch(
                f"{MODULE}.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
            ) as mock_ls,
            patch(
                f"{MODULE}.AT.task_agent_curd",
                new_callable=AsyncMock,
            ) as mock_task_agent,
        ):
            result = await process_inserted_message(
                _mock_project_config(),
                _PROJECT_ID,
                _SESSION_ID,
                _MESSAGE_ID,
            )

            assert not result.ok()
            assert update_status.call_args_list[0].args[1:] == (
                [_MESSAGE_ID],
                TaskStatus.RUNNING,
            )
            assert update_status.call_args_list[-1].args[1:] == (
                [_MESSAGE_ID],
                TaskStatus.FAILED,
            )
            mock_ls.assert_not_called()
            mock_task_agent.assert_not_called()

    @pytest.mark.asyncio
    async def test_task_agent_exception_rolls_back_only_inserted_message(self):
        update_status = AsyncMock()
        root_id = uuid.uuid4()
        branch_messages = [
            _make_message(root_id, "user"),
            _make_message(_MESSAGE_ID, "assistant", parent_id=root_id),
        ]

        with (
            patch(f"{MODULE}.DB_CLIENT", _mock_db()),
            patch(f"{MODULE}.get_metrics", new_callable=AsyncMock, return_value=False),
            patch(f"{MODULE}.get_wide_event", MagicMock(return_value={})),
            patch(
                f"{MODULE}.MD.update_message_status_to",
                update_status,
            ),
            patch(
                f"{MODULE}.MD.fetch_message_branch_path_data",
                new_callable=AsyncMock,
                return_value=Result.resolve(branch_messages),
            ),
            patch(
                f"{MODULE}.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                f"{MODULE}.AT.task_agent_curd",
                new_callable=AsyncMock,
                side_effect=asyncio.CancelledError(),
            ),
        ):
            with pytest.raises(asyncio.CancelledError):
                await process_inserted_message(
                    _mock_project_config(),
                    _PROJECT_ID,
                    _SESSION_ID,
                    _MESSAGE_ID,
                )

            assert update_status.call_args_list[0].args[1:] == (
                [_MESSAGE_ID],
                TaskStatus.RUNNING,
            )
            assert update_status.call_args_list[-1].args[1:] == (
                [_MESSAGE_ID],
                TaskStatus.FAILED,
            )
