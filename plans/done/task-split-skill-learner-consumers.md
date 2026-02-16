# Split Skill Learner into Two MQ Consumers

## Problem

The current `process_skill_learn_task` consumer runs the **entire** skill learning pipeline in a single handler:

1. Fetch raw messages from DB (heavy — full conversation logs)
2. Context distillation (single LLM call)
3. Fetch learning space + skills
4. Run skill learner agent (up to 5 LLM iterations with tool calls)

This means:
- **Memory**: Raw messages stay in memory for the entire agent loop even though they're only needed during distillation.
- **Lock duration**: Redis lock is held for distillation + agent = potentially 3-5 minutes.
- **Blocking**: The consumer worker is blocked for the full duration, reducing throughput.
- **Handler timeout**: The default `mq_consumer_handler_timeout` (96s) is shorter than the full pipeline (~210s), risking mid-execution cancellation. This pre-existing bug is fixed by this task.

## Features / Showcase

- Skill learner consumer split into two independent, MQ-connected consumers:
  - **Consumer 1 (Distillation)**: fast, single LLM call, frees raw messages from memory immediately.
  - **Consumer 2 (Skill Learning Agent)**: receives compact distilled text, runs agent loop with a custom handler timeout.
- Redis lock is only held during the agent phase (Consumer 2), not during distillation.
- If distillation fails, the agent consumer is never invoked (natural fault isolation).
- Each consumer can be scaled independently.
- Fixes pre-existing handler timeout bug: Consumer 2 gets a custom timeout matching its workload.

## Design Overview

### Current Flow (single consumer)
```
SkillLearnTask (MQ)
  └─> Consumer [holds lock for entire duration, default 96s handler timeout too short]
        ├── Step 1: Fetch task + raw messages (DB)
        ├── Step 2: Context distillation (1 LLM call)
        ├── Step 3: Fetch learning space + skills (DB)
        └── Step 4: Run agent (up to 5 LLM iterations)
```

### New Flow (two consumers)
```
SkillLearnTask (MQ)
  └─> Consumer 1: Distillation [no lock needed, default timeout OK]
        ├── Fetch task + raw messages (DB)
        ├── Run context distillation (1 LLM call)
        ├── Publish SkillLearnDistilled to MQ
        └── Done — raw messages freed from memory

SkillLearnDistilled (MQ)
  └─> Consumer 2: Skill Agent [holds lock only here, custom timeout]
        ├── Acquire Redis lock
        ├── Fetch learning space + skills (DB)
        ├── Run skill learner agent (up to 5 LLM iterations)
        └── Release lock
```

### New MQ Topology

| Component | Exchange | Routing Key | Queue |
|---|---|---|---|
| Distillation (entry) | `learning.skill` | `learning.skill.distill` | `learning.skill.distill.entry` |
| Skill Agent (entry) | `learning.skill` | `learning.skill.agent` | `learning.skill.agent.entry` |
| Skill Agent (retry) | `learning.skill` | `learning.skill.agent.retry` | `learning.skill.agent.retry.entry` |

- The **old** `learning.skill.process` / `learning.skill.process.retry` queues are replaced.
- **Post-deploy cleanup**: Delete old queues `learning.skill.process.entry` and `learning.skill.process.retry.entry` from RabbitMQ after deploy. Any in-flight messages in the old queues will be lost — this is acceptable since skill learning is best-effort and will trigger again on the next task completion.
- Distillation consumer does NOT need a retry queue — if it fails, the message is just dropped (same as today when distillation fails, the agent never runs). No lock needed either — distillation is a read-only, idempotent operation.
- Skill Agent consumer keeps the retry queue pattern for Redis lock contention.

### New MQ Message Schema

```python
class SkillLearnDistilled(BaseModel):
    """Published by distillation consumer, consumed by skill agent consumer."""
    project_id: asUUID
    session_id: asUUID
    task_id: asUUID
    learning_space_id: asUUID
    distilled_context: str  # formatted text from extract_distillation_result()
```

- `learning_space_id` is pre-resolved in Consumer 1 (avoids re-querying in Consumer 2).
- `distilled_context` is the compact text output, typically < 1 KB (vs raw messages which can be 10-100 KB+).
- `session_id` and `task_id` are included for observability logging in Consumer 2 (not used by business logic).

### Lock Strategy Change

| Aspect | Before | After |
|---|---|---|
| Lock scope | Entire pipeline (distill + agent) | Agent phase only (Consumer 2) |
| Lock TTL | 300s (5 min) | `skill_learn_lock_ttl_seconds` config, updated default: 240s — agent only; 5 iters × ~40s/LLM call = 200s typical, 240s gives 20% headroom |
| Lock acquired by | `process_skill_learn_task` | `process_skill_agent` (Consumer 2) |
| Distillation locking | Locked (unnecessarily) | No lock — distillation is idempotent |
| Handler timeout | Default 96s (too short — pre-existing bug) | Consumer 2: `skill_learn_lock_ttl_seconds + 60` (~300s); Consumer 1: default 96s (sufficient for single LLM call) |

