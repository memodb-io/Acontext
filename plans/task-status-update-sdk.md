# Task Status Update SDK

> **Companion plan:** `plans/disable-task-status-change.md` — prevents the task agent from auto-changing status, so the user controls when to trigger learning via this SDK method.

## Features / Showcase

**Before:** Task status (`pending`, `running`, `success`, `failed`) can only be updated internally by CORE's task agent via LLM tool calls. External clients (SDKs) can only read tasks via `get_tasks()`. There is no way for an external system to manually mark a task as `success` or `failed`.

**After:** A new `PATCH /session/{session_id}/task/{task_id}/status` API endpoint allows SDK users to manually update a task's status. When the status is set to `success` or `failed`, it triggers the **same skill learning pipeline** (distillation → skill agent) that the internal task agent uses — it is not just a DB field update.

### Downstream Trigger

Setting status to `success` or `failed` via this endpoint publishes a `SkillLearnTask` to RabbitMQ, which triggers the full pipeline:

```
update_task_status("success" | "failed")
  → DB status update
  → Publish SkillLearnTask to MQ (exchange: learning.skill, key: learning.skill.distill)
    → CORE distillation consumer: fetches task + messages, runs LLM distillation
      → Publishes SkillLearnDistilled to MQ
        → CORE skill agent consumer: reads/updates/creates skills in learning space
```

This is the exact same path as when CORE's internal task agent calls `update_task(task_status="success")`.

### Use Cases

1. **Benchmarking**: External evaluation harnesses (e.g., SkillsBench) can mark tasks as success/failed based on verifier results, triggering Acontext's self-learning pipeline. Combined with `disable_task_status_change=True`, the user has full control over when learning is triggered.
2. **Human-in-the-loop**: Operators can manually mark agent tasks as succeeded/failed from their own systems
3. **CI/CD integration**: Automated pipelines can update task outcomes programmatically

### Typical Flow (with `disable_task_status_change`)

```python
# 1. Create session with auto status changes disabled
session = client.sessions.create(disable_task_status_change=True)

# 2. Store conversation — tasks get extracted with descriptions/progress
client.sessions.store_message(session_id=session.id, blob=msg, format="openai")
client.sessions.flush(session.id)

# 3. Get auto-extracted tasks (status remains "running", not auto-resolved)
tasks = client.sessions.get_tasks(session.id)
task = tasks.items[0]

# 4. User decides outcome (e.g., based on external verifier)
client.sessions.update_task_status(
    session_id=session.id,
    task_id=task.id,
    status="success",  # triggers full skill learning pipeline
)
```

### API

```
PATCH /api/v1/session/{session_id}/task/{task_id}/status
```

**Request body:**
```json
{
  "status": "success"  // "success" | "failed" | "running" | "pending"
}
```

**Response:**
```json
{
  "data": {
    "id": "task-uuid",
    "session_id": "session-uuid",
    "project_id": "project-uuid",
    "order": 1,
    "data": { "task_description": "...", "progresses": [...] },
    "status": "success",
    "is_planning": false,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

**Error responses:**
- `400` — Invalid status value (not one of `success`, `failed`, `running`, `pending`)
- `404` — Task not found, or task doesn't belong to the given session

**SDK usage:**
```python
# Python (sync)
client.sessions.update_task_status(
    session_id="session-uuid",
    task_id="task-uuid",
    status="success",
)

