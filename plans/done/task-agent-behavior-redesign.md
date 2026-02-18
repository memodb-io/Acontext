# Task Agent Behavior Redesign

## Summary

Redesign the task extraction agent's behavior without changing the DB schema. Three key behavioral changes: (1) use the user's query verbatim as the task description instead of agent-invented summaries, (2) record progresses as honest, summarized step-by-step records of agent actions, and (3) treat user preferences as a single replaceable string instead of an append-only list — ensuring conflict resolution when preferences change.

Additionally, split the overloaded `append_messages_to_task` tool into three focused tools with single responsibilities.

## Current State

### Agent Overview
The task extraction agent (`llm/agent/task.py`) analyzes buffered conversation messages and performs CRUD on tasks via LLM tool-calling. It runs autonomously after messages are buffered and processed via RabbitMQ.

### Current Behavior (what changes)
1. **Task descriptions** are extracted from the agent's planning discussions — the agent invents structured descriptions like "Implement user authentication UI" from user requests.
2. **Progresses** are first-person narratives appended to a `list[str]` — e.g., "I navigated to the settings page and added a toggle."
3. **User preferences** are individual preference strings appended to a `list[str]` — e.g., `["user wants dark mode", "user prefers React"]`. New preferences are added on top of existing ones, which can cause conflicts if the user changes their mind.
4. **`append_messages_to_task`** is overloaded — it links messages, appends progress, appends preferences, and auto-updates status, all in one tool call. This couples unrelated concerns.

### Key Files
| File | Role |
|------|------|
| `src/server/core/acontext_core/llm/prompt/task.py` | System prompt + user input template + tool list |
| `src/server/core/acontext_core/llm/agent/task.py` | Agent loop, context building, `NEED_UPDATE_CTX` set |
| `src/server/core/acontext_core/llm/tool/task_tools.py` | Tool registry |
| `src/server/core/acontext_core/llm/tool/task_lib/append.py` | `append_messages_to_task` tool schema + handler |
| `src/server/core/acontext_core/llm/tool/task_lib/insert.py` | `insert_task` tool schema + handler |
| `src/server/core/acontext_core/llm/tool/task_lib/update.py` | `update_task` tool schema + handler |
| `src/server/core/acontext_core/llm/tool/task_lib/ctx.py` | `TaskCtx` dataclass |
| `src/server/core/acontext_core/service/data/task.py` | Data layer: `append_progress_to_task` |
| `src/server/core/acontext_core/schema/session/task.py` | `TaskSchema.to_string()`, `TaskData` pydantic model |
| `src/server/core/tests/llm/test_task_agent_atomicity.py` | Existing atomicity tests |

## Design Decisions

> **Decision #1:** How to handle user_preference replacement in the DB when schema stores `list[str]`?
> - **Chosen:** Replace entire `user_preferences` list with `[new_string]` — The DB schema stays unchanged (`user_preferences: list[str]`), but whenever the agent provides a new preference string, we replace the entire list with a single-element list containing the new value.

> **Decision #2:** Should current user preferences be shown to the agent in context?
> - **Chosen:** Yes — include current `user_preferences` in the task section shown to the agent. The agent needs to see the current preference to decide whether to rewrite it.

> **Decision #3:** Where to present user preferences — in task section or separate section?
> - **Chosen:** In the task section — since preferences are per-task, they belong with the task listing. Format: `Task N: description (Status: X) | User Prefs: "..."`

> **Decision #4:** How should `to_string()` handle legacy multi-element `user_preferences` from before this change?
> - **Chosen:** Join all elements with `" | "` — Preserves all data for old tasks. New tasks will naturally have only one element.

> **Decision #5:** Should the `user_preference` parameter be removed from `append_progress_to_task`?
> - **Chosen:** Yes, remove it — The data layer function should only handle progress. User preference is now handled by a separate `set_user_preference_for_task` function called by a dedicated tool.

