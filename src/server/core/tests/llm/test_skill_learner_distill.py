"""
Tests for context distillation tool schemas and extraction.

Covers:
- DISTILL_SUCCESS_TOOL schema validation
- DISTILL_FAILURE_TOOL schema validation
- extract_distillation_result for success/failure/error paths
- Triviality filter (is_worth_learning / skip_reason)
- Distillation prompt content
- pack_distillation_input formatting
"""

import pytest
from unittest.mock import MagicMock
from pydantic import BaseModel

from acontext_core.schema.llm import LLMResponse, LLMToolCall, LLMFunction
from acontext_core.schema.session.task import TaskSchema, TaskData, TaskStatus
from acontext_core.schema.session.message import MessageBlob
from acontext_core.llm.tool.skill_learner_lib.distill import (
    DISTILL_SUCCESS_TOOL,
    DISTILL_FAILURE_TOOL,
    DistillationOutcome,
    extract_distillation_result,
)
from acontext_core.llm.prompt.skill_distillation import SkillDistillationPrompt


def _make_llm_response(tool_name: str, arguments: dict) -> LLMResponse:
    """Build a mock LLMResponse with a single tool call."""

    class FakeRaw(BaseModel):
        pass

    return LLMResponse(
        role="assistant",
        raw_response=FakeRaw(),
        content=None,
        tool_calls=[
            LLMToolCall(
                id="call_test_123",
                function=LLMFunction(name=tool_name, arguments=arguments),
                type="function",
            )
        ],
    )


def _make_llm_response_no_tools() -> LLMResponse:
    """Build a mock LLMResponse with no tool calls."""

    class FakeRaw(BaseModel):
        pass

    return LLMResponse(
        role="assistant",
        raw_response=FakeRaw(),
        content="I couldn't analyze this.",
        tool_calls=None,
    )


# =============================================================================
# Schema validation tests
# =============================================================================


class TestDistillSuccessToolSchema:
    def test_has_all_required_fields(self):
        """DISTILL_SUCCESS_TOOL has all required fields."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        assert "task_goal" in props
        assert "approach" in props
        assert "key_decisions" in props
        assert "generalizable_pattern" in props

    def test_required_list(self):
        """Required list matches expected fields."""
        required = DISTILL_SUCCESS_TOOL.function.parameters["required"]
        assert "task_goal" in required
        assert "approach" in required
        assert "key_decisions" in required
        assert "generalizable_pattern" in required

    def test_no_user_preferences_observed(self):
        """user_preferences_observed is no longer in properties."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        assert "user_preferences_observed" not in props

    def test_key_decisions_is_array(self):
        """key_decisions is an array of strings."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        assert props["key_decisions"]["type"] == "array"
        assert props["key_decisions"]["items"]["type"] == "string"

    def test_has_is_worth_learning_required(self):
        """is_worth_learning is in properties and required."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        required = DISTILL_SUCCESS_TOOL.function.parameters["required"]
        assert "is_worth_learning" in props
        assert props["is_worth_learning"]["type"] == "boolean"
        assert "is_worth_learning" in required

    def test_has_skip_reason_optional(self):
        """skip_reason is in properties but not required."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        required = DISTILL_SUCCESS_TOOL.function.parameters["required"]
        assert "skip_reason" in props
        assert "skip_reason" not in required


class TestDistillFailureToolSchema:
    def test_has_all_required_fields(self):
        """DISTILL_FAILURE_TOOL has all required fields."""
        props = DISTILL_FAILURE_TOOL.function.parameters["properties"]
        assert "task_goal" in props
        assert "failure_point" in props
        assert "flawed_reasoning" in props
        assert "what_should_have_been_done" in props
        assert "prevention_principle" in props

    def test_required_list(self):
        """Required list matches expected fields."""
        required = DISTILL_FAILURE_TOOL.function.parameters["required"]
        assert "task_goal" in required
        assert "failure_point" in required
        assert "flawed_reasoning" in required
        assert "what_should_have_been_done" in required
        assert "prevention_principle" in required

    def test_no_user_preferences_observed(self):
        """user_preferences_observed is no longer in properties."""
        props = DISTILL_FAILURE_TOOL.function.parameters["properties"]
        assert "user_preferences_observed" not in props

    def test_has_is_worth_learning_required(self):
        """is_worth_learning is in properties and required."""
        props = DISTILL_FAILURE_TOOL.function.parameters["properties"]
        required = DISTILL_FAILURE_TOOL.function.parameters["required"]
        assert "is_worth_learning" in props
        assert props["is_worth_learning"]["type"] == "boolean"
        assert "is_worth_learning" in required

    def test_has_skip_reason_optional(self):
        """skip_reason is in properties but not required."""
        props = DISTILL_FAILURE_TOOL.function.parameters["properties"]
        required = DISTILL_FAILURE_TOOL.function.parameters["required"]
        assert "skip_reason" in props
        assert "skip_reason" not in required


# =============================================================================
# extract_distillation_result tests
# =============================================================================


class TestExtractDistillationResultSuccess:
    def test_success_analysis_formatted(self):
        """Success tool call args are formatted into readable text."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "Fix login bug",
                "approach": "Checked token expiry logic and fixed the refresh flow.",
                "key_decisions": [
                    "Inspected the auth middleware first",
                    "Added token refresh before retry",
                ],
                "generalizable_pattern": "Always check token expiry before retrying.",
                "is_worth_learning": True,
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert isinstance(outcome, DistillationOutcome)
        assert outcome.is_worth_learning is True
        assert "## Task Analysis (Success)" in outcome.distilled_text
        assert "Fix login bug" in outcome.distilled_text
        assert "token expiry" in outcome.distilled_text
        assert "Inspected the auth middleware first" in outcome.distilled_text
        assert "Added token refresh before retry" in outcome.distilled_text
        assert "Always check token expiry" in outcome.distilled_text
        assert "User Preferences Observed" not in outcome.distilled_text

    def test_success_without_optional_preferences(self):
        """Success extraction handles missing user_preferences_observed."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "Deploy service",
                "approach": "Used blue-green deployment.",
                "key_decisions": ["Tested staging first"],
                "generalizable_pattern": "Always test in staging.",
                "is_worth_learning": True,
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert "User Preferences Observed" not in outcome.distilled_text

    def test_success_missing_required_field(self):
        """Success extraction rejects when required field is missing."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "Fix bug",
                "approach": "Fixed it.",
                # Missing key_decisions and generalizable_pattern
            },
        )
        result = extract_distillation_result(resp)
        assert not result.ok()


