"""
Tests for the skill learning trigger mechanism.

Covers:
- update_task appends task_id to ctx.learning_task_ids for success/failed
- update_task does NOT append for running/pending
- Agent loop drain-publish behavior with enable_skill_learning flag
- NEED_UPDATE_CTX edge case: IDs preserved in function-scoped list
"""

import uuid
import pytest
from pydantic import BaseModel as PydanticBaseModel
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction
from acontext_core.schema.session.task import TaskSchema, TaskData, TaskStatus
from acontext_core.service.constants import EX, RK
from acontext_core.llm.tool.task_lib.ctx import TaskCtx
from acontext_core.llm.tool.task_lib.update import update_task_handler
from acontext_core.llm.agent.task import task_agent_curd


def _make_task(
    order: int = 1,
    status: TaskStatus = TaskStatus.RUNNING,
    description: str = "Test task",
) -> TaskSchema:
    return TaskSchema(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        order=order,
        status=status,
        data=TaskData(task_description=description),
        raw_message_ids=[],
    )


def _make_ctx(tasks: list[TaskSchema] | None = None) -> TaskCtx:
    tasks = tasks or []
    return TaskCtx(
        db_session=AsyncMock(),
        project_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        task_ids_index=[t.id for t in tasks],
        task_index=tasks,
        message_ids_index=[],
    )


# =============================================================================
# update_task collection tests
# =============================================================================


class TestUpdateTaskCollectsLearningIds:
    @pytest.mark.asyncio
    async def test_success_appends_task_id(self):
        """update_task to success appends task_id to ctx.learning_task_ids."""
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        mock_updated = MagicMock()
        mock_updated.order = 1

        with patch(
            "acontext_core.llm.tool.task_lib.update.TD.update_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_updated),
        ):
            result = await update_task_handler(
                ctx, {"task_order": 1, "task_status": "success"}
            )
            assert result.ok()
            assert task.id in ctx.learning_task_ids

    @pytest.mark.asyncio
    async def test_failed_appends_task_id(self):
        """update_task to failed appends task_id to ctx.learning_task_ids."""
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        mock_updated = MagicMock()
        mock_updated.order = 1

        with patch(
            "acontext_core.llm.tool.task_lib.update.TD.update_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_updated),
        ):
            result = await update_task_handler(
                ctx, {"task_order": 1, "task_status": "failed"}
            )
            assert result.ok()
            assert task.id in ctx.learning_task_ids

    @pytest.mark.asyncio
    async def test_running_does_not_append(self):
        """update_task to running does NOT append to learning_task_ids."""
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        mock_updated = MagicMock()
        mock_updated.order = 1

        with patch(
            "acontext_core.llm.tool.task_lib.update.TD.update_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_updated),
        ):
            await update_task_handler(
                ctx, {"task_order": 1, "task_status": "running"}
            )
            assert len(ctx.learning_task_ids) == 0

    @pytest.mark.asyncio
    async def test_pending_does_not_append(self):
        """update_task to pending does NOT append to learning_task_ids."""
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        mock_updated = MagicMock()
        mock_updated.order = 1

        with patch(
            "acontext_core.llm.tool.task_lib.update.TD.update_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_updated),
        ):
            await update_task_handler(
                ctx, {"task_order": 1, "task_status": "pending"}
            )
            assert len(ctx.learning_task_ids) == 0

    @pytest.mark.asyncio
    async def test_no_status_does_not_append(self):
        """update_task without task_status does NOT append."""
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        mock_updated = MagicMock()
        mock_updated.order = 1

        with patch(
            "acontext_core.llm.tool.task_lib.update.TD.update_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_updated),
        ):
            await update_task_handler(
                ctx, {"task_order": 1, "task_description": "Updated desc"}
            )
            assert len(ctx.learning_task_ids) == 0

    @pytest.mark.asyncio
    async def test_multiple_updates_collect_all(self):
        """Multiple update_task calls accumulate all IDs."""
        task1 = _make_task(order=1)
        task2 = _make_task(order=2)
        ctx = _make_ctx(tasks=[task1, task2])

        mock_updated1 = MagicMock()
        mock_updated1.order = 1
        mock_updated2 = MagicMock()
        mock_updated2.order = 2

        with patch(
            "acontext_core.llm.tool.task_lib.update.TD.update_task",
            new_callable=AsyncMock,
            side_effect=[
                Result.resolve(mock_updated1),
                Result.resolve(mock_updated2),
            ],
        ):
            await update_task_handler(
                ctx, {"task_order": 1, "task_status": "success"}
            )
            await update_task_handler(
                ctx, {"task_order": 2, "task_status": "failed"}
            )
            assert len(ctx.learning_task_ids) == 2
            assert task1.id in ctx.learning_task_ids
            assert task2.id in ctx.learning_task_ids


# =============================================================================
# TaskCtx default tests
# =============================================================================


