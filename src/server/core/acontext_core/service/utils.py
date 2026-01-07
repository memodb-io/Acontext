from ..infra.redis import REDIS_CLIENT
from ..env import DEFAULT_CORE_CONFIG
from ..schema.utils import asUUID
from ..util.generate_ids import generate_temp_id


async def check_redis_lock_or_set(project_id: asUUID, key: str) -> bool:
    new_key = f"lock.{project_id}.{key}"
    ttl_seconds = (
        DEFAULT_CORE_CONFIG.space_task_sop_lock_ttl_seconds
        or DEFAULT_CORE_CONFIG.session_message_processing_timeout_seconds
    )
    async with REDIS_CLIENT.get_client_context() as client:
        # Use SET with NX (not exists) and EX (expire) for atomic lock acquisition
        result = await client.set(
            new_key,
            "1",
            nx=True,  # Only set if key doesn't exist
            ex=ttl_seconds,
        )
        # Returns True if the lock was acquired (key didn't exist), False if it already existed
        return result is not None


async def acquire_redis_lock_token(project_id: asUUID, key: str) -> str | None:
    new_key = f"lock.{project_id}.{key}"
    token = generate_temp_id()
    ttl_seconds = (
        DEFAULT_CORE_CONFIG.space_task_sop_lock_ttl_seconds
        or DEFAULT_CORE_CONFIG.session_message_processing_timeout_seconds
    )
    async with REDIS_CLIENT.get_client_context() as client:
        result = await client.set(new_key, token, nx=True, ex=ttl_seconds)
    return token if result is not None else None


async def release_redis_lock(project_id: asUUID, key: str):
    new_key = f"lock.{project_id}.{key}"
    async with REDIS_CLIENT.get_client_context() as client:
        await client.delete(new_key)
