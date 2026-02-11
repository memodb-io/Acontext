# Task Tracking Mechanism – Architecture Overview

## Features / Show case

- **Automatic task extraction from conversations**: When users chat with an agent through sessions, the system automatically extracts structured tasks from the conversation using an LLM-based agent.
- **Buffered message processing**: Messages are buffered before processing — triggered either when a message count threshold is reached or after an idle timeout, reducing redundant LLM calls.
- **LLM-driven task CRUD**: A task agent powered by LLM decides how to create, update, and organize tasks using a tool-calling loop.
- **Shared PostgreSQL between API and Core**: The Go API writes messages and reads tasks; the Python Core writes tasks and reads messages. Both use the same DB schema.
- **Planning section support**: Messages that don't map to concrete tasks (e.g. brainstorming, context-setting) are routed to a special "planning" task.
- **Per-session opt-out**: Sessions can disable task tracking via `disable_task_tracking` flag.

---

## Design Overview

### System Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────────┐
│   Client     │──POST──▶│  Go API      │──MQ────▶│  Python Core     │
│              │         │  (Gin)       │         │  (FastAPI)       │
│              │◀──GET───│              │◀──DB────│                  │
└─────────────┘         └──────────────┘         └──────────────────┘
                              │                         │
                              ▼                         ▼
                        ┌──────────┐             ┌──────────┐
                        │PostgreSQL│◀───shared───▶│PostgreSQL│
                        └──────────┘             └──────────┘
                              │                         │
                              ▼                         ▼
                        ┌──────────┐             ┌──────────┐
                        │ RabbitMQ │             │  Redis   │
                        └──────────┘             └──────────┘
