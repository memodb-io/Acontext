"""
Tests for SOP batching behavior.

These are service-layer tests that focus on the batching orchestration logic.
They intentionally mock:
- the Redis lock (to avoid distributed lock complexity in unit tests)
- the Redis buffer module (to avoid requiring a real Redis server)
- the controller call (to assert a single batched invocation)

This gives fast, deterministic tests that validate the batching flow without
coupling to infrastructure.
"""

import asyncio

import pytest

from acontext_core.infra.db import DatabaseClient
from acontext_core.schema.block.sop_block import SOPData, SOPStep
from acontext_core.schema.mq.sop import SOPComplete
from acontext_core.schema.orm import Project, Session, Space, Task
from acontext_core.schema.result import Result


@pytest.mark.asyncio
async def test_space_sop_complete_batches_buffered_items(monkeypatch):
    """
    Smoke test for SOP batching:
    - handler buffers items per-space
    - lock-holder pops additional buffered items and calls batch controller once
    """
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        project = Project(
            secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
        )
        session.add(project)
        await session.flush()

        space = Space(project_id=project.id, configs={"name": "test-space"})
        session.add(space)
        await session.flush()

        s = Session(project_id=project.id, space_id=space.id)
        session.add(s)
        await session.flush()

        t1 = Task(
            project_id=project.id,
            session_id=s.id,
            order=1,
            data={"task_description": "t1"},
        )
        t2 = Task(
            project_id=project.id,
            session_id=s.id,
            order=2,
            data={"task_description": "t2"},
        )
        session.add_all([t1, t2])
        await session.flush()

    sop_data_1 = SOPData(
        use_when="when testing",
        preferences="none",
        tool_sops=[SOPStep(tool_name="noop", action="noop")],
    )
    sop_data_2 = SOPData(
        use_when="when testing",
        preferences="none",
        tool_sops=[SOPStep(tool_name="noop", action="noop")],
    )

    body1 = SOPComplete(
        project_id=project.id,
        space_id=space.id,
        task_id=t1.id,
        sop_data=sop_data_1,
    )
    body2 = SOPComplete(
        project_id=project.id,
        space_id=space.id,
        task_id=t2.id,
        sop_data=sop_data_2,
    )

    # Patch the module under test directly (it registers consumers at import time).
    from acontext_core.service import space_receive_sop as SRS

    monkeypatch.setattr(SRS, "DB_CLIENT", db_client)

    # Make batching immediate and deterministic.
    monkeypatch.setattr(SRS.DEFAULT_CORE_CONFIG, "space_task_sop_batch_wait_seconds", 0)
    monkeypatch.setattr(SRS.DEFAULT_CORE_CONFIG, "space_task_sop_batch_max_size", 16)

    # Avoid Redis lock complexity.
    async def _lock(_project_id, _key):
        return True

    async def _unlock(_project_id, _key):
        return None

    monkeypatch.setattr(SRS, "check_redis_lock_or_set", _lock)
    monkeypatch.setattr(SRS, "release_redis_lock", _unlock)

    # In-memory buffer implementation for the smoke test.
    buffer_items: list[str] = []

    async def _push_sop_buffer(body: SOPComplete) -> bool:
        buffer_items.append(body.model_dump_json())
        return True

    async def _push_entries(_project_id, _space_id, entries_json: list[str]) -> bool:
        buffer_items.extend(entries_json)
        return True

    async def _remove(_project_id, _space_id, entry_json: str, count: int = 0) -> bool:
        if count == 0:
            buffer_items[:] = [x for x in buffer_items if x != entry_json]
        else:
            removed = 0
            kept: list[str] = []
            for x in buffer_items:
                if x == entry_json and removed < count:
                    removed += 1
                else:
                    kept.append(x)
            buffer_items[:] = kept
        return True

    async def _pop(_project_id, _space_id, max_n: int) -> list[str]:
        n = min(max_n, len(buffer_items))
        out = buffer_items[:n]
        del buffer_items[:n]
        return out

    def _parse(entry_json: str):
        try:
            return SOPComplete.model_validate_json(entry_json)
        except Exception:
            return None

    monkeypatch.setattr(SRS.SSB, "push_sop_buffer", _push_sop_buffer)
    monkeypatch.setattr(SRS.SSB, "push_sop_buffer_entries_json", _push_entries)
    monkeypatch.setattr(SRS.SSB, "remove_sop_buffer_entry", _remove)
    monkeypatch.setattr(SRS.SSB, "pop_sop_buffer_batch", _pop)
    monkeypatch.setattr(SRS.SSB, "parse_sop_buffer_entry", _parse)

    # Controller call capture.
    calls = []

    async def _process_batch(_project_config, _project_id, _space_id, task_ids, sop_datas):
        calls.append((list(task_ids), list(sop_datas)))
        return Result.resolve({"ok": True})

    monkeypatch.setattr(SRS.SSC, "process_sop_complete_batch", _process_batch)

    # Provide a project config without going through the real PD.get_project_config.
    async def _get_project_config(_db_session, _project_id):
        class _Cfg:
            default_space_construct_agent_max_iterations = 1

        return Result.resolve(_Cfg())

    monkeypatch.setattr(SRS.PD, "get_project_config", _get_project_config)

    # Ensure tasks are considered not-yet-digested by default; fetch_task is already real.
    # Pre-buffer a second SOPComplete so the first handler drains it into the batch.
    await SRS.SSB.push_sop_buffer(body2)

    await asyncio.wait_for(SRS.space_sop_complete_task(body1, None), timeout=5)

    assert len(calls) == 1
    batched_task_ids = calls[0][0]
    assert set(batched_task_ids) == {t1.id, t2.id}