> **Decision #6:** How to split the overloaded `append_messages_to_task` tool?
> - **Chosen:** Three isolated tools with single responsibilities:
>   - `append_messages_to_task` — only links message IDs to a task + auto-sets status to `running`
>   - `append_task_progress` — **new tool** — appends a progress step to a task
>   - `set_task_user_preference` — **new tool** — replaces the user preference string for a task
> - This eliminates the coupling problem entirely. Each tool can be called independently and concurrently.

## API / Interface Changes

No API or external interface changes. All changes are internal to the Python Core agent behavior.

**Note on SDKs:** The Python and TypeScript SDKs format `user_preferences` as a numbered list (e.g., `1. pref`). After this change, the list will typically have one element, so the output becomes `1. <full preference string>`. This is cosmetically awkward but functionally correct. SDK formatting updates are deferred to a follow-up.

## Data Model Changes

**No DB schema changes.** The `TaskData` JSONB structure stays:
```python
class TaskData(BaseModel):
    task_description: str
    progresses: Optional[list[str]] = None
    user_preferences: Optional[list[str]] = None
```

The only change is **behavioral**: `user_preferences` will now contain at most one element (the latest complete preference string) instead of accumulating multiple entries.

**Backward compatibility:** Existing tasks with multi-element `user_preferences` lists will be shown to the agent as a joined string (all elements joined with `" | "`). When the agent next updates a task's preference, the entire list is replaced with a single-element list.

## Tool Changes Summary (Before → After)

### `insert_task`
| Aspect | Before | After |
|--------|--------|-------|
| `task_description` param | "A clear, concise description of the task..." | Use the user's query/request verbatim or closely paraphrased. |
| Handler | — | No change |

### `update_task`
| Aspect | Before | After |
|--------|--------|-------|
| `task_description` param | "Update description for the task..." | Reflect the user's updated query/intent. |
| Handler | — | No change |

### `append_messages_to_task` (simplified)
| Aspect | Before | After |
|--------|--------|-------|
| Params | `task_order`, `message_ids`, `progress`, `user_preference_and_infos` | `task_order`, `message_ids` only |
| Responsibility | Link messages + append progress + append preference + auto-set status | **Only** link message IDs to task + auto-set status to `running` |
| Handler | 60+ lines handling messages, progress, preferences | Simple: link messages, update status if needed |

### `append_task_progress` (NEW tool)
| Aspect | Details |
|--------|---------|
| File | `src/server/core/acontext_core/llm/tool/task_lib/progress.py` |
| Params | `task_order` (int, required), `progress` (string, required) |
| Responsibility | Append a single progress step to a task's `progresses` list |
| Handler | Calls `TD.append_progress_to_task(db, task_id, progress)` |
| Status guard | Rejects if task is `success` or `failed` (must update status first) |

### `set_task_user_preference` (NEW tool)
| Aspect | Details |
|--------|---------|
| File | `src/server/core/acontext_core/llm/tool/task_lib/set_preference.py` |
| Params | `task_order` (int, required), `user_preference` (string, required) |
| Responsibility | **Replace** the task's entire `user_preferences` list with `[user_preference]` |
| Handler | Calls `TD.set_user_preference_for_task(db, task_id, user_preference)` |
| Status guard | No status restriction — preferences can be set on any task |

### `append_messages_to_planning_section` / `finish` / `report_thinking`
No changes.

### Supporting data layer
| Function | Before | After |
|----------|--------|-------|
| `append_progress_to_task` | `(db, task_id, progress, user_preference=None)` — appends both | `(db, task_id, progress)` — progress only, `user_preference` param **removed** |
| `set_user_preference_for_task` | Does not exist | **New**: `(db, task_id, user_preference)` — replaces list with `[user_preference]` |

### Supporting schema
| Method | Before | After |
|--------|--------|-------|
| `TaskSchema.to_string()` | `"Task {order}: {desc} (Status: {status})"` | `"Task {order}: {desc} (Status: {status}) \| User Prefs: "{prefs}"` — suffix shown only when preferences exist; joins all elements with `" \| "` |

