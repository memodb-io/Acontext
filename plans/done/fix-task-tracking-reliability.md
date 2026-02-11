# Plan: Fix Task Tracking Reliability (3 Issues)

## Features / Show case

- **Atomic tool execution per LLM iteration**: All tool calls within a single LLM response execute in one DB transaction. If any tool fails, the entire iteration rolls back — no more partial task state (e.g., task created but messages not linked).
- **Bounded flush retries**: `flush_session_message_blocking` now has a configurable max retry count (via `CoreConfig`), preventing infinite spin when the Redis lock is stuck.
- **Deduplicated buffer timers**: When messages arrive while the buffer is below `max_turns`, only one `asyncio` timer task is created per session (deduped via Redis), eliminating redundant MQ publishes and wasted consumer invocations in multi-worker deployments.

---

## Design Overview

### Fix 1: Transaction atomicity across tool calls in one iteration

**Current behavior**: Each tool call in `task_agent_curd` opens its own `DB_CLIENT.get_session_context()`. Each tool auto-commits independently. If tool #3 fails, tools #1-2 are already committed.

**New behavior**: One `DB_CLIENT.get_session_context()` wraps the entire tool-call `for` loop within one iteration (one LLM response). All tools share one DB session/transaction. Commit happens once when all tools succeed; any hard error triggers rollback of the entire iteration via the existing `get_session_context` exception handler.

**Why this works**:
- `get_session_context` already commits on clean exit and rolls back on exception (see `infra/db.py` lines 162-171)
- `expire_on_commit=False` is set on the sessionmaker, so ORM objects remain usable after `flush()`
- Within a single PostgreSQL transaction (READ COMMITTED), `flush()`'d writes are visible to subsequent queries in the same session — so `build_task_ctx` with `USE_CTX = None` correctly sees uncommitted inserts/updates
- The Redis lock already guarantees no other worker modifies the same session's tasks concurrently, so holding row locks (`SELECT FOR UPDATE` in `insert_task`) within a longer transaction is safe

**Error handling (option a)**: On hard error (`Result.reject()` or exception from a tool), raise an exception to exit the `async with` block → session rolls back → agent aborts. This preserves existing abort semantics while adding rollback safety.

### Fix 2: Bound `flush_session_message_blocking` with max retries

**Current behavior**: `while True` loop with no exit condition other than acquiring the lock.

**New behavior**: Loop up to `session_message_flush_max_retries` times (new `CoreConfig` field). When exhausted, return `Result.reject()`. The caller (`routers/session.py`) already handles error results and returns the appropriate status to the client.

**Config**: Add `session_message_flush_max_retries: int = 60` to `CoreConfig`. At 1s intervals (`session_message_session_lock_wait_seconds = 1`), this gives 60s total wait — matching the lock TTL (`session_message_processing_timeout_seconds = 60`).

### Fix 3: Avoid redundant asyncio tasks from buffer scheduling

**Current behavior**: Every message arriving when `pending < max_turns` creates a new `asyncio.create_task(waiting_for_message_notify(ttl, body))`. With 15 messages (max_turns=16), 15 sleeping tasks are created. All 15 eventually publish to `buffer.process`, but only 1 passes the dedup check in `buffer_new_message`. The other 14 are wasted MQ publishes + consumer invocations.

**Problem with naive Redis NX dedup**: If we simply gate task creation with a Redis NX key and nothing else, only message A (the first) gets a timer. But `buffer_new_message` checks `body.message_id == latest_pending_message_id` (line 149). By the time A's timer fires, A is no longer the latest pending message (N is). So the timer gets rejected, and no timer was ever created for N. **Messages sit pending forever.**

**Correct fix — `skip_latest_check` flag**:

Add a boolean flag `skip_latest_check: bool = False` to `InsertNewMessage`. Only the timer sets it to `True`. All other paths (API events, retries, resends) always use the default `False`. Two changes work together:

1. **Redis NX to gate timer creation** — `SET buffer_timer.{project_id}.{session_id} "1" NX EX={ttl}`. Only the first message per TTL window creates an asyncio timer task. This eliminates redundant asyncio tasks and MQ publishes.

2. **Timer publishes with `skip_latest_check=True`** — `waiting_for_message_notify` publishes an `InsertNewMessage` with `skip_latest_check=True`. The dedup check in both `buffer_new_message` and `insert_new_message` is updated to: `if not body.skip_latest_check and body.message_id != latest_pending_message_id: return`. When the flag is `True`, the latest-message check is bypassed; when `False` (all normal messages), the dedup applies as before.