class TestExtractDistillationResultFailure:
    def test_failure_analysis_formatted(self):
        """Failure tool call args are formatted into readable text."""
        resp = _make_llm_response(
            "report_failure_analysis",
            {
                "task_goal": "Migrate database",
                "failure_point": "Ran migration without backup.",
                "flawed_reasoning": "Assumed rollback would work.",
                "what_should_have_been_done": "Take backup before migration.",
                "prevention_principle": "Always backup before destructive ops.",
                "is_worth_learning": True,
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert isinstance(outcome, DistillationOutcome)
        assert outcome.is_worth_learning is True
        assert "## Task Analysis (Failure)" in outcome.distilled_text
        assert "Migrate database" in outcome.distilled_text
        assert "without backup" in outcome.distilled_text
        assert "Assumed rollback" in outcome.distilled_text
        assert "Take backup" in outcome.distilled_text
        assert "Always backup" in outcome.distilled_text
        assert "User Preferences Observed" not in outcome.distilled_text

    def test_failure_without_optional_preferences(self):
        """Failure extraction handles missing user_preferences_observed."""
        resp = _make_llm_response(
            "report_failure_analysis",
            {
                "task_goal": "Fix bug",
                "failure_point": "Wrong file edited.",
                "flawed_reasoning": "Assumed it was the right file.",
                "what_should_have_been_done": "Read the error trace first.",
                "prevention_principle": "Always trace errors to source.",
                "is_worth_learning": True,
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert "User Preferences Observed" not in outcome.distilled_text

    def test_failure_missing_required_field(self):
        """Failure extraction rejects when required field is missing."""
        resp = _make_llm_response(
            "report_failure_analysis",
            {
                "task_goal": "Fix bug",
                # Missing other required fields
            },
        )
        result = extract_distillation_result(resp)
        assert not result.ok()


class TestExtractDistillationResultErrors:
    def test_no_tool_calls(self):
        """Returns error when LLM response has no tool calls."""
        resp = _make_llm_response_no_tools()
        result = extract_distillation_result(resp)
        assert not result.ok()

    def test_wrong_tool_name(self):
        """Returns error when tool call has unexpected function name."""
        resp = _make_llm_response("some_other_tool", {"data": "value"})
        result = extract_distillation_result(resp)
        assert not result.ok()


# =============================================================================
# Triviality filter (is_worth_learning) tests
# =============================================================================


class TestTrivialityFilter:
    def test_not_worth_learning_returns_false(self):
        """extract_distillation_result returns is_worth_learning=False + skip_reason when LLM sets it."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "What time is it?",
                "approach": "Looked up the current time.",
                "key_decisions": ["None"],
                "generalizable_pattern": "None",
                "is_worth_learning": False,
                "skip_reason": "simple factual lookup",
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert outcome.is_worth_learning is False
        assert outcome.skip_reason == "simple factual lookup"
        assert outcome.distilled_text is not None

    def test_worth_learning_returns_true(self):
        """extract_distillation_result returns is_worth_learning=True with distilled_text."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "Deploy API to staging",
                "approach": "Used blue-green deployment with health checks.",
                "key_decisions": ["Ran migrations first", "Verified health endpoint"],
                "generalizable_pattern": "Always run migrations before switching traffic.",
                "is_worth_learning": True,
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert outcome.is_worth_learning is True
        assert outcome.skip_reason is None
        assert "Deploy API" in outcome.distilled_text

    def test_defaults_to_worth_learning_when_field_missing(self):
        """extract_distillation_result defaults to is_worth_learning=True if field is missing (fail-open)."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "Fix auth bug",
                "approach": "Fixed token refresh.",
                "key_decisions": ["Checked middleware"],
                "generalizable_pattern": "Validate tokens.",
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert outcome.is_worth_learning is True

    def test_failure_not_worth_learning(self):
        """Failure analysis also supports is_worth_learning=False."""
        resp = _make_llm_response(
            "report_failure_analysis",
            {
                "task_goal": "Convert 5km to miles",
                "failure_point": "Gave wrong conversion factor.",
                "flawed_reasoning": "Used approximate factor.",
                "what_should_have_been_done": "Use exact factor 0.621371.",
                "prevention_principle": "Use precise conversion constants.",
                "is_worth_learning": False,
                "skip_reason": "one-shot calculation, no reusable pattern",
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert outcome.is_worth_learning is False
        assert outcome.skip_reason == "one-shot calculation, no reusable pattern"


# =============================================================================
# Distillation prompt tests
# =============================================================================


class TestDistillationPrompts:
    def test_success_distillation_prompt_mentions_tool(self):
        """Success distillation prompt references report_success_analysis."""
        prompt = SkillDistillationPrompt.success_distillation_prompt()
        assert len(prompt) > 0
        assert "report_success_analysis" in prompt

    def test_failure_distillation_prompt_mentions_tool(self):
        """Failure distillation prompt references report_failure_analysis."""
        prompt = SkillDistillationPrompt.failure_distillation_prompt()
        assert len(prompt) > 0
        assert "report_failure_analysis" in prompt

    def test_success_prompt_includes_triviality_assessment(self):
        """Success prompt instructs LLM to assess is_worth_learning."""
        prompt = SkillDistillationPrompt.success_distillation_prompt()
        assert "is_worth_learning" in prompt
        assert "skip_reason" in prompt
        assert "NOT worth learning" in prompt

    def test_failure_prompt_includes_triviality_assessment(self):
        """Failure prompt instructs LLM to assess is_worth_learning."""
        prompt = SkillDistillationPrompt.failure_distillation_prompt()
        assert "is_worth_learning" in prompt
        assert "skip_reason" in prompt
        assert "NOT worth learning" in prompt


# =============================================================================
# pack_distillation_input tests
# =============================================================================


class TestPackDistillationInput:
    def test_formats_task_and_messages(self):
        """pack_distillation_input includes task info, all tasks, and messages."""
        import uuid

        finished_task = TaskSchema(
            id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            order=1,
            status=TaskStatus.SUCCESS,
            data=TaskData(
                task_description="Fix the login bug",
                progresses=["Step 1: read code", "Step 2: fix it"],
                user_preferences=["user prefers TypeScript"],
            ),
            raw_message_ids=[],
        )
        all_tasks = [
            finished_task,
            TaskSchema(
                id=uuid.uuid4(),
                session_id=finished_task.session_id,
                order=2,
                status=TaskStatus.PENDING,
                data=TaskData(task_description="Write tests"),
                raw_message_ids=[],
            ),
        ]
        task_messages = []

        result = SkillDistillationPrompt.pack_distillation_input(
            finished_task, task_messages, all_tasks
        )
        assert "## Finished Task" in result
        assert "Fix the login bug" in result
        assert "Step 1: read code" in result
        assert "User Preferences" not in result
        assert "## All Session Tasks" in result
        assert "## Task Messages" in result