### Tool registry & agent wiring
| File | Change |
|------|--------|
| `llm/tool/task_tools.py` | Add `_append_task_progress_tool` and `_set_task_user_preference_tool` to `TASK_TOOLS` dict |
| `llm/prompt/task.py` | Add new tools to `tool_schema()` return list |
| `llm/agent/task.py` | Add both new tools to `NEED_UPDATE_CTX` — they modify task `data` (progresses/preferences) which is part of `TaskCtx.task_index`, so context must be rebuilt after they run |

---

## Testing Strategy & Test Cases

### Strategy
- **Unit tests:** Test the new data function, new tool handlers, and modified existing handlers
- **Integration tests:** Verify existing atomicity tests still pass with the modified tools
- **Manual verification:** Run the agent against sample conversations and verify task descriptions match user queries, progresses read as step records, and user preferences are properly replaced

### Test Cases
- [x] Test `set_user_preference_for_task` data fn replaces existing preferences with a single new string
- [x] Test `set_user_preference_for_task` data fn works when `user_preferences` is `None` (first time)
- [x] Test `set_user_preference_for_task` data fn works when `user_preferences` is empty list `[]`
- [x] Test `set_user_preference_for_task` data fn replaces multi-element legacy list `["a", "b", "c"]` → `["new"]`
- [x] Test `append_progress_to_task` data fn no longer accepts `user_preference` parameter
- [x] Test `append_messages_to_task` handler only links messages (no progress/preference logic)
- [x] Test `append_messages_to_task` handler auto-sets status to `running`
- [x] Test `append_messages_to_task` handler rejects if task is `success` or `failed`
- [x] Test `append_task_progress` handler appends progress string correctly
- [x] Test `append_task_progress` handler rejects if task is `success` or `failed`
- [x] Test `set_task_user_preference` handler replaces preference string
- [x] Test `set_task_user_preference` handler rejects empty/whitespace-only preference strings
- [x] Test `set_task_user_preference` handler works on any task status (no restriction)
- [x] Test `append_task_progress` + `set_task_user_preference` on same task in same DB session (both JSONB sub-fields updated correctly)
- [x] Test `TaskSchema.to_string()` includes user preferences when present (single element)
- [x] Test `TaskSchema.to_string()` joins all elements for legacy multi-element `user_preferences`
- [x] Test `TaskSchema.to_string()` omits user preferences when `None`
- [x] Test `TaskSchema.to_string()` omits user preferences when empty list `[]`
- [x] Existing atomicity tests pass unchanged

---

## Implementation Tasks

### Recommended Execution Order

> Tasks have dependencies — **do not implement in numerical order**.

| Step | Task(s) | Why |
|------|---------|-----|
| 1 (parallel) | Task 2, Task 3, Task 7 | Independent — no cross-deps. Schema, data layer, and description updates. |
| 2 (parallel) | Task 4, Task 5 | New tools — depend on Task 3 (data layer functions). |
| 3 | Task 6 | Simplify old tool — do after Tasks 4+5 so there's no gap where progress/prefs can't be recorded. |
| 4 | Task 1 | Prompt + `tool_schema()` + `NEED_UPDATE_CTX` — depends on Tasks 4+5 (imports new tool objects). |
| 5 | Task 8 | Tests — depends on everything above. |

### Task 1: Rewrite the system prompt
- **Files:** `src/server/core/acontext_core/llm/prompt/task.py`
- **What:** Rewrite `TaskPrompt.system_prompt()` to reflect new agent behavior:
  - **Task descriptions**: Instruct the agent to use the user's query/request as the task description, verbatim or closely paraphrased. Do NOT invent new descriptions from agent planning.
  - **Progresses**: Instruct the agent to use `append_task_progress` to record concise, honest summaries of what the agent actually did at each step. Do NOT prefix with "Step:" — the `pack_previous_progress_section` function already adds a `Task N:` prefix, so progress strings should be plain descriptions like "Created login component in src/Login.tsx" or "Encountered Python syntax error in routers.py, investigating".
  - **User preferences**: Instruct the agent to use `set_task_user_preference` to set/update the preference. The current preference is visible in the task listing. The agent must provide the complete new preference string that replaces the old one entirely. This is NOT append — it's a full rewrite to resolve any conflicts with prior preferences.
  - **Message linking**: Instruct the agent to use `append_messages_to_task` only for linking message IDs to tasks. It no longer handles progress or preferences.
  - Keep the planning section, status transitions rules largely the same.
  - Update the Thinking Report checklist to reflect new tools and behavior.
  - Update `tool_schema()` to include the two new tools in the returned list.