### Why Distillation Doesn't Need a Lock

- Distillation is a **read-only** operation: it reads DB data and produces text output.
- Even if two distillations run concurrently for the same learning space, they produce independent outputs.
- The lock only matters for Consumer 2, where skills are actually written/modified.
- Worst case: two distillations produce two `SkillLearnDistilled` messages, and Consumer 2's lock serializes the agent runs — correct behavior.

## TODOs

### 1. Add new routing keys to constants
- [x] Add `learning_skill_distill`, `learning_skill_agent`, `learning_skill_agent_retry` to `RK` class
- [x] Remove old `learning_skill_process` and `learning_skill_process_retry` from `RK` class

> **Sequencing note**: Old constants are referenced in `task.py` (TODO #6) and `skill_learner.py` (TODO #5). Remove old constants only after both are updated — in practice all changes land in the same PR, but keep this ordering when coding to avoid linter errors mid-flight.

**Files:**
- `src/server/core/acontext_core/service/constants.py`

### 2. Update config default for lock TTL
- [x] Change `skill_learn_lock_ttl_seconds` default from `300` to `240`
- [x] Update comment from `# 5 min — covers distillation + agent iterations` to `# 4 min — agent phase only (5 iters × ~40s + 20% headroom)`

**Files:**
- `src/server/core/acontext_core/schema/config.py`

### 3. Add `SkillLearnDistilled` MQ schema
- [x] Add `SkillLearnDistilled` model with `project_id`, `session_id`, `task_id`, `learning_space_id`, `distilled_context`

**Files:**
- `src/server/core/acontext_core/schema/mq/learning.py`

### 4. Split controller into two functions

> **BUG RISK — MEDIUM**: The split point is between Step 2 (distillation) and Step 3 (fetch LS + skills). Make sure:
> 1. `process_context_distillation()` closes its DB session before returning — raw messages must not leak into the caller's scope.
> 2. `run_skill_agent()` must re-fetch `LearningSpace` to get `user_id` (it's NOT in the MQ message) — don't skip this by assuming stale data from Consumer 1.
> 3. `process_context_distillation()` return type should carry enough info to build `SkillLearnDistilled` — return a `Result[SkillLearnDistilled]` directly, not intermediate pieces.

- [x] Extract `process_context_distillation(project_id, session_id, task_id, learning_space_id) -> Result[SkillLearnDistilled]` from current controller — covers Steps 1-2 (fetch data + distillation). Returns a fully-formed `SkillLearnDistilled` payload on success.
- [x] Extract `run_skill_agent(project_id, learning_space_id, distilled_context) -> Result[None]` from current controller — covers Steps 3-4 (fetch LS for `user_id` + fetch skills + run agent). Accepts distilled context string as input.

> **Naming**: The controller function is named `run_skill_agent`, NOT `process_skill_agent`, to avoid name collision with the consumer function `process_skill_agent` in `service/skill_learner.py`. This follows the existing convention where consumer and controller names differ (e.g. consumer `process_skill_learn_task` vs controller `process_skill_learning`).

**Files:**
- `src/server/core/acontext_core/service/controller/skill_learner.py`

### 5. Rewrite consumer with two handlers

> **BUG RISK — HIGH**: This is the most complex TODO. Four things to get right:
> 1. Consumer 1 must resolve `learning_space_id` *before* building `SkillLearnDistilled` — if session has no LS, skip early (no publish).
> 2. Consumer 2's lock key must use `learning_space_id` from the message (not re-resolve from session), matching the existing `f"skill_learn.{learning_space_id}"` format.
> 3. Consumer 2's retry republish must serialize the *same* `SkillLearnDistilled` body (not the original `SkillLearnTask`), because the retry DLX routes back to the agent queue which expects `SkillLearnDistilled`.
> 4. Consumer 2 **must** set a custom `timeout` in its `ConsumerConfigData` — the default 96s handler timeout (`mq_consumer_handler_timeout`) will kill the agent mid-execution. This was a pre-existing bug in the old monolithic consumer; fix it here.

- [x] Replace `process_skill_learn_task` with `process_skill_distillation` consumer:
  ```python
  @register_consumer(config=ConsumerConfigData(
      exchange_name=EX.learning_skill,
      routing_key=RK.learning_skill_distill,
      queue_name="learning.skill.distill.entry",
  ))
  async def process_skill_distillation(body: SkillLearnTask, message: Message):
  ```
  - Resolves `learning_space_id` from session (moved from old consumer)
  - If session has no learning space → skip (no publish, no error)
  - Calls `process_context_distillation()` controller
  - On success: publishes `SkillLearnDistilled` to `learning.skill.agent`
  - **No Redis lock needed** — distillation is read-only and idempotent
- [x] Add `process_skill_agent` consumer:
  ```python
  @register_consumer(config=ConsumerConfigData(
      exchange_name=EX.learning_skill,
      routing_key=RK.learning_skill_agent,
      queue_name="learning.skill.agent.entry",
      timeout=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds + 60,
  ))
  async def process_skill_agent(body: SkillLearnDistilled, message: Message):
  ```
  - Logs `body.session_id` and `body.task_id` for observability
  - Acquires Redis lock: `check_redis_lock_or_set(body.project_id, f"skill_learn.{body.learning_space_id}", ttl_seconds=DEFAULT_CORE_CONFIG.skill_learn_lock_ttl_seconds)`
  - Calls `SLC.run_skill_agent()` controller (note: `run_skill_agent`, not `process_skill_agent`) with `body.project_id`, `body.learning_space_id`, `body.distilled_context`
  - Releases lock in `finally`
  - On lock failure: republishes `body.model_dump_json()` to `RK.learning_skill_agent_retry`
- [x] Add retry queue for agent consumer (same DLX pattern as before):
  ```python
  register_consumer(config=ConsumerConfigData(
      exchange_name=EX.learning_skill,
      routing_key=RK.learning_skill_agent_retry,
      queue_name="learning.skill.agent.retry.entry",
      message_ttl_seconds=DEFAULT_CORE_CONFIG.session_message_session_lock_wait_seconds,
      need_dlx_queue=True,
      use_dlx_ex_rk=(EX.learning_skill, RK.learning_skill_agent),
  ))(SpecialHandler.NO_PROCESS)
  ```
- [x] Remove old `process_skill_learn_task` and its retry queue

> **Resolved**: Added dedicated `skill_learn_agent_retry_delay_seconds = 16` config. With 240s lock TTL, worst-case is ~15 retries instead of ~240.

**Files:**
- `src/server/core/acontext_core/service/skill_learner.py`

### 6. Update MQ publisher in task agent

> **BUG RISK — LOW but easy to miss**: Only the routing key changes (`RK.learning_skill_process` → `RK.learning_skill_distill`). The message schema (`SkillLearnTask`) is unchanged. Don't accidentally change the exchange or schema.

- [x] Change `RK.learning_skill_process` → `RK.learning_skill_distill` in the drain-publish section of the task agent loop (line ~241 in `task.py`). The `SkillLearnTask` schema is unchanged — only the routing key changes.
- Note: `update.py` is NOT touched — it only appends to `ctx.learning_task_ids`, which is drained in `task.py`.

**Files:**
- `src/server/core/acontext_core/llm/agent/task.py` (the actual `publish_mq` call)

### 7. Update tests
- [x] Create or update `test_skill_learner_consumer.py` — split consumer tests into distillation-consumer tests and agent-consumer tests; update controller tests to test the two new functions (`process_context_distillation`, `run_skill_agent`) instead of the old monolithic `process_skill_learning`
- [x] Add test for distillation consumer publishing `SkillLearnDistilled` on success
- [x] Add test for distillation consumer NOT publishing when distillation fails
- [x] Add test for distillation consumer skipping when session has no learning space
- [x] Add test for agent consumer receiving `SkillLearnDistilled` and running the agent
- [x] Add test for agent consumer lock contention retry (republishes same `SkillLearnDistilled` body)
- [x] Add test for agent consumer lock release in `finally` (even on agent error)
- [x] Add `SkillLearnDistilled` serialization round-trip test
- [x] Add test for distillation consumer including correct `learning_space_id` in published `SkillLearnDistilled`
- [x] Update `test_skill_learner_trigger.py` — line 330 asserts `RK.learning_skill_process`; change to `RK.learning_skill_distill`

**Files:**
- `src/server/core/tests/service/test_skill_learner_consumer.py`
- `src/server/core/tests/llm/test_skill_learner_trigger.py`

## New Deps

None — all existing infrastructure (RabbitMQ, Redis, Pydantic) is reused.

## Test Cases

- [x] Distillation consumer processes `SkillLearnTask` and publishes `SkillLearnDistilled`
- [x] Distillation consumer skips sessions with no learning space
- [x] Distillation consumer handles distillation LLM failure gracefully (no publish)
- [x] Distillation consumer publishes `SkillLearnDistilled` with correct `learning_space_id` (from session resolution, not hardcoded)
- [x] `SkillLearnDistilled` schema serializes/deserializes correctly (especially `distilled_context` as string)
- [x] Agent consumer processes `SkillLearnDistilled` and runs the agent successfully
- [x] Agent consumer acquires Redis lock before running the agent
- [x] Agent consumer republishes to retry queue on lock contention (same `SkillLearnDistilled` body, not `SkillLearnTask`)
- [x] Agent consumer releases Redis lock in finally block (even on error)
- [x] Agent consumer handler timeout is sufficient for full agent loop (~300s, not default 96s)
- [x] Agent consumer logs `session_id` and `task_id` from message for traceability
- [x] End-to-end: task completion triggers distillation, distillation triggers agent, agent updates skills