# Python (async)
await client.sessions.update_task_status(
    session_id="session-uuid",
    task_id="task-uuid",
    status="success",
)
```

```typescript
// TypeScript
await client.sessions.updateTaskStatus(
    "session-uuid",
    "task-uuid",
    { status: "success" },
);
```

## Design Overview

The change adds a single PATCH endpoint that:
1. Validates the task belongs to the session and the session belongs to the project
2. Updates the task status in the DB
3. If the new status is `success` or `failed`:
   - Resolves the session's `learning_space_id` (via `LearningSpaceSession`)
   - Publishes a `SkillLearnTask` message to the learning queue — the same message schema and routing used by CORE's internal task agent (`update_task_handler` in `task_lib/update.py`)
   - This triggers the full distillation → skill agent pipeline in CORE

The skill learning trigger is done API-side (Go) by publishing to RabbitMQ, matching the same exchange/routing key (`learning.skill` / `learning.skill.distill`) that CORE's task agent uses.

### Key Design Decisions
- **PATCH (not PUT)**: Only status is updatable — task description, order, and other fields remain controlled by the internal task agent
- **Trigger learning from API**: The API server publishes directly to RabbitMQ rather than going through CORE, since the learning pipeline is already decoupled via message queue
- **Same learning path**: Uses the exact same `SkillLearnTask` message schema (`project_id`, `session_id`, `task_id`) and routing key, so the existing distillation → skill agent pipeline handles it identically
- **Learning space resolution**: The API must resolve the learning space for the session before publishing; if no learning space exists, the status is updated but no learning is triggered (same behavior as CORE)

## TODOs

### API (Go)

- [x] **Add `UpdateTaskStatus` to repo** — `src/server/api/go/internal/modules/repo/task.go`
  - Add `UpdateStatus(ctx, sessionID, taskID, status string) (*model.Task, error)` method to `TaskRepo` interface
  - Implementation: validate status is one of the 4 allowed values, update and return the task
  - Validate the task belongs to the given session

- [x] **Add `UpdateTaskStatus` to service** — `src/server/api/go/internal/modules/service/task.go`
  - Add `UpdateTaskStatus(ctx, in UpdateTaskStatusInput) (*model.Task, error)` to `TaskService` interface
  - Input struct: `SessionID uuid.UUID`, `TaskID uuid.UUID`, `Status string`
  - Call repo to update status
  - If status is `success` or `failed`:
    1. Resolve `learning_space_id` via `LearningSpaceSession` lookup for the session
    2. If learning space exists → publish `SkillLearnTask` to RabbitMQ
    3. If no learning space → skip publishing (status still updated — same behavior as CORE)

- [x] **Add `UpdateTaskStatus` handler** — `src/server/api/go/internal/modules/handler/task.go`
  - Add `UpdateTaskStatusReq` struct with `Status string` field (binding: `required,oneof=success failed running pending`)
  - Add `UpdateTaskStatus(c *gin.Context)` handler that parses session_id and task_id from path, binds request, calls service
  - Add Swagger annotations

- [x] **Register route** — `src/server/api/go/internal/router/router.go`
  - Add `task.PATCH("/:task_id/status", d.TaskHandler.UpdateTaskStatus)` inside the task group

- [x] **Add MQ config entries** — `src/server/api/go/internal/config/config.go`
  - Add `LearningSkill string` to `MQExchangeName` struct (default: `"learning.skill"`)
  - Add `LearningSkillDistill string` to `MQRoutingKey` struct (default: `"learning.skill.distill"`)

- [x] **Add MQ publishing logic** — `src/server/api/go/internal/modules/service/task.go`
  - Use the existing `publisher.PublishJSON()` pattern (see `StoreMessage` in `service/session.go` for reference)
  - Publish to exchange `cfg.RabbitMQ.ExchangeName.LearningSkill`, routing key `cfg.RabbitMQ.RoutingKey.LearningSkillDistill`
  - Message body: `{"project_id": "...", "session_id": "...", "task_id": "..."}`
  - Only publish if a learning space exists for the session (resolved in service method above)
  - Log errors but don't fail the request (same pattern as session message publishing)

### Python SDK

- [x] **Add `update_task_status` (sync)** — `src/client/acontext-py/src/acontext/resources/sessions.py`
  - Add method: `update_task_status(session_id: str, task_id: str, *, status: str) -> Task`
  - Sends `PATCH /session/{session_id}/task/{task_id}/status` with JSON body `{"status": status}`

- [x] **Add `update_task_status` (async)** — `src/client/acontext-py/src/acontext/resources/async_sessions.py`
  - Mirror the sync method with `async/await`

### TypeScript SDK

- [x] **Add `updateTaskStatus`** — `src/client/acontext-ts/src/resources/sessions.ts`
  - Add method: `async updateTaskStatus(sessionId: string, taskId: string, options: { status: string }): Promise<Task>`
  - Sends `PATCH /session/{sessionId}/task/${taskId}/status` with JSON body

### Documentation

- [x] **Update `docs/observe/agent_tasks.mdx`**
  - Add "Manual Status Update" section with Python and TypeScript code examples
  - Explain that updating to `success`/`failed` triggers the self-learning pipeline

## New Deps

None. Uses existing RabbitMQ connection and message patterns already in the API.

## Test Cases

- [x] PATCH with valid status values (`success`, `failed`, `running`, `pending`) returns 200 and updated task
- [x] PATCH with invalid status value returns 400
- [x] PATCH with non-existent task_id returns 404
- [x] PATCH with task_id that doesn't belong to session_id returns 404
- [x] Setting status to `success` triggers skill learning (verify MQ message published)
- [x] Setting status to `failed` triggers skill learning (verify MQ message published)
- [x] Setting status to `running` or `pending` does NOT trigger skill learning
- [x] Setting status to `success` when session has no learning space — status updates, no MQ message published
- [ ] Setting status to `success` twice (idempotent) — second call succeeds, publishes MQ again *(integration test — requires running DB)*
- [x] Python SDK sync `update_task_status` works correctly
- [x] Python SDK async `update_task_status` works correctly
- [x] TypeScript SDK `updateTaskStatus` works correctly
