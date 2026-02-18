# Self-Learning Skill Pipeline

## Features / Showcase

When a task in a session is marked as **success** or **failed**, and the session belongs to a **learning space**, the system automatically triggers a **Skill Learner Agent**. This agent:

1. Reviews the completed/failed task, its attached messages, and the session's full task list
2. Reads existing skills in the learning space to find related ones
3. Updates relevant skills in-place (positive SOPs for successes, anti-patterns for failures)
4. Creates new skills if no existing skill covers the topic
5. Follows any instructions embedded within skills themselves (e.g., a "daily-log" skill that says "log today's summary to yyyy-mm-dd.md")

**Example flow:**
```
User's coding session → task "Fix login bug" marked success
  → Skill Learner triggered
  → Agent reads "authentication-patterns" skill
  → Agent appends new SOP: "When login fails with 401, check token expiry before refreshing"
  → Agent also follows "daily-log" skill instructions → creates 2026-02-15.md with summary
```

---

## Design Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  process_session_pending_message (existing, modified)               │
│  1. Check if session has learning space (one query, before agent)   │
│  2. Pass enable_skill_learning=True to task_agent_curd              │
│                                                                     │
│  task_agent_curd (existing, modified)                               │
│  3. update_task tool detects status → success/failed                │
│  4. Appends task_id to ctx.learning_task_ids (no MQ yet)            │
│  5. After iteration's DB session commits → drain list & publish_mq  │
│     (publish only after DB confirms — no phantom messages)          │
└────────────────────────┬────────────────────────────────────────────┘
                         │ publish_mq (per-iteration, after DB commit)
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MQ: learning.skill / learning.skill.process                        │
│  Queue: learning.skill.process.entry                                │
│  Retry: learning.skill.process.retry → DLX → back to primary       │
└────────────────────────┬────────────────────────────────────────────┘
                         │ consume
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  skill_learner consumer                                             │
│  → Acquire Redis lock: lock.{project_id}.skill_learn.{ls_id}       │
│    (if lock fails → republish to retry queue, DLX provides backoff) │
│  → controller/skill_learner.py                                      │
│    1. Fetch target task + its raw messages                          │
│    2. Fetch all session tasks (context)                             │
│    3. Context Distillation (single LLM call with tool calling)      │
│       - Different tool per outcome: success vs failure              │
│       - Compresses raw messages into structured analysis            │
│    4. Get learning space → get skill IDs → get skill infos          │
│    5. Call skill_learner_agent(distilled_context, skills)            │
│  → Release Redis lock (in finally block)                            │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Context Distillation (single-shot, NOT an agent loop)              │
│                                                                     │
│  Input: raw messages + task info + session tasks                    │
│  Output: structured analysis via tool call arguments                │
│                                                                     │
│  If SUCCESS → LLM calls `report_success_analysis` tool:             │
│    task_goal, approach, key_decisions,                               │
│    generalizable_pattern, user_preferences_observed                  │
│                                                                     │
│  If FAILURE → LLM calls `report_failure_analysis` tool:             │
│    task_goal, failure_point, flawed_reasoning,                       │
│    what_should_have_been_done, prevention_principle,                  │
│    user_preferences_observed                                         │
└────────────────────────┬────────────────────────────────────────────┘
                         │ distilled context
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  skill_learner_agent (LLM agent loop)                               │
│                                                                     │
│  System Prompt: Self-learning skill management                      │
│  Tools:                                                             │
│    - get_skill (list files in a skill)                              │
│    - get_skill_file (read file content from artifact)               │
│    - str_replace_skill_file (edit file via string replacement)      │
│    - create_skill_file (create new file in an existing skill)       │
│    - create_skill (create a brand new skill in the learning space)  │
│    - delete_skill_file (delete file from a skill)                   │
│    - report_thinking                                                │
│    - finish                                                         │
│                                                                     │
│  Context (injected as user message):                                │
│    - Distilled task analysis (structured, from distillation step)   │
│    - Available skills (name + description)                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Trigger Mechanism: Collect in Tool, Publish After DB Commit

`TaskCtx` carries a `learning_task_ids` list. When `update_task` sets a task to success/failed, it always appends the task_id to the list — no MQ publish yet, no flag check. The tool is "dumb" — it just records that a task finished. The decision to publish to the learning pipeline is made by the outer loop (`task_agent_curd`), which holds the `enable_skill_learning` parameter and gates the drain-publish. This separation keeps the tool handler free of learning-pipeline concerns.

After the iteration's DB session commits, the agent loop drains the list and publishes each task_id to MQ (only if `enable_skill_learning` is True). This guarantees no phantom messages on rollback.

**Important: surviving `NEED_UPDATE_CTX` resets.** In the existing agent loop, `update_task` is in `NEED_UPDATE_CTX`, so after the handler returns, `USE_CTX` is set to `None` and rebuilt from scratch for the next tool call. This would destroy any accumulated `learning_task_ids`. To handle this, `task_agent_curd` maintains a **function-scoped** `_pending_learning_task_ids` list. Before each `NEED_UPDATE_CTX` reset, IDs are transferred from `USE_CTX.learning_task_ids` to the function-scoped list. The drain-publish uses this function-scoped list.