- **Why:** The core behavioral change — all other tasks support this prompt change.
- **Acceptance criteria:**
  - [x] Prompt clearly instructs using user's query as task description
  - [x] Prompt explicitly distinguishes user requests (= tasks) from agent execution steps (= progress)
  - [x] Prompt includes concrete correct/wrong examples (restaurant booking, multi-request)
  - [x] Prompt clearly instructs concise step-by-step progress recording (no "Step:" prefix)
  - [x] Prompt clearly instructs full-replacement semantics for user preferences
  - [x] Prompt references the three separate tools for messages, progress, and preferences
  - [x] No references to `user_preference_and_infos` remain in the prompt (old parameter name)
  - [x] Thinking Report checklist updated to reference new tool names and split workflow
  - [x] `tool_schema()` returns all 8 tools (6 existing + 2 new)

### Task 2: Update `TaskSchema.to_string()` to include user preferences
- **Files:** `src/server/core/acontext_core/schema/session/task.py`
- **What:** Modify `to_string()` to include the current user_preference when present. Implementation:
  ```python
  def to_string(self) -> str:
      base = f"Task {self.order}: {self.data.task_description} (Status: {self.status})"
      if self.data.user_preferences and len(self.data.user_preferences) > 0:
          prefs = " | ".join(self.data.user_preferences)
          base += f' | User Prefs: "{prefs}"'
      return base
  ```
  - Guard against `IndexError` by checking truthiness AND length.
  - Join ALL elements with `" | "` to handle legacy multi-element lists without data loss.
  - Omit the suffix entirely when `None` or empty.
- **Why:** The agent needs to see current user preferences to know what to rewrite. Joining all elements ensures backward compatibility with old tasks.
- **Acceptance criteria:**
  - [ ] `to_string()` shows user preferences when they exist (non-empty list)
  - [ ] `to_string()` omits preference suffix when `None` or empty list `[]`
  - [ ] Joins all elements with `" | "` for backward compatibility
  - [ ] No `IndexError` on empty list

### Task 3: Update data layer — add `set_user_preference_for_task`, clean up `append_progress_to_task`
- **Files:** `src/server/core/acontext_core/service/data/task.py`
- **What:**
  1. **Add** `set_user_preference_for_task(db_session, task_id, user_preference: str) -> Result[None]` that replaces the entire `user_preferences` list with `[user_preference]`.
  2. **Remove** the `user_preference` parameter from `append_progress_to_task`. The function should only handle progress appending. Remove the `if user_preference is not None:` block entirely.
- **Why:** Clean separation: one function per concern. Eliminates the split-brain API risk.
- **Acceptance criteria:**
  - [ ] New `set_user_preference_for_task` replaces `user_preferences` with `[new_string]`
  - [ ] Handles `None`/missing `user_preferences` key gracefully
  - [ ] Calls `flag_modified(task, "data")` and `flush()`
  - [ ] `append_progress_to_task` signature no longer has `user_preference` parameter
  - [ ] `append_progress_to_task` only appends to `progresses`, not `user_preferences`

### Task 4: Create `append_task_progress` tool
- **Files:**
  - `src/server/core/acontext_core/llm/tool/task_lib/progress.py` (new file)
  - `src/server/core/acontext_core/llm/tool/task_tools.py` (register)
