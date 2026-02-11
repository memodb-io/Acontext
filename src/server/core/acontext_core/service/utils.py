from ..infra.redis import REDIS_CLIENT
from ..env import DEFAULT_CORE_CONFIG
from ..schema.utils import asUUID


async def check_redis_lock_or_set(project_id: asUUID, key: str) -> bool:
    new_key = f"lock.{project_id}.{key}"
    async with REDIS_CLIENT.get_client_context() as client:
        # Use SET with NX (not exists) and EX (expire) for atomic lock acquisition
        result = await client.set(
            new_key,
            "1",
            nx=True,  # Only set if key doesn't exist
            ex=DEFAULT_CORE_CONFIG.session_message_processing_timeout_seconds,
        )
        # Returns True if the lock was acquired (key didn't exist), False if it already existed
        return result is not None


async def release_redis_lock(project_id: asUUID, key: str):
    new_key = f"lock.{project_id}.{key}"
    async with REDIS_CLIENT.get_client_context() as client:
        await client.delete(new_key)


async def check_buffer_timer_or_set(
    project_id: asUUID, session_id: asUUID, ttl_seconds: int
) -> bool:
    """
    Check if a buffer timer already exists for this session. If not, set one.

    Returns True if the key was newly set (caller should create the timer),
    False if the key already existed (timer already scheduled).
    """
    key = f"buffer_timer.{project_id}.{session_id}"
    async with REDIS_CLIENT.get_client_context() as client:
        result = await client.set(
            key,
            "1",
            nx=True,
            ex=ttl_seconds,
        )
        return result is not None
