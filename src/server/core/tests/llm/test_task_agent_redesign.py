"""
Tests for the task agent behavior redesign:
- set_user_preference_for_task data function
- TaskSchema.to_string() with user preferences
- append_task_progress tool handler
- set_task_user_preference tool handler
- simplified append_messages_to_task handler
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.schema.session.task import TaskSchema, TaskData, TaskStatus
from acontext_core.llm.tool.task_lib.ctx import TaskCtx
from acontext_core.llm.tool.task_lib.progress import _append_task_progress_handler
from acontext_core.llm.tool.task_lib.set_preference import (
    _set_task_user_preference_handler,
)
from acontext_core.llm.tool.task_lib.append import _append_messages_to_task_handler


def _make_ctx(
    tasks: list[TaskSchema] = None,
    message_ids: list = None,
) -> TaskCtx:
    tasks = tasks or []
    message_ids = message_ids or []
    return TaskCtx(
        db_session=AsyncMock(),
        project_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        task_ids_index=[t.id for t in tasks],
        task_index=tasks,
        message_ids_index=message_ids,
    )


def _make_task(
    order: int = 1,
    status: TaskStatus = TaskStatus.RUNNING,
    description: str = "Test task",
    user_preferences: list[str] | None = None,
    progresses: list[str] | None = None,
) -> TaskSchema:
    return TaskSchema(
        id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        order=order,
        status=status,
        data=TaskData(
            task_description=description,
            progresses=progresses,
            user_preferences=user_preferences,
        ),
        raw_message_ids=[],
    )


# =============================================================================
# TaskSchema.to_string() tests
# =============================================================================


class TestToStringWithPreferences:
    def test_single_preference(self):
        task = _make_task(user_preferences=["user wants dark mode"])
        result = task.to_string()
        assert 'User Prefs: "user wants dark mode"' in result
        assert result.startswith("Task 1: Test task (Status: running)")

    def test_multi_element_legacy_preferences_joined(self):
        task = _make_task(user_preferences=["wants React", "prefers TypeScript", "uses VSCode"])
        result = task.to_string()
        assert 'User Prefs: "wants React | prefers TypeScript | uses VSCode"' in result

    def test_none_preferences_omitted(self):
        task = _make_task(user_preferences=None)
        result = task.to_string()
        assert "User Prefs" not in result
        assert result == "Task 1: Test task (Status: running)"

    def test_empty_list_preferences_omitted(self):
        task = _make_task(user_preferences=[])
        result = task.to_string()
        assert "User Prefs" not in result
        assert result == "Task 1: Test task (Status: running)"


# =============================================================================
# append_task_progress handler tests
# =============================================================================


class TestAppendTaskProgressHandler:
    @pytest.mark.asyncio
    async def test_appends_progress_correctly(self):
        task = _make_task(status=TaskStatus.RUNNING)
        ctx = _make_ctx(tasks=[task])

        with patch(
            "acontext_core.llm.tool.task_lib.progress.TD.append_progress_to_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(None),
        ) as mock_append:
            result = await _append_task_progress_handler(
                ctx, {"task_order": 1, "progress": "Created login component"}
            )
            assert result.ok()
            mock_append.assert_called_once_with(
                ctx.db_session, task.id, "Created login component"
            )

    @pytest.mark.asyncio
    async def test_rejects_success_task(self):
        task = _make_task(status=TaskStatus.SUCCESS)
        ctx = _make_ctx(tasks=[task])

        result = await _append_task_progress_handler(
            ctx, {"task_order": 1, "progress": "some progress"}
        )
        assert result.ok()  # Result.resolve with error message
        data, _ = result.unpack()
        assert "already" in data.lower()
        assert "success" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_failed_task(self):
        task = _make_task(status=TaskStatus.FAILED)
        ctx = _make_ctx(tasks=[task])

        result = await _append_task_progress_handler(
            ctx, {"task_order": 1, "progress": "some progress"}
        )
        data, _ = result.unpack()
        assert "already" in data.lower()
        assert "failed" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_out_of_range(self):
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        result = await _append_task_progress_handler(
            ctx, {"task_order": 5, "progress": "some progress"}
        )
        data, _ = result.unpack()
        assert "out of range" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_empty_progress(self):
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        result = await _append_task_progress_handler(
            ctx, {"task_order": 1, "progress": "   "}
        )
        data, _ = result.unpack()
        assert "non-empty" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_missing_task_order(self):
        ctx = _make_ctx(tasks=[_make_task()])

        result = await _append_task_progress_handler(
            ctx, {"progress": "some progress"}
        )
        data, _ = result.unpack()
        assert "task_order" in data.lower()


# =============================================================================
# set_task_user_preference handler tests
# =============================================================================


class TestSetTaskUserPreferenceHandler:
    @pytest.mark.asyncio
    async def test_sets_preference_correctly(self):
        task = _make_task(status=TaskStatus.RUNNING)
        ctx = _make_ctx(tasks=[task])

        with patch(
            "acontext_core.llm.tool.task_lib.set_preference.TD.set_user_preference_for_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(None),
        ) as mock_set:
            result = await _set_task_user_preference_handler(
                ctx, {"task_order": 1, "user_preference": "user wants dark mode and React"}
            )
            assert result.ok()
            mock_set.assert_called_once_with(
                ctx.db_session, task.id, "user wants dark mode and React"
            )

    @pytest.mark.asyncio
    async def test_rejects_empty_preference(self):
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        result = await _set_task_user_preference_handler(
            ctx, {"task_order": 1, "user_preference": "   "}
        )
        data, _ = result.unpack()
        assert "non-empty" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_out_of_range(self):
        task = _make_task()
        ctx = _make_ctx(tasks=[task])

        result = await _set_task_user_preference_handler(
            ctx, {"task_order": 10, "user_preference": "some pref"}
        )
        data, _ = result.unpack()
        assert "out of range" in data.lower()

    @pytest.mark.asyncio
    async def test_works_on_any_status(self):
        """Preferences can be set on any task status, including success/failed."""
        for status in [TaskStatus.PENDING, TaskStatus.RUNNING, TaskStatus.SUCCESS, TaskStatus.FAILED]:
            task = _make_task(status=status)
            ctx = _make_ctx(tasks=[task])

            with patch(
                "acontext_core.llm.tool.task_lib.set_preference.TD.set_user_preference_for_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ):
                result = await _set_task_user_preference_handler(
                    ctx, {"task_order": 1, "user_preference": "user pref"}
                )
                assert result.ok()
                data, _ = result.unpack()
                assert "set" in data.lower()


# =============================================================================
# Simplified append_messages_to_task handler tests
# =============================================================================


class TestSimplifiedAppendMessagesToTask:
    @pytest.mark.asyncio
    async def test_links_messages_only(self):
        """Handler should only link messages, not call progress or preference functions."""
        task = _make_task(status=TaskStatus.RUNNING)
        msg_ids = [uuid.uuid4(), uuid.uuid4()]
        ctx = _make_ctx(tasks=[task], message_ids=msg_ids)

        with (
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.append_messages_to_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_append_msg,
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.append_progress_to_task",
                new_callable=AsyncMock,
            ) as mock_progress,
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.update_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
        ):
            result = await _append_messages_to_task_handler(
                ctx, {"task_order": 1, "message_id_range": [0, 1]}
            )
            assert result.ok()
            mock_append_msg.assert_called_once()
            mock_progress.assert_not_called()

    @pytest.mark.asyncio
    async def test_auto_sets_running_status(self):
        """Handler should auto-set status to running if not already."""
        task = _make_task(status=TaskStatus.PENDING)
        msg_ids = [uuid.uuid4()]
        ctx = _make_ctx(tasks=[task], message_ids=msg_ids)

        with (
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.append_messages_to_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.update_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_update,
        ):
            result = await _append_messages_to_task_handler(
                ctx, {"task_order": 1, "message_id_range": [0, 0]}
            )
            assert result.ok()
            mock_update.assert_called_once_with(
                ctx.db_session, task.id, status="running"
            )

    @pytest.mark.asyncio
    async def test_does_not_set_running_if_already(self):
        """Handler should NOT call update_task if already running."""
        task = _make_task(status=TaskStatus.RUNNING)
        msg_ids = [uuid.uuid4()]
        ctx = _make_ctx(tasks=[task], message_ids=msg_ids)

        with (
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.append_messages_to_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.update_task",
                new_callable=AsyncMock,
            ) as mock_update,
        ):
            result = await _append_messages_to_task_handler(
                ctx, {"task_order": 1, "message_id_range": [0, 0]}
            )
            assert result.ok()
            mock_update.assert_not_called()

    @pytest.mark.asyncio
    async def test_rejects_success_task(self):
        task = _make_task(status=TaskStatus.SUCCESS)
        msg_ids = [uuid.uuid4()]
        ctx = _make_ctx(tasks=[task], message_ids=msg_ids)

        result = await _append_messages_to_task_handler(
            ctx, {"task_order": 1, "message_id_range": [0, 0]}
        )
        data, _ = result.unpack()
        assert "already" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_failed_task(self):
        task = _make_task(status=TaskStatus.FAILED)
        msg_ids = [uuid.uuid4()]
        ctx = _make_ctx(tasks=[task], message_ids=msg_ids)

        result = await _append_messages_to_task_handler(
            ctx, {"task_order": 1, "message_id_range": [0, 0]}
        )
        data, _ = result.unpack()
        assert "already" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_invalid_range(self):
        """Handler should reject non-2-element arrays."""
        task = _make_task(status=TaskStatus.RUNNING)
        ctx = _make_ctx(tasks=[task], message_ids=[uuid.uuid4()])

        result = await _append_messages_to_task_handler(
            ctx, {"task_order": 1, "message_id_range": [5]}
        )
        data, _ = result.unpack()
        assert "2-element" in data.lower()

    @pytest.mark.asyncio
    async def test_rejects_inverted_range(self):
        """Handler should reject start > end."""
        task = _make_task(status=TaskStatus.RUNNING)
        ctx = _make_ctx(tasks=[task], message_ids=[uuid.uuid4()])

        result = await _append_messages_to_task_handler(
            ctx, {"task_order": 1, "message_id_range": [5, 2]}
        )
        data, _ = result.unpack()
        assert "start must be <= end" in data.lower()

    @pytest.mark.asyncio
    async def test_expands_range_correctly(self):
        """Range [1, 3] should expand to message indexes 1, 2, 3."""
        task = _make_task(status=TaskStatus.RUNNING)
        msg_ids = [uuid.uuid4() for _ in range(5)]
        ctx = _make_ctx(tasks=[task], message_ids=msg_ids)

        with (
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.append_messages_to_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_append_msg,
            patch(
                "acontext_core.llm.tool.task_lib.append.TD.update_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
        ):
            result = await _append_messages_to_task_handler(
                ctx, {"task_order": 1, "message_id_range": [1, 3]}
            )
            assert result.ok()
            # Should pass the actual UUIDs for indexes 1, 2, 3
            called_ids = mock_append_msg.call_args[0][1]
            assert called_ids == [msg_ids[1], msg_ids[2], msg_ids[3]]


# =============================================================================
# Data layer tests (DB-backed)
# =============================================================================


class TestSetUserPreferenceForTaskData:
    @pytest.mark.asyncio
    async def test_replaces_existing_preferences(self, db_client):
        from acontext_core.service.data.task import set_user_preference_for_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_replace",
                secret_key_hash_phc="test_pref_replace",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={
                    "task_description": "Test",
                    "user_preferences": ["old pref"],
                },
                status="running",
            )
            session.add(task)
            await session.flush()

            result = await set_user_preference_for_task(
                session, task.id, "new complete preference"
            )
            data, error = result.unpack()
            assert error is None

            await session.refresh(task)
            assert task.data["user_preferences"] == ["new complete preference"]

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_works_when_none(self, db_client):
        from acontext_core.service.data.task import set_user_preference_for_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_none",
                secret_key_hash_phc="test_pref_none",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test"},  # No user_preferences key
                status="running",
            )
            session.add(task)
            await session.flush()

            result = await set_user_preference_for_task(
                session, task.id, "first preference"
            )
            data, error = result.unpack()
            assert error is None

            await session.refresh(task)
            assert task.data["user_preferences"] == ["first preference"]

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_replaces_legacy_multi_element(self, db_client):
        from acontext_core.service.data.task import set_user_preference_for_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_legacy",
                secret_key_hash_phc="test_pref_legacy",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={
                    "task_description": "Test",
                    "user_preferences": ["a", "b", "c"],
                },
                status="running",
            )
            session.add(task)
            await session.flush()

            result = await set_user_preference_for_task(
                session, task.id, "new single pref"
            )
            data, error = result.unpack()
            assert error is None

            await session.refresh(task)
            assert task.data["user_preferences"] == ["new single pref"]

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_works_with_empty_list(self, db_client):
        from acontext_core.service.data.task import set_user_preference_for_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_empty",
                secret_key_hash_phc="test_pref_empty",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={
                    "task_description": "Test",
                    "user_preferences": [],
                },
                status="running",
            )
            session.add(task)
            await session.flush()

            result = await set_user_preference_for_task(
                session, task.id, "pref from empty"
            )
            data, error = result.unpack()
            assert error is None

            await session.refresh(task)
            assert task.data["user_preferences"] == ["pref from empty"]

            await session.delete(project)


class TestProgressAndPreferenceSameSession:
    @pytest.mark.asyncio
    async def test_both_jsonb_fields_updated(self, db_client):
        """Test append_task_progress + set_user_preference_for_task on same task in same session."""
        from acontext_core.service.data.task import (
            append_progress_to_task,
            set_user_preference_for_task,
        )
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_both_jsonb",
                secret_key_hash_phc="test_both_jsonb",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            task = Task(
                session_id=test_session.id,
                project_id=project.id,
                order=1,
                data={"task_description": "Test"},
                status="running",
            )
            session.add(task)
            await session.flush()

            # Both operations in same session
            r1 = await append_progress_to_task(session, task.id, "Step 1 done")
            assert r1.ok()

            r2 = await set_user_preference_for_task(session, task.id, "user wants X")
            assert r2.ok()

            await session.refresh(task)
            assert task.data["progresses"] == ["Step 1 done"]
            assert task.data["user_preferences"] == ["user wants X"]

            await session.delete(project)


class TestAppendProgressNoUserPreferenceParam:
    @pytest.mark.asyncio
    async def test_no_user_preference_parameter(self, db_client):
        """Verify append_progress_to_task no longer accepts user_preference."""
        from acontext_core.service.data.task import append_progress_to_task
        from acontext_core.schema.orm import Task, Project, Session
        import inspect

        sig = inspect.signature(append_progress_to_task)
        params = list(sig.parameters.keys())
        assert "user_preference" not in params, (
            "append_progress_to_task should no longer have user_preference parameter"
        )


# =============================================================================
# Tool registry & wiring tests
# =============================================================================


class TestToolRegistryAndWiring:
    def test_task_tools_has_new_tools(self):
        from acontext_core.llm.tool.task_tools import TASK_TOOLS

        assert "append_task_progress" in TASK_TOOLS
        assert "set_task_user_preference" in TASK_TOOLS

    def test_tool_schema_returns_8_tools(self):
        from acontext_core.llm.prompt.task import TaskPrompt

        schemas = TaskPrompt.tool_schema()
        assert len(schemas) == 8
        names = [s.function.name for s in schemas]
        assert "append_task_progress" in names
        assert "set_task_user_preference" in names

    def test_need_update_ctx_has_new_tools(self):
        from acontext_core.llm.agent.task import NEED_UPDATE_CTX

        assert "append_task_progress" in NEED_UPDATE_CTX
        assert "set_task_user_preference" in NEED_UPDATE_CTX