class TestTaskCtxDefaults:
    def test_learning_task_ids_default_empty(self):
        """TaskCtx.learning_task_ids defaults to empty list."""
        ctx = TaskCtx(
            db_session=AsyncMock(),
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_ids_index=[],
            task_index=[],
            message_ids_index=[],
        )
        assert ctx.learning_task_ids == []
        assert isinstance(ctx.learning_task_ids, list)

    def test_separate_instances_have_separate_lists(self):
        """Each TaskCtx instance has its own learning_task_ids list."""
        ctx1 = _make_ctx()
        ctx2 = _make_ctx()
        tid = uuid.uuid4()
        ctx1.learning_task_ids.append(tid)
        assert tid not in ctx2.learning_task_ids


# =============================================================================
# Agent loop drain-publish tests
# =============================================================================


class _FakeRaw(PydanticBaseModel):
    pass


def _make_llm_response(tool_calls):
    """Helper to create a mock LLMResponse with given tool calls."""
    return LLMResponse(
        role="assistant",
        raw_response=_FakeRaw(),
        tool_calls=tool_calls,
    )


def _make_mock_message():
    """Helper to create a mock MessageBlob."""
    mock_msg = MagicMock()
    mock_msg.message_id = uuid.uuid4()
    mock_msg.to_string = MagicMock(return_value="user message content")
    mock_msg.task_id = None
    return mock_msg


def _setup_db_mock(mock_db, db_session=None):
    """Configure the DB_CLIENT mock for async context manager usage."""
    if db_session is None:
        db_session = AsyncMock()
    mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
        return_value=db_session
    )
    mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
        return_value=False
    )
    return db_session


