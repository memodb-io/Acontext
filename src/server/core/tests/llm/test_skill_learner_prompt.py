"""
Tests for the skill learner prompt.

Covers:
- System prompt content validation
- System prompt mentions multi-turn context arrival
- pack_skill_learner_input formatting
- pack_skill_learner_input with pending contexts
- pack_incoming_contexts formatting
- Tool schemas include all expected tools (no distillation tools)
"""

import uuid
from datetime import date
from unittest.mock import patch

import pytest
from acontext_core.llm.prompt.skill_learner import SkillLearnerPrompt
from acontext_core.schema.mq.learning import SkillLearnDistilled


def _make_distilled(distilled_context="## Task Analysis\nTest"):
    return SkillLearnDistilled(
        project_id=uuid.uuid4(),
        session_id=uuid.uuid4(),
        task_id=uuid.uuid4(),
        learning_space_id=uuid.uuid4(),
        distilled_context=distilled_context,
    )


class TestSystemPrompt:
    def test_non_empty(self):
        """System prompt is a non-empty string."""
        prompt = SkillLearnerPrompt.system_prompt()
        assert isinstance(prompt, str)
        assert len(prompt) > 100

    def test_references_task_analysis(self):
        """System prompt references 'Task Analysis' (distilled context, not raw messages)."""
        prompt = SkillLearnerPrompt.system_prompt()
        assert "Task Analysis" in prompt

    def test_references_available_skills(self):
        """System prompt references 'Available Skills'."""
        prompt = SkillLearnerPrompt.system_prompt()
        assert "Available Skills" in prompt

    def test_mentions_report_thinking(self):
        """System prompt mentions report_thinking requirement."""
        prompt = SkillLearnerPrompt.system_prompt()
        assert "report_thinking" in prompt

    def test_mentions_multi_turn_context_arrival(self):
        """System prompt describes multi-turn context arrival."""
        prompt = SkillLearnerPrompt.system_prompt()
        assert "Multi-Turn Context Arrival" in prompt
        assert "Complete your current in-progress work" in prompt
        assert "additive" in prompt


class TestPackSkillLearnerInput:
    def test_formats_both_sections(self):
        """pack_skill_learner_input includes both Task Analysis and Available Skills."""
        distilled = "## Task Analysis (Success)\n**Goal:** Fix bug\n..."
        skills_str = "- **auth-patterns**: Authentication handling"
        result = SkillLearnerPrompt.pack_skill_learner_input(distilled, skills_str)
        assert "## Task Analysis (Success)" in result
        assert "## Available Skills" in result
        assert "auth-patterns" in result
        assert "Today's date:" in result

    def test_empty_skills(self):
        """pack_skill_learner_input handles no-skills message."""
        distilled = "## Task Analysis (Failure)\n**Goal:** Deploy"
        skills_str = "(No skills in this learning space yet)"
        result = SkillLearnerPrompt.pack_skill_learner_input(distilled, skills_str)
        assert "(No skills in this learning space yet)" in result

    def test_with_pending_contexts(self):
        """pack_skill_learner_input includes pending contexts when provided."""
        distilled = "## Task Analysis\nInitial"
        skills_str = "- **my-skill**: Description"
        pending = [
            _make_distilled("## Task Analysis\nPending A"),
            _make_distilled("## Task Analysis\nPending B"),
        ]
        result = SkillLearnerPrompt.pack_skill_learner_input(
            distilled, skills_str, pending_contexts=pending
        )
        assert "Initial" in result
        assert "Pending A" in result
        assert "Pending B" in result
        assert "Pending Context 1" in result
        assert "Pending Context 2" in result

    def test_no_pending_contexts_same_as_before(self):
        """pack_skill_learner_input with no pending is equivalent to old behavior."""
        distilled = "## Task Analysis\nOnly this"
        skills_str = "- **s**: d"
        result = SkillLearnerPrompt.pack_skill_learner_input(distilled, skills_str)
        assert "Pending" not in result
        assert "Only this" in result


