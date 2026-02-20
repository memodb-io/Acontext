"""
Tests for the task agent behavior:
- append_preference_to_planning_task data function
- TaskSchema.to_string() (no user preferences displayed)
- append_task_progress tool handler
- submit_user_preference tool handler
- simplified append_messages_to_task handler
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.schema.session.task import TaskSchema, TaskData, TaskStatus
from acontext_core.llm.tool.task_lib.ctx import TaskCtx
from acontext_core.llm.tool.task_lib.progress import _append_task_progress_handler
from acontext_core.llm.tool.task_lib.submit_preference import (
    _submit_user_preference_handler,
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
# TaskSchema.to_string() tests — no longer shows user preferences
# =============================================================================


class TestToStringWithPreferences:
    def test_single_preference_not_shown(self):
        task = _make_task(user_preferences=["user wants dark mode"])
        result = task.to_string()
        assert "User Prefs" not in result
        assert result == "Task 1: Test task (Status: running)"

    def test_multi_element_preferences_not_shown(self):
        task = _make_task(user_preferences=["wants React", "prefers TypeScript", "uses VSCode"])
        result = task.to_string()
        assert "User Prefs" not in result
        assert result == "Task 1: Test task (Status: running)"

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
# submit_user_preference handler tests
# =============================================================================


class TestSubmitUserPreferenceHandler:
    @pytest.mark.asyncio
    async def test_appends_to_pending_preferences(self):
        ctx = _make_ctx(tasks=[_make_task()])

        with patch(
            "acontext_core.llm.tool.task_lib.submit_preference.TD.append_preference_to_planning_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(None),
        ):
            result = await _submit_user_preference_handler(
                ctx, {"preference": "user prefers TypeScript"}
            )
            assert result.ok()
            assert "user prefers TypeScript" in ctx.pending_preferences

    @pytest.mark.asyncio
    async def test_persists_to_planning_task(self):
        ctx = _make_ctx(tasks=[_make_task()])

        with patch(
            "acontext_core.llm.tool.task_lib.submit_preference.TD.append_preference_to_planning_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(None),
        ) as mock_append:
            result = await _submit_user_preference_handler(
                ctx, {"preference": "email: user@co.com"}
            )
            assert result.ok()
            mock_append.assert_called_once_with(
                ctx.db_session, ctx.project_id, ctx.session_id, "email: user@co.com"
            )

    @pytest.mark.asyncio
    async def test_rejects_empty_preference(self):
        ctx = _make_ctx(tasks=[_make_task()])

        result = await _submit_user_preference_handler(
            ctx, {"preference": "   "}
        )
        data, _ = result.unpack()
        assert "non-empty" in data.lower()
        assert len(ctx.pending_preferences) == 0

    @pytest.mark.asyncio
    async def test_rejects_none_preference(self):
        ctx = _make_ctx(tasks=[_make_task()])

        result = await _submit_user_preference_handler(
            ctx, {}
        )
        data, _ = result.unpack()
        assert "non-empty" in data.lower()

    @pytest.mark.asyncio
    async def test_db_failure_still_captures_for_mq(self):
        """Even if DB persist fails, preference is still in pending_preferences."""
        ctx = _make_ctx(tasks=[_make_task()])

        with patch(
            "acontext_core.llm.tool.task_lib.submit_preference.TD.append_preference_to_planning_task",
            new_callable=AsyncMock,
            return_value=Result.reject("DB error"),
        ):
            result = await _submit_user_preference_handler(
                ctx, {"preference": "prefers dark mode"}
            )
            assert result.ok()
            assert "prefers dark mode" in ctx.pending_preferences

    @pytest.mark.asyncio
    async def test_db_exception_still_captures_for_mq(self):
        """Even if DB raises exception, preference is still in pending_preferences."""
        ctx = _make_ctx(tasks=[_make_task()])

        with patch(
            "acontext_core.llm.tool.task_lib.submit_preference.TD.append_preference_to_planning_task",
            new_callable=AsyncMock,
            side_effect=RuntimeError("Connection lost"),
        ):
            result = await _submit_user_preference_handler(
                ctx, {"preference": "uses PostgreSQL"}
            )
            assert result.ok()
            assert "uses PostgreSQL" in ctx.pending_preferences

    @pytest.mark.asyncio
    async def test_multiple_preferences_accumulate(self):
        ctx = _make_ctx(tasks=[_make_task()])

        with patch(
            "acontext_core.llm.tool.task_lib.submit_preference.TD.append_preference_to_planning_task",
            new_callable=AsyncMock,
            return_value=Result.resolve(None),
        ):
            await _submit_user_preference_handler(ctx, {"preference": "pref 1"})
            await _submit_user_preference_handler(ctx, {"preference": "pref 2"})
            await _submit_user_preference_handler(ctx, {"preference": "pref 3"})

        assert ctx.pending_preferences == ["pref 1", "pref 2", "pref 3"]


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
# pack_task_input known preferences tests
# =============================================================================


class TestPackTaskInputKnownPreferences:
    def test_includes_known_preferences_section(self):
        from acontext_core.llm.prompt.task import TaskPrompt

        result = TaskPrompt.pack_task_input(
            previous_progress="progress here",
            current_message_with_ids="messages here",
            current_tasks="tasks here",
            known_preferences=["prefers TypeScript", "uses VS Code"],
        )
        assert "## Known User Preferences:" in result
        assert "- prefers TypeScript" in result
        assert "- uses VS Code" in result

    def test_omits_section_when_no_preferences(self):
        from acontext_core.llm.prompt.task import TaskPrompt

        result = TaskPrompt.pack_task_input(
            previous_progress="progress here",
            current_message_with_ids="messages here",
            current_tasks="tasks here",
            known_preferences=None,
        )
        assert "Known User Preferences" not in result

    def test_omits_section_when_empty_list(self):
        from acontext_core.llm.prompt.task import TaskPrompt

        result = TaskPrompt.pack_task_input(
            previous_progress="progress here",
            current_message_with_ids="messages here",
            current_tasks="tasks here",
            known_preferences=[],
        )
        assert "Known User Preferences" not in result

    def test_section_between_progress_and_messages(self):
        from acontext_core.llm.prompt.task import TaskPrompt

        result = TaskPrompt.pack_task_input(
            previous_progress="progress here",
            current_message_with_ids="messages here",
            current_tasks="tasks here",
            known_preferences=["pref1"],
        )
        progress_pos = result.index("progress here")
        prefs_pos = result.index("Known User Preferences")
        messages_pos = result.index("messages here")
        assert progress_pos < prefs_pos < messages_pos


# =============================================================================
# Data layer tests (DB-backed)
# =============================================================================


class TestAppendPreferenceToPlanningTaskData:
    @pytest.mark.asyncio
    async def test_creates_planning_task_and_appends(self, db_client):
        from acontext_core.service.data.task import append_preference_to_planning_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_planning_create",
                secret_key_hash_phc="test_pref_planning_create",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            result = await append_preference_to_planning_task(
                session, project.id, test_session.id, "prefers TypeScript"
            )
            data, error = result.unpack()
            assert error is None

            from sqlalchemy import select
            query = (
                select(Task)
                .where(Task.session_id == test_session.id)
                .where(Task.is_planning == True)  # noqa: E712
            )
            res = await session.execute(query)
            planning = res.scalars().first()
            assert planning is not None
            assert planning.data["user_preferences"] == ["prefers TypeScript"]

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_appends_to_existing_planning_task(self, db_client):
        from acontext_core.service.data.task import append_preference_to_planning_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_planning_append",
                secret_key_hash_phc="test_pref_planning_append",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            planning_task = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=0,
                data={
                    "task_description": "collecting planning&requirments",
                    "user_preferences": ["existing pref"],
                },
                status="pending",
                is_planning=True,
            )
            session.add(planning_task)
            await session.flush()

            result = await append_preference_to_planning_task(
                session, project.id, test_session.id, "new pref"
            )
            data, error = result.unpack()
            assert error is None

            await session.refresh(planning_task)
            assert planning_task.data["user_preferences"] == ["existing pref", "new pref"]

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_initializes_list_when_absent(self, db_client):
        from acontext_core.service.data.task import append_preference_to_planning_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_planning_init",
                secret_key_hash_phc="test_pref_planning_init",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            planning_task = Task(
                project_id=project.id,
                session_id=test_session.id,
                order=0,
                data={"task_description": "collecting planning&requirments"},
                status="pending",
                is_planning=True,
            )
            session.add(planning_task)
            await session.flush()

            result = await append_preference_to_planning_task(
                session, project.id, test_session.id, "first pref"
            )
            data, error = result.unpack()
            assert error is None

            await session.refresh(planning_task)
            assert planning_task.data["user_preferences"] == ["first pref"]

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_multiple_appends_accumulate(self, db_client):
        from acontext_core.service.data.task import append_preference_to_planning_task
        from acontext_core.schema.orm import Task, Project, Session

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_pref_planning_multi",
                secret_key_hash_phc="test_pref_planning_multi",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            r1 = await append_preference_to_planning_task(
                session, project.id, test_session.id, "pref A"
            )
            assert r1.ok()
            r2 = await append_preference_to_planning_task(
                session, project.id, test_session.id, "pref B"
            )
            assert r2.ok()
            r3 = await append_preference_to_planning_task(
                session, project.id, test_session.id, "pref C"
            )
            assert r3.ok()

            from sqlalchemy import select
            query = (
                select(Task)
                .where(Task.session_id == test_session.id)
                .where(Task.is_planning == True)  # noqa: E712
            )
            res = await session.execute(query)
            planning = res.scalars().first()
            assert planning.data["user_preferences"] == ["pref A", "pref B", "pref C"]

            await session.delete(project)


class TestProgressAndPreferenceSameSession:
    @pytest.mark.asyncio
    async def test_both_jsonb_fields_updated(self, db_client):
        """Test append_task_progress + append_preference_to_planning_task on same session."""
        from acontext_core.service.data.task import (
            append_progress_to_task,
            append_preference_to_planning_task,
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

            r1 = await append_progress_to_task(session, task.id, "Step 1 done")
            assert r1.ok()

            r2 = await append_preference_to_planning_task(
                session, project.id, test_session.id, "user wants X"
            )
            assert r2.ok()

            await session.refresh(task)
            assert task.data["progresses"] == ["Step 1 done"]

            from sqlalchemy import select
            query = (
                select(Task)
                .where(Task.session_id == test_session.id)
                .where(Task.is_planning == True)  # noqa: E712
            )
            res = await session.execute(query)
            planning = res.scalars().first()
            assert planning is not None
            assert planning.data["user_preferences"] == ["user wants X"]

            await session.delete(project)


class TestAppendProgressNoUserPreferenceParam:
    @pytest.mark.asyncio
    async def test_no_user_preference_parameter(self, db_client):
        """Verify append_progress_to_task no longer accepts user_preference."""
        from acontext_core.service.data.task import append_progress_to_task
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
        assert "submit_user_preference" in TASK_TOOLS
        assert "set_task_user_preference" not in TASK_TOOLS

    def test_tool_schema_returns_8_tools(self):
        from acontext_core.llm.prompt.task import TaskPrompt

        schemas = TaskPrompt.tool_schema()
        assert len(schemas) == 8
        names = [s.function.name for s in schemas]
        assert "append_task_progress" in names
        assert "submit_user_preference" in names
        assert "set_task_user_preference" not in names

    def test_need_update_ctx_does_not_have_preference_tool(self):
        from acontext_core.llm.agent.task import NEED_UPDATE_CTX

        assert "append_task_progress" in NEED_UPDATE_CTX
        assert "submit_user_preference" not in NEED_UPDATE_CTX
        assert "set_task_user_preference" not in NEED_UPDATE_CTX


# =============================================================================
# TaskData schema backward compat
# =============================================================================


class TestTaskDataSchemaCompat:
    def test_user_preferences_field_exists(self):
        data = TaskData(
            task_description="Test",
            user_preferences=["old pref"],
        )
        assert data.user_preferences == ["old pref"]

    def test_user_preferences_none_by_default(self):
        data = TaskData(task_description="Test")
        assert data.user_preferences is None

    def test_old_regular_task_data_deserializes(self):
        raw = {
            "task_description": "Legacy task",
            "progresses": ["step 1"],
            "user_preferences": ["legacy pref"],
        }
        data = TaskData(**raw)
        assert data.user_preferences == ["legacy pref"]
        assert data.progresses == ["step 1"]
