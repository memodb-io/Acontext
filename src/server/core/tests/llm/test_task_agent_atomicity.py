"""
Tests for Fix 1: Transaction atomicity across tool calls in one LLM iteration.

Verifies that all tool calls within a single LLM response execute in one DB
transaction. If any tool fails, the entire iteration rolls back.
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import BaseModel
from acontext_core.schema.result import Result
from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction
from acontext_core.schema.session.task import TaskSchema
from acontext_core.llm.agent.task import task_agent_curd, build_task_ctx
from acontext_core.llm.tool.base import Tool
from acontext_core.llm.tool.task_lib.ctx import TaskCtx


class _StubRawResponse(BaseModel):
    """Minimal BaseModel to satisfy LLMResponse.raw_response type."""
    pass


def _make_tool_call(tool_name: str, arguments: dict, call_id: str = None) -> LLMToolCall:
    return LLMToolCall(
        id=call_id or uuid.uuid4().hex,
        type="function",
        function=LLMFunction(name=tool_name, arguments=arguments),
    )


def _make_llm_response(tool_calls: list[LLMToolCall], content: str = "thinking...") -> LLMResponse:
    return LLMResponse(
        role="assistant",
        raw_response=_StubRawResponse(),
        content=content,
        tool_calls=tool_calls,
    )


def _make_finish_response() -> LLMResponse:
    return LLMResponse(
        role="assistant",
        raw_response=_StubRawResponse(),
        content="Done.",
        tool_calls=None,
    )


class TestAtomicityOnSuccess:
    """Fix 1 — Atomicity on success: multiple tool calls commit together."""

    @pytest.mark.asyncio
    async def test_all_tools_commit_in_single_transaction(self):
        """
        Mock LLM returning multiple tool calls (insert_task + append_messages).
        Verify both are committed together (single session context entered once).
        """
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        messages = []

        mock_db_session = AsyncMock()
        mock_ctx = TaskCtx(
            db_session=mock_db_session,
            project_id=project_id,
            session_id=session_id,
            task_ids_index=[],
            task_index=[],
            message_ids_index=[],
        )

        tool_calls = [
            _make_tool_call("insert_task", {"after_task_order": 0, "task_description": "Test task"}),
            _make_tool_call("append_messages_to_task", {"task_order": 1, "message_ids": [0]}),
        ]
        llm_response = _make_llm_response(tool_calls)

        mock_handler_1 = AsyncMock(return_value=Result.resolve("inserted task_1"))
        mock_handler_2 = AsyncMock(return_value=Result.resolve("appended"))

        mock_tools = {
            "insert_task": Tool(schema=MagicMock(), handler=mock_handler_1),
            "append_messages_to_task": Tool(schema=MagicMock(), handler=mock_handler_2),
        }

        session_context_calls = []

        class FakeSessionContext:
            async def __aenter__(self_ctx):
                session_context_calls.append("enter")
                return mock_db_session

            async def __aexit__(self_ctx, exc_type, exc_val, exc_tb):
                session_context_calls.append("exit")
                if exc_type:
                    session_context_calls.append("rollback")
                    raise exc_val
                session_context_calls.append("commit")
                return False

        with (
            patch("acontext_core.llm.agent.task.llm_complete") as mock_llm,
            patch("acontext_core.llm.agent.task.response_to_sendable_message", return_value={"role": "assistant", "content": "..."}),
            patch("acontext_core.llm.agent.task.TASK_TOOLS", mock_tools),
            patch("acontext_core.llm.agent.task.build_task_ctx", new_callable=AsyncMock, return_value=mock_ctx),
            patch("acontext_core.llm.agent.task.TD.fetch_current_tasks", new_callable=AsyncMock, return_value=Result.resolve([])),
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db_client,
        ):
            # First call returns tool calls, second returns no tool calls (stop)
            mock_llm.side_effect = [
                Result.resolve(llm_response),
                Result.resolve(_make_finish_response()),
            ]
            mock_db_client.get_session_context.side_effect = [
                FakeSessionContext(),  # initial fetch_current_tasks
                FakeSessionContext(),  # the tool-call loop transaction
            ]

            result = await task_agent_curd(project_id, session_id, messages)

            assert result.ok()
            mock_handler_1.assert_called_once()
            mock_handler_2.assert_called_once()
            # Two session contexts: one for initial fetch, one for the tool loop
            assert session_context_calls.count("enter") == 2
            assert session_context_calls.count("commit") == 2


class TestAtomicityOnFailure:
    """Fix 1 — Atomicity on failure: tool #2 fails, tool #1 writes rolled back."""

    @pytest.mark.asyncio
    async def test_failure_triggers_rollback_and_reject(self):
        """
        Mock LLM returning multiple tool calls where tool #2 fails with
        Result.reject(). Verify tool #1's writes are rolled back.
        """
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        messages = []

        mock_db_session = AsyncMock()
        mock_ctx = TaskCtx(
            db_session=mock_db_session,
            project_id=project_id,
            session_id=session_id,
            task_ids_index=[],
            task_index=[],
            message_ids_index=[],
        )

        tool_calls = [
            _make_tool_call("insert_task", {"after_task_order": 0, "task_description": "Test task"}),
            _make_tool_call("append_messages_to_task", {"task_order": 1, "message_ids": [0]}),
        ]
        llm_response = _make_llm_response(tool_calls)

        mock_handler_1 = AsyncMock(return_value=Result.resolve("inserted task_1"))
        mock_handler_2 = AsyncMock(return_value=Result.reject("Some tool error"))

        mock_tools = {
            "insert_task": Tool(schema=MagicMock(), handler=mock_handler_1),
            "append_messages_to_task": Tool(schema=MagicMock(), handler=mock_handler_2),
        }

        rollback_called = False

        class FakeSessionContext:
            async def __aenter__(self_ctx):
                return mock_db_session

            async def __aexit__(self_ctx, exc_type, exc_val, exc_tb):
                nonlocal rollback_called
                if exc_type:
                    rollback_called = True
                    # Re-raise to propagate to the outer try/except RuntimeError
                    return False
                return False

        with (
            patch("acontext_core.llm.agent.task.llm_complete") as mock_llm,
            patch("acontext_core.llm.agent.task.response_to_sendable_message", return_value={"role": "assistant", "content": "..."}),
            patch("acontext_core.llm.agent.task.TASK_TOOLS", mock_tools),
            patch("acontext_core.llm.agent.task.build_task_ctx", new_callable=AsyncMock, return_value=mock_ctx),
            patch("acontext_core.llm.agent.task.TD.fetch_current_tasks", new_callable=AsyncMock, return_value=Result.resolve([])),
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db_client,
        ):
            mock_llm.return_value = Result.resolve(llm_response)
            mock_db_client.get_session_context.side_effect = [
                FakeSessionContext(),  # initial fetch
                FakeSessionContext(),  # tool loop — should rollback
            ]

            result = await task_agent_curd(project_id, session_id, messages)

            assert not result.ok()
            assert "rejected" in result.error.errmsg.lower() or "error" in result.error.errmsg.lower()
            assert rollback_called, "DB session should have been rolled back"
            # Tool #1 was called, tool #2 was called and failed
            mock_handler_1.assert_called_once()
            mock_handler_2.assert_called_once()