3. **Retries always reset the flag** — When `buffer_new_message` fails to acquire the lock and republishes to the retry queue, it publishes the body as-is but the flag is not explicitly propagated — the retry uses the original body which has `skip_latest_check=True`. However, the retry DLXes back to `insert_new_message`, where the flag bypasses the dedup check. This is fine because:
   - If the lock was held → someone was processing → new messages' own events handle future work
   - If the lock was released → `insert_new_message` proceeds to buffer/process as normal
   - The Redis session lock still prevents concurrent processing regardless

**Safety preserved**: Normal MQ messages from the API always have `skip_latest_check=False` (default) → the dedup check still applies as before. Only timer-originated messages set the flag to `True`. `message_id` stays as a required `asUUID` — no nullable changes, no risk of `None` propagating through unrelated code.

**Schema change**: Add `skip_latest_check: bool = False` to `InsertNewMessage`. Non-breaking — existing messages without the field default to `False`.

**Why Redis (not in-memory dict)**: Multiple Core workers consume from the same queues. An in-memory dict on worker 1 wouldn't know about worker 2's timer. Redis provides cross-worker coordination.

**Trade-off acknowledged**: The timer does NOT reset on each new message — the first message's TTL wins. This is acceptable because:
1. The TTL is short (default 8s)
2. If more messages arrive and reach `max_turns`, the buffer path is skipped entirely and processing happens immediately via `insert_new_message`
3. If the timer fires and pending messages exist, they all get processed regardless of which message originally scheduled the timer

---

## TODOs

### Fix 1: Transaction atomicity across tool calls

- [x] **Restructure tool-call loop in `task_agent_curd`** — `src/server/core/acontext_core/llm/agent/task.py`
  - Move `async with DB_CLIENT.get_session_context() as db_session` to wrap the entire `for tool_call in use_tools` loop (lines 168-203)
  - Remove the per-tool `async with DB_CLIENT.get_session_context() as db_session` (line 177)
  - Pass the shared `db_session` to `build_task_ctx` for all tools in the iteration
  - On `Result.reject()` from a tool, raise an exception to trigger rollback + abort
  - On `KeyError` / `Exception`, same behavior as current (abort) but now the session rolls back
  - The `USE_CTX = None` pattern continues to work: rebuild queries the same session and sees `flush()`'d writes

### Fix 2: Bound flush retries

- [x] **Add `session_message_flush_max_retries` to `CoreConfig`** — `src/server/core/acontext_core/schema/config.py`
  - Add field: `session_message_flush_max_retries: int = 60`
  - Place it next to the existing `session_message_session_lock_wait_seconds` and `session_message_processing_timeout_seconds` fields

- [x] **Add max retry loop in `flush_session_message_blocking`** — `src/server/core/acontext_core/service/session_message.py`
  - Replace `while True` with `for attempt in range(max_retries)`
  - Use `for/else` pattern: if loop exhausts without acquiring lock, return `Result.reject()`
  - Read `max_retries` from `DEFAULT_CORE_CONFIG.session_message_flush_max_retries`

### Fix 3: Redis NX timer dedup + `skip_latest_check` flag

- [x] **Add `skip_latest_check` flag to `InsertNewMessage`** — `src/server/core/acontext_core/schema/mq/session.py`
  - Add field: `skip_latest_check: bool = False`
  - `message_id` stays as required `asUUID` — no nullable change

- [x] **Add `check_buffer_timer_or_set` helper** — `src/server/core/acontext_core/service/utils.py`
  - New async function: `check_buffer_timer_or_set(project_id, session_id, ttl_seconds) -> bool`
  - Key format: `buffer_timer.{project_id}.{session_id}`
  - Use `SET key "1" NX EX={ttl_seconds}` (same pattern as `check_redis_lock_or_set` but with caller-provided TTL)
  - Returns `True` if key was newly set (timer should be created), `False` if key already existed (timer already scheduled)

- [x] **Gate timer creation with Redis NX in `insert_new_message`** — `src/server/core/acontext_core/service/session_message.py`
  - Before `asyncio.create_task(waiting_for_message_notify(...))`, call `check_buffer_timer_or_set(project_id, session_id, ttl)`
  - If returns `False` (key exists), skip creating the asyncio task and return early
  - If returns `True` (new key), proceed with creating the asyncio task as before