- **What:** Create a new tool `append_task_progress` with:
  - **Schema:**
    - `task_order` (int, required) — the task order number
    - `progress` (string, required) — concise, honest summary of what the agent did in this step
  - **Handler:**
    - Validate `task_order` is in range
    - Reject if task status is `success` or `failed` (must update to `running` first)
    - Call `TD.append_progress_to_task(db, task_id, progress)`
  - Register in `TASK_TOOLS` dict in `task_tools.py`
- **Why:** Isolated tool for appending progress, decoupled from message linking and preferences.
- **Acceptance criteria:**
  - [ ] Tool schema has `task_order` and `progress` params
  - [ ] Handler validates task_order range
  - [ ] Handler rejects for `success`/`failed` tasks
  - [ ] Handler calls `append_progress_to_task` (progress only)
  - [ ] Registered in `TASK_TOOLS`

### Task 5: Create `set_task_user_preference` tool
- **Files:**
  - `src/server/core/acontext_core/llm/tool/task_lib/set_preference.py` (new file)
  - `src/server/core/acontext_core/llm/tool/task_tools.py` (register)
- **What:** Create a new tool `set_task_user_preference` with:
  - **Schema:**
    - `task_order` (int, required) — the task order number
    - `user_preference` (string, required) — the complete, rewritten preference string that replaces all prior preferences
  - **Handler:**
    - Validate `task_order` is in range
    - Reject empty/whitespace-only `user_preference` strings with a helpful message
    - No status restriction — preferences can be set on any task
    - Call `TD.set_user_preference_for_task(db, task_id, user_preference)`
  - Register in `TASK_TOOLS` dict in `task_tools.py`
- **Why:** Isolated tool for preference management with replacement semantics.
- **Acceptance criteria:**
  - [ ] Tool schema has `task_order` and `user_preference` params
  - [ ] Handler validates task_order range
  - [ ] Handler rejects empty/whitespace-only `user_preference` strings
  - [ ] No status-based rejection (works on any status)
  - [ ] Handler calls `set_user_preference_for_task`
  - [ ] Registered in `TASK_TOOLS`

### Task 6: Simplify `append_messages_to_task` tool
- **Files:** `src/server/core/acontext_core/llm/tool/task_lib/append.py`
- **What:**
  - **Schema:** Remove `progress` and `user_preference_and_infos` parameters. Keep only `task_order` and `message_ids`.
  - **Handler:** Simplify to only:
    1. Validate `task_order` and `message_ids`
    2. Reject if task is `success` or `failed`
    3. Link messages to task via `TD.append_messages_to_task()`
    4. Auto-set task status to `running` if not already
  - Remove all progress/preference logic from the handler.
- **Why:** Single responsibility — this tool only links messages to tasks.
- **Acceptance criteria:**
  - [ ] Schema has only `task_order` and `message_ids` params
  - [ ] Handler does not call `append_progress_to_task` or `set_user_preference_for_task`
  - [ ] Handler auto-sets status to `running` only when not already `running` (preserve conditional check)
  - [ ] Handler still rejects for `success`/`failed` tasks

### Task 7: Update `insert_task` and `update_task` tool descriptions
- **Files:**
  - `src/server/core/acontext_core/llm/tool/task_lib/insert.py`
  - `src/server/core/acontext_core/llm/tool/task_lib/update.py`
- **What:**
  - `insert_task`: Update the `task_description` parameter description to emphasize using the user's query/request as the description.
  - `update_task`: Update the `task_description` parameter description similarly.
- **Why:** Both tools accept `task_description`. Both should be consistent with the prompt's instruction.
- **Acceptance criteria:**
  - [ ] `insert_task` param description says to use the user's query/request
  - [ ] `update_task` param description says to reflect the user's updated intent
  - [ ] No handler logic changes needed