```

### Division of Responsibility

| Component       | Responsibilities                                                    |
| --------------- | ------------------------------------------------------------------- |
| **Go API**      | Store messages, publish MQ events, read/list tasks                  |
| **Python Core** | Consume MQ events, buffer messages, run LLM task agent, write tasks |

---

## Data Structures

### Task ORM

**Go API** (`src/server/api/go/internal/modules/model/task.go`):

| Field        | Type               | Notes                                                |
| ------------ | ------------------ | ---------------------------------------------------- |
| `ID`         | UUID               | PK                                                   |
| `SessionID`  | UUID               | FK → sessions                                        |
| `ProjectID`  | UUID               | FK → projects                                        |
| `Order`      | int                | Task order within session                            |
| `Data`       | JSONB (`TaskData`) | `task_description`, `progresses`, `user_preferences` |
| `Status`     | string             | `pending`, `running`, `success`, `failed`            |
| `IsPlanning` | bool               | True = planning section, excluded from list API      |
| `CreatedAt`  | timestamp          |                                                      |
| `UpdatedAt`  | timestamp          |                                                      |

**Python Core** (`src/server/core/acontext_core/schema/orm/task.py`):

Mirrors the Go API model via SQLAlchemy. Same fields. Constraint: unique `(session_id, order)`.

### TaskData (JSONB payload)

| Field              | Type         | Description                                  |
| ------------------ | ------------ | -------------------------------------------- |
| `task_description` | string       | What the task is about                       |
| `progresses`       | list[string] | Progress updates appended by the agent       |
| `user_preferences` | list[string] | User preferences/info extracted by the agent |

### Pydantic DTOs (Core)

**File:** `src/server/core/acontext_core/schema/session/task.py`

- **TaskStatus** (StrEnum): `pending`, `running`, `success`, `failed`
- **TaskData**: `task_description`, `progresses`, `user_preferences`
- **TaskSchema**: Full task representation with `id`, `session_id`, `order`, `status`, `data`, `raw_message_ids`; has `to_string()` for LLM context

### Message (task-related fields)

**Go API** (`src/server/api/go/internal/modules/model/message.go`):

| Field                      | Type   | Description                               |
| -------------------------- | ------ | ----------------------------------------- |
| `TaskID`                   | *UUID  | FK → tasks (SET NULL on delete)           |
| `SessionTaskProcessStatus` | string | `pending`, `running`, `success`, `failed` |

**Python Core** (`src/server/core/acontext_core/schema/orm/message.py`):

Same fields mirrored in SQLAlchemy.

### Session (task-related field)

| Field                 | Type | Description                            |
| --------------------- | ---- | -------------------------------------- |
| `DisableTaskTracking` | bool | When true, MQ events are not published |

### MQ Payload

**File:** `src/server/core/acontext_core/schema/mq/session.py` — `InsertNewMessage`

| Field        | Type |
| ------------ | ---- |
| `project_id` | UUID |
| `session_id` | UUID |
| `message_id` | UUID |

### Project Config (buffer settings)

**File:** `src/server/core/acontext_core/schema/config.py` — `ProjectConfig`

| Config                                        | Default | Purpose                                               |
| --------------------------------------------- | ------- | ----------------------------------------------------- |
| `project_session_message_buffer_max_turns`    | 16      | Pending message count to trigger immediate processing |
| `project_session_message_buffer_max_overflow` | 16      | Extra messages before overflow/truncation             |
| `project_session_message_buffer_ttl_seconds`  | 8       | Idle time before buffer flush                         |

---

## API Endpoints

| Method  | Path                               | Handler                | Description                                    |
| ------- | ---------------------------------- | ---------------------- | ---------------------------------------------- |
| **GET** | `/api/v1/session/:session_id/task` | `TaskHandler.GetTasks` | List non-planning tasks with cursor pagination |

**Query Parameters** (`GetTasksReq`):
- `limit` (1–200)
- `cursor` (base64-encoded `(created_at, id)` tuple)
- `time_desc` (bool, sort order)

**Note:** The Go API only **reads** tasks. All task creation/mutation is performed by the Python Core.

---

## Essential Functions / Modules

### Go API

| File                      | Function/Module                    | Purpose                                                   |
| ------------------------- | ---------------------------------- | --------------------------------------------------------- |
| `handler/task.go`         | `TaskHandler.GetTasks`             | HTTP handler for listing tasks                            |
| `service/task.go`         | `TaskService.GetTasks`             | Business logic with cursor pagination                     |
| `repo/task.go`            | `TaskRepo.ListBySessionWithCursor` | DB query; excludes `is_planning=true`                     |
| `service/session.go`      | `SessionService.StoreMessage`      | Stores message + publishes MQ event                       |
| `service/session.go`      | MQ publish block (lines ~361-375)  | Publishes `InsertNewMessage` to RabbitMQ                  |
| `infra/queue/rabbitmq.go` | `Publisher.PublishJSON`            | Generic JSON publisher                                    |
| `config/config.go`        | RabbitMQ config                    | Exchange: `session.message`, RK: `session.message.insert` |
| `pkg/paging/cursor.go`    | `EncodeCursor` / `DecodeCursor`    | Base64 cursor encoding                                    |

### Python Core — Message Consumers

| File                         | Function                     | Purpose                                                              |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `service/session_message.py` | `insert_new_message`         | Main consumer for `session.message.insert` — buffers or processes    |
| `service/session_message.py` | `buffer_new_message`         | Consumer for `session.message.buffer.process` — idle timeout trigger |
| `service/session_message.py` | `waiting_for_message_notify` | Schedules delayed republish to buffer.process queue                  |

### Python Core — Controller

| File                            | Function                          | Purpose                                                                                          |
| ------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `service/controller/message.py` | `process_session_pending_message` | Orchestrator: marks messages running → fetches context → calls task agent → marks success/failed |

### Python Core — LLM Task Agent

| File                 | Function                     | Purpose                                                                |
| -------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| `llm/agent/task.py`  | `task_agent_curd`            | Main agent loop: loads tasks, builds prompt, calls LLM, executes tools |
| `llm/prompt/task.py` | `TaskPrompt.system_prompt`   | System prompt describing task extraction rules                         |
| `llm/prompt/task.py` | `TaskPrompt.pack_task_input` | Builds user message with current tasks + messages                      |
| `llm/prompt/task.py` | `TaskPrompt.tool_schema`     | Returns tool definitions for the LLM                                   |

### Python Core — Task Tools (LLM function-calling tools)

| File                                   | Tool Name                             | Purpose                                   |
| -------------------------------------- | ------------------------------------- | ----------------------------------------- |
| `llm/tool/task_lib/insert.py`          | `insert_task`                         | Create a new task after a given order     |
| `llm/tool/task_lib/update.py`          | `update_task`                         | Update task status/description by order   |
| `llm/tool/task_lib/append.py`          | `append_messages_to_task`             | Link messages to a task + add progress    |
| `llm/tool/task_lib/append_planning.py` | `append_messages_to_planning_section` | Route messages to planning task           |
| `llm/tool/task_lib/finish.py`          | `finish`                              | Terminate the agent loop                  |
| `llm/tool/util_lib/think.py`           | `report_thinking`                     | Log reasoning (no DB change)              |
| `llm/tool/task_lib/ctx.py`             | `TaskCtx`                             | Context dataclass passed to tool handlers |
| `llm/tool/task_tools.py`               | Tool registry                         | Registers all task tools                  |

### Python Core — Task Data Layer (CRUD)

| File                   | Function                                   | Purpose                                                        |
| ---------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `service/data/task.py` | `fetch_planning_task`                      | Get planning task for session                                  |
| `service/data/task.py` | `fetch_task`                               | Get task by ID with messages                                   |
| `service/data/task.py` | `fetch_current_tasks`                      | List non-planning tasks for session                            |
| `service/data/task.py` | `insert_task`                              | Insert task; shifts higher orders with `SELECT ... FOR UPDATE` |
| `service/data/task.py` | `update_task`                              | Update status, order, data (full or patch)                     |
| `service/data/task.py` | `delete_task`                              | Delete task by ID                                              |
| `service/data/task.py` | `append_messages_to_task`                  | Set `task_id` on message records                               |
| `service/data/task.py` | `append_progress_to_task`                  | Append to `progresses` and `user_preferences` in JSONB         |
| `service/data/task.py` | `append_messages_to_planning_section`      | Create planning task if needed; link messages                  |
| `service/data/task.py` | `fetch_previous_tasks_without_message_ids` | Get prior tasks for LLM context                                |

### Python Core — Infrastructure

| File                | Function                  | Purpose                                     |
| ------------------- | ------------------------- | ------------------------------------------- |
| `service/utils.py`  | `check_redis_lock_or_set` | Acquire Redis lock: `SET key NX EX=timeout` |
| `service/utils.py`  | `release_redis_lock`      | Release Redis lock: `DEL key`               |
| `infra/async_mq.py` | MQ consumer registration  | Binds queues to exchanges and routing keys  |
| `infra/redis.py`    | Redis client              | Connection to Redis                         |

---

## Data Flow

### End-to-End: Message → Task Extraction

```
1. Client → API: POST /api/v1/session/{id}/messages
   │
   ├─ SessionService.StoreMessage() persists message in PostgreSQL
   │
   └─ If disable_task_tracking == false && publisher != nil:
      └─ Publish to RabbitMQ
         Exchange: "session.message"
         Routing Key: "session.message.insert"
         Body: { project_id, session_id, message_id }

