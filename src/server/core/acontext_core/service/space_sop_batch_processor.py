"""
SOP batching processor for Space construct agent.

Why this module exists
----------------------
The SOP completion MQ consumer (`space_receive_sop.py`) is invoked once per SOP block
completion, but the Space construct agent performs better when it receives multiple
SOP blocks at once (it can load workspace context once and insert multiple blocks).

This module implements "debounce + batch drain" behavior:
1) Every SOPComplete message is buffered per-space in Redis.
2) A per-space Redis lock ensures only one worker drains/processes the buffer at a time.
3) The lock holder waits briefly to allow more messages to arrive, then drains up to
   a configured max batch size and calls the construct agent once for the batch.

Important operational notes
---------------------------
This module intentionally uses conservative, explicit error handling:
- Most failures are treated as retryable by publishing to the retry routing key.
- Drained items are restored to Redis buffer on retryable failures so they are not lost.

This module does NOT attempt to solve all distributed-systems correctness problems
around locks and retries; it focuses on readability and traceable behavior.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

from ..env import LOG
from ..schema.mq.sop import SOPComplete


@dataclass(frozen=True)
class SOPBatchSettings:
    """
    Settings required for batching.

    These are extracted from DEFAULT_CORE_CONFIG by the caller so that:
    - tests can inject deterministic values
    - this module stays decoupled from the config system
    """

    lock_wait_seconds: int
    batch_wait_seconds: int
    batch_max_size: int


@dataclass(frozen=True)
class SOPBatchDependencies:
    """
    Dependency bundle for SOP batching.

    This isolates IO-heavy components and makes the processor easy to test by injecting
    fakes or monkeypatching the caller module.
    """

    # MQ publishing
    mq_client: object
    exchange_name: str
    retry_routing_key: str

    # Redis lock management
    lock_acquire: object
    lock_release: object
    lock_key_prefix: str

    # Redis buffer module (space_sop_buffer.py)
    buffer: object

    # DB + data access modules
    db_client: object
    project_data: object
    task_data: object
    session_data: object

    # Controller entrypoint (space_sop.py)
    controller: object


class SOPBatchProcessor:
    """
    Orchestrates per-space SOP completion batching.

    The public API is `process(body)`. The caller is responsible for:
    - invoking this method from the MQ consumer handler
    - providing dependencies and settings (usually from module globals)
    """

    def __init__(self, settings: SOPBatchSettings, deps: SOPBatchDependencies):
        self._settings = settings
        self._deps = deps

    async def process(self, body: SOPComplete) -> None:
        """
        Entry point for handling one SOPComplete message.

        The call flow is:
        - buffer this message
        - acquire per-space lock (or publish retry if locked)
        - if lock owner: wait a short time, drain batch, validate, process, restore/publish retry on failure
        """
        if body.task_id is None:
            LOG.error("Task ID is required for SOP complete")
            return

        await self._buffer_incoming(body)

        lock_key = self._space_lock_key(body.space_id)
        acquired = await self._try_acquire_lock_or_retry(body, lock_key)
        if not acquired:
            return

        try:
            await self._process_as_lock_owner(body)
        finally:
            await self._safe_release_lock(body, lock_key)

    async def _buffer_incoming(self, body: SOPComplete) -> None:
        """
        Best-effort buffering of the incoming message.

        Buffering is used both for batching (drain multiple messages) and for restoring
        work on retryable failures.
        """
        try:
            ok = await self._deps.buffer.push_sop_buffer(body)
        except Exception as e:
            LOG.error(
                f"Failed to buffer SOPComplete due to unexpected error "
                f"(space={body.space_id}, task={body.task_id}): {e}"
            )
            return

        if not ok:
            LOG.warning(
                f"Failed to buffer SOPComplete for space {body.space_id} (task {body.task_id})"
            )

    def _space_lock_key(self, space_id) -> str:
        """Return the per-space lock key used for SOP completion processing."""
        return f"{self._deps.lock_key_prefix}.{space_id}"

    async def _try_acquire_lock_or_retry(self, body: SOPComplete, lock_key: str) -> bool:
        """
        Try to acquire the per-space lock.

        If the lock is already held, publish a retry message and return False.
        If Redis errors occur, also publish a retry message (best effort).
        """
        try:
            acquired = await self._deps.lock_acquire(body.project_id, lock_key)
        except Exception as e:
            LOG.error(
                f"Failed to acquire SOP space lock due to Redis error "
                f"(space={body.space_id}, task={body.task_id}): {e}"
            )
            await self._publish_retry_best_effort(body)
            return False

        if acquired:
            LOG.info(f"Lock Space {body.space_id} for SOP complete task")
            return True

        # Lock not acquired: ask MQ to redeliver later. This is the primary throttle
        # when many messages arrive for the same space concurrently.
        LOG.debug(
            f"Current Space {body.space_id} is locked. "
            f"wait {self._settings.lock_wait_seconds} seconds for next resend. "
        )
        await self._publish_retry_best_effort(body)
        return False

    async def _process_as_lock_owner(self, body: SOPComplete) -> None:
        """
        Lock-owner path: debounce, drain, validate, and process in one batch.

        This method is intentionally structured into small steps so reviewers can
        reason about:
        - what was drained from Redis
        - why individual items were skipped
        - what was restored and why
        """
        popped_entries: list[str] = []
        current_entry_json = body.model_dump_json()

        batch_log_prefix = f"SOP_BATCH space={body.space_id} project={body.project_id}"

        # Remove the current message from the buffer, if present.
        # Rationale: the current message is handled via `body` already, so we want
        # subsequent draining to mostly pull "other" messages that arrived nearby.
        await self._safe_remove_from_buffer(body.project_id, body.space_id, current_entry_json)

        await self._debounce_for_batching()

        popped_entries = await self._drain_additional_entries(
            project_id=body.project_id, space_id=body.space_id
        )

        parsed_items, skip_reasons = self._parse_and_filter_entries(
            body, current_entry_json, popped_entries
        )

        LOG.info(
            f"{batch_log_prefix} drained popped={len(popped_entries) + 1} "
            f"parsed={len(parsed_items)} skip={sum(skip_reasons.values())} "
            f"skip_reasons={skip_reasons}"
        )

        unique_items, skip_reasons = self._dedupe_by_task_id(parsed_items, skip_reasons)

        # Filter items down to those we can safely process now (project exists, tasks exist,
        # tasks belong to this space, etc.). This avoids sending obviously-invalid items
        # into the construct agent.
        try:
            project_config, processable_items, current_is_processable, skip_reasons = (
                await self._validate_items_against_db(body, unique_items, skip_reasons)
            )
        except Exception as e:
            # DB failures are treated as retryable; restore drained entries and schedule a retry.
            await self._restore_and_retry_on_failure(
                body=body,
                batch_log_prefix=batch_log_prefix,
                entries_to_restore=[entry_json for entry_json, _ in unique_items],
                retry_body=body,
                reason="db_exception",
                error=e,
                skip_reasons=skip_reasons,
            )
            return

        if not processable_items:
            # Nothing to do: ensure the current entry isn't stuck in the buffer and exit.
            await self._safe_remove_from_buffer(body.project_id, body.space_id, current_entry_json)
            LOG.info(
                f"{batch_log_prefix} empty_after_filtering popped={len(popped_entries) + 1} "
                f"processable=0 skip={sum(skip_reasons.values())} skip_reasons={skip_reasons}"
            )
            return

        await self._call_construct_agent_or_retry(
            body=body,
            batch_log_prefix=batch_log_prefix,
            project_config=project_config,
            processable_items=processable_items,
            current_entry_json=current_entry_json,
            current_is_processable=current_is_processable,
            popped_entries=popped_entries,
            skip_reasons=skip_reasons,
        )

    async def _debounce_for_batching(self) -> None:
        """Wait briefly to allow additional SOPComplete messages to arrive."""
        wait_seconds = self._settings.batch_wait_seconds
        if wait_seconds > 0:
            await asyncio.sleep(wait_seconds)

    async def _drain_additional_entries(self, project_id, space_id) -> list[str]:
        """
        Drain up to (max_batch_size - 1) additional items from the buffer.

        The "- 1" is because the current message is already represented by `body`.
        """
        max_batch_size = self._settings.batch_max_size
        if max_batch_size <= 0:
            LOG.warning("Invalid space_task_sop_batch_max_size, using default batch size: 1")
            max_batch_size = 1

        pop_size = max(max_batch_size - 1, 0)
        if pop_size <= 0:
            return []

        return await self._deps.buffer.pop_sop_buffer_batch(project_id, space_id, pop_size)

    def _parse_and_filter_entries(
        self,
        current_body: SOPComplete,
        current_entry_json: str,
        popped_entries: list[str],
    ) -> tuple[list[tuple[str, SOPComplete]], dict[str, int]]:
        """
        Parse drained Redis entries into SOPComplete objects and apply cheap invariants.

        Filters out:
        - invalid JSON/pydantic payloads
        - entries for another project/space (defensive; buffer is per-space but allows diagnosis)
        - entries missing task_id
        """
        skip_reasons: dict[str, int] = {}

        def _skip(reason: str) -> None:
            skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

        parsed_items: list[tuple[str, SOPComplete]] = [(current_entry_json, current_body)]
        for entry_json in popped_entries:
            item = self._deps.buffer.parse_sop_buffer_entry(entry_json)
            if item is None:
                _skip("invalid_payload")
                continue
            if item.project_id != current_body.project_id or item.space_id != current_body.space_id:
                _skip("project_or_space_mismatch")
                continue
            if item.task_id is None:
                _skip("missing_task_id")
                continue
            parsed_items.append((entry_json, item))

        return parsed_items, skip_reasons

    def _dedupe_by_task_id(
        self,
        parsed_items: list[tuple[str, SOPComplete]],
        skip_reasons: dict[str, int],
    ) -> tuple[list[tuple[str, SOPComplete]], dict[str, int]]:
        """
        Dedupe items within the drained set by task_id.

        Note: this uses "first wins" ordering based on `parsed_items`. This matches
        the previous implementation and is simple to reason about.
        """
        def _skip(reason: str) -> None:
            skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

        seen_task_ids: set = set()
        unique_items: list[tuple[str, SOPComplete]] = []
        for entry_json, item in parsed_items:
            if item.task_id in seen_task_ids:
                _skip("duplicate_task_id")
                continue
            seen_task_ids.add(item.task_id)
            unique_items.append((entry_json, item))

        return unique_items, skip_reasons

    async def _validate_items_against_db(
        self,
        body: SOPComplete,
        unique_items: list[tuple[str, SOPComplete]],
        skip_reasons: dict[str, int],
    ):
        """
        Validate buffered items against DB state and return those safe to process.

        This is where we enforce stronger invariants:
        - project config exists
        - task exists and is not already `space_digested`
        - session exists and belongs to this space
        """
        def _skip(reason: str) -> None:
            skip_reasons[reason] = skip_reasons.get(reason, 0) + 1

        project_config = None
        processable_items: list[tuple[str, SOPComplete]] = []
        current_is_processable = False

        async with self._deps.db_client.get_session_context() as db_session:
            r = await self._deps.project_data.get_project_config(db_session, body.project_id)
            project_config, eil = r.unpack()
            if eil:
                for _entry_json, _item in unique_items:
                    _skip("project_not_found")
                return project_config, [], False, skip_reasons

            for entry_json, item in unique_items:
                r = await self._deps.task_data.fetch_task(db_session, item.task_id)
                if not r.ok():
                    _skip("task_not_found")
                    continue
                task_data, _ = r.unpack()
                if task_data.space_digested:
                    _skip("task_already_space_digested")
                    continue

                r = await self._deps.session_data.fetch_session(db_session, task_data.session_id)
                if not r.ok():
                    _skip("session_not_found")
                    continue
                session_data, _ = r.unpack()
                if session_data.space_id is None:
                    _skip("session_has_no_space")
                    continue
                if session_data.space_id != body.space_id:
                    _skip("task_space_mismatch")
                    continue

                processable_items.append((entry_json, item))
                if item.task_id == body.task_id:
                    current_is_processable = True

        return project_config, processable_items, current_is_processable, skip_reasons

    async def _call_construct_agent_or_retry(
        self,
        body: SOPComplete,
        batch_log_prefix: str,
        project_config,
        processable_items: list[tuple[str, SOPComplete]],
        current_entry_json: str,
        current_is_processable: bool,
        popped_entries: list[str],
        skip_reasons: dict[str, int],
    ) -> None:
        """
        Call the construct agent once for the batch. Restore + retry on failures.

        We treat two types of failures as retryable:
        - controller raises an exception (agent_exception)
        - controller returns Result.ok() == False (agent_result)
        """
        # Use the first processable item as the "retry trigger" so the retry message is a valid,
        # processable payload (especially when the current message itself was filtered out).
        retry_trigger_item = processable_items[0][1]

        task_ids = [item.task_id for _entry_json, item in processable_items]
        sop_datas = [item.sop_data for _entry_json, item in processable_items]

        LOG.info(
            f"{batch_log_prefix} processing size={len(processable_items)} "
            f"popped={len(popped_entries) + 1} skip={sum(skip_reasons.values())} "
            f"skip_reasons={skip_reasons}"
        )

        try:
            result = await self._deps.controller.process_sop_complete_batch(
                project_config,
                body.project_id,
                body.space_id,
                task_ids,
                sop_datas,
            )
        except Exception as e:
            await self._restore_and_retry_on_failure(
                body=body,
                batch_log_prefix=batch_log_prefix,
                entries_to_restore=[entry_json for entry_json, _item in processable_items],
                retry_body=retry_trigger_item,
                reason="agent_exception",
                error=e,
                skip_reasons=skip_reasons,
                current_entry_json=current_entry_json,
                current_is_processable=current_is_processable,
            )
            return

        if not result.ok():
            await self._restore_and_retry_on_failure(
                body=body,
                batch_log_prefix=batch_log_prefix,
                entries_to_restore=[entry_json for entry_json, _item in processable_items],
                retry_body=retry_trigger_item,
                reason="agent_result",
                error=None,
                skip_reasons=skip_reasons,
                current_entry_json=current_entry_json,
                current_is_processable=current_is_processable,
            )
            return

        # Success: ensure the current message isn't stuck in the buffer and log completion.
        await self._safe_remove_from_buffer(body.project_id, body.space_id, current_entry_json)
        LOG.info(
            f"{batch_log_prefix} done success={len(processable_items)} "
            f"popped={len(popped_entries) + 1} skip={sum(skip_reasons.values())} "
            f"skip_reasons={skip_reasons}"
        )

    async def _restore_and_retry_on_failure(
        self,
        *,
        body: SOPComplete,
        batch_log_prefix: str,
        entries_to_restore: list[str],
        retry_body: SOPComplete,
        reason: str,
        error: Exception | None,
        skip_reasons: dict[str, int],
        current_entry_json: str | None = None,
        current_is_processable: bool | None = None,
    ) -> None:
        """
        Restore drained entries to the buffer and publish a retry trigger.

        This consolidates repeated failure handling logic into a single, reviewed path.
        """
        suffix = f": {error}" if error is not None else ""
        LOG.warning(
            f"{batch_log_prefix} retryable_failure={reason} "
            f"retryable_items={len(entries_to_restore)} "
            f"skip={sum(skip_reasons.values())} skip_reasons={skip_reasons}{suffix}"
        )

        # If the "current" message was not processable, we try to avoid leaving it duplicated in the
        # buffer (it may have been pushed at the start of the handler).
        if current_entry_json is not None and current_is_processable is False:
            await self._safe_remove_from_buffer(body.project_id, body.space_id, current_entry_json)

        restored = await self._deps.buffer.push_sop_buffer_entries_json(
            body.project_id, body.space_id, entries_to_restore
        )
        if restored:
            await self._publish_retry_best_effort(retry_body)
        else:
            # Worst-case fallback: if we cannot restore to Redis, publish each item as a retry message.
            for entry_json in entries_to_restore:
                item = self._deps.buffer.parse_sop_buffer_entry(entry_json)
                if item is None:
                    continue
                await self._publish_retry_best_effort(item)

        LOG.warning(
            f"SOPComplete batch failure, scheduled retry "
            f"(space={body.space_id}, retryable_failure={len(entries_to_restore)}, "
            f"skip={sum(skip_reasons.values())}, skip_reasons={skip_reasons})"
        )

    async def _publish_retry_best_effort(self, body: SOPComplete) -> None:
        """
        Publish a retry message, logging but not raising on publish failure.

        MQ publishing failures should not crash the handler; they would otherwise
        be treated as permanent failures by the MQ runtime.
        """
        try:
            await self._deps.mq_client.publish(
                exchange_name=self._deps.exchange_name,
                routing_key=self._deps.retry_routing_key,
                body=body.model_dump_json(),
            )
        except Exception as publish_e:
            LOG.error(
                f"Failed to publish SOPComplete retry "
                f"(space={body.space_id}, task={body.task_id}): {publish_e}"
            )

    async def _safe_remove_from_buffer(
        self, project_id, space_id, entry_json: str, *, count: int = 0
    ) -> None:
        """Remove an entry from the Redis buffer, suppressing errors."""
        try:
            await self._deps.buffer.remove_sop_buffer_entry(
                project_id, space_id, entry_json, count=count
            )
        except Exception as e:
            LOG.warning(
                f"Failed to remove SOPComplete from buffer (space={space_id}): {e}"
            )

    async def _safe_release_lock(self, body: SOPComplete, lock_key: str) -> None:
        """Release the per-space lock, logging but not raising on failure."""
        try:
            await self._deps.lock_release(body.project_id, lock_key)
        except Exception as e:
            LOG.error(
                f"Failed to release SOP space lock (space={body.space_id}, task={body.task_id}): {e}"
            )