class TestAgentLoopDrainPublish:
    """Tests for the agent loop's drain-and-publish behavior in task_agent_curd."""

    @pytest.mark.asyncio
    async def test_learning_enabled_publishes_mq(self):
        """Agent loop with enable_skill_learning=True drains and calls publish_mq."""
        session_id = uuid.uuid4()
        project_id = uuid.uuid4()
        task = TaskSchema(
            id=uuid.uuid4(),
            session_id=session_id,
            order=1,
            status=TaskStatus.RUNNING,
            data=TaskData(task_description="Test task"),
            raw_message_ids=[],
        )

        mock_updated = MagicMock()
        mock_updated.order = 1

        llm_response = _make_llm_response([
            LLMToolCall(
                id="call_update",
                function=LLMFunction(
                    name="update_task",
                    arguments={"task_order": 1, "task_status": "success"},
                ),
                type="function",
            ),
            LLMToolCall(
                id="call_finish",
                function=LLMFunction(name="finish", arguments={}),
                type="function",
            ),
        ])

        with (
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.llm.agent.task.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve([task]),
            ),
            patch(
                "acontext_core.llm.agent.task.llm_complete",
                new_callable=AsyncMock,
                return_value=Result.resolve(llm_response),
            ),
            patch(
                "acontext_core.llm.agent.task.response_to_sendable_message",
                return_value={"role": "assistant", "content": "ok"},
            ),
            patch(
                "acontext_core.llm.tool.task_lib.update.TD.update_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_updated),
            ),
            patch(
                "acontext_core.llm.agent.task.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            _setup_db_mock(mock_db)

            result = await task_agent_curd(
                project_id=project_id,
                session_id=session_id,
                messages=[_make_mock_message()],
                enable_skill_learning=True,
            )

            assert result.ok()
            mock_publish.assert_called_once()
            # Verify exchange and routing key
            call_args = mock_publish.call_args
            assert call_args[0][0] == EX.learning_skill
            assert call_args[0][1] == RK.learning_skill_process

    @pytest.mark.asyncio
    async def test_learning_disabled_no_publish(self):
        """Agent loop with enable_skill_learning=False does NOT publish."""
        session_id = uuid.uuid4()
        project_id = uuid.uuid4()
        task = TaskSchema(
            id=uuid.uuid4(),
            session_id=session_id,
            order=1,
            status=TaskStatus.RUNNING,
            data=TaskData(task_description="Test task"),
            raw_message_ids=[],
        )

        mock_updated = MagicMock()
        mock_updated.order = 1

        llm_response = _make_llm_response([
            LLMToolCall(
                id="call_update",
                function=LLMFunction(
                    name="update_task",
                    arguments={"task_order": 1, "task_status": "success"},
                ),
                type="function",
            ),
            LLMToolCall(
                id="call_finish",
                function=LLMFunction(name="finish", arguments={}),
                type="function",
            ),
        ])

        with (
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.llm.agent.task.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve([task]),
            ),
            patch(
                "acontext_core.llm.agent.task.llm_complete",
                new_callable=AsyncMock,
                return_value=Result.resolve(llm_response),
            ),
            patch(
                "acontext_core.llm.agent.task.response_to_sendable_message",
                return_value={"role": "assistant", "content": "ok"},
            ),
            patch(
                "acontext_core.llm.tool.task_lib.update.TD.update_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_updated),
            ),
            patch(
                "acontext_core.llm.agent.task.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            _setup_db_mock(mock_db)

            result = await task_agent_curd(
                project_id=project_id,
                session_id=session_id,
                messages=[_make_mock_message()],
                enable_skill_learning=False,
            )

            assert result.ok()
            mock_publish.assert_not_called()

    @pytest.mark.asyncio
    async def test_need_update_ctx_preserves_ids_across_resets(self):
        """NEED_UPDATE_CTX edge case: IDs are preserved in function-scoped list
        after USE_CTX = None. Two update_task calls → both IDs published."""
        session_id = uuid.uuid4()
        project_id = uuid.uuid4()
        task1 = TaskSchema(
            id=uuid.uuid4(),
            session_id=session_id,
            order=1,
            status=TaskStatus.RUNNING,
            data=TaskData(task_description="Task 1"),
            raw_message_ids=[],
        )
        task2 = TaskSchema(
            id=uuid.uuid4(),
            session_id=session_id,
            order=2,
            status=TaskStatus.RUNNING,
            data=TaskData(task_description="Task 2"),
            raw_message_ids=[],
        )

        mock_updated1 = MagicMock()
        mock_updated1.order = 1
        mock_updated2 = MagicMock()
        mock_updated2.order = 2

        llm_response = _make_llm_response([
            LLMToolCall(
                id="call_update_1",
                function=LLMFunction(
                    name="update_task",
                    arguments={"task_order": 1, "task_status": "success"},
                ),
                type="function",
            ),
            LLMToolCall(
                id="call_update_2",
                function=LLMFunction(
                    name="update_task",
                    arguments={"task_order": 2, "task_status": "failed"},
                ),
                type="function",
            ),
            LLMToolCall(
                id="call_finish",
                function=LLMFunction(name="finish", arguments={}),
                type="function",
            ),
        ])

        with (
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.llm.agent.task.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve([task1, task2]),
            ),
            patch(
                "acontext_core.llm.agent.task.llm_complete",
                new_callable=AsyncMock,
                return_value=Result.resolve(llm_response),
            ),
            patch(
                "acontext_core.llm.agent.task.response_to_sendable_message",
                return_value={"role": "assistant", "content": "ok"},
            ),
            patch(
                "acontext_core.llm.tool.task_lib.update.TD.update_task",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve(mock_updated1),
                    Result.resolve(mock_updated2),
                ],
            ),
            patch(
                "acontext_core.llm.agent.task.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            _setup_db_mock(mock_db)

            result = await task_agent_curd(
                project_id=project_id,
                session_id=session_id,
                messages=[_make_mock_message()],
                enable_skill_learning=True,
            )

            assert result.ok()
            # Both task IDs should have been published
            assert mock_publish.call_count == 2
            published_jsons = [
                call_args[0][2] for call_args in mock_publish.call_args_list
            ]
            # Verify both task IDs appear in the published messages
            assert str(task1.id) in "".join(published_jsons)
            assert str(task2.id) in "".join(published_jsons)

    @pytest.mark.asyncio
    async def test_pending_list_cleared_after_drain(self):
        """Agent loop clears _pending_learning_task_ids after publishing."""
        session_id = uuid.uuid4()
        project_id = uuid.uuid4()
        task = TaskSchema(
            id=uuid.uuid4(),
            session_id=session_id,
            order=1,
            status=TaskStatus.RUNNING,
            data=TaskData(task_description="Task"),
            raw_message_ids=[],
        )

        mock_updated = MagicMock()
        mock_updated.order = 1

        # LLM returns update_task(success) in first iteration, then no tools
        # in second iteration (to verify cleared list doesn't publish again)
        llm_responses = [
            _make_llm_response([
                LLMToolCall(
                    id="call_update",
                    function=LLMFunction(
                        name="update_task",
                        arguments={"task_order": 1, "task_status": "success"},
                    ),
                    type="function",
                ),
            ]),
            # Second iteration: LLM returns no tool calls → loop stops
            LLMResponse(
                role="assistant",
                raw_response=_FakeRaw(),
                tool_calls=None,
                content="Done.",
            ),
        ]

        with (
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.llm.agent.task.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve([task]),
            ),
            patch(
                "acontext_core.llm.agent.task.llm_complete",
                new_callable=AsyncMock,
                side_effect=[
                    Result.resolve(llm_responses[0]),
                    Result.resolve(llm_responses[1]),
                ],
            ),
            patch(
                "acontext_core.llm.agent.task.response_to_sendable_message",
                return_value={"role": "assistant", "content": "ok"},
            ),
            patch(
                "acontext_core.llm.tool.task_lib.update.TD.update_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_updated),
            ),
            patch(
                "acontext_core.llm.agent.task.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            _setup_db_mock(mock_db)

            result = await task_agent_curd(
                project_id=project_id,
                session_id=session_id,
                messages=[_make_mock_message()],
                enable_skill_learning=True,
            )

            assert result.ok()
            # Only one publish call — list was cleared and not re-published
            assert mock_publish.call_count == 1
