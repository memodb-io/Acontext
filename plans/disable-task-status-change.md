# Disable Task Status Change

## Features / Showcase

**Before:** When Acontext's task agent processes messages, it autonomously decides when tasks are `success` or `failed` and updates their status. There is no way to prevent this — the task agent controls the full task lifecycle.

**After:** A new session-level flag `disable_task_status_change` prevents the task agent from changing task status to `success` or `failed`. Tasks are still created, descriptions tracked, messages linked, and progress recorded — but status remains at `running` until the user manually updates it via the `update_task_status` SDK method (see `plans/task-status-update-sdk.md`).

### Use Case

```python
# Create session with auto status changes disabled
session = client.sessions.create(disable_task_status_change=True)

# Store agent conversation — tasks get extracted normally
client.sessions.store_message(session_id=session.id, blob=msg, format="openai")
client.sessions.flush(session.id)

# Tasks exist with descriptions and progress, but status stays "running"
tasks = client.sessions.get_tasks(session.id)
assert tasks.items[0].status == "running"  # NOT auto-set to success/failed

# User decides the outcome (e.g., based on external verifier)
client.sessions.update_task_status(
    session_id=session.id,
    task_id=tasks.items[0].id,
    status="success",  # triggers skill learning pipeline
)
```

### How It Differs from `disable_task_tracking`

| | `disable_task_tracking` | `disable_task_status_change` |
|---|---|---|
| **What's blocked** | Entire task extraction pipeline | Only status transitions to `success`/`failed` |
| **Tasks created?** | No | Yes |
| **Progress tracked?** | No | Yes |
| **Messages linked?** | No | Yes |
| **Where checked** | API layer (blocks MQ publish) | CORE layer (task agent's `update_task` tool) |
| **Learning triggered?** | Never | Only via manual `update_task_status` |

## Design Overview

Unlike `disable_task_tracking` (which blocks at the API layer by not publishing to MQ), this flag must be checked **inside CORE's task agent** because the task agent needs to run — it just can't finalize status.

### Implementation Approach

1. Add `disable_task_status_change` boolean to Session model (API + CORE)
2. Pass the flag through the message processing pipeline down to `TaskCtx`
3. In `update_task_handler`: if the flag is set and the requested status is `success` or `failed`, silently skip the status change (still allow description updates, progress recording, etc.)
4. Expose via SDK session creation

### Data Flow

```
Session.disable_task_status_change = true
        │
        ▼
API publishes message to MQ (normal — task tracking is NOT disabled)
        │
        ▼
CORE message consumer → process_session_pending_message()
        │
        ▼
task_agent_curd(disable_task_status_change=True)
        │
        ▼
LLM calls update_task tool with task_status="success"
        │
        ▼
update_task_handler checks ctx.disable_task_status_change
        │
        ├── True  → update description/data only, skip status change,
        │           do NOT add to learning_task_ids
        │
        └── False → normal behavior (update status + trigger learning)
```

## TODOs

### API (Go)

- [x] **Add field to Session model** — `src/server/api/go/internal/modules/model/session.go`
  - Add `DisableTaskStatusChange bool` with `gorm:"not null;default:false"` and `json:"disable_task_status_change"`

- [x] **DB migration** — GORM AutoMigrate handles column addition automatically when the model field is added (same as `disable_task_tracking`). Verify by checking `cfg.Database.AutoMigrate` is enabled in dev. No manual migration file needed.

- [x] **Update session creation handler** — `src/server/api/go/internal/modules/handler/session.go`
  - Add `DisableTaskStatusChange *bool` to `CreateSessionReq`
  - Set `session.DisableTaskStatusChange` in handler if provided

> **Design decision:** CORE reads `disable_task_status_change` directly from the Session table at processing time — no MQ schema change needed, no modification to `StoreMQPublishJSON` required.

### CORE (Python)

- [x] **Add field to Session ORM** — `src/server/core/acontext_core/schema/orm/session.py`
  - Add `disable_task_status_change: bool = field(default=False, ...)`

- [x] **Read flag in message controller** — `src/server/core/acontext_core/service/controller/message.py`
  - In `process_session_pending_message()`, add a DB query to fetch the session's `disable_task_status_change` field (e.g., `SELECT disable_task_status_change FROM sessions WHERE id = :session_id` using an existing session data accessor or a new lightweight one)
  - Pass the flag value to `task_agent_curd()` as a new `disable_task_status_change` parameter
  - Place the query alongside the existing `LS.get_learning_space_for_session()` call (lines 72-76) since both read session-level config

- [x] **Add parameter to `task_agent_curd`** — `src/server/core/acontext_core/llm/agent/task.py`
  - Add `disable_task_status_change: bool = False` parameter
  - Pass it into `TaskCtx` when constructing context for tool handlers

- [x] **Add field to `TaskCtx`** — `src/server/core/acontext_core/llm/tool/task_lib/ctx.py`
  - Add `disable_task_status_change: bool = False`

- [x] **Guard status change in `update_task_handler`** — `src/server/core/acontext_core/llm/tool/task_lib/update.py`
  - If `ctx.disable_task_status_change` is `True` and `task_status in ("success", "failed")`:
    - Strip `task_status` from the update (set to `None`)
    - Do NOT add task to `ctx.learning_task_ids`
    - Still allow `task_description` updates
    - Return a message like `"Task {order} updated (status change skipped — manual control enabled)"`

### Python SDK

- [x] **Add to session creation (sync)** — `src/client/acontext-py/src/acontext/resources/sessions.py`
  - Add `disable_task_status_change: bool | None = None` parameter to `create()`
  - Include in payload if provided

- [x] **Add to session creation (async)** — `src/client/acontext-py/src/acontext/resources/async_sessions.py`
  - Mirror sync changes

- [x] **Update Session type** — `src/client/acontext-py/src/acontext/types/session.py`
  - Add `disable_task_status_change: bool` field to `Session` model

### TypeScript SDK

- [x] **Add to session creation** — `src/client/acontext-ts/src/resources/sessions.ts`
  - Add `disableTaskStatusChange?: boolean | null` to create options
  - Include `disable_task_status_change` in payload if provided

- [x] **Update Session type** — `src/client/acontext-ts/src/types/session.ts`
  - Add `disable_task_status_change: z.boolean()` to `SessionSchema`

### Documentation

- [x] **Create `docs/observe/disable_task_status_change.mdx`**
  - Explain the feature, show Python and TypeScript examples
  - Link to `update_task_status` and self-learning docs

- [x] **Update `docs/observe/agent_tasks.mdx`**
  - Add reference to manual status control option

## New Deps

None. Uses existing session model pattern and CORE tool handler infrastructure.

## Test Cases

- [x] Session created with `disable_task_status_change=True` has the flag set in DB
- [x] Session created without the flag defaults to `False`
- [ ] With flag enabled: task agent creates tasks normally (descriptions, progress, messages linked) *(integration test — requires running CORE)*
- [x] With flag enabled: task agent's `update_task(task_status="success")` skips the status change — task remains at current status
- [x] With flag enabled: task agent's `update_task(task_status="failed")` skips the status change
- [x] With flag enabled: task agent's `update_task(task_description="...")` still works (description updates allowed)
- [x] With flag enabled: `learning_task_ids` is NOT populated (no auto-triggered learning)
- [x] With flag disabled (default): task agent status changes work normally
- [x] With flag enabled: manual `update_task_status` SDK call still works and triggers learning
- [x] Python SDK sync `create(disable_task_status_change=True)` works
- [x] Python SDK async `create(disable_task_status_change=True)` works
- [x] TypeScript SDK `create({ disableTaskStatusChange: true })` works
