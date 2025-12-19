"""
Redis-backed per-space SOPComplete buffer.

Purpose
-------
SOP completion events may arrive in bursts. To batch them into fewer construct-agent
calls, we buffer SOPComplete payloads in Redis using a per-space key.

Design
------
- Data structure: Redis LIST (append with RPUSH, drain with an atomic LRANGE+LTRIM Lua).
- Keying: one list per `(project_id, space_id)` so different spaces do not contend.
- TTL: refreshed on each push so idle buffers eventually disappear.

Operational notes
----------------
- Entries are stored as JSON strings using `SOPComplete.model_dump_json()`.
- Removal uses exact string match (Redis LREM). This is simple but depends on stable
  JSON serialization; callers should treat it as best-effort housekeeping rather than
  a strict correctness guarantee.
"""

from ..env import DEFAULT_CORE_CONFIG, LOG
from ..infra.redis import REDIS_CLIENT
from ..schema.mq.sop import SOPComplete
from ..schema.utils import asUUID


SPACE_SOP_BUFFER_KEY_PREFIX = "space_sop_buffer"


def space_sop_buffer_key(project_id: asUUID, space_id: asUUID) -> str:
    """
    Per-space SOP buffer key.

    Format: space_sop_buffer.<project_id>.<space_id>
    """
    return f"{SPACE_SOP_BUFFER_KEY_PREFIX}.{project_id}.{space_id}"


async def push_sop_complete_to_buffer(body: SOPComplete) -> bool:
    """
    Append SOPComplete payload JSON to the per-space Redis list and refresh TTL.

    Returns:
        True if pushed successfully, False otherwise.
    """
    ttl_seconds = DEFAULT_CORE_CONFIG.space_task_sop_buffer_ttl_seconds
    if ttl_seconds <= 0:
        ttl_seconds = 30 * 60
        LOG.warning(
            "Invalid space_task_sop_buffer_ttl_seconds, using default TTL: "
            f"{ttl_seconds} seconds"
        )

    buffer_key = space_sop_buffer_key(body.project_id, body.space_id)
    payload_json = body.model_dump_json()

    try:
        async with REDIS_CLIENT.get_client_context() as client:
            pipe = client.pipeline(transaction=True)
            pipe.rpush(buffer_key, payload_json)
            pipe.expire(buffer_key, ttl_seconds)
            await pipe.execute()
        return True
    except Exception as e:
        LOG.error(f"Failed to push SOPComplete to Redis buffer {buffer_key}: {e}")
        return False


async def push_sop_buffer(body: SOPComplete) -> bool:
    """
    Backwards/ergonomic alias: push SOPComplete payload into the per-space buffer.
    """
    return await push_sop_complete_to_buffer(body)


async def push_sop_buffer_entries_json(
    project_id: asUUID, space_id: asUUID, entries_json: list[str]
) -> bool:
    """
    Append raw JSON payload(s) to the per-space SOP buffer and refresh TTL.

    This is primarily used to restore popped entries on retryable failures.
    """
    if not entries_json:
        return True

    ttl_seconds = DEFAULT_CORE_CONFIG.space_task_sop_buffer_ttl_seconds
    if ttl_seconds <= 0:
        ttl_seconds = 30 * 60
        LOG.warning(
            "Invalid space_task_sop_buffer_ttl_seconds, using default TTL: "
            f"{ttl_seconds} seconds"
        )

    buffer_key = space_sop_buffer_key(project_id, space_id)
    try:
        async with REDIS_CLIENT.get_client_context() as client:
            pipe = client.pipeline(transaction=True)
            pipe.rpush(buffer_key, *entries_json)
            pipe.expire(buffer_key, ttl_seconds)
            await pipe.execute()
        return True
    except Exception as e:
        LOG.error(f"Failed to restore SOP buffer entries to {buffer_key}: {e}")
        return False


_POP_BATCH_LUA = """
local key = KEYS[1]
local count = tonumber(ARGV[1])
if not count or count <= 0 then
  return {}
end
local items = redis.call('LRANGE', key, 0, count - 1)
if #items > 0 then
  redis.call('LTRIM', key, #items, -1)
end
return items
"""


async def pop_sop_buffer_batch(
    project_id: asUUID, space_id: asUUID, max_n: int
) -> list[str]:
    """
    Pop up to `max_n` items from the per-space Redis list atomically.

    This is intended to be called only by the worker holding the space lock.
    """
    if max_n <= 0:
        return []

    buffer_key = space_sop_buffer_key(project_id, space_id)
    async with REDIS_CLIENT.get_client_context() as client:
        items = await client.eval(_POP_BATCH_LUA, 1, buffer_key, max_n)

    if items is None:
        return []
    if isinstance(items, str):
        return [items]
    return list(items)


async def remove_sop_buffer_entry(
    project_id: asUUID, space_id: asUUID, entry_json: str, count: int = 0
) -> bool:
    """
    Remove matching entry JSON string(s) from the per-space buffer list.

    Args:
        count: Redis LREM count semantics. Use 0 to remove all occurrences.
    """
    if not entry_json:
        return True

    buffer_key = space_sop_buffer_key(project_id, space_id)
    try:
        async with REDIS_CLIENT.get_client_context() as client:
            await client.lrem(buffer_key, count, entry_json)
        return True
    except Exception as e:
        LOG.error(f"Failed to remove SOP buffer entry from {buffer_key}: {e}")
        return False


def parse_sop_buffer_entry(entry_json: str) -> SOPComplete | None:
    """
    Parse a Redis buffer entry into SOPComplete.

    Buffer entries are expected to be `SOPComplete.model_dump_json()` strings.
    """
    try:
        return SOPComplete.model_validate_json(entry_json)
    except Exception:
        return None