2. Core Consumer: insert_new_message receives message
   │
   ├─ Load ProjectConfig (buffer settings)
   ├─ Count pending messages for session
   │
   ├─ IF pending_count < max_turns:
   │     Schedule waiting_for_message_notify(ttl_seconds)
   │       → after TTL, publish to "session.message.buffer.process"
   │     RETURN (wait for more messages)
   │
   ├─ IF pending_count >= max_turns:
   │     Try Redis lock: lock.{project_id}.session.message.insert.{session_id}
   │     ├─ Lock FAILED → republish to "session.message.insert.retry" → RETURN
   │     └─ Lock OK → continue
   │
   └─ Call MC.process_session_pending_message(project_id, session_id, config)

3. Buffer Path (idle timeout):
   │
   └─ buffer_new_message receives from "session.message.buffer.process"
      ├─ Verify message is still latest pending
      ├─ Try Redis lock
      │   ├─ Lock FAILED → republish to retry
      │   └─ Lock OK → continue
      └─ Call MC.process_session_pending_message(...)

4. Controller: process_session_pending_message
   │
   ├─ Fetch pending message IDs (limit = max_overflow + max_turns)
   ├─ If metric disabled → mark FAILED → RETURN
   ├─ Mark messages as RUNNING
   ├─ Fetch full messages (including S3 parts)
   ├─ Fetch prior messages for context
   ├─ Convert to MessageBlob list
   │
   └─ Call AT.task_agent_curd(project_id, session_id, messages, ...)

5. LLM Task Agent: task_agent_curd
   │
   ├─ Load current tasks from DB → TaskSchema[]
   ├─ Build prompt:
   │   ├─ System: TaskPrompt.system_prompt()
   │   └─ User: pack_task_input(current_tasks, previous_progress, messages_with_ids)
   │
   ├─ Call llm_complete(system, user, tools)
   │
   └─ LOOP (max_iterations):
       ├─ If response has tool_calls:
       │   ├─ Build TaskCtx (db_session, task_ids_index, message_ids_index)
       │   ├─ Execute each tool:
       │   │   ├─ insert_task → TD.insert_task (shifts orders, inserts row)
       │   │   ├─ update_task → TD.update_task (status/description)
       │   │   ├─ append_messages_to_task → TD.append_messages + append_progress + set status=running
       │   │   ├─ append_messages_to_planning_section → TD.append_messages_to_planning_section
       │   │   ├─ report_thinking → log only
       │   │   └─ finish → EXIT LOOP
       │   ├─ Rebuild context if tool in NEED_UPDATE_CTX
       │   └─ Append tool results → call LLM again
       │
       └─ If no tool_calls → EXIT LOOP

6. Post-processing:
   │
   ├─ Mark messages as SUCCESS (or FAILED on exception)
   └─ Release Redis lock

