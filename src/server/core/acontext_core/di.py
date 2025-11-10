from . import service
from .env import LOG, DEFAULT_CORE_CONFIG
from .infra.db import init_database, close_database, DB_CLIENT
from .infra.redis import init_redis, close_redis, REDIS_CLIENT
from .infra.async_mq import init_mq, close_mq, MQ_CLIENT
from .infra.s3 import init_s3, close_s3, S3_CLIENT
from .llm.complete import llm_sanity_check
from .llm.embeddings import embedding_sanity_check


async def setup() -> None:
    # await llm_sanity_check()
    # await embedding_sanity_check()
    await init_database()
    await init_redis()
    await init_s3()
    await init_mq()


async def cleanup() -> None:
    await close_database()
    await close_redis()
    await close_s3()
    await close_mq()
