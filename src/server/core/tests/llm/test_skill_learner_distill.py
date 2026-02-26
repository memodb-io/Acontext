"""
Tests for context distillation tool schemas and extraction.

Covers:
- DISTILL_SKIP_TOOL schema validation
- DISTILL_SUCCESS_TOOL schema validation
- DISTILL_FACTUAL_TOOL schema validation
- DISTILL_FAILURE_TOOL schema validation
- extract_distillation_result for skip/success/factual/failure/error paths
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
    DISTILL_SKIP_TOOL,
    DISTILL_SUCCESS_TOOL,
    DISTILL_FACTUAL_TOOL,
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


class TestDistillSkipToolSchema:
    def test_has_required_fields(self):
        """DISTILL_SKIP_TOOL has reason field."""
        props = DISTILL_SKIP_TOOL.function.parameters["properties"]
        assert "reason" in props

    def test_required_list(self):
        """Required list includes reason."""
        required = DISTILL_SKIP_TOOL.function.parameters["required"]
        assert "reason" in required

    def test_no_is_worth_learning(self):
        """skip tool does not have is_worth_learning."""
        props = DISTILL_SKIP_TOOL.function.parameters["properties"]
        assert "is_worth_learning" not in props


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

    def test_no_is_worth_learning(self):
        """is_worth_learning is not in success tool (moved to skip_learning)."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        assert "is_worth_learning" not in props

    def test_key_decisions_is_array(self):
        """key_decisions is an array of strings."""
        props = DISTILL_SUCCESS_TOOL.function.parameters["properties"]
        assert props["key_decisions"]["type"] == "array"
        assert props["key_decisions"]["items"]["type"] == "string"


class TestDistillFactualToolSchema:
    def test_has_all_required_fields(self):
        """DISTILL_FACTUAL_TOOL has all required fields."""
        props = DISTILL_FACTUAL_TOOL.function.parameters["properties"]
        assert "task_goal" in props
        assert "facts" in props

    def test_required_list(self):
        """Required list matches expected fields."""
        required = DISTILL_FACTUAL_TOOL.function.parameters["required"]
        assert "task_goal" in required
        assert "facts" in required

    def test_facts_is_array_of_strings(self):
        """facts is an array of strings."""
        props = DISTILL_FACTUAL_TOOL.function.parameters["properties"]
        assert props["facts"]["type"] == "array"
        assert props["facts"]["items"]["type"] == "string"

    def test_no_is_worth_learning(self):
        """is_worth_learning is not in factual tool."""
        props = DISTILL_FACTUAL_TOOL.function.parameters["properties"]
        assert "is_worth_learning" not in props


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

    def test_no_is_worth_learning(self):
        """is_worth_learning is not in failure tool (failures always worth learning)."""
        props = DISTILL_FAILURE_TOOL.function.parameters["properties"]
        assert "is_worth_learning" not in props


# =============================================================================
# extract_distillation_result tests
# =============================================================================


class TestExtractDistillationResultSkip:
    def test_skip_learning_returns_not_worth(self):
        """skip_learning tool returns is_worth_learning=False with reason."""
        resp = _make_llm_response(
            "skip_learning",
            {"reason": "simple factual lookup"},
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert isinstance(outcome, DistillationOutcome)
        assert outcome.is_worth_learning is False
        assert outcome.skip_reason == "simple factual lookup"
        assert outcome.distilled_text is None

    def test_skip_learning_default_reason(self):
        """skip_learning with empty reason defaults to 'not specified'."""
        resp = _make_llm_response("skip_learning", {})
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert outcome.is_worth_learning is False
        assert outcome.skip_reason == "not specified"


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

    def test_success_missing_required_field(self):
        """Success extraction rejects when required field is missing."""
        resp = _make_llm_response(
            "report_success_analysis",
            {
                "task_goal": "Fix bug",
                "approach": "Fixed it.",
            },
        )
        result = extract_distillation_result(resp)
        assert not result.ok()


class TestExtractDistillationResultFactual:
    def test_factual_content_formatted(self):
        """Factual tool call args are formatted into readable text."""
        resp = _make_llm_response(
            "report_factual_content",
            {
                "task_goal": "User mentioned people during a scheduling conversation.",
                "facts": [
                    "Alice Chen is a product manager at Acme Corp.",
                    "Alice Chen prefers morning meeting slots.",
                    "Bob Martinez is on the DevOps team.",
                    "Bob Martinez helped fix the staging deploy issue.",
                ],
            },
        )
        result = extract_distillation_result(resp)
        assert result.ok()
        outcome, _ = result.unpack()
        assert isinstance(outcome, DistillationOutcome)
        assert outcome.is_worth_learning is True
        assert "## Factual Content" in outcome.distilled_text
        assert "Alice Chen" in outcome.distilled_text
        assert "Bob Martinez" in outcome.distilled_text
        assert "DevOps" in outcome.distilled_text

    def test_factual_missing_facts_field(self):
        """Factual extraction rejects when facts field is missing."""
        resp = _make_llm_response(
            "report_factual_content",
            {"task_goal": "Some conversation"},
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

    def test_failure_missing_required_field(self):
        """Failure extraction rejects when required field is missing."""
        resp = _make_llm_response(
            "report_failure_analysis",
            {"task_goal": "Fix bug"},
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
# Distillation prompt tests
# =============================================================================


class TestDistillationPrompts:
    def test_success_distillation_prompt_mentions_tools(self):
        """Success distillation prompt references all three tools."""
        prompt = SkillDistillationPrompt.success_distillation_prompt()
        assert len(prompt) > 0
        assert "report_success_analysis" in prompt
        assert "report_factual_content" in prompt
        assert "skip_learning" in prompt

    def test_failure_distillation_prompt_mentions_tool(self):
        """Failure distillation prompt references report_failure_analysis."""
        prompt = SkillDistillationPrompt.failure_distillation_prompt()
        assert len(prompt) > 0
        assert "report_failure_analysis" in prompt

    def test_failure_prompt_has_no_skip(self):
        """Failure prompt does not mention skip_learning or is_worth_learning."""
        prompt = SkillDistillationPrompt.failure_distillation_prompt()
        assert "skip_learning" not in prompt
        assert "is_worth_learning" not in prompt


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

    def test_includes_skill_descriptions_when_provided(self):
        """pack_distillation_input includes skill descriptions section."""
        import uuid

        finished_task = TaskSchema(
            id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            order=1,
            status=TaskStatus.SUCCESS,
            data=TaskData(task_description="Schedule meeting"),
            raw_message_ids=[],
        )
        skill_descriptions = [
            ("social-contacts", "Track people the user interacts with"),
            ("daily-log", "Daily activity summaries"),
        ]
        result = SkillDistillationPrompt.pack_distillation_input(
            finished_task, [], [finished_task], skill_descriptions
        )
        assert "## Learning Space Skills" in result
        assert "social-contacts" in result
        assert "Track people the user interacts with" in result
        assert "daily-log" in result

    def test_no_skill_section_when_none(self):
        """pack_distillation_input omits skill section when no skills."""
        import uuid

        finished_task = TaskSchema(
            id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            order=1,
            status=TaskStatus.SUCCESS,
            data=TaskData(task_description="Fix bug"),
            raw_message_ids=[],
        )
        result = SkillDistillationPrompt.pack_distillation_input(
            finished_task, [], [finished_task]
        )
        assert "Learning Space Skills" not in result
