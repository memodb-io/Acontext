from .base import BasePrompt
from ...schema.session.task import TaskSchema
from ...schema.session.message import MessageBlob
from typing import List, Tuple


class SkillDistillationPrompt(BasePrompt):

    @classmethod
    def success_distillation_prompt(cls) -> str:
        return """Analyze this successful task and choose the appropriate tool:

**Use `skip_learning`** if the task is trivial and not worth recording — e.g. simple factual lookups ("what is 2+2"), small talk, one-shot calculations, generic Q&A with no domain content, or trivial status checks. Consider the learning space's skills (if listed): if the task's content is relevant to any skill, it is NOT trivial.

**Use `report_success_analysis`** when the task involved a multi-step procedure, debugging, configuration, or a meaningful decision process:
- task_goal: what the user wanted (1 sentence)
- approach: strategy that worked (2-3 sentences)
- key_decisions: actions that mattered (list, 1 sentence each)
- generalizable_pattern: reusable SOP for similar future tasks (2-3 sentences)

**Use `report_factual_content`** when the task is primarily about recording information — people, facts, preferences, entities, or domain knowledge — rather than a procedure:
- task_goal: brief context of the conversation (1 sentence)
- facts: list of concise, self-contained factual statements in third-person (e.g. "Bob Martinez is on the DevOps team", "Alice Chen prefers morning meetings")

Pick the tool that best fits. Do NOT inflate simple factual content into fake procedures. If someone mentions a person or a fact, use `report_factual_content`. If the task involved real steps and decisions, use `report_success_analysis`.

"The user" refers to the person sending messages (role: user). People mentioned within messages are third parties, not the user."""

    @classmethod
    def failure_distillation_prompt(cls) -> str:
        return """Analyze this failed task and call `report_failure_analysis` with:

- task_goal: what the user wanted (1 sentence)
- failure_point: where the approach went wrong, cite specific actions (2-3 sentences)
- flawed_reasoning: the incorrect assumption or bad action (2-3 sentences)
- what_should_have_been_done: the correct approach — most valuable field (2-3 sentences)
- prevention_principle: general rule to prevent this failure class (1-2 sentences)

Focus on actionable lessons, not blame.
"The user" refers to the person sending messages (role: user). People mentioned within messages are third parties, not the user."""

    @classmethod
    def pack_distillation_input(
        cls,
        finished_task: TaskSchema,
        task_messages: List[MessageBlob],
        all_tasks: List[TaskSchema],
        skill_descriptions: List[Tuple[str, str]] | None = None,
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

        skills_section = ""
        if skill_descriptions:
            skills_section = "\n## Learning Space Skills\n"
            for name, desc in skill_descriptions:
                skills_section += f"- **{name}**: {desc}\n"

        return f"{task_info}\n{all_tasks_section}\n{messages_section}{skills_section}"