```python
# ── process_session_pending_message (caller) ──
# One-time check before agent starts:
async with DB_CLIENT.get_session_context() as session:
    ls = await LS.get_learning_space_for_session(session, session_id)

r = await AT.task_agent_curd(
    project_id, session_id, messages_data,
    enable_skill_learning=(ls is not None),  # NEW param
    ...
)

# ── task_agent_curd (function scope) ──
_pending_learning_task_ids: list[asUUID] = []  # survives USE_CTX rebuilds

# ── update_task_handler (tool) — always collects finished task IDs, does NOT publish ──
if task_status in ("success", "failed"):
    ctx.learning_task_ids.append(actually_task_id)

# ── agent loop (inside tool dispatch, before NEED_UPDATE_CTX reset) ──
# Save IDs before USE_CTX is destroyed:
if tool_name in NEED_UPDATE_CTX:
    if USE_CTX and USE_CTX.learning_task_ids:
        _pending_learning_task_ids.extend(USE_CTX.learning_task_ids)
        USE_CTX.learning_task_ids.clear()
    USE_CTX = None  # existing behavior

# ── agent loop (after DB session commits, before _messages.extend) ──
# Collect any remaining IDs from current USE_CTX, then drain-publish:
if USE_CTX and USE_CTX.learning_task_ids:
    _pending_learning_task_ids.extend(USE_CTX.learning_task_ids)
    USE_CTX.learning_task_ids.clear()
if _pending_learning_task_ids and enable_skill_learning:
    for tid in _pending_learning_task_ids:
        try:
            await publish_mq(EX.learning_skill, RK.learning_skill_process,
                SkillLearnTask(project_id=project_id,
                               session_id=session_id,
                               task_id=tid).model_dump_json())
        except Exception:
            LOG.warning("Failed to publish skill learning event", task_id=str(tid))
    _pending_learning_task_ids.clear()
```

This approach:
- **Safe**: MQ messages are only published after the DB transaction commits — no phantom messages on rollback
- **Online**: published right after each iteration's commit — minimal delay
- **Survives rebuilds**: function-scoped `_pending_learning_task_ids` + save-before-reset handles `NEED_UPDATE_CTX` destroying `USE_CTX`
- The learning space check happens once (before the agent starts)
- Publish failures are non-fatal (try/except per task_id, logged as warning)

### Skill File CRUD via Direct DB Access

Since core has direct DB access, skill file operations use SQLAlchemy queries on `Artifact` table (not API calls):

| Operation        | Implementation                                                                    |
| ---------------- | --------------------------------------------------------------------------------- |
| **Read**         | Query Artifact by (disk_id, path, filename) → return `asset_meta['content']`      |
| **Edit**         | Read content → string replace → `upsert_artifact` with new content                |
| **Create File**  | `upsert_artifact` with new content (handles create-or-update)                     |
| **Create Skill** | `create_skill` (Disk + AgentSkill + SKILL.md) → add `LearningSpaceSkill` junction |
| **Delete File**  | Delete Artifact row by (disk_id, path, filename)                                  |

