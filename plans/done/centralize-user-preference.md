# Plan: Centralize User Preferences — Task-Independent Preference Submission to Skill Learning

## Features / Show case

- **Task-independent preference submission**: The task agent can now submit user preferences without tying them to a specific task. Preferences like "I prefer TypeScript" or "my email is x@y.com" are captured regardless of which task (if any) is being discussed.
- **Immediate preference learning**: Submitted preferences are published directly to the skill agent queue after the task agent loop completes — no need to wait for a task to reach `success` or `failed`. Preferences from abandoned/long-running tasks are no longer lost.
- **Bypass distillation**: Preferences skip the context distillation step entirely (there's nothing to distill — "I prefer tabs" is already a clear statement). They're formatted as a `distilled_context` string and sent straight to the skill agent, reusing the existing `SkillLearnDistilled` → skill agent pipeline.
- **Batched per turn**: Multiple preferences detected in a single task agent turn are batched into one `SkillLearnDistilled` message, minimizing lock contention and LLM calls on the skill agent.
- **Persistent storage on planning task**: Every submitted preference is appended to the planning task's JSONB `data["user_preferences"]` list. This provides a durable record in the DB (visible for debugging, auditing, and recovery) while the MQ publish handles the learning side.
- **Known preferences in context**: The task agent's input includes a `## Known User Preferences` section showing all previously submitted preferences (read from the planning task). This prevents duplicate submissions across turns and gives the agent useful context for task descriptions.
- **Clean separation of concerns**: Distillation now focuses purely on task outcome analysis (SOPs, anti-patterns). Preference learning has its own dedicated path. The two don't interfere.
- **Synergy with triviality filter**: The triviality filter can skip tasks like "Hi, I'm John, I use Python" (`is_worth_learning: false`). But the preferences in that message ("name is John", "uses Python") are still captured by the task agent via `submit_user_preference` and learned immediately — they never depend on distillation passing.

**Before (problem):**

```
User says "I prefer dark mode, also my email is user@co.com" during a running task
  → set_task_user_preference(task_order=1, pref="prefers dark mode, email: user@co.com")
  → Stored in task.data["user_preferences"]
  → Task never finishes (user abandons session)
  → SkillLearnTask never published
  → Preference LOST forever
```

**After (solution):**

```
User says "I prefer dark mode, also my email is user@co.com" during a running task
  → submit_user_preference(pref="prefers dark mode, email: user@co.com")
  → Persisted to planning task's data["user_preferences"] in DB (durable)
  → Accumulated in TaskCtx.pending_preferences (for MQ)
  → End of iteration → format as distilled_context → publish SkillLearnDistilled
  → Skill agent receives it immediately, updates "user-general-facts" skill
  → Preference STORED and LEARNED regardless of task outcome
```

---

## Design overview

### Data flow

```
Session Messages → Task Agent (task_agent_curd)
    │
    ├── Tool: submit_user_preference("prefers TypeScript")
    │     ├── ctx.pending_preferences.append("prefers TypeScript")  ← MQ path (first)
    │     └── TD.append_preference_to_planning_task(...)            ← DB persist (second, soft-fail)
    │
    ├── Tool: submit_user_preference("email: user@co.com")
    │     ├── ctx.pending_preferences.append("email: user@co.com") ← MQ path (first)
    │     └── TD.append_preference_to_planning_task(...)            ← DB persist (second, soft-fail)
    │
    ├── (other tools: insert_task, update_task, etc.)
    │     └── on NEED_UPDATE_CTX: drain ctx.pending_preferences → _pending_preferences
    │         (same pattern as learning_task_ids drain to prevent loss on ctx reset)
    │
    └── End of each iteration (after try/except, before error return):
          ├── Final drain: USE_CTX.learning_task_ids → _pending_learning_task_ids
          ├── Final drain: USE_CTX.pending_preferences → _pending_preferences
          ├── Publish _pending_learning_task_ids → SkillLearnTask (existing, unchanged)
          └── Publish _pending_preferences → format → SkillLearnDistilled
                    directly to skill agent queue (RK: learning.skill.agent)
                    bypassing distillation consumer entirely
```

### `SkillLearnDistilled` message for preferences

Reuses the existing `SkillLearnDistilled` schema. The `distilled_context` field is formatted as:

```markdown
## User Preferences Observed
- Prefers TypeScript over JavaScript
- Email: user@example.com
- Always use 2-space indentation
```

The `task_id` field is set to a nil UUID (`uuid.UUID(int=0)`) since no task is associated. The skill agent receives this just like any task distillation and updates the appropriate skill (e.g., `user-general-facts`).

### Persistent storage in planning task

Every call to `submit_user_preference` persists the preference to the planning task's JSONB `data["user_preferences"]` list via `TD.append_preference_to_planning_task()`. This function reuses the same planning-task-or-create pattern as `append_messages_to_planning_section` — if no planning task exists, one is created with `is_planning=True, order=0`. The preference is **appended** (not replaced), so the list grows over a session's lifetime.

This DB write is the durable record. The MQ publish (later, at end of iteration) is for learning. If MQ publish fails, the preference is still in the DB. Committed preferences survive across iterations. Note: within a single iteration, all tool DB writes share one session — if a later tool fails, the entire session rolls back (including the preference write). But the MQ publish still proceeds because `_pending_preferences` is not cleared on error.

`submit_user_preference` does NOT need to be in `NEED_UPDATE_CTX` because the planning task is excluded from the task context (`fetch_current_tasks` filters `is_planning == False`). Modifying its JSONB doesn't invalidate the ctx.

### Preference drain on ctx reset (critical correctness detail)

When a tool in `NEED_UPDATE_CTX` runs, `USE_CTX` is set to `None`. Before that, we must drain `pending_preferences` into the loop-level `_pending_preferences` list — same pattern as `learning_task_ids`. Without this, preferences submitted before an `update_task` call in the same tool batch would be silently lost.

### Error resilience

Unlike `_pending_learning_task_ids` which are cleared on tool error (task state may be inconsistent), `_pending_preferences` are **NOT** cleared on error. Preferences are user facts ("I prefer Python") that remain true regardless of whether `insert_task` crashed. They should still be published.

### Passing `learning_space_id` through (avoid redundant DB lookup)

The message controller already resolves `learning_space_id` to check if skill learning is enabled. Instead of passing only a boolean `enable_skill_learning` and re-resolving inside the task agent, pass `learning_space_id: Optional[asUUID]` directly. The boolean is derived from `learning_space_id is not None`.

### What changes and what doesn't

| Component | Changes? | Details |
|---|---|---|
| `TaskCtx` | **Yes** | Add `pending_preferences: list[str]` field |
| `submit_user_preference` tool | **New** | New tool, replaces `set_task_user_preference` |
| `set_task_user_preference` tool | **Removed** | Replaced by `submit_user_preference` |
| `task_tools.py` | **Yes** | Swap tool registration |
| `task.py` (agent) | **Yes** | Drain `pending_preferences` on ctx reset + final drain after try/except + publish after each iteration; change `enable_skill_learning` to `learning_space_id`; add `SkillLearnDistilled` and `uuid` imports; update `NEED_UPDATE_CTX` (remove old tool) |
| `message.py` (controller) | **Yes** | Pass `learning_space_id` instead of boolean |
| `task.py` (prompt) | **Yes** | Update preference instructions (no task_order) |
| `TaskData` schema | **Yes** | Keep `user_preferences` field (used by planning task); remove from `to_string()` display |
| `task.py` (service/data) | **Yes** | Replace `set_user_preference_for_task()` with `append_preference_to_planning_task()` |
| `skill_distillation.py` (prompt) | **Yes** | Remove `user_preferences_observed` from distillation prompts; remove `user_preferences` from `pack_distillation_input` |
| `distill.py` (tools) | **Yes** | Remove `user_preferences_observed` from tool schemas |
| `skill_learner.py` (prompt) | **Yes** | Add "User Preferences Observed" to skill learner system prompt context description; broaden opening line; add User Preference entry format |
| `SkillLearnDistilled` MQ schema | **No** | Reused as-is (task_id = nil UUID for preference messages) |
| `process_skill_agent` consumer | **No** | Receives `SkillLearnDistilled` as before |
| `skill_learner_agent` agent loop | **No** | Processes distilled_context as before |
| `process_skill_distillation` consumer | **No** | Unchanged (preference path bypasses it) |
| Constants (EX, RK) | **No** | Reuse `learning.skill.agent` routing key |

### Lock contention consideration

If a task completes AND preferences are submitted in the same turn, two `SkillLearnDistilled` messages are published: one from distillation (via `SkillLearnTask` → distillation consumer) and one from preferences (directly). The second will hit the Redis lock and go to the retry queue — this is already handled by the existing retry/DLX mechanism. No special handling needed.

---

## TODOs

- [x] **1. Add `pending_preferences` to `TaskCtx`** — Add `pending_preferences: list[str] = field(default_factory=list)` to the `TaskCtx` dataclass, mirroring the existing `learning_task_ids` pattern.
  - File: `src/server/core/acontext_core/llm/tool/task_lib/ctx.py`

- [x] **2. Create `submit_user_preference` tool** — New tool file. Handler does two things in this order: (a) appends the preference string to `ctx.pending_preferences` (always succeeds — ensures MQ learning path is never lost), then (b) calls `TD.append_preference_to_planning_task()` to persist to DB. If DB write fails, log warning and return success anyway — the preference is captured for MQ. No `task_order` parameter. Description emphasizes task-independent general preferences, personal info, constraints. Validates non-empty/whitespace-only preference strings.
  - File: `src/server/core/acontext_core/llm/tool/task_lib/submit_preference.py` (new)

- [x] **3. Remove `set_task_user_preference` tool** — Delete the old task-bound preference tool file.
  - File: `src/server/core/acontext_core/llm/tool/task_lib/set_preference.py` (delete)

- [x] **4. Update task tool registry** — Replace `set_task_user_preference` import/registration with `submit_user_preference`.
  - File: `src/server/core/acontext_core/llm/tool/task_tools.py`

- [x] **5. Update task agent prompt** — Multiple changes in the system prompt:
  - File: `src/server/core/acontext_core/llm/prompt/task.py`
  - (a) **Task Structure section** — remove per-task preference references:
    ```
    ## Task Structure
    - Tasks have: description, status, and sequential order (`task_order=1, 2, ...`)
    - Messages link to tasks via their IDs
    - Statuses: `pending` | `running` | `success` | `failed`
    ```
  - (b) **Input Format section** — remove "and user preferences", add Known User Preferences:
    ```
    ## Input Format
    - `## Current Existing Tasks`: existing tasks with orders, descriptions, and statuses
    - `## Previous Progress`: context from prior task progress
    - `## Known User Preferences`: previously submitted user preferences (if any) — do not re-submit these
    - `## Current Message with IDs`: messages to analyze, formatted as `<message id=N>content</message>`
    ```
  - (c) **Section 5** — replace "Record User Preferences" with "Submit User Preferences":
    ```
    ### 5. Submit User Preferences
    - Use `submit_user_preference` when messages reveal user preferences, personal info, or general constraints
    - These are **task-independent** — submit them regardless of which task (if any) they relate to
    - Examples of what to submit:
      - Tech stack preferences ("I prefer TypeScript", "we use PostgreSQL")
      - Coding style ("always use 2-space indentation", "prefer functional style")
      - Personal info ("my name is John", "my email is john@co.com")
      - Tool/workflow preferences ("I use VS Code", "deploy to AWS")
      - Project constraints ("must support IE11", "no external dependencies")
    - Each call submits one preference — be specific and self-contained
    - Do NOT skip preferences just because they seem unrelated to the current task
    - Check `## Known User Preferences` first — do NOT re-submit preferences already listed there
    ```
  - (d) **Thinking report item 6** — change from:
    `6. User preferences to set or update for which tasks?`
    to:
    `6. Any user preferences, personal info, or general constraints to submit?`
  - (e) **`tool_schema()` method** — replace `set_task_user_preference` with `submit_user_preference`:
    ```python
    submit_user_preference_tool = TASK_TOOLS["submit_user_preference"].schema
    ```
  - (f) **`pack_task_input()`** — add `known_preferences: list[str] = None` parameter. If non-empty, insert a `## Known User Preferences` section (one bullet per preference) between `## Previous Progress` and `## Current Message with IDs`.

- [x] **6. Update task agent loop and imports** — Changes in `task.py` agent:
  - (a) **Imports**: Add `from ...schema.mq.learning import SkillLearnDistilled` (alongside existing `SkillLearnTask` import). Add `import uuid`. Replace `_set_task_user_preference_tool` import with `_submit_user_preference_tool` import from `submit_preference`. Remove `_set_task_user_preference_tool` from the `NEED_UPDATE_CTX` set (the new tool does NOT need to be in `NEED_UPDATE_CTX` — the planning task is excluded from the task context, so modifying it doesn't invalidate ctx).
  - (b) **Fetch known preferences**: In the initial `DB_CLIENT.get_session_context()` block (where `fetch_current_tasks` is called), also call `TD.fetch_planning_task(db_session, session_id)`. Extract `known_preferences = planning_task.data.user_preferences or []` if planning task exists, else `[]`. Pass `known_preferences` to `TaskPrompt.pack_task_input()`.
  - (c) Add `_pending_preferences: list[str] = []` at the loop level (mirroring `_pending_learning_task_ids`).
  - (d) In the `NEED_UPDATE_CTX` drain block (inside the `for tool_call in use_tools` loop, after `tool_name in NEED_UPDATE_CTX`), also drain `ctx.pending_preferences` into `_pending_preferences` before setting `USE_CTX = None`. This prevents preference loss when ctx is reset mid-batch.
  - (e) **Final drain after try/except** (critical — mirrors the existing `learning_task_ids` final drain at lines 233-235): Add `if USE_CTX and USE_CTX.pending_preferences: _pending_preferences.extend(USE_CTX.pending_preferences); USE_CTX.pending_preferences.clear()`. This catches preferences when `submit_user_preference` is the last tool in a batch and no `NEED_UPDATE_CTX` tool follows.
  - (f) After the existing `_pending_learning_task_ids` publish block, add a preference publish block: if `learning_space_id is not None` and `_pending_preferences` is non-empty, format them as a `distilled_context` string, publish `SkillLearnDistilled` directly to `RK.learning_skill_agent` with `task_id=uuid.UUID(int=0)`. Wrap in try/except with `LOG.warning` on failure (same pattern as `SkillLearnTask` publish). Clear `_pending_preferences` after publish.
  - (g) Do NOT clear `_pending_preferences` on tool error in the `except RuntimeError` block (unlike `_pending_learning_task_ids`). Preferences are user facts that remain true regardless of tool errors. Because the publish block (step f) runs before the `if _tool_error is not None: return` check, preferences are still published even when the function returns an error.
  - (h) Change parameter `enable_skill_learning: bool` to `learning_space_id: Optional[asUUID] = None`. Derive boolean from `learning_space_id is not None` where needed.
  - File: `src/server/core/acontext_core/llm/agent/task.py`

- [x] **7. Update message controller** — Pass `ls_session.learning_space_id` (or `None`) instead of `enable_skill_learning` boolean to `task_agent_curd`. Remove the boolean derivation.
  - File: `src/server/core/acontext_core/service/controller/message.py`

- [x] **8. Keep `user_preferences` on `TaskData`, remove from `to_string()`** — Keep the `user_preferences: Optional[list[str]] = None` field on `TaskData` (it's now used by the planning task to store accumulated preferences). Remove the user prefs display from `TaskSchema.to_string()` — regular tasks no longer store per-task preferences, and the planning task is not displayed via this path. Old regular-task JSONB rows that have `user_preferences` remain harmlessly in the DB.
  - File: `src/server/core/acontext_core/schema/session/task.py`

- [x] **9. Remove `set_user_preference_for_task`, add `append_preference_to_planning_task` data function** — Two changes in the data layer (no tool changes here — tool replacement is TODO #2-4):
  - (a) Delete `set_user_preference_for_task()` — the old per-task preference writer, no longer called by anything.
  - (b) Add `append_preference_to_planning_task(db_session, project_id, session_id, preference)` — a new **internal data function** (not a tool) called programmatically by the `submit_user_preference` tool handler. It finds the planning task (`is_planning=True`) or creates one (same find-or-create pattern as `append_messages_to_planning_section` data function), appends `preference` to `task.data["user_preferences"]` list (initializing if absent), calls `flag_modified` and flushes.
  - File: `src/server/core/acontext_core/service/data/task.py`

- [x] **10. Remove `user_preferences_observed` from distillation tools** — Remove the `user_preferences_observed` property from both `DISTILL_SUCCESS_TOOL` and `DISTILL_FAILURE_TOOL` schemas. Update `extract_distillation_result` to no longer append the `**User Preferences Observed:**` line.
  - File: `src/server/core/acontext_core/llm/tool/skill_learner_lib/distill.py`

- [x] **11. Remove `user_preferences` from distillation prompts** — Remove `user_preferences_observed` from `success_distillation_prompt()` and `failure_distillation_prompt()`. Remove the `user_preferences` section from `pack_distillation_input()`.
  - File: `src/server/core/acontext_core/llm/prompt/skill_distillation.py`

- [x] **12. Update skill learner system prompt for preference-only context** — Multiple changes:
  - File: `src/server/core/acontext_core/llm/prompt/skill_learner.py`
  - (a) **Opening line** — broaden from task-only to include preferences:
    ```
    You are a Self-Learning Skill Agent. You receive pre-distilled context (task analysis or user preferences) and update the learning space's skills.
    ```
  - (b) **"Context You Receive" section** — add `## User Preferences Observed` as a second context type, remove `user_preferences_observed` from task analysis fields:
    ```
    ## Context You Receive

    You receive ONE of the following context types, plus the available skills list:

    - **## Task Analysis**: pre-distilled summary of a completed task (not raw messages). Fields differ by outcome:
      - Success: task_goal, approach, key_decisions, generalizable_pattern
      - Failure: task_goal, failure_point, flawed_reasoning, what_should_have_been_done, prevention_principle
    - **## User Preferences Observed**: user facts, preferences, or personal info submitted during conversations, independent of any specific task outcome. These are direct factual statements, not task analysis.
    - **## Available Skills**: all skill names and descriptions in the learning space
    ```
  - (c) **Add "User Preference" entry format** alongside SOP and Warning:
    ```
    User Preference (Fact):
    - [factual preference statement]
    - Source: preference, YYYY-MM-DD
    ```
  - (d) **Workflow step 3 (Decide: Update or Create)** — add preference-specific guidance:
    ```
    4. Received user preferences (not task analysis)? → Look for a user-facts/preferences skill (e.g. "user-general-facts"). Update it, or create it if none exists.
       - Do NOT create SOP or Warning entries for user preferences — store them as factual entries using the User Preference format.
    ```
  - (e) **`pack_skill_learner_input()` closing line** — change from:
    `Please analyze the task and update or create skills as appropriate.`
    to:
    `Please analyze the above and update or create skills as appropriate.`

- [x] **13. Update existing tests and tool descriptions** — Existing test files and one tool description reference removed fields/functions. Update them:
  - (a) `tests/llm/test_task_agent.py` — **Heaviest changes.** Rewrite `TestToStringWithPreferences` (4 tests: `to_string()` no longer shows user prefs). Replace `TestSetTaskUserPreference` handler tests with `submit_user_preference` handler tests (import from `submit_preference`, test ctx.pending_preferences + DB persistence). Replace `TestSetUserPreferenceForTaskData` (4 tests: swap `set_user_preference_for_task` for `append_preference_to_planning_task` tests). Rewrite `TestProgressAndPreferenceSameSession`. Update `TestToolRegistration`: assert `"submit_user_preference" in TASK_TOOLS`, remove `NEED_UPDATE_CTX` assertion for preference tool, update tool count if changed.
  - (b) `tests/llm/test_skill_learner_distill.py` — Remove assertions about `user_preferences_observed` in distillation tool schemas. Update `pack_distillation_input` tests: remove the `user_preferences` section from expected output. Verify `extract_distillation_result` no longer appends `**User Preferences Observed:**` line.
  - (c) `tests/service/test_skill_learner_consumer.py` — Update any assertions on distilled text content that expect `user_preferences_observed`. Verify existing `process_skill_distillation` and `process_skill_agent` consumer tests still pass.
  - (d) `src/server/core/acontext_core/llm/tool/task_lib/append.py` — Update `append_messages_to_task` tool description: change `set_task_user_preference` reference to `submit_user_preference` (or remove the per-task preference mention since preferences are now task-independent).

---

## New deps

None. All changes use existing infrastructure (Pydantic, dataclasses, RabbitMQ, UUID).

---

## Test cases

- [x] `submit_user_preference` handler appends preference string to `ctx.pending_preferences`
- [x] `submit_user_preference` handler persists preference to planning task's `data["user_preferences"]` via `TD.append_preference_to_planning_task()`
- [x] `submit_user_preference` handler creates a planning task if none exists (same pattern as `append_messages_to_planning_section`)
- [x] `submit_user_preference` handler rejects empty/whitespace-only preference strings
- [x] `append_preference_to_planning_task` appends (not replaces) to the `user_preferences` list
- [x] `pending_preferences` are drained from `USE_CTX` before ctx reset in `NEED_UPDATE_CTX` block (preference submitted before `update_task` in same batch is not lost)
- [x] `pending_preferences` are drained from `USE_CTX` in the final drain after try/except (preference submitted as last tool in batch is not lost)
- [x] `task_agent_curd` drains `pending_preferences` and publishes `SkillLearnDistilled` with formatted context when `learning_space_id is not None`
- [x] `task_agent_curd` does NOT publish preferences when `learning_space_id is None`
- [x] `task_agent_curd` does NOT publish when no preferences were submitted (no empty message)
- [x] `_pending_preferences` are NOT cleared on tool error (preferences survive agent errors); preferences are still published before error return
- [x] Published `SkillLearnDistilled` has nil UUID for `task_id` and correctly formatted `distilled_context`
- [x] Multiple preferences in one turn are batched into a single `SkillLearnDistilled` message
- [x] `pending_preferences` are accumulated correctly across multiple tool calls within one agent iteration
- [x] `TaskData` schema still includes `user_preferences` field; `to_string()` no longer displays it
- [x] Old regular-task JSONB data with `user_preferences` key still deserializes correctly (field exists, value preserved)
- [x] `extract_distillation_result` no longer includes `**User Preferences Observed:**` line
- [x] `pack_distillation_input` no longer includes `- User Preferences:` section
- [x] Skill learner agent correctly handles `## User Preferences Observed` context (updates user-facts skill, does not create SOP/Warning entries)
- [x] Message controller passes `learning_space_id` (or `None`) to `task_agent_curd`
- [x] Existing tests in `test_task_agent.py` updated and passing (handler tests, `to_string` tests, tool registration, NEED_UPDATE_CTX assertions)
- [x] Existing tests in `test_skill_learner_distill.py` updated and passing (no `user_preferences_observed` assertions)
- [x] Existing tests in `test_skill_learner_consumer.py` updated and passing
- [x] `append_messages_to_task` tool description no longer references `set_task_user_preference`