class TestContextRebuildWithinTransaction:
    """Fix 1 — Context rebuild within transaction: USE_CTX=None triggers rebuild
    that sees flush()'d writes within the same session."""

    @pytest.mark.asyncio
    async def test_rebuild_sees_flushed_writes(self):
        """
        Mock LLM returning insert_task + append_messages_to_task (which triggers
        USE_CTX = None). Verify build_task_ctx is called again with the same
        db_session, which would see the newly inserted task via flush().
        """
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        messages = []

        mock_db_session = AsyncMock()

        # build_task_ctx will be called twice:
        # 1st call: initial ctx (before_use_ctx=None)
        # 2nd call: rebuild after insert_task sets USE_CTX=None (before_use_ctx=None)
        build_ctx_db_sessions = []

        async def fake_build_task_ctx(db_session, proj_id, sess_id, msgs, before_use_ctx=None):
            build_ctx_db_sessions.append(db_session)
            return TaskCtx(
                db_session=db_session,
                project_id=proj_id,
                session_id=sess_id,
                task_ids_index=[],
                task_index=[],
                message_ids_index=[],
            )

        tool_calls = [
            _make_tool_call("insert_task", {"after_task_order": 0, "task_description": "New task"}),
            _make_tool_call("append_messages_to_task", {"task_order": 1, "message_ids": [0]}),
        ]
        llm_response = _make_llm_response(tool_calls)

        mock_tools = {
            "insert_task": Tool(schema=MagicMock(), handler=AsyncMock(return_value=Result.resolve("inserted"))),
            "append_messages_to_task": Tool(schema=MagicMock(), handler=AsyncMock(return_value=Result.resolve("appended"))),
        }
        # Mark insert_task as needing ctx rebuild
        mock_tools["insert_task"].schema.function.name = "insert_task"

        class FakeSessionContext:
            async def __aenter__(self_ctx):
                return mock_db_session

            async def __aexit__(self_ctx, exc_type, exc_val, exc_tb):
                return False

        with (
            patch("acontext_core.llm.agent.task.llm_complete") as mock_llm,
            patch("acontext_core.llm.agent.task.response_to_sendable_message", return_value={"role": "assistant", "content": "..."}),
            patch("acontext_core.llm.agent.task.TASK_TOOLS", mock_tools),
            patch("acontext_core.llm.agent.task.build_task_ctx", side_effect=fake_build_task_ctx),
            patch("acontext_core.llm.agent.task.TD.fetch_current_tasks", new_callable=AsyncMock, return_value=Result.resolve([])),
            patch("acontext_core.llm.agent.task.DB_CLIENT") as mock_db_client,
        ):
            mock_llm.side_effect = [
                Result.resolve(llm_response),
                Result.resolve(_make_finish_response()),
            ]
            mock_db_client.get_session_context.side_effect = [
                FakeSessionContext(),  # initial fetch
                FakeSessionContext(),  # tool loop
            ]

            result = await task_agent_curd(project_id, session_id, messages)

            assert result.ok()
            # build_task_ctx called twice for the tool loop (once for insert_task,
            # once for append_messages_to_task after USE_CTX was reset to None)
            assert len(build_ctx_db_sessions) == 2
            # Both calls got the SAME db_session — the shared transaction
            assert build_ctx_db_sessions[0] is build_ctx_db_sessions[1]
            assert build_ctx_db_sessions[0] is mock_db_session