### Task 8: Verify and update tests
- **Files:** `src/server/core/tests/llm/test_task_agent_atomicity.py`, `src/server/core/tests/service/test_task_data.py`
- **What:**
  - Verify existing atomicity tests still pass (they mock tool handlers, so tool splitting doesn't affect them)
  - Add unit tests for `set_user_preference_for_task` data function:
    - Replaces existing single-element preferences
    - Works when `user_preferences` is `None` (first time)
    - Works when `user_preferences` is empty list `[]`
    - Replaces multi-element legacy list `["a", "b", "c"]` → `["new"]`
  - Add unit tests for `to_string()`:
    - Single-element preferences shown
    - Multi-element legacy preferences joined with `" | "`
    - `None` preferences omitted
    - Empty list `[]` preferences omitted
  - Add unit tests for new `append_task_progress` handler:
    - Appends progress correctly
    - Rejects for `success`/`failed` tasks
  - Add unit tests for new `set_task_user_preference` handler:
    - Replaces preference correctly
    - Rejects empty/whitespace-only preference strings
    - Works on any task status
  - Add integration test: `append_task_progress` + `set_task_user_preference` on same task in same DB session (verify both JSONB sub-fields updated)
  - Add unit tests for simplified `append_messages_to_task` handler:
    - Only links messages (no progress/preference side effects)
    - Auto-sets status to `running`
  - Verify `append_progress_to_task` tests pass with removed `user_preference` parameter
- **Why:** Ensure behavioral changes don't break existing guarantees and all new tools are tested.
- **Acceptance criteria:**
  - [ ] All existing tests pass
  - [ ] New tests for `set_user_preference_for_task` data fn cover replace semantics + legacy data
  - [ ] New tests for `to_string()` cover all edge cases including legacy multi-element lists
  - [ ] New tests for each new tool handler (including empty-string rejection for `set_task_user_preference`)
  - [ ] New integration test for sequential tools on same task in same session
  - [ ] New test for simplified `append_messages_to_task` handler

## Draft: New System Prompt

> **Review this section.** This is the proposed replacement for `TaskPrompt.system_prompt()`.
> Lines marked with `# CHANGED` highlight differences from the current prompt.

```
You are an autonomous Task Management Agent that analyzes conversations to track and manage task statuses.

## Task Structure
- Tasks have: description, status, user preferences, and sequential order (`task_order=1, 2, ...`)  # CHANGED: added "user preferences"
- Messages link to tasks via their IDs
- Statuses: `pending` | `running` | `success` | `failed`
- Each task displays its current user preference (if any) in the listing  # CHANGED: new line

## Input Format
- `## Current Existing Tasks`: existing tasks with orders, descriptions, statuses, and user preferences  # CHANGED: added "and user preferences"
- `## Previous Progress`: context from prior task progress
- `## Current Message with IDs`: messages to analyze, formatted as `<message id=N>content</message>`

## Workflow

### 1. Detect Planning
- Planning = user/agent discussions about what to do next (not actual execution)
- Use `append_messages_to_planning_section` to capture full requirement discussions

### 2. Create/Modify Tasks
- Task descriptions must use the user's query or request verbatim, or closely paraphrased. Do NOT invent structured descriptions from agent planning discussions.  # CHANGED: entire bullet rewritten
  - Good: "Add dark mode toggle to the settings page"  # CHANGED: new example
  - Bad: "Implement UI theme switching functionality with user preference persistence"  # CHANGED: new example
- Use top-level tasks from planning (~3-10 tasks), avoid excessive subtasks
- Ensure tasks are MECE (mutually exclusive, collectively exhaustive) with existing tasks
- Collect ALL tasks mentioned in planning, regardless of execution status
- Use `update_task` when user requirements conflict with existing task descriptions

### 3. Link Messages to Tasks  # CHANGED: section simplified — progress and preferences removed
- Use `append_messages_to_task` to link message IDs to the relevant task
- This tool ONLY links messages and auto-sets the task status to `running` — it does NOT record progress or preferences
- Only link messages that directly contribute to a task (no random linking)

### 4. Record Progress  # CHANGED: entire section rewritten — was "Update Progress"
- Use `append_task_progress` to record what the agent actually did at each step
- Write concise, honest summaries of agent actions
- Be specific with actual values and file paths:
  - Good: "Created login component in src/Login.tsx"
  - Good: "Encountered Python syntax error in routers.py, investigating"
  - Good: "Navigated to https://github.com/trending"
  - Bad: "Started working on the login feature"
  - Bad: "Encountered errors"

### 5. Record User Preferences  # CHANGED: entirely new section
- Use `set_task_user_preference` when messages contain user preferences, requirements, or relevant personal info for a task
- The current preference (if any) is shown in the task listing as `User Prefs: "..."`
- This tool REPLACES the entire preference — provide the complete, updated preference string
- If the user's new preference conflicts with the existing one, write a merged/resolved version that reflects the user's latest intent
- Include relevant user info (email, tech stack choices, constraints, etc.)

### 6. Update Status  # CHANGED: was section 5
- `pending`: Task not started
- `running`: Work begins, or restarting after failure
- `success`: Confirmed complete by user, or agent moves to next task without errors
- `failed`: Explicit errors, user abandonment, or user reports failure

## Rules
- Cannot append messages or progress to `success` or `failed` tasks. For such tasks being retried: update to `running` first, then append  # CHANGED: clarified scope
- Optimize your level of parallelism, concurrently call multiple tools as much as possible.
- This is a non-interactive session. Execute the entire workflow autonomously based on the initial input. Do not stop for confirmations.

## Thinking Report
Before calling tools, use `report_thinking` to briefly address:
1. Planning detected? Task modifications needed?  # CHANGED: simplified
2. Any failed tasks needing re-run?
3. How do existing tasks relate to current messages?
4. New tasks to create? (use user's words for descriptions)  # CHANGED: added reminder
5. Which messages contribute to planning vs. specific tasks?
6. User preferences to set or update for which tasks?  # CHANGED: rewritten for new tool
7. What specific progress to record for which tasks?  # CHANGED: rewritten for new tool
8. Which task statuses to update?
9. Which tools can be called concurrently?

Before calling `finish`, verify all actions are covered.
```

### Changes from current prompt (summary)

| Area | Current | New |
|------|---------|-----|
| Task descriptions | "Extract tasks from agent's confirmed responses" | "Use user's query verbatim or closely paraphrased" |
| Progress recording | Via `progress` param in `append_messages_to_task`, narrated in first person | Via separate `append_task_progress` tool, concise third-person summaries |
| User preferences | Via `user_preference_and_infos` param in `append_messages_to_task`, append semantics | Via separate `set_task_user_preference` tool, full-replacement semantics |
| Message linking | `append_messages_to_task` does messages + progress + prefs | `append_messages_to_task` does messages only |
| Section count | 5 workflow sections | 6 workflow sections (split "Link + Record" into 3 sections) |
| Thinking checklist | References `user_preference_and_infos` | References new tool names, no old param names |

## Out of Scope

- **DB schema changes**: The `TaskData` JSONB structure is explicitly unchanged.
- **Go API changes**: The API only reads tasks; no changes needed.
- **SDK formatting updates**: The Python and TypeScript SDKs render `user_preferences` as a numbered list. After this change, single-element lists will render as `1. <full preference>`. Cosmetically awkward but functionally correct — deferred to follow-up.
- **Dashboard UI changes**: The dashboard iterates `user_preferences` similarly to SDKs. Same cosmetic issue — deferred.
- **Message buffering logic**: Buffer/MQ/Redis lock mechanics are unchanged.
- **Planning section behavior**: The planning section tool and logic remain as-is.
- **Agent loop logic**: The `task_agent_curd` iteration loop, transaction handling, and context rebuilding are unchanged. `NEED_UPDATE_CTX` must be updated to include the two new tools (`append_task_progress`, `set_task_user_preference`) since they modify task `data` JSONB that's loaded into `TaskCtx.task_index`.
- **Data migration**: No migration of existing multi-element `user_preferences` data. Old data is handled by joining all elements in `to_string()`. The agent will naturally replace old lists with single-element lists the next time it processes a task.
