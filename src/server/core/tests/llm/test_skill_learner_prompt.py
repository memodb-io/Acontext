"""
Tests for the skill learner prompt.

Covers:
- System prompt content validation
- pack_skill_learner_input formatting
- Tool schemas include all expected tools (no distillation tools)
"""

import pytest
from acontext_core.llm.prompt.skill_learner import SkillLearnerPrompt


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


class TestToolSchemas:
    def test_returns_8_tools(self):
        """Tool schemas include all 8 expected tools."""
        schemas = SkillLearnerPrompt.tool_schema()
        assert len(schemas) == 8

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