class TestPackIncomingContexts:
    def test_formats_single_context(self):
        """pack_incoming_contexts formats a single context correctly."""
        ctx = _make_distilled("## Task Analysis\nNew learning")
        result = SkillLearnerPrompt.pack_incoming_contexts(
            [ctx], "- **skill-a**: desc"
        )
        assert "Additional contexts have arrived" in result
        assert "New learning" in result
        assert "## Available Skills (updated)" in result
        assert "skill-a" in result

    def test_formats_multiple_contexts(self):
        """pack_incoming_contexts formats N contexts correctly."""
        contexts = [
            _make_distilled("## Analysis A"),
            _make_distilled("## Analysis B"),
            _make_distilled("## Analysis C"),
        ]
        result = SkillLearnerPrompt.pack_incoming_contexts(
            contexts, "(No skills in this learning space yet)"
        )
        assert "New Context 1" in result
        assert "New Context 2" in result
        assert "New Context 3" in result
        assert "Analysis A" in result
        assert "Analysis B" in result
        assert "Analysis C" in result

    def test_includes_finish_instruction(self):
        """pack_incoming_contexts includes instruction to finish current work first."""
        ctx = _make_distilled()
        result = SkillLearnerPrompt.pack_incoming_contexts([ctx], "")
        assert "Finish your current task first" in result

    def test_uses_each_context_own_original_date(self):
        """pack_incoming_contexts uses each context's own original_date."""
        # Context with historical date
        ctx_a = SkillLearnDistilled(
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            learning_space_id=uuid.uuid4(),
            distilled_context="## Task Analysis\nHistorical session A",
            original_date="2023/05/21 (Sun) 14:03",
        )
        # Context with different historical date
        ctx_b = SkillLearnDistilled(
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            learning_space_id=uuid.uuid4(),
            distilled_context="## Task Analysis\nHistorical session B",
            original_date="2024/01/15 (Mon) 10:30",
        )
        # Context without original_date (should use today)
        ctx_c = SkillLearnDistilled(
            project_id=uuid.uuid4(),
            session_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            learning_space_id=uuid.uuid4(),
            distilled_context="## Task Analysis\nRecent session C",
            original_date=None,
        )

        with patch(
            "acontext_core.llm.prompt.skill_learner.date"
        ) as mock_date:
            mock_date.today.return_value = date(2026, 4, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            result = SkillLearnerPrompt.pack_incoming_contexts(
                [ctx_a, ctx_b, ctx_c], "- **skill-a**: desc"
            )

        # Each context should have its own date
        assert "Date: 2023/05/21" in result
        assert "Date: 2024/01/15" in result
        assert "Date: 2026-04-01" in result  # mocked today's date fallback
        # Should NOT have a single "Today's date" at the end
        assert "Today's date:" not in result


class TestToolSchemas:
    def test_returns_9_tools(self):
        """Tool schemas include all 9 expected tools."""
        schemas = SkillLearnerPrompt.tool_schema()
        assert len(schemas) == 9

    def test_tool_names(self):
        """Tool schemas contain all expected tool names."""
        schemas = SkillLearnerPrompt.tool_schema()
        names = {s.function.name for s in schemas}
        expected = {
            "get_skill",
            "get_skill_file",
            "str_replace_skill_file",
            "create_skill_file",
            "create_skill",
            "delete_skill_file",
            "mv_skill_file",
            "finish",
            "report_thinking",
        }
        assert names == expected

    def test_no_distillation_tools(self):
        """Distillation tools are NOT in the skill learner tool pool."""
        schemas = SkillLearnerPrompt.tool_schema()
        names = {s.function.name for s in schemas}
        assert "report_success_analysis" not in names
        assert "report_failure_analysis" not in names

    def test_prompt_kwargs(self):
        """prompt_kwargs returns expected prompt_id."""
        kwargs = SkillLearnerPrompt.prompt_kwargs()
        assert kwargs == {"prompt_id": "agent.skill_learner"}