7. Client → API: GET /api/v1/session/{id}/task
   │
   └─ TaskHandler.GetTasks
      └─ TaskRepo.ListBySessionWithCursor (excludes is_planning=true)
         └─ Returns tasks from PostgreSQL (written by Core)
```

### RabbitMQ Topology

| Exchange          | Type   | Routing Key                      | Queue                            | Consumer                 |
| ----------------- | ------ | -------------------------------- | -------------------------------- | ------------------------ |
| `session.message` | DIRECT | `session.message.insert`         | `session.message.insert.entry`   | `insert_new_message`     |
| `session.message` | DIRECT | `session.message.insert.retry`   | `session.message.insert.retry`   | NO_PROCESS (DLX backoff) |
| `session.message` | DIRECT | `session.message.buffer.process` | `session.message.buffer.process` | `buffer_new_message`     |

### Redis Lock Pattern

- **Key format**: `lock.{project_id}.session.message.insert.{session_id}`
- **Acquire**: `SET key "1" NX EX=timeout` → returns True/False
- **Release**: `DEL key` (in `finally` block)
- **On lock failure**: republish message to retry queue (DLX provides backoff)
- **Purpose**: Ensures only one Core worker processes a session's messages at a time

---

## Key Design Decisions

1. **Write separation**: API never writes tasks; Core never exposes task HTTP endpoints. They share the same DB.
2. **Buffering over eager processing**: Messages are batched to reduce LLM calls. The buffer flushes on count threshold OR idle timeout — whichever comes first.
3. **LLM as the decision-maker**: The task agent uses function-calling to decide what tasks to create/update. It has full context of existing tasks and new messages.
4. **Order-based task identity**: Tasks are identified by `order` within a session (not by ID) in the LLM tools, making it natural for the LLM to reference them.
5. **Planning section**: A special `is_planning=true` task captures non-actionable messages, keeping the task list clean.
6. **Retry with DLX**: Failed lock acquisitions use dead-letter exchange for automatic retry with backoff.
7. **Context rebuilding**: After tools that mutate task state (`insert_task`, `update_task`, `append_messages_to_task`), the agent rebuilds its context from DB before the next LLM call.

---

## File Index

### Go API (`src/server/api/go/internal/`)

| File                         | Role                                    |
| ---------------------------- | --------------------------------------- |
| `modules/model/task.go`      | Task + TaskData GORM models             |
| `modules/handler/task.go`    | HTTP handler (GetTasks)                 |
| `modules/service/task.go`    | Task service (pagination logic)         |
| `modules/repo/task.go`       | Task repository (DB queries)            |
| `modules/model/message.go`   | Message model (task_id, process_status) |
| `modules/model/session.go`   | Session model (disable_task_tracking)   |
| `modules/service/session.go` | Session service (MQ publish on store)   |
| `router/router.go`           | Route wiring                            |
| `infra/queue/rabbitmq.go`    | MQ publisher                            |
| `config/config.go`           | RabbitMQ exchange/routing key config    |
| `pkg/paging/cursor.go`       | Cursor encoding/decoding                |

### Python Core (`src/server/core/acontext_core/`)

| File                                   | Role                                     |
| -------------------------------------- | ---------------------------------------- |
| `schema/orm/task.py`                   | Task SQLAlchemy ORM                      |
| `schema/orm/message.py`                | Message ORM (task_id, process_status)    |
| `schema/session/task.py`               | Task Pydantic DTOs                       |
| `schema/mq/session.py`                 | MQ payload DTO                           |
| `schema/config.py`                     | ProjectConfig (buffer settings)          |
| `service/session_message.py`           | MQ consumers (insert, buffer, retry)     |
| `service/controller/message.py`        | Message processing controller            |
| `service/data/task.py`                 | Task CRUD operations                     |
| `service/data/message.py`              | Message data operations                  |
| `service/utils.py`                     | Redis lock helpers                       |
| `llm/agent/task.py`                    | LLM task agent loop                      |
| `llm/prompt/task.py`                   | Task prompt templates                    |
| `llm/tool/task_tools.py`               | Tool registry                            |
| `llm/tool/task_lib/insert.py`          | insert_task tool                         |
| `llm/tool/task_lib/update.py`          | update_task tool                         |
| `llm/tool/task_lib/append.py`          | append_messages_to_task tool             |
| `llm/tool/task_lib/append_planning.py` | append_messages_to_planning_section tool |
| `llm/tool/task_lib/finish.py`          | finish tool                              |
| `llm/tool/task_lib/ctx.py`             | TaskCtx dataclass                        |
| `llm/tool/util_lib/think.py`           | report_thinking tool                     |
| `infra/async_mq.py`                    | MQ consumer/publisher infra              |
| `infra/redis.py`                       | Redis client                             |
