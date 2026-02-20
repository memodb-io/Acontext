from .base import BasePrompt
from ...schema.session.task import TaskSchema
from ...schema.session.message import MessageBlob
from typing import List


class SkillDistillationPrompt(BasePrompt):

    _TRIVIALITY_ASSESSMENT = """
Assess whether this task is worth learning from:
- Worth learning: tasks involving multi-step procedures, meaningful decisions, debugging, configuration, domain-specific knowledge, or user preferences.
- NOT worth learning: simple factual lookups, small talk, one-shot calculations, generic Q&A, trivial status checks, or tasks where no real procedure or decision was involved.

Set is_worth_learning accordingly. If false, provide a brief skip_reason."""

    @classmethod
    def success_distillation_prompt(cls) -> str:
        return f"""Analyze this successful task and call `report_success_analysis` with:

- task_goal: what the user wanted (1 sentence)
- approach: strategy that worked (2-3 sentences)
- key_decisions: actions that mattered (list, 1 sentence each)
- generalizable_pattern: reusable SOP for similar future tasks (2-3 sentences)
- is_worth_learning: whether this task is worth recording as a skill (see below)
- skip_reason: if not worth learning, briefly explain why

Cite actual actions, not vague summaries.
{cls._TRIVIALITY_ASSESSMENT}"""

    @classmethod
    def failure_distillation_prompt(cls) -> str:
        return f"""Analyze this failed task and call `report_failure_analysis` with:

- task_goal: what the user wanted (1 sentence)
- failure_point: where the approach went wrong, cite specific actions (2-3 sentences)
- flawed_reasoning: the incorrect assumption or bad action (2-3 sentences)
- what_should_have_been_done: the correct approach — most valuable field (2-3 sentences)
- prevention_principle: general rule to prevent this failure class (1-2 sentences)
- is_worth_learning: whether this task is worth recording as a skill (see below)
- skip_reason: if not worth learning, briefly explain why

Focus on actionable lessons, not blame.
{cls._TRIVIALITY_ASSESSMENT}"""

    @classmethod
    def pack_distillation_input(
        cls,
        finished_task: TaskSchema,
        task_messages: List[MessageBlob],
        all_tasks: List[TaskSchema],
    ) -> str:
        task_info = (
            f"## Finished Task\n"
            f"- Status: {finished_task.status}\n"
            f"- Description: {finished_task.data.task_description}\n"
        )
        if finished_task.data.progresses:
            task_info += "- Progress:\n"
            for p in finished_task.data.progresses:
                task_info += f"  - {p}\n"

        all_tasks_section = "## All Session Tasks\n"
        for t in all_tasks:
            all_tasks_section += f"- {t.to_string()}\n"

        messages_section = "## Task Messages\n"
        tool_mappings = {}
        for m in task_messages:
            messages_section += (
                f"---\n{m.to_string(tool_mappings, truncate_chars=512)}\n"
            )

        return f"{task_info}\n{all_tasks_section}\n{messages_section}"