- [x] **Timer publishes with `skip_latest_check=True`** — `src/server/core/acontext_core/service/session_message.py`
  - In `waiting_for_message_notify`, create a new body with the flag set:
    ```python
    timer_body = InsertNewMessage(
        project_id=body.project_id, session_id=body.session_id,
        message_id=body.message_id, skip_latest_check=True,
    )
    await publish_mq(..., body=timer_body.model_dump_json())
    ```

- [x] **Update dedup check in both consumers to respect the flag** — `src/server/core/acontext_core/service/session_message.py`
  - `insert_new_message` (line 51): change to `if not body.skip_latest_check and body.message_id != latest_pending_message_id:`
  - `buffer_new_message` (line 149): change to `if not body.skip_latest_check and body.message_id != latest_pending_message_id:`
  - Normal messages (`skip_latest_check=False`, default) → dedup applies as before
  - Timer messages (`skip_latest_check=True`) → bypass dedup, proceed to pending check + lock step

---

## New Deps

None. All changes use existing infrastructure (SQLAlchemy sessions, Redis, asyncio).

---

## Test Cases

- [x] **Fix 1 — Atomicity on success**: Mock LLM returning multiple tool calls (insert_task + append_messages). Verify both are committed together (task exists AND messages linked).
- [x] **Fix 1 — Atomicity on failure**: Mock LLM returning multiple tool calls where tool #2 fails with `Result.reject()`. Verify tool #1's writes are rolled back (no orphaned task in DB).
- [x] **Fix 1 — Context rebuild within transaction**: Mock LLM returning insert_task + append_messages_to_task (which triggers `USE_CTX = None`). Verify the rebuild query within the same session sees the newly inserted task.
- [x] **Fix 2 — Flush succeeds within retries**: Mock Redis lock to fail N times then succeed. Verify `flush_session_message_blocking` eventually processes.
- [x] **Fix 2 — Flush exhausts retries**: Mock Redis lock to always fail. Verify `Result.reject()` is returned after `max_retries` attempts.
- [x] **Fix 3 — First message creates timer**: Send a message when buffer < max_turns. Verify Redis key is set and asyncio task is created.
- [x] **Fix 3 — Subsequent messages skip timer**: Send a second message for the same session while Redis key exists. Verify no new asyncio task is created.
- [x] **Fix 3 — Different sessions get their own timers**: Send messages for two different sessions. Verify both get their own Redis key and asyncio task.
- [x] **Fix 3 — Timer fires with `skip_latest_check=True`**: Timer fires after multiple messages arrived. Verify `buffer_new_message` receives `skip_latest_check=True`, bypasses dedup check, and processes all pending messages.
- [x] **Fix 3 — Normal message still deduped**: A real message arrives at `insert_new_message` with `skip_latest_check=False` (default) but is not the latest pending. Verify it is still skipped by the dedup check.
- [x] **Fix 3 — Timer retry path**: Timer fires, `buffer_new_message` can't get lock, retries via DLX to `insert_new_message`. Verify `insert_new_message` bypasses dedup (flag=True) and proceeds normally.
- [x] **Fix 3 — Timer fires with no pending messages**: All messages already processed by the time timer fires. Verify `buffer_new_message` returns early on the `not len(message_ids)` check.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/server/core/acontext_core/llm/agent/task.py` | Fix 1: restructure tool-call loop to use single DB session per iteration |
| `src/server/core/acontext_core/schema/config.py` | Fix 2: add `session_message_flush_max_retries` to `CoreConfig` |
| `src/server/core/acontext_core/schema/mq/session.py` | Fix 3: add `skip_latest_check: bool = False` to `InsertNewMessage` |
| `src/server/core/acontext_core/service/session_message.py` | Fix 2: bound flush loop; Fix 3: Redis NX timer dedup + `skip_latest_check` flag in dedup checks + timer body + reset flag on retries |
| `src/server/core/acontext_core/service/utils.py` | Fix 3: add `check_buffer_timer_or_set` helper |
| `src/server/core/tests/llm/test_task_agent_atomicity.py` | Fix 1 tests: atomicity on success, failure, and context rebuild |
| `src/server/core/tests/service/test_flush_retries.py` | Fix 2 tests: flush succeeds within retries, flush exhausts retries |
| `src/server/core/tests/service/test_buffer_timer_dedup.py` | Fix 3 tests: timer creation, dedup, skip_latest_check, retry path |
