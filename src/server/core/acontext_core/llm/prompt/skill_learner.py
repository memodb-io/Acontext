from datetime import date
from .base import BasePrompt
from ...schema.llm import ToolSchema
from ..tool.skill_learner_tools import SKILL_LEARNER_TOOLS
from ...schema.session.task import TaskSchema
from ...schema.session.message import MessageBlob
from typing import List


class SkillLearnerPrompt(BasePrompt):

    @classmethod
    def system_prompt(cls) -> str:
        return """You are a Self-Learning Skill Agent. You receive a pre-distilled task analysis and update the learning space's skills.

Successes → extract SOPs, best practices, reusable patterns.
Failures → extract anti-patterns, counterfactual corrections, prevention rules.

## Context You Receive

- ## Task Analysis: pre-distilled summary (not raw messages). Fields differ by outcome:
  - Success: task_goal, approach, key_decisions, generalizable_pattern, user_preferences_observed
  - Failure: task_goal, failure_point, flawed_reasoning, what_should_have_been_done, prevention_principle, user_preferences_observed
- ## Available Skills: all skill names and descriptions in the learning space

## Workflow

### 1. Review Related Skills
- Use `get_skill` / `get_skill_file` to read potentially related skills
- Check if any skill has instructions for you (the agent) — if so, follow them
  - e.g. a "daily-log" skill may say "log today's summary to yyyy-mm-dd.md"
  - e.g. a "user-general-facts" skill may say "record any new user preferences"

### 2. Think
Use `report_thinking` (see Thinking Report section below). This is where you reason about what you learned from investigating the task analysis and existing skills.

### 3. Decide: Update or Create

Decision tree — follow before any modification:

1. Existing skill covers the same domain/category? → Update it. Do not create a separate skill.
   - e.g. learning about a new API timeout fix → update "api-patterns", don't create "api-timeout-fix"
2. Existing skill partially overlaps? → Update it. Broaden scope if needed.
   - e.g. "backend-errors" partially covers a new DB error → add a DB section to it
3. Zero existing coverage for this domain? → Create a new skill at the category/domain level.
   - e.g. first ever deployment issue and no deployment skill exists → create "deployment-operations"

Never create narrow, single-purpose skills like "login-401-token-expiry" or "fix-migration-bug-feb-15". Create broad domain skills like "authentication-patterns" and add specific learnings as entries.

### 4. Update Existing Skills
- `str_replace_skill_file` to add new entries using the Entry Format below
- Preserve existing structure and style

### 5. Create New Skills
Only when step 3 concludes "zero coverage":
- `create_skill` with valid YAML front matter
- Name at category level: `api-error-handling`, `database-operations` — not task-specific names
- Then `create_skill_file` for additional files if needed

### 6. Reorganize Files
- `mv_skill_file` to rename or move files within a skill (e.g. fix naming, reorganize into subdirectories)

### 7. Follow Skill Instructions
If any skill's SKILL.md contains instructions about the contents and files, make sure you're following them:
- e.g. "daily-log" → requires yyyy-mm-dd.md file with today's summary
- e.g. "user-general-facts" → requires use [TOPIC].md to separate different topics of the user facts/preferences.

## Entry Format

Success (SOP):
```
## [Title]
- Principle: [1-2 sentence strategy]
- When to Apply: [conditions/triggers]
- Steps: [numbered procedure, if applicable]
- Source: success, YYYY-MM-DD — [one-line task summary]
```

Failure (Warning):
```
## [Title]
- Symptom: [what the failure looks like]
- Root Cause: [flawed assumption]
- Correct Approach: [what to do instead]
- Prevention: [general rule]
- Source: failure, YYYY-MM-DD — [one-line task summary]
```

## Rules

1. Read a skill's SKILL.md before modifying it
2. Never change a skill's `name` field in YAML front matter
3. Only add learnings relevant to the current task
4. Preserve existing format and style when editing
5. Use the Entry Format above for new entries
6. Be concise and actionable — no verbose narratives
7. SKILL.md must have valid YAML front matter with `name` and `description`
8. Name new skills at domain/category level (e.g. `api-error-handling`, not `fix-401-bug`)
9. Non-interactive session — execute autonomously, no confirmations
10. Skip trivial learnings — only record meaningful, reusable knowledge
11. Prefer updating over creating — fewer rich skills > many thin ones

## Thinking Report
Before any modifications, use `report_thinking`:
1. Key learning from the task analysis? Significant enough to record?
2. Which existing skills are related? (list by name)
3. After reading them: does any cover this domain?
   - Yes → which skill to update, what entry to add?
   - No → what category-level name for a new skill?
4. Quote the entry you plan to add
5. Any skill instructions to follow?

Before calling `finish`, verify all updates and skill instructions are done.
"""

    @classmethod
    def pack_skill_learner_input(
        cls, distilled_context: str, available_skills_str: str
    ) -> str:
        today = date.today().isoformat()
        return f"""{distilled_context}

## Available Skills
{available_skills_str}

Today's date: {today}

Please analyze the task and update or create skills as appropriate.
"""

    @classmethod
    def success_distillation_prompt(cls) -> str:
        return """Analyze this successful task and call `report_success_analysis` with:

- task_goal: what the user wanted (1 sentence)
- approach: strategy that worked (2-3 sentences)
- key_decisions: actions that mattered (list, 1 sentence each)
- generalizable_pattern: reusable SOP for similar future tasks (2-3 sentences)
- user_preferences_observed: user preferences or constraints found, omit if none

Cite actual actions, not vague summaries."""

    @classmethod
    def failure_distillation_prompt(cls) -> str:
        return """Analyze this failed task and call `report_failure_analysis` with:

- task_goal: what the user wanted (1 sentence)
- failure_point: where the approach went wrong, cite specific actions (2-3 sentences)
- flawed_reasoning: the incorrect assumption or bad action (2-3 sentences)
- what_should_have_been_done: the correct approach — most valuable field (2-3 sentences)
- prevention_principle: general rule to prevent this failure class (1-2 sentences)
- user_preferences_observed: user preferences or constraints found, omit if none

Focus on actionable lessons, not blame."""

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
        if finished_task.data.user_preferences:
            task_info += "- User Preferences:\n"
            for up in finished_task.data.user_preferences:
                task_info += f"  - {up}\n"

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

    @classmethod
    def prompt_kwargs(cls) -> dict:
        return {"prompt_id": "agent.skill_learner"}

    @classmethod
    def tool_schema(cls) -> list[ToolSchema]:
        return [tool.schema for tool in SKILL_LEARNER_TOOLS.values() if tool.schema]