When `SKILL.md` is modified (via edit or create_file), automatically re-parse YAML front matter and update `AgentSkill.description` (name changes are forbidden by the agent's system prompt).

### Context Distillation (Pre-Processing Step)

Before the skill learner agent runs, a **single-shot LLM call** distills raw task messages into a compact, structured analysis. This separates "understanding what happened" from "deciding what to write in skills," giving the agent cleaner input and saving context window budget.

**Why distill instead of passing raw messages:**
- Raw messages are noisy — file contents, tool results, code blocks, backtracking (research: SkillRL, Letta Skill Learning)
- A typical task can have 20-50 messages (20-50K tokens); distillation compresses to ~500 tokens
- Differential processing: success and failure produce structurally different analyses
- The skill learner agent gets almost its entire context window for skill reading/writing

**How it works:**
1. Controller determines task status (success vs failure)
2. Picks the corresponding distillation prompt and tool
3. Calls `llm_complete()` once with raw messages as user content + the appropriate tool
4. Extracts structured analysis from the tool call arguments
5. Formats analysis as text for the skill learner agent

**Success distillation** extracts: goal, approach, key decisions, generalizable pattern, user preferences.

**Failure distillation** extracts: goal, failure point, flawed reasoning, what should have been done (counterfactual), prevention principle, user preferences. This structured failure analysis is based on SkillRL's experience-based distillation — failed trajectories are transformed into concise counterfactuals rather than dumped as raw noise.

**Tool calling (not json_mode)** is used for structured output — consistent with the rest of the codebase.

```python
# In controller/skill_learner.py — distillation step

# 1. Pick tool schema + prompt based on status
if task.status == TaskStatus.SUCCESS:
    tool_schema = DISTILL_SUCCESS_TOOL  # ToolSchema (not Tool — no handler)
    system_prompt = SkillLearnerPrompt.success_distillation_prompt()
else:
    tool_schema = DISTILL_FAILURE_TOOL
    system_prompt = SkillLearnerPrompt.failure_distillation_prompt()

# 2. Build user content from raw messages + task info
user_content = SkillLearnerPrompt.pack_distillation_input(
    finished_task, task_messages, all_tasks
)

# 3. Single LLM call (tools pre-dumped to dicts — matches task_agent_curd pattern)
r = await llm_complete(
    system_prompt=system_prompt,
    history_messages=[{"role": "user", "content": user_content}],
    tools=[tool_schema.model_dump()],
    prompt_kwargs={"prompt_id": "distill.skill_learner"},
)

# 4. Extract tool call arguments → distilled_context string
llm_return, eil = r.unpack()
if eil:
    return Result.reject(f"Distillation LLM call failed: {eil}")
distilled_context, eil = extract_distillation_result(llm_return)
if eil:
    return Result.reject(f"Distillation extraction failed: {eil}")
```

---

## New Data Structures

### MQ Message

```python
# schema/mq/learning.py
class SkillLearnTask(BaseModel):
    project_id: asUUID
    session_id: asUUID
    task_id: asUUID
```

### Agent Context

```python
# llm/tool/skill_learner_lib/ctx.py

@dataclass
class SkillInfo:
    id: asUUID
    disk_id: asUUID
    name: str
    description: str
    file_paths: list[str]  # e.g., ["SKILL.md", "scripts/main.py"]

@dataclass
class SkillLearnerCtx:
    db_session: AsyncSession
    project_id: asUUID
    learning_space_id: asUUID                # needed for create_skill (add to LS)
    user_id: Optional[asUUID]                 # inherited from LearningSpace.user_id (fetched once by controller)
    skills: dict[str, SkillInfo]             # skill_name -> SkillInfo
    has_reported_thinking: bool = False       # guard: editing tools reject until report_thinking is called
```

### Context Distillation Tool Schemas (single-shot, used in controller)

These are schema-only (no handler) — the controller extracts tool call arguments directly from the LLM response. Uses `ToolSchema` directly (not `Tool`, since there's no handler to dispatch to).

```python
# llm/tool/skill_learner_lib/distill.py
# Tool schemas are lightweight — detailed instructions live in the prompts.

DISTILL_SUCCESS_TOOL = ToolSchema(function=FunctionSchema(
    name="report_success_analysis",
    description="Report the structured analysis of a successful task.",
    parameters={
        "type": "object",
        "properties": {
            "task_goal": {"type": "string"},
            "approach": {"type": "string"},
            "key_decisions": {"type": "array", "items": {"type": "string"}},
            "generalizable_pattern": {"type": "string"},
            "user_preferences_observed": {"type": "string"},
        },
        "required": ["task_goal", "approach", "key_decisions", "generalizable_pattern"],
    },
))

DISTILL_FAILURE_TOOL = ToolSchema(function=FunctionSchema(
    name="report_failure_analysis",
    description="Report the structured failure analysis of a failed task.",
    parameters={
        "type": "object",
        "properties": {
            "task_goal": {"type": "string"},
            "failure_point": {"type": "string"},
            "flawed_reasoning": {"type": "string"},
            "what_should_have_been_done": {"type": "string"},
            "prevention_principle": {"type": "string"},
            "user_preferences_observed": {"type": "string"},
        },
        "required": ["task_goal", "failure_point", "flawed_reasoning", "what_should_have_been_done", "prevention_principle"],
    },
))
```

### Context Distillation Prompts

All field-level instructions live here (not in tool descriptions) to keep schemas lightweight.

```python
# In llm/prompt/skill_learner.py

# --- Success distillation system prompt ---
"""Analyze this successful task and call `report_success_analysis` with:

- task_goal: what the user wanted (1 sentence)
- approach: strategy that worked (2-3 sentences)
- key_decisions: actions that mattered (list, 1 sentence each)
- generalizable_pattern: reusable SOP for similar future tasks (2-3 sentences)
- user_preferences_observed: user preferences or constraints found, omit if none

Cite actual actions, not vague summaries."""

# --- Failure distillation system prompt ---
"""Analyze this failed task and call `report_failure_analysis` with:

- task_goal: what the user wanted (1 sentence)
- failure_point: where the approach went wrong, cite specific actions (2-3 sentences)
- flawed_reasoning: the incorrect assumption or bad action (2-3 sentences)
- what_should_have_been_done: the correct approach — most valuable field (2-3 sentences)
- prevention_principle: general rule to prevent this failure class (1-2 sentences)
- user_preferences_observed: user preferences or constraints found, omit if none

Focus on actionable lessons, not blame."""
```

### Modified Existing Data Structure

```python
# llm/tool/task_lib/ctx.py (MODIFIED — add two fields)

@dataclass
class TaskCtx:
    db_session: AsyncSession
    project_id: asUUID
    session_id: asUUID
    task_ids_index: list[asUUID]
    task_index: list[TaskSchema]
    message_ids_index: list[asUUID]
    learning_task_ids: list[asUUID] = field(default_factory=list)  # NEW: collects finished task IDs, drained after DB commit
```

### Modified Function Signature

```python
# llm/agent/task.py (MODIFIED — new optional parameter, passed through to TaskCtx)

async def task_agent_curd(
    project_id, session_id, messages,
    max_iterations=3,
    previous_progress_num=6,
    enable_skill_learning=False,  # NEW
) -> Result[None]:  # Return type unchanged
```

---

## New Data Layer Functions

All in `src/server/core/acontext_core/service/data/`.

### `learning_space.py` (NEW file)

| Function                         | Signature                                                                 | Description                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_learning_space_for_session` | `(db_session, session_id) -> Result[LearningSpaceSession \| None]`        | Query `LearningSpaceSession` by `session_id`. Returns the junction row (has `learning_space_id`) or `None` if session doesn't belong to any learning space. |
| `get_learning_space`             | `(db_session, learning_space_id) -> Result[LearningSpace]`                | Query `LearningSpace` by ID. Returns the learning space row (has `user_id`, `project_id`). Used by controller to get `user_id` for skill creation.          |
| `get_learning_space_skill_ids`   | `(db_session, learning_space_id) -> Result[list[asUUID]]`                 | Query `LearningSpaceSkill` by `learning_space_id`, return list of `skill_id`s.                                                                              |
| `get_skills_info`                | `(db_session, skill_ids) -> Result[list[SkillInfo]]`                      | Query `AgentSkill` by IDs, join `Artifact` via `disk_id` to collect file paths. Returns list of `SkillInfo(id, disk_id, name, description, file_paths)`.    |
| `add_skill_to_learning_space`    | `(db_session, learning_space_id, skill_id) -> Result[LearningSpaceSkill]` | Insert a `LearningSpaceSkill` junction row. Used by `create_skill` tool after creating a new skill.                                                         |

### `artifact.py` (MODIFIED — add one function)

| Function                  | Signature                                               | Description                                                                              |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `delete_artifact_by_path` | `(db_session, disk_id, path, filename) -> Result[None]` | Delete `Artifact` where `(disk_id, path, filename)` matches. Returns error if not found. |

### `agent_skill.py` (EXISTING — already has `create_skill`, `get_agent_skill`)

| Function                                             | Already Exists | Used By             |
| ---------------------------------------------------- | -------------- | ------------------- |
| `create_skill(db_session, project_id, content, ...)` | Yes            | `create_skill` tool |
| `get_agent_skill(db_session, project_id, skill_id)`  | Yes            | Various tools       |

### Existing functions reused (no changes needed)

| File             | Function                                                           | Used By                                        |
| ---------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `artifact.py`    | `get_artifact_by_path(db_session, disk_id, path, filename)`        | `get_skill_file`, `str_replace_skill_file`     |
| `artifact.py`    | `upsert_artifact(db_session, disk_id, path, filename, asset_meta)` | `str_replace_skill_file`, `create_skill_file`  |
| `artifact.py`    | `list_artifacts_by_path(db_session, disk_id)`                      | `get_skills_info` (build file_paths)           |
| `task.py`        | `fetch_task(db_session, task_id)`                                  | Controller (fetch finished task)               |
| `task.py`        | `fetch_current_tasks(db_session, session_id)`                      | Controller (fetch all session tasks)           |
| `message.py`     | `fetch_messages_data_by_ids(db_session, message_ids)`              | Controller (fetch task messages)               |
| `agent_skill.py` | `create_skill(db_session, project_id, content)`                    | `create_skill` tool                            |
| `agent_skill.py` | `_parse_skill_md(content)`                                         | `str_replace_skill_file` (re-parse after edit) |

---

## Self-Learning Agent System Prompt

```
You are a Self-Learning Skill Agent. You receive a pre-distilled task analysis and update the learning space's skills.

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

### 6. Follow Skill Instructions
If any skill's SKILL.md contains instructions for the learning agent, execute them.
- e.g. "daily-log" → create yyyy-mm-dd.md with today's summary
- e.g. "user-general-facts" → update with newly discovered preferences

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
```

---

## TODOs

### 1. Add MQ constants for skill learning
- [x] **Modify** `src/server/core/acontext_core/service/constants.py`
  - Add `EX.learning_skill = "learning.skill"`
  - Add `RK.learning_skill_process = "learning.skill.process"`
  - Add `RK.learning_skill_process_retry = "learning.skill.process.retry"`

### 2. Add MQ message schema
- [x] **Create** `src/server/core/acontext_core/schema/mq/learning.py`
  - Define `SkillLearnTask(BaseModel)` with `project_id`, `session_id`, `task_id`

### 3. Add learning space data service
- [x] **Create** `src/server/core/acontext_core/service/data/learning_space.py`
  - `get_learning_space_for_session`
  - `get_learning_space` (fetch by ID — returns `LearningSpace` with `user_id`)
  - `get_learning_space_skill_ids`
  - `get_skills_info`
  - `add_skill_to_learning_space`

### 4. Add artifact delete function
- [x] **Modify** `src/server/core/acontext_core/service/data/artifact.py`
  - Add `delete_artifact_by_path`

### 5. Modify TaskCtx to carry the collection list
- [x] **Modify** `src/server/core/acontext_core/llm/tool/task_lib/ctx.py`
  - Add `learning_task_ids: list[asUUID] = field(default_factory=list)`
  - No `enable_skill_learning` flag on ctx — the tool always collects, the outer loop gates the publish

### 6. Modify update_task tool to collect finished task IDs
- [x] **Modify** `src/server/core/acontext_core/llm/tool/task_lib/update.py`
  - After successful update, if `task_status in ("success", "failed")`:
    - Append `task_id` to `ctx.learning_task_ids` (no flag check, no MQ publish — just collect)

### 7. Pass flag through task_agent_curd + drain-publish after commit
- [x] **Modify** `src/server/core/acontext_core/llm/agent/task.py`
  - Add `enable_skill_learning: bool = False` parameter to `task_agent_curd`
  - Add `_pending_learning_task_ids: list[asUUID] = []` at function scope (survives `USE_CTX` rebuilds)
  - `build_task_ctx` needs **no changes** — `learning_task_ids` is always initialized empty via `field(default_factory=list)`, and the outer loop gates the publish via `enable_skill_learning`
  - **Save-before-reset** (inside the tool dispatch loop, around the existing `NEED_UPDATE_CTX` block):
    ```python
    if tool_name in NEED_UPDATE_CTX:
        if USE_CTX and USE_CTX.learning_task_ids:
            _pending_learning_task_ids.extend(USE_CTX.learning_task_ids)
            USE_CTX.learning_task_ids.clear()
        USE_CTX = None  # existing line
    ```
  - **Drain-publish** (after `except RuntimeError`, before `_messages.extend(tool_response)`):
    ```python
    if USE_CTX and USE_CTX.learning_task_ids:
        _pending_learning_task_ids.extend(USE_CTX.learning_task_ids)
        USE_CTX.learning_task_ids.clear()
    if _pending_learning_task_ids and enable_skill_learning:
        for tid in _pending_learning_task_ids:
            try:
                await publish_mq(EX.learning_skill, RK.learning_skill_process,
                    SkillLearnTask(project_id=project_id,
                                   session_id=session_id,
                                   task_id=tid).model_dump_json())
            except Exception:
                LOG.warning("Failed to publish skill learning event", task_id=str(tid))
        _pending_learning_task_ids.clear()
    ```
  - Add imports: `SkillLearnTask` from `schema/mq/learning`, `publish_mq` from `infra/async_mq`, `EX`/`RK` from `service/constants`

### 8. Add learning space check in message controller
- [x] **Modify** `src/server/core/acontext_core/service/controller/message.py`
  - Before calling `task_agent_curd`, query `get_learning_space_for_session(session_id)`
  - Pass `enable_skill_learning=(ls is not None)` to `task_agent_curd`

### 9. Add skill learner context and tools
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/` directory
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/__init__.py` (empty, Python package)
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/ctx.py`
  - `SkillInfo` dataclass
  - `SkillLearnerCtx` dataclass (with `learning_space_id`, `has_reported_thinking: bool = False`)
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/get_skill.py`
  - Tool: `get_skill` — returns skill info with file list from `ctx.skills`
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/get_skill_file.py`
  - Tool: `get_skill_file` — reads file content from artifact via `get_artifact_by_path`
  - Validate file path: reject `..` traversal and absolute paths
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/str_replace_skill_file.py`
  - Tool: `str_replace_skill_file` — string replace in file, `upsert_artifact` with updated content
  - Guard: if `not ctx.has_reported_thinking`, return `"You must call report_thinking before making edits."`
  - If SKILL.md: re-parse YAML → update `AgentSkill.description`; if YAML is invalid, reject the edit
  - Validate file path: reject `..` traversal and absolute paths
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/create_skill_file.py`
  - Tool: `create_skill_file` — create new file in an existing skill via `upsert_artifact`
  - Guard: if `not ctx.has_reported_thinking`, return `"You must call report_thinking before making edits."`
  - Forbid creating `SKILL.md` (use `str_replace_skill_file` to edit it instead)
  - Validate file path: reject `..` traversal and absolute paths
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/create_skill.py`
  - Tool: `create_skill` — create a brand new skill (Disk + AgentSkill + SKILL.md artifact)
  - Guard: if `not ctx.has_reported_thinking`, return `"You must call report_thinking before making edits."`
  - Uses existing `agent_skill.create_skill(db_session, project_id, skill_md_content, user_id=ctx.user_id)`
  - `user_id` comes from `ctx.user_id` (pre-fetched by controller from `LearningSpace.user_id` — no extra DB query)
  - Then `add_skill_to_learning_space(db_session, learning_space_id, skill.id)`
  - Then register new skill in `ctx.skills` so agent can reference it immediately
  - All operations share the same `db_session` (single transaction — no partial state on failure)
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/delete_skill_file.py`
  - Tool: `delete_skill_file` — delete file via `delete_artifact_by_path`
  - Guard: if `not ctx.has_reported_thinking`, return `"You must call report_thinking before making edits."`
  - Forbid deleting `SKILL.md`
  - Validate file path: reject `..` traversal and absolute paths

### 10. Create distillation tool schemas (single-shot, used by controller)
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_lib/distill.py`
  - Define `DISTILL_SUCCESS_TOOL` as `ToolSchema` (not `Tool` — no handler) with `report_success_analysis` function and fields: `task_goal`, `approach`, `key_decisions`, `generalizable_pattern`, `user_preferences_observed`
  - Define `DISTILL_FAILURE_TOOL` as `ToolSchema` with `report_failure_analysis` function and fields: `task_goal`, `failure_point`, `flawed_reasoning`, `what_should_have_been_done`, `prevention_principle`, `user_preferences_observed`
  - These are schema-only — the controller passes them to `llm_complete()` and extracts tool call arguments from the response
  - Define `extract_distillation_result(llm_return: LLMResponse) -> Result[str]` helper:
    - Extracts tool call arguments from `LLMResponse.tool_calls[0].function.arguments`
    - Returns `Result.reject` if no tool calls, wrong tool name, or missing required fields
    - Formats the arguments as a readable text section (`## Task Analysis\n...`) for the skill learner agent

### 11. Create skill learner tool pool
- [x] **Create** `src/server/core/acontext_core/llm/tool/skill_learner_tools.py`
  - Import all 6 skill tools + `_finish_tool` from util_lib
  - Create a custom `report_thinking` tool handler that wraps `_thinking_tool` and sets `ctx.has_reported_thinking = True`
  - Build `SKILL_LEARNER_TOOLS: ToolPool` dict (8 tools total)
  - Note: distillation tools are NOT in this pool (they're used by the controller, not the agent)

### 12. Create skill learner prompt
- [x] **Create** `src/server/core/acontext_core/llm/prompt/skill_learner.py`
  - `SkillLearnerPrompt(BasePrompt)`:
    - `system_prompt()` — the system prompt from above (references distilled context, not raw messages)
    - `pack_skill_learner_input(distilled_context, available_skills_str)` — formats user message with `## Task Analysis` and `## Available Skills`
    - `success_distillation_prompt()` — system prompt for success distillation (classmethod)
    - `failure_distillation_prompt()` — system prompt for failure distillation (classmethod)
    - `pack_distillation_input(finished_task, task_messages, all_tasks)` — formats raw messages + task info for distillation LLM call
    - `prompt_kwargs()` — returns `{"prompt_id": "agent.skill_learner"}`
    - `tool_schema()` — returns tool schemas from `SKILL_LEARNER_TOOLS`

### 13. Create skill learner agent
- [x] **Create** `src/server/core/acontext_core/llm/agent/skill_learner.py`
  - `skill_learner_agent(project_id, learning_space_id, user_id, skills_info, distilled_context, max_iterations=5) -> Result[None]`
  - Receives pre-distilled context (NOT raw messages) — the controller handles distillation before calling this
  - Builds `SkillLearnerCtx(db_session, project_id, learning_space_id, user_id, skills)` per tool-execution block
  - Follows same pattern as `task_agent_curd`:
    - Pre-dump tools to dicts: `json_tools = [tool.model_dump() for tool in SkillLearnerPrompt.tool_schema()]`
    - Build initial user message via `SkillLearnerPrompt.pack_skill_learner_input(distilled_context, available_skills_str)`
    - LLM loop: call `llm_complete()` → process tool calls → append tool responses → repeat
    - Detect `finish` tool by name → break iteration loop
    - Open fresh `DB_CLIENT.get_session_context()` per tool-execution block (same DB session management as task agent)
  - Add `@track_process` decorator for telemetry (consistent with existing agents)
  - Use the project's configured LLM model (same `llm_complete` abstraction as task agent)

### 14. Create skill learner controller
- [x] **Create** `src/server/core/acontext_core/service/controller/skill_learner.py`
  - `process_skill_learning(project_id, session_id, task_id, learning_space_id) -> Result[None]`
  - `learning_space_id` is passed from the consumer (already resolved for the lock key — no duplicate query)
  - **Step 1**: Fetch target task, raw messages, session tasks
  - **Step 2**: Context Distillation — single `llm_complete()` call:
    - Pick distillation prompt + tool based on `task.status` (success vs failure)
    - Build user content via `pack_distillation_input(task, messages, session_tasks)`
    - Call `llm_complete()` with the tool — extract structured analysis from tool call arguments
    - Format via `extract_distillation_result()` → `distilled_context` string
    - **On distillation failure**: log warning and return early (`Result.reject`) — do NOT run the agent with no distilled context
  - **Step 3**: Fetch `LearningSpace` to get `user_id`, then skill infos via `get_learning_space_skill_ids` + `get_skills_info`
  - **Step 4**: Call `skill_learner_agent(project_id, learning_space_id, user_id, skills_info, distilled_context)`
  - Error paths:
    - Task not found → `Result.reject` (stale message, task was deleted)
    - Task not success/failed → `Result.resolve` (skip — stale message or status changed)
    - Session has no tasks → `Result.reject`
    - Learning space deleted → `Result.reject`
    - Distillation LLM call fails → `Result.reject` (logged, do not proceed to agent)
    - Agent fails → propagate agent's `Result.reject`

### 15. Create skill learner consumer (with Redis lock)
- [x] **Create** `src/server/core/acontext_core/service/skill_learner.py`
  - **Primary consumer** `process_skill_learn_task`:
    - Register with `@register_consumer` (exchange: `EX.learning_skill`, routing_key: `RK.learning_skill_process`, queue: `"learning.skill.process.entry"`)
    - Resolve `learning_space_id` from session via `get_learning_space_for_session(db_session, session_id)`
      - If session has no learning space → skip gracefully (learning space may have been removed)
    - Acquire Redis lock: `check_redis_lock_or_set(project_id, f"skill_learn.{learning_space_id}")`
      - Lock key format: `lock.{project_id}.skill_learn.{learning_space_id}`
      - TTL: `session_message_processing_timeout_seconds` (reuse existing config, 60s)
    - If lock acquired → call `process_skill_learning(project_id, session_id, task_id, learning_space_id)`
    - If lock NOT acquired → republish to retry queue: `publish_mq(EX.learning_skill, RK.learning_skill_process_retry, body)`
    - Release lock in `finally` block: `release_redis_lock(project_id, f"skill_learn.{learning_space_id}")`
  - **Retry consumer** `process_skill_learn_task_retry`:
    - Register with `@register_consumer` (exchange: `EX.learning_skill`, routing_key: `RK.learning_skill_process_retry`, queue: `"learning.skill.process.retry.entry"`, `need_dlx_queue=True`, `use_dlx_ex_rk=(EX.learning_skill, RK.learning_skill_process)`)
    - Handler: `SpecialHandler.NO_PROCESS` (DLX re-routes back to primary queue after TTL backoff)

### 16. Register consumer in service init
- [x] **Modify** `src/server/core/acontext_core/service/__init__.py`
  - Add `from . import skill_learner  # noqa: F401`

### Recommended Execution Order

> Tasks have dependencies — **do not implement in numerical order**.

| Step         | Task(s)            | Why                                                                                                     |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------- |
| 1 (parallel) | TODO 1, 2, 3, 4, 5 | Independent — MQ constants, schema, data layer, artifact delete, TaskCtx fields. No cross-deps.         |
| 2 (parallel) | TODO 6, 7, 8       | Modify existing agent pipeline — depend on TODO 1 (constants), TODO 3 (data service), TODO 5 (TaskCtx). |
| 3 (parallel) | TODO 9, 10         | Skill learner tools + distillation tools — depend on TODO 3 (data service), TODO 4 (artifact delete).   |
| 4 (parallel) | TODO 11, 12        | Tool pool + prompt — depend on TODO 9, 10 (tools exist).                                                |
| 5            | TODO 13            | Skill learner agent — depends on TODO 9, 11, 12.                                                        |
| 6            | TODO 14            | Controller — depends on TODO 3, 10, 13.                                                                 |
| 7            | TODO 15            | Consumer — depends on TODO 1, 2, 14.                                                                    |
| 8            | TODO 16            | Service init — depends on TODO 15.                                                                      |

---

## Design Notes

### Concurrency: Redis Lock per Learning Space

If two tasks in the same session complete in quick succession, two consumers would run skill learner agents concurrently against the same skill set — risking lost updates or `str_replace_skill_file` failures from stale content.

**Solution:** Redis distributed lock per learning space, following the same pattern as `session_message` consumers:

```python
# Lock key format
lock_key = f"skill_learn.{learning_space_id}"

# In consumer handler:
ls = await LS.get_learning_space_for_session(db_session, session_id)
locked = await check_redis_lock_or_set(project_id, lock_key)
if not locked:
    # Another learner is processing this space — retry later
    await publish_mq(EX.learning_skill, RK.learning_skill_process_retry, body_json)
    return
try:
    await process_skill_learning(project_id, session_id, task_id, ls.learning_space_id)
finally:
    await release_redis_lock(project_id, lock_key)
```

- **Lock key:** `lock.{project_id}.skill_learn.{learning_space_id}` — serializes all learning for one space
- **TTL:** 60s (reuses `session_message_processing_timeout_seconds`) — auto-expires if consumer crashes
- **On lock failure:** Republish to retry queue → DLX re-routes back to primary queue after TTL backoff
- **Release:** Always in `finally` block — guarantees release on success or failure
- **Effect:** Only one skill learner agent runs per learning space at a time. Queued messages wait via DLX backoff.

### Edge Cases & Implementation Notes

1. **`NEED_UPDATE_CTX` destroys `USE_CTX`**: In `task_agent_curd`, `update_task` is in the `NEED_UPDATE_CTX` set. After the handler appends a task_id to `ctx.learning_task_ids`, the loop immediately sets `USE_CTX = None`. To avoid losing accumulated IDs, a **function-scoped `_pending_learning_task_ids`** list is used — IDs are transferred from the ctx before each `NEED_UPDATE_CTX` reset and drained/published after the DB session commits. See TODO 7 for the exact insertion points.

2. **Learning space deleted between publish and consume**: The MQ message only contains `(project_id, session_id, task_id)`. When the consumer resolves `learning_space_id` via `get_learning_space_for_session`, the session may no longer belong to a learning space. The consumer skips gracefully.

3. **Task status changed between publish and consume**: A task marked `success` at publish time could theoretically be updated again before consume. The controller validates `task.status in (SUCCESS, FAILED)` — if not, it skips via `Result.resolve` (not an error, just a stale message).

4. **Distillation failure isolation**: If the distillation LLM call fails (timeout, rate limit, invalid response), the controller returns early with `Result.reject`. The skill learner agent never runs. This prevents the agent from operating on incomplete information.

5. **`build_task_ctx` needs no changes**: `learning_task_ids` has a default (`field(default_factory=list)`), so fresh `TaskCtx` construction works without modification. The `enable_skill_learning` flag lives only on `task_agent_curd`'s function parameter — it gates the drain-publish, not the collection. The tool always collects finished task IDs regardless.

---

## New Dependencies

**None.** All functionality is built on existing infrastructure:
- `aio_pika` (already used for MQ)
- `sqlalchemy` (already used for DB)
- `pydantic` (already used for schemas)
- LLM completion via existing `llm_complete` abstraction

---

## Test Cases

### Unit Tests

- [x] `test_learning_space_data_service` — Test `get_learning_space_for_session`, `get_learning_space`, `get_learning_space_skill_ids`, `get_skills_info`, `add_skill_to_learning_space`
  - Session with learning space returns correct data (includes `learning_space_id`)
  - Session without learning space returns None
  - `get_learning_space` returns learning space with `user_id`
  - `get_learning_space` returns error for non-existent ID
  - Learning space with no skills returns empty list
- [x] `test_artifact_delete` — Test `delete_artifact_by_path`
  - Deleting existing artifact succeeds
  - Deleting non-existent artifact returns error
- [x] `test_skill_learner_tools`
  - `get_skill` returns correct skill info with file list
  - `get_skill_file` reads correct file content from artifact
  - `str_replace_skill_file` correctly replaces string in file
  - `str_replace_skill_file` rejects when old_string not found
  - `str_replace_skill_file` rejects when old_string found multiple times
  - `str_replace_skill_file` on SKILL.md updates AgentSkill description
  - `create_skill_file` creates new artifact with correct content
  - `create_skill` creates new AgentSkill + Disk + artifact + LS junction
  - `create_skill` registers new skill in context
  - `delete_skill_file` removes artifact
  - `delete_skill_file` rejects deleting SKILL.md
- [x] `test_thinking_guard`
  - All editing tools (`str_replace_skill_file`, `create_skill_file`, `create_skill`, `delete_skill_file`) return hint string when `ctx.has_reported_thinking` is False
  - After `report_thinking` is called, `ctx.has_reported_thinking` is True
  - After `report_thinking` is called, editing tools proceed normally
  - Read-only tools (`get_skill`, `get_skill_file`) work regardless of `has_reported_thinking`
- [x] `test_skill_learner_distill`
  - `DISTILL_SUCCESS_TOOL` schema has all required fields (task_goal, approach, key_decisions, generalizable_pattern)
  - `DISTILL_FAILURE_TOOL` schema has all required fields (task_goal, failure_point, flawed_reasoning, what_should_have_been_done, prevention_principle)
  - `extract_distillation_result` returns `Result[str]` with formatted text for success tool call args
  - `extract_distillation_result` returns `Result[str]` with formatted text for failure tool call args
  - `extract_distillation_result` handles missing optional fields (user_preferences_observed)
  - `extract_distillation_result` returns `Result.reject` when LLM response has no tool calls
  - `extract_distillation_result` returns `Result.reject` when tool call has wrong function name
  - `pack_distillation_input` formats task + messages + session tasks correctly
  - Success distillation prompt is non-empty and mentions `report_success_analysis`
  - Failure distillation prompt is non-empty and mentions `report_failure_analysis`
- [x] `test_skill_learner_prompt`
  - System prompt is non-empty string and references "Task Analysis" (not raw messages)
  - `pack_skill_learner_input` formats `## Task Analysis` and `## Available Skills` sections
  - Tool schemas include all 8 expected tools (distillation tools are NOT included)
- [x] `test_skill_learner_trigger`
  - `update_task` to success always appends task_id to `ctx.learning_task_ids` (no flag check)
  - `update_task` to failed always appends task_id to `ctx.learning_task_ids`
  - `update_task` to running does NOT append
  - `update_task` to pending does NOT append
  - Agent loop with `enable_skill_learning=True` drains `_pending_learning_task_ids` and calls `publish_mq` after DB commit
  - Agent loop with `enable_skill_learning=False` does NOT publish (IDs collected but not sent)
  - Agent loop clears the list after draining
  - **NEED_UPDATE_CTX edge case**: when `update_task` appends IDs and then `USE_CTX` is set to `None`, IDs are preserved in the function-scoped `_pending_learning_task_ids` list
  - **Multiple updates in one iteration**: two `update_task` calls in one iteration both have their IDs published
- [x] `test_skill_learner_tools_validation`
  - `get_skill_file` rejects path with `..` traversal
  - `create_skill_file` rejects creating `SKILL.md` (forbidden — use str_replace instead)
  - `str_replace_skill_file` rejects edit that produces invalid YAML in SKILL.md
  - `delete_skill_file` rejects path with `..` traversal
  - `create_skill` uses `ctx.user_id` (not a separate DB query)

### Integration Tests

- [x] `test_context_distillation_e2e` — Distillation with mock LLM (covered in `test_skill_learner_distill.py`)
  - Success task → LLM returns `report_success_analysis` tool call → extracted correctly
  - Failed task → LLM returns `report_failure_analysis` tool call → extracted correctly
  - LLM returns no tool call → graceful error
  - LLM returns wrong tool name → graceful error
- [x] `test_skill_learner_consumer` — End-to-end consumer test (covered in `test_skill_learner_consumer.py`)
  - Publish SkillLearnTask → consumer processes → distillation runs → agent runs → skills updated
  - Failed task uses failure distillation prompt and tool
  - Pipeline passes existing skills info to the agent
- [x] `test_skill_learner_agent` — Agent loop test with mock LLM (covered in `test_skill_learner_agent.py`)
  - Agent reads skills, edits files, creates new skills correctly
  - Agent receives distilled context (not raw messages) and processes it correctly
  - Agent stops on finish / no-tool-calls / max_iterations
  - Agent handles LLM error and unknown tool error gracefully
  - Agent preserves has_reported_thinking across iterations
  - Tool responses are appended to conversation history
- [x] `test_skill_learner_consumer_error_paths` (covered in `test_skill_learner_consumer.py`)
  - Consumer handles missing task_id gracefully (task was deleted)
  - Consumer handles task not in success/failed status (stale message — skip)
  - Consumer handles deleted learning space gracefully
  - Consumer handles learning space with no skills (agent creates new skills)
  - Consumer handles distillation failure gracefully (logs warning, returns early — agent does NOT run)
- [x] `test_skill_learner_consumer_locking` (covered in `test_skill_learner_consumer.py`)
  - Consumer acquires lock and processes successfully → lock released
  - Consumer fails to acquire lock → republishes to retry queue (not processed)
  - Consumer crashes mid-processing → lock auto-expires after TTL
  - Lock is released in `finally` even when controller raises an exception
  - Two concurrent consumers for same learning space → one processes, one retries
  - Retry consumer re-routes message back to primary queue via DLX

---

## File Summary

### New Files (16)
| File                                                   | Description                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `schema/mq/learning.py`                                | `SkillLearnTask` MQ message schema                                                   |
| `service/data/learning_space.py`                       | Learning space data access layer (5 functions)                                       |
| `service/controller/skill_learner.py`                  | Skill learner orchestration controller (distillation + agent)                        |
| `service/skill_learner.py`                             | MQ consumer registration                                                             |
| `llm/agent/skill_learner.py`                           | Skill learner agent (LLM loop)                                                       |
| `llm/prompt/skill_learner.py`                          | System prompt, distillation prompts, and input formatting                            |
| `llm/tool/skill_learner_tools.py`                      | Tool pool registration (8 tools)                                                     |
| `llm/tool/skill_learner_lib/__init__.py`               | Python package init (empty)                                                          |
| `llm/tool/skill_learner_lib/ctx.py`                    | `SkillInfo` + `SkillLearnerCtx` dataclasses                                          |
| `llm/tool/skill_learner_lib/distill.py`                | Distillation tool schemas (`ToolSchema`, no handler) + `extract_distillation_result` |
| `llm/tool/skill_learner_lib/get_skill.py`              | Get skill info tool                                                                  |
| `llm/tool/skill_learner_lib/get_skill_file.py`         | Read skill file tool                                                                 |
| `llm/tool/skill_learner_lib/str_replace_skill_file.py` | Edit skill file tool                                                                 |
| `llm/tool/skill_learner_lib/create_skill_file.py`      | Create file in existing skill tool                                                   |
| `llm/tool/skill_learner_lib/create_skill.py`           | Create brand new skill tool                                                          |
| `llm/tool/skill_learner_lib/delete_skill_file.py`      | Delete skill file tool                                                               |

### Modified Files (7)
| File                            | Change                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `service/constants.py`          | Add `EX.learning_skill`, `RK.learning_skill_process`, `RK.learning_skill_process_retry`                                           |
| `service/__init__.py`           | Import `skill_learner` consumer module                                                                                            |
| `service/controller/message.py` | Check learning space, pass `enable_skill_learning` to agent                                                                       |
| `service/data/artifact.py`      | Add `delete_artifact_by_path` function                                                                                            |
| `llm/tool/task_lib/ctx.py`      | Add `learning_task_ids: list` field to `TaskCtx` (no flag — tool always collects, outer loop gates publish)                       |
| `llm/tool/task_lib/update.py`   | Append to `ctx.learning_task_ids` when status → success/failed (always, no flag check)                                            |
| `llm/agent/task.py`             | Add `enable_skill_learning` param, pass to `TaskCtx`, save-before-reset pattern for `NEED_UPDATE_CTX`, drain-publish after commit |

All paths are relative to `src/server/core/acontext_core/`.
