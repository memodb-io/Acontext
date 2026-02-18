"""
Tests for the split skill learner consumers and controllers.

Covers:
- Distillation consumer: resolves LS, calls controller, publishes SkillLearnDistilled
- Distillation consumer: skips when session has no learning space
- Distillation consumer: does NOT publish when distillation fails
- Distillation consumer: publishes correct learning_space_id
- Agent consumer: acquires lock and calls run_skill_agent
- Agent consumer: lock contention → republishes same SkillLearnDistilled body
- Agent consumer: lock released in finally (even on error)
- Agent consumer: logs session_id and task_id for observability
- Controller: process_context_distillation error paths
- Controller: run_skill_agent error paths
- SkillLearnDistilled schema serialization round-trip
- End-to-end: distillation → agent with correct args
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.schema.session.task import TaskData, TaskStatus
from acontext_core.schema.mq.learning import SkillLearnTask, SkillLearnDistilled
from acontext_core.env import DEFAULT_CORE_CONFIG
from acontext_core.service.skill_learner import (
    process_skill_distillation,
    process_skill_agent,
)
from acontext_core.service.controller.skill_learner import (
    process_context_distillation,
    run_skill_agent,
)


def _make_body(
    project_id=None, session_id=None, task_id=None
) -> SkillLearnTask:
    return SkillLearnTask(
        project_id=project_id or uuid.uuid4(),
        session_id=session_id or uuid.uuid4(),
        task_id=task_id or uuid.uuid4(),
    )


def _make_distilled_body(
    project_id=None,
    session_id=None,
    task_id=None,
    learning_space_id=None,
    distilled_context="Test distilled context",
) -> SkillLearnDistilled:
    return SkillLearnDistilled(
        project_id=project_id or uuid.uuid4(),
        session_id=session_id or uuid.uuid4(),
        task_id=task_id or uuid.uuid4(),
        learning_space_id=learning_space_id or uuid.uuid4(),
        distilled_context=distilled_context,
    )


def _make_ls_session(learning_space_id=None):
    mock = MagicMock()
    mock.learning_space_id = learning_space_id or uuid.uuid4()
    return mock


def _make_learning_space(user_id=None):
    mock = MagicMock()
    mock.user_id = user_id
    return mock


# =============================================================================
# Distillation consumer tests
# =============================================================================


class TestDistillationConsumer:
    @pytest.mark.asyncio
    async def test_publishes_distilled_on_success(self):
        """Distillation consumer publishes SkillLearnDistilled on success."""
        body = _make_body()
        ls_session = _make_ls_session()
        mock_message = MagicMock()

        distilled_payload = SkillLearnDistilled(
            project_id=body.project_id,
            session_id=body.session_id,
            task_id=body.task_id,
            learning_space_id=ls_session.learning_space_id,
            distilled_context="distilled text",
        )

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(ls_session),
            ),
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.SLC.process_context_distillation",
                new_callable=AsyncMock,
                return_value=Result.resolve(distilled_payload),
            ) as mock_distill,
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_distillation(body, mock_message)

            mock_distill.assert_called_once_with(
                body.project_id,
                body.session_id,
                body.task_id,
                ls_session.learning_space_id,
            )
            mock_publish.assert_called_once()
            call_kwargs = mock_publish.call_args.kwargs
            assert call_kwargs["routing_key"] == "learning.skill.agent"

    @pytest.mark.asyncio
    async def test_does_not_publish_on_distillation_failure(self):
        """Distillation consumer does NOT publish when distillation fails."""
        body = _make_body()
        ls_session = _make_ls_session()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(ls_session),
            ),
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.SLC.process_context_distillation",
                new_callable=AsyncMock,
                return_value=Result.reject("LLM timeout"),
            ),
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_distillation(body, mock_message)

            mock_publish.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_no_learning_space(self):
        """Distillation consumer skips when session has no learning space."""
        body = _make_body()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                "acontext_core.service.skill_learner.SLC.process_context_distillation",
                new_callable=AsyncMock,
            ) as mock_distill,
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_distillation(body, mock_message)

            mock_distill.assert_not_called()
            mock_publish.assert_not_called()

    @pytest.mark.asyncio
    async def test_publishes_correct_learning_space_id(self):
        """Distillation consumer includes correct learning_space_id in published message."""
        body = _make_body()
        expected_ls_id = uuid.uuid4()
        ls_session = _make_ls_session(learning_space_id=expected_ls_id)
        mock_message = MagicMock()

        distilled_payload = SkillLearnDistilled(
            project_id=body.project_id,
            session_id=body.session_id,
            task_id=body.task_id,
            learning_space_id=expected_ls_id,
            distilled_context="distilled text",
        )

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(ls_session),
            ),
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.SLC.process_context_distillation",
                new_callable=AsyncMock,
                return_value=Result.resolve(distilled_payload),
            ),
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_distillation(body, mock_message)

            mock_publish.assert_called_once()
            published_json = mock_publish.call_args.kwargs["body"]
            restored = SkillLearnDistilled.model_validate_json(published_json)
            assert restored.learning_space_id == expected_ls_id

    @pytest.mark.asyncio
    async def test_does_not_publish_when_task_skipped(self):
        """Distillation consumer does NOT publish when controller returns None (task skipped)."""
        body = _make_body()
        ls_session = _make_ls_session()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.get_learning_space_for_session",
                new_callable=AsyncMock,
                return_value=Result.resolve(ls_session),
            ),
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.SLC.process_context_distillation",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_distillation(body, mock_message)

            mock_publish.assert_not_called()


# =============================================================================
# Agent consumer tests
# =============================================================================


class TestAgentConsumer:
    @pytest.mark.asyncio
    async def test_acquires_lock_and_runs_agent(self):
        """Agent consumer acquires lock and calls run_skill_agent."""
        body = _make_distilled_body()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "acontext_core.service.skill_learner.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.skill_learner.SLC.run_skill_agent",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_agent,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_agent(body, mock_message)

            mock_agent.assert_called_once_with(
                body.project_id,
                body.learning_space_id,
                body.distilled_context,
                max_iterations=DEFAULT_CORE_CONFIG.skill_learn_agent_max_iterations,
            )
            mock_release.assert_called_once()

    @pytest.mark.asyncio
    async def test_lock_contention_republishes_same_body(self):
        """Agent consumer republishes same SkillLearnDistilled body on lock contention."""
        body = _make_distilled_body()
        mock_message = MagicMock()

        with (
            patch(
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
            patch(
                "acontext_core.service.skill_learner.SLC.run_skill_agent",
                new_callable=AsyncMock,
            ) as mock_agent,
        ):
            await process_skill_agent(body, mock_message)

            mock_agent.assert_not_called()
            mock_publish.assert_called_once()
            # Verify retry routing key
            call_kwargs = mock_publish.call_args.kwargs
            assert call_kwargs["routing_key"] == "learning.skill.agent.retry"
            # Verify body is the same SkillLearnDistilled (not SkillLearnTask)
            published_json = call_kwargs["body"]
            restored = SkillLearnDistilled.model_validate_json(published_json)
            assert restored.project_id == body.project_id
            assert restored.learning_space_id == body.learning_space_id
            assert restored.distilled_context == body.distilled_context

    @pytest.mark.asyncio
    async def test_lock_released_on_agent_error(self):
        """Agent consumer releases lock in finally block even on agent error."""
        body = _make_distilled_body()
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "acontext_core.service.skill_learner.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.skill_learner.SLC.run_skill_agent",
                new_callable=AsyncMock,
                return_value=Result.reject("Agent crashed"),
            ),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_agent(body, mock_message)

            mock_release.assert_called_once()

    @pytest.mark.asyncio
    async def test_lock_released_on_exception(self):
        """Agent consumer releases lock even when run_skill_agent raises an exception."""
        body = _make_distilled_body()
        mock_message = MagicMock()

        with (
            patch(
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "acontext_core.service.skill_learner.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.skill_learner.SLC.run_skill_agent",
                new_callable=AsyncMock,
                side_effect=RuntimeError("Unexpected crash"),
            ),
        ):
            with pytest.raises(RuntimeError):
                await process_skill_agent(body, mock_message)

            mock_release.assert_called_once()

    @pytest.mark.asyncio
    async def test_lock_key_uses_learning_space_id_from_message(self):
        """Agent consumer uses learning_space_id from message for lock key."""
        ls_id = uuid.uuid4()
        body = _make_distilled_body(learning_space_id=ls_id)
        mock_message = MagicMock()

        with (
            patch("acontext_core.service.skill_learner.DB_CLIENT") as mock_db,
            patch(
                "acontext_core.service.skill_learner.LS.update_session_status",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ) as mock_lock,
            patch(
                "acontext_core.service.skill_learner.release_redis_lock",
                new_callable=AsyncMock,
            ),
            patch(
                "acontext_core.service.skill_learner.SLC.run_skill_agent",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_agent(body, mock_message)

            mock_lock.assert_called_once_with(
                body.project_id,
                f"skill_learn.{ls_id}",
                ttl_seconds=240,
            )


# =============================================================================
# Controller: process_context_distillation tests
# =============================================================================


class TestProcessContextDistillation:
    @pytest.mark.asyncio
    async def test_task_not_found(self):
        """Controller rejects when task is not found (stale message)."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        with patch(
            "acontext_core.service.controller.skill_learner.DB_CLIENT"
        ) as mock_db:
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            with patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_task",
                new_callable=AsyncMock,
                return_value=Result.reject("Not found"),
            ):
                result = await process_context_distillation(
                    project_id, session_id, task_id, ls_id
                )
                assert not result.ok()
                _, error = result.unpack()
                assert "not found" in error.errmsg.lower()

    @pytest.mark.asyncio
    async def test_task_not_success_or_failed_skips(self):
        """Controller resolves None when task is not in success/failed status."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.RUNNING

        with patch(
            "acontext_core.service.controller.skill_learner.DB_CLIENT"
        ) as mock_db:
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            with patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_task),
            ):
                result = await process_context_distillation(
                    project_id, session_id, task_id, ls_id
                )
                assert result.ok()
                value, _ = result.unpack()
                assert value is None

    @pytest.mark.asyncio
    async def test_distillation_failure(self):
        """Controller rejects when distillation LLM call fails."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.SUCCESS
        mock_task.raw_message_ids = []
        mock_task.data = TaskData(task_description="Test")

        mock_tasks = [mock_task]

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_task),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_tasks),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.llm_complete",
                new_callable=AsyncMock,
                return_value=Result.reject("LLM timeout"),
            ),
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await process_context_distillation(
                project_id, session_id, task_id, ls_id
            )
            assert not result.ok()
            _, error = result.unpack()
            assert "distillation" in error.errmsg.lower()

    @pytest.mark.asyncio
    async def test_returns_skill_learn_distilled_on_success(self):
        """Controller returns SkillLearnDistilled with correct fields on success."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.SUCCESS
        mock_task.raw_message_ids = []
        mock_task.data = TaskData(task_description="Test")

        mock_tasks = [mock_task]

        from pydantic import BaseModel
        from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction

        class FakeRaw(BaseModel):
            pass

        mock_llm_response = LLMResponse(
            role="assistant",
            raw_response=FakeRaw(),
            tool_calls=[
                LLMToolCall(
                    id="call_1",
                    function=LLMFunction(
                        name="report_success_analysis",
                        arguments={
                            "task_goal": "goal",
                            "approach": "approach",
                            "key_decisions": ["d1"],
                            "generalizable_pattern": "pattern",
                        },
                    ),
                    type="function",
                )
            ],
        )

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_task),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_tasks),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.llm_complete",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_llm_response),
            ),
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await process_context_distillation(
                project_id, session_id, task_id, ls_id
            )
            assert result.ok()
            payload, _ = result.unpack()
            assert isinstance(payload, SkillLearnDistilled)
            assert payload.project_id == project_id
            assert payload.session_id == session_id
            assert payload.task_id == task_id
            assert payload.learning_space_id == ls_id
            assert len(payload.distilled_context) > 0


# =============================================================================
# Controller: run_skill_agent tests
# =============================================================================


class TestRunSkillAgent:
    @pytest.mark.asyncio
    async def test_learning_space_deleted_rejects(self):
        """run_skill_agent rejects when learning space is deleted."""
        project_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space",
                new_callable=AsyncMock,
                return_value=Result.reject("Not found"),
            ),
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await run_skill_agent(project_id, ls_id, "context")
            assert not result.ok()
            _, error = result.unpack()
            assert "not found" in error.errmsg.lower()

    @pytest.mark.asyncio
    async def test_runs_agent_with_correct_args(self):
        """run_skill_agent passes correct args to skill_learner_agent."""
        project_id = uuid.uuid4()
        ls_id = uuid.uuid4()
        user_id = uuid.uuid4()
        distilled_context = "## Task Analysis (Success)\nTest content"

        mock_ls = _make_learning_space(user_id=user_id)

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_ls),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space_skill_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_skills_info",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.skill_learner_agent",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_agent,
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await run_skill_agent(project_id, ls_id, distilled_context)
            assert result.ok()
            mock_agent.assert_called_once()
            call_kwargs = mock_agent.call_args.kwargs
            assert call_kwargs["project_id"] == project_id
            assert call_kwargs["learning_space_id"] == ls_id
            assert call_kwargs["user_id"] == user_id
            assert call_kwargs["distilled_context"] == distilled_context
            assert call_kwargs["skills_info"] == []

    @pytest.mark.asyncio
    async def test_with_existing_skills(self):
        """run_skill_agent passes existing skills info to the agent."""
        project_id = uuid.uuid4()
        ls_id = uuid.uuid4()
        skill_id = uuid.uuid4()
        user_id = uuid.uuid4()

        mock_ls = _make_learning_space(user_id=user_id)

        from acontext_core.service.data.learning_space import SkillInfo

        mock_skill_info = SkillInfo(
            id=skill_id,
            disk_id=uuid.uuid4(),
            name="db-patterns",
            description="Database patterns",
            file_paths=["SKILL.md"],
        )

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_ls),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space_skill_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([skill_id]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_skills_info",
                new_callable=AsyncMock,
                return_value=Result.resolve([mock_skill_info]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.skill_learner_agent",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_agent,
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await run_skill_agent(project_id, ls_id, "context")
            assert result.ok()
            mock_agent.assert_called_once()
            call_kwargs = mock_agent.call_args.kwargs
            assert len(call_kwargs["skills_info"]) == 1
            assert call_kwargs["skills_info"][0].name == "db-patterns"


# =============================================================================
# MQ schema tests
# =============================================================================


class TestSkillLearnSchemas:
    def test_skill_learn_task_serialization(self):
        """SkillLearnTask serializes and deserializes correctly."""
        task = SkillLearnTask(
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
        )
        json_str = task.model_dump_json()
        restored = SkillLearnTask.model_validate_json(json_str)
        assert restored.project_id == task.project_id
        assert restored.session_id == task.session_id
        assert restored.task_id == task.task_id

    def test_skill_learn_distilled_serialization(self):
        """SkillLearnDistilled serializes and deserializes correctly."""
        distilled = SkillLearnDistilled(
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            learning_space_id=uuid.uuid4(),
            distilled_context="## Task Analysis (Success)\n**Goal**: Fix bug\n**Approach**: ...",
        )
        json_str = distilled.model_dump_json()
        restored = SkillLearnDistilled.model_validate_json(json_str)
        assert restored.project_id == distilled.project_id
        assert restored.session_id == distilled.session_id
        assert restored.task_id == distilled.task_id
        assert restored.learning_space_id == distilled.learning_space_id
        assert restored.distilled_context == distilled.distilled_context

    def test_skill_learn_distilled_context_as_string(self):
        """SkillLearnDistilled distilled_context is preserved as plain string."""
        context = "Line 1\nLine 2\n\nSpecial chars: <>&\"'"
        distilled = SkillLearnDistilled(
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            learning_space_id=uuid.uuid4(),
            distilled_context=context,
        )
        json_str = distilled.model_dump_json()
        restored = SkillLearnDistilled.model_validate_json(json_str)
        assert restored.distilled_context == context


# =============================================================================
# End-to-end controller tests
# =============================================================================


class TestEndToEnd:
    @pytest.mark.asyncio
    async def test_success_task_distillation_produces_payload(self):
        """SUCCESS task flows through distillation and produces SkillLearnDistilled."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.SUCCESS
        mock_task.raw_message_ids = [uuid.uuid4()]
        mock_task.data = TaskData(
            task_description="Fix login bug",
            progresses=["Read code", "Applied fix"],
        )

        mock_all_tasks = [mock_task]

        mock_message = MagicMock()
        mock_message.id = mock_task.raw_message_ids[0]
        mock_message.role = "user"
        mock_message.parts = [{"type": "text", "text": "Fix login"}]
        mock_message.task_id = task_id

        from pydantic import BaseModel
        from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction

        class FakeRaw(BaseModel):
            pass

        distill_response = LLMResponse(
            role="assistant",
            raw_response=FakeRaw(),
            tool_calls=[
                LLMToolCall(
                    id="call_distill",
                    function=LLMFunction(
                        name="report_success_analysis",
                        arguments={
                            "task_goal": "Fix login bug",
                            "approach": "Checked token expiry and fixed refresh.",
                            "key_decisions": ["Inspected auth middleware"],
                            "generalizable_pattern": "Always check token expiry.",
                        },
                    ),
                    type="function",
                )
            ],
        )

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_task),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_all_tasks),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.MD.fetch_messages_data_by_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([mock_message]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.llm_complete",
                new_callable=AsyncMock,
                return_value=Result.resolve(distill_response),
            ),
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await process_context_distillation(
                project_id, session_id, task_id, ls_id
            )

            assert result.ok()
            payload, _ = result.unpack()
            assert isinstance(payload, SkillLearnDistilled)
            assert "## Task Analysis (Success)" in payload.distilled_context
            assert "Fix login bug" in payload.distilled_context
            assert "token expiry" in payload.distilled_context
            assert payload.project_id == project_id
            assert payload.learning_space_id == ls_id

    @pytest.mark.asyncio
    async def test_failed_task_uses_failure_distillation(self):
        """Failed task uses failure distillation tool and prompt."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.FAILED
        mock_task.raw_message_ids = []
        mock_task.data = TaskData(task_description="Deploy service")

        mock_all_tasks = [mock_task]

        from pydantic import BaseModel
        from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction

        class FakeRaw(BaseModel):
            pass

        distill_response = LLMResponse(
            role="assistant",
            raw_response=FakeRaw(),
            tool_calls=[
                LLMToolCall(
                    id="call_distill_fail",
                    function=LLMFunction(
                        name="report_failure_analysis",
                        arguments={
                            "task_goal": "Deploy service",
                            "failure_point": "Ran migration without backup.",
                            "flawed_reasoning": "Assumed rollback would work.",
                            "what_should_have_been_done": "Take backup first.",
                            "prevention_principle": "Always backup before destructive ops.",
                        },
                    ),
                    type="function",
                )
            ],
        )

        captured_llm_calls = []
        original_llm_complete = AsyncMock(return_value=Result.resolve(distill_response))

        async def capturing_llm_complete(**kwargs):
            captured_llm_calls.append(kwargs)
            return await original_llm_complete(**kwargs)

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_task",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_task),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.TD.fetch_current_tasks",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_all_tasks),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.llm_complete",
                new_callable=AsyncMock,
                side_effect=capturing_llm_complete,
            ),
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await process_context_distillation(
                project_id, session_id, task_id, ls_id
            )

            assert result.ok()
            payload, _ = result.unpack()
            assert isinstance(payload, SkillLearnDistilled)

            # Verify failure distillation prompt was used
            assert len(captured_llm_calls) == 1
            distill_call = captured_llm_calls[0]
            assert "report_failure_analysis" in distill_call["system_prompt"]

            # Payload contains failure-formatted distilled context
            assert "## Task Analysis (Failure)" in payload.distilled_context
            assert "Deploy service" in payload.distilled_context
            assert "without backup" in payload.distilled_context

    @pytest.mark.asyncio
    async def test_agent_receives_distilled_context_and_runs(self):
        """run_skill_agent receives distilled context string and runs agent."""
        project_id = uuid.uuid4()
        ls_id = uuid.uuid4()
        user_id = uuid.uuid4()
        distilled_context = "## Task Analysis (Success)\n**Goal**: Optimize\n**Pattern**: Profile first"

        mock_ls = _make_learning_space(user_id=user_id)

        with (
            patch(
                "acontext_core.service.controller.skill_learner.DB_CLIENT"
            ) as mock_db,
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_ls),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space_skill_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_skills_info",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.skill_learner_agent",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_agent,
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await run_skill_agent(project_id, ls_id, distilled_context)

            assert result.ok()
            mock_agent.assert_called_once()
            call_kwargs = mock_agent.call_args.kwargs
            assert call_kwargs["distilled_context"] == distilled_context
            assert call_kwargs["project_id"] == project_id
            assert call_kwargs["learning_space_id"] == ls_id
            assert call_kwargs["user_id"] == user_id
