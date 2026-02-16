"""
Tests for the skill learner consumer and controller.

Covers:
- Consumer acquires lock and processes
- Consumer fails to acquire lock and republishes
- Lock released in finally
- Controller error paths: missing task, stale status, missing LS, distillation failure
- End-to-end: fetch task → distill → agent runs with correct args
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.schema.session.task import TaskSchema, TaskData, TaskStatus
from acontext_core.schema.mq.learning import SkillLearnTask
from acontext_core.service.skill_learner import process_skill_learn_task
from acontext_core.service.controller.skill_learner import process_skill_learning


def _make_body(
    project_id=None, session_id=None, task_id=None
) -> SkillLearnTask:
    return SkillLearnTask(
        project_id=project_id or uuid.uuid4(),
        session_id=session_id or uuid.uuid4(),
        task_id=task_id or uuid.uuid4(),
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
# Consumer locking tests
# =============================================================================


class TestConsumerLocking:
    @pytest.mark.asyncio
    async def test_acquires_lock_and_processes(self):
        """Consumer acquires lock and calls controller."""
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
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "acontext_core.service.skill_learner.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.skill_learner.SLC.process_skill_learning",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ) as mock_process,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_learn_task(body, mock_message)

            mock_process.assert_called_once_with(
                body.project_id,
                body.session_id,
                body.task_id,
                ls_session.learning_space_id,
            )
            mock_release.assert_called_once()

    @pytest.mark.asyncio
    async def test_lock_failed_republishes_to_retry(self):
        """Consumer fails to acquire lock and republishes to retry queue."""
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
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=False,
            ),
            patch(
                "acontext_core.service.skill_learner.publish_mq",
                new_callable=AsyncMock,
            ) as mock_publish,
            patch(
                "acontext_core.service.skill_learner.SLC.process_skill_learning",
                new_callable=AsyncMock,
            ) as mock_process,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_learn_task(body, mock_message)

            mock_process.assert_not_called()
            mock_publish.assert_called_once()
            # Verify routing key is the retry queue
            call_kwargs = mock_publish.call_args.kwargs
            assert "retry" in call_kwargs["routing_key"]

    @pytest.mark.asyncio
    async def test_lock_released_on_controller_error(self):
        """Lock is released even when controller raises."""
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
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "acontext_core.service.skill_learner.release_redis_lock",
                new_callable=AsyncMock,
            ) as mock_release,
            patch(
                "acontext_core.service.skill_learner.SLC.process_skill_learning",
                new_callable=AsyncMock,
                return_value=Result.reject("Controller failed"),
            ),
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_learn_task(body, mock_message)

            # Lock must be released even on error
            mock_release.assert_called_once()

    @pytest.mark.asyncio
    async def test_no_learning_space_skips(self):
        """Consumer skips when session has no learning space."""
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
                "acontext_core.service.skill_learner.check_redis_lock_or_set",
                new_callable=AsyncMock,
            ) as mock_lock,
            patch(
                "acontext_core.service.skill_learner.SLC.process_skill_learning",
                new_callable=AsyncMock,
            ) as mock_process,
        ):
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=MagicMock()
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            await process_skill_learn_task(body, mock_message)

            mock_lock.assert_not_called()
            mock_process.assert_not_called()


# =============================================================================
# Controller error path tests
# =============================================================================


class TestControllerErrorPaths:
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
                result = await process_skill_learning(
                    project_id, session_id, task_id, ls_id
                )
                assert not result.ok()
                _, error = result.unpack()
                assert "not found" in error.errmsg.lower()

    @pytest.mark.asyncio
    async def test_task_not_success_or_failed_skips(self):
        """Controller resolves (skips) when task is not in success/failed status."""
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
                result = await process_skill_learning(
                    project_id, session_id, task_id, ls_id
                )
                # Should resolve (not reject) — stale message, just skip
                assert result.ok()

    @pytest.mark.asyncio
    async def test_distillation_failure_stops_agent(self):
        """Controller rejects and does NOT run agent when distillation fails."""
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
            patch(
                "acontext_core.service.controller.skill_learner.skill_learner_agent",
                new_callable=AsyncMock,
            ) as mock_agent,
        ):
            mock_session = AsyncMock()
            mock_db.get_session_context.return_value.__aenter__ = AsyncMock(
                return_value=mock_session
            )
            mock_db.get_session_context.return_value.__aexit__ = AsyncMock(
                return_value=False
            )

            result = await process_skill_learning(
                project_id, session_id, task_id, ls_id
            )
            assert not result.ok()
            _, error = result.unpack()
            assert "distillation" in error.errmsg.lower()
            # Agent must NOT have been called
            mock_agent.assert_not_called()

    @pytest.mark.asyncio
    async def test_learning_space_no_skills_calls_agent(self):
        """Controller handles learning space with no skills (agent creates new skills)."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.SUCCESS
        mock_task.raw_message_ids = []
        mock_task.data = TaskData(task_description="Test")

        mock_tasks = [mock_task]
        mock_ls = _make_learning_space(user_id=uuid.uuid4())

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
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_ls),
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_learning_space_skill_ids",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),  # No skills
            ),
            patch(
                "acontext_core.service.controller.skill_learner.LS.get_skills_info",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),  # No skills
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

            result = await process_skill_learning(
                project_id, session_id, task_id, ls_id
            )
            assert result.ok()
            # Agent must have been called with empty skills_info
            mock_agent.assert_called_once()
            call_kwargs = mock_agent.call_args.kwargs
            assert call_kwargs["skills_info"] == []
            assert call_kwargs["user_id"] == mock_ls.user_id
            assert call_kwargs["learning_space_id"] == ls_id

    @pytest.mark.asyncio
    async def test_learning_space_deleted_rejects(self):
        """Controller rejects when learning space is deleted between publish and consume."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.SUCCESS
        mock_task.raw_message_ids = []
        mock_task.data = TaskData(task_description="Test")

        mock_tasks = [mock_task]

        # Mock a successful distillation
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
                            "task_goal": "g",
                            "approach": "a",
                            "key_decisions": ["d"],
                            "generalizable_pattern": "p",
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

            result = await process_skill_learning(
                project_id, session_id, task_id, ls_id
            )
            assert not result.ok()
            _, error = result.unpack()
            assert "not found" in error.errmsg.lower()


# =============================================================================
# MQ schema tests
# =============================================================================


class TestSkillLearnTaskSchema:
    def test_serialization(self):
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


# =============================================================================
# End-to-end consumer test
# =============================================================================


class TestConsumerEndToEnd:
    """Full pipeline: fetch task → distill → fetch LS/skills → agent runs."""

    @pytest.mark.asyncio
    async def test_success_task_full_pipeline(self):
        """SkillLearnTask with SUCCESS task flows through distillation → agent."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()
        user_id = uuid.uuid4()

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

        mock_ls = _make_learning_space(user_id=user_id)

        from pydantic import BaseModel
        from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction

        class FakeRaw(BaseModel):
            pass

        # Distillation LLM response
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

            result = await process_skill_learning(
                project_id, session_id, task_id, ls_id
            )

            assert result.ok()
            mock_agent.assert_called_once()
            call_kwargs = mock_agent.call_args.kwargs

            # Agent receives distilled context, not raw messages
            assert "## Task Analysis (Success)" in call_kwargs["distilled_context"]
            assert "Fix login bug" in call_kwargs["distilled_context"]
            assert "token expiry" in call_kwargs["distilled_context"]

            # Agent receives correct IDs
            assert call_kwargs["project_id"] == project_id
            assert call_kwargs["learning_space_id"] == ls_id
            assert call_kwargs["user_id"] == user_id
            assert call_kwargs["skills_info"] == []

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
        mock_ls = _make_learning_space(user_id=uuid.uuid4())

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

            result = await process_skill_learning(
                project_id, session_id, task_id, ls_id
            )

            assert result.ok()

            # Verify failure distillation prompt was used
            assert len(captured_llm_calls) == 1
            distill_call = captured_llm_calls[0]
            assert "report_failure_analysis" in distill_call["system_prompt"]

            # Agent receives failure-formatted distilled context
            mock_agent.assert_called_once()
            distilled = mock_agent.call_args.kwargs["distilled_context"]
            assert "## Task Analysis (Failure)" in distilled
            assert "Deploy service" in distilled
            assert "without backup" in distilled

    @pytest.mark.asyncio
    async def test_full_pipeline_with_existing_skills(self):
        """Pipeline passes existing skills info to the agent."""
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()
        task_id = uuid.uuid4()
        ls_id = uuid.uuid4()
        skill_id = uuid.uuid4()

        mock_task = MagicMock()
        mock_task.status = TaskStatus.SUCCESS
        mock_task.raw_message_ids = []
        mock_task.data = TaskData(task_description="Optimize query")

        mock_all_tasks = [mock_task]
        mock_ls = _make_learning_space(user_id=uuid.uuid4())

        from pydantic import BaseModel
        from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction
        from acontext_core.service.data.learning_space import SkillInfo

        class FakeRaw(BaseModel):
            pass

        distill_response = LLMResponse(
            role="assistant",
            raw_response=FakeRaw(),
            tool_calls=[
                LLMToolCall(
                    id="call_d",
                    function=LLMFunction(
                        name="report_success_analysis",
                        arguments={
                            "task_goal": "Optimize query",
                            "approach": "Added index.",
                            "key_decisions": ["Profiled first"],
                            "generalizable_pattern": "Profile before optimizing.",
                        },
                    ),
                    type="function",
                )
            ],
        )

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
                return_value=Result.resolve(distill_response),
            ),
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

            result = await process_skill_learning(
                project_id, session_id, task_id, ls_id
            )

            assert result.ok()
            mock_agent.assert_called_once()
            call_kwargs = mock_agent.call_args.kwargs
            # Agent receives the existing skill info
            assert len(call_kwargs["skills_info"]) == 1
            assert call_kwargs["skills_info"][0].name == "db-patterns"
