import os
from typing import Optional, Dict, Any, AsyncGenerator
from contextlib import asynccontextmanager

import redis.asyncio as redis
from redis.asyncio import ConnectionPool, Redis
from redis.exceptions import (
    ConnectionError,
    TimeoutError,
    RedisError,
)

from ..env import LOG as logger
from ..env import DEFAULT_CORE_CONFIG


class RedisClient:
    """
    Best-practice Redis client with connection pooling and async support.

    Features:
    - Async Redis with connection pooling
    - Automatic connection recovery
    - Redis URL support with authentication
    - Health checks and monitoring
    - Proper error handling
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or self._build_redis_url()
        if not self.redis_url:
            raise ValueError(
                "Redis URL could not be constructed from environment variables"
            )

        logger.info(f"Redis URL: {self._build_redis_url()}")

        self._pool: ConnectionPool = self._create_pool()
        self._client: Redis = self._create_client()

    def _build_redis_url(self) -> str:
        """Build Redis URL from environment variables."""
        redis_url = DEFAULT_CORE_CONFIG.redis_url
        return redis_url

    @property
    def pool(self) -> ConnectionPool:
        """Get the Redis connection pool, creating it if necessary."""
        return self._pool

    @property
    def client(self) -> Redis:
        """Get the Redis client, creating it if necessary."""
        return self._client

    def _create_pool(self) -> ConnectionPool:
        """Create the Redis connection pool with optimal settings."""
        pool = ConnectionPool.from_url(
            self.redis_url,
            # Connection pool settings
            max_connections=DEFAULT_CORE_CONFIG.redis_pool_size,  # Maximum number of connections in the pool
            retry_on_timeout=True,  # Retry on timeout errors
            retry_on_error=[ConnectionError, TimeoutError],  # Retry on these errors
            # Connection settings
            socket_timeout=5,  # Socket timeout in seconds
            socket_connect_timeout=5,  # Connection timeout in seconds
            socket_keepalive=True,  # Enable TCP keepalive
            socket_keepalive_options={},  # Default keepalive options
            health_check_interval=30,  # Health check every 30 seconds
            # Protocol settings
            decode_responses=True,  # Automatically decode byte responses to strings
            encoding="utf-8",  # Default encoding
        )

        logger.info("Redis connection pool created")
        return pool

    def _create_client(self) -> Redis:
        """Create the Redis client with optimal settings."""
        client = Redis(connection_pool=self.pool, decode_responses=True)
        
        # Instrument with OpenTelemetry if enabled
        try:
            from ..telemetry.config import TelemetryConfig
            telemetry_config = TelemetryConfig.from_env()
            if telemetry_config.enabled:
                from ..telemetry.otel import instrument_redis
                instrument_redis(client)
                logger.info("Redis OpenTelemetry instrumentation enabled")
        except Exception as e:
            logger.warning(
                f"Failed to instrument Redis with OpenTelemetry, continuing without tracing: {e}",
                exc_info=True
            )
        
        logger.info("Redis client created")
        return client

    async def get_client(self) -> Redis:
        """
        Get a Redis client instance.

        The client uses connection pooling, so you don't need to close it manually.
        Use this for direct Redis operations.
        """
        return self.client

    @asynccontextmanager
    async def get_client_context(self) -> AsyncGenerator[Redis, None]:
        """
        Get a Redis client with context manager support.

        Usage:
            async with redis_client.get_client_context() as client:
                await client.set("key", "value")
                value = await client.get("key")
        """
        client = await self.get_client()
        try:
            yield client
        except Exception:
            # Connection will be returned to pool automatically
            raise

    async def health_check(self) -> bool:
        """
        Perform a health check on the Redis connection.

        Returns:
            True if Redis is accessible, False otherwise.
        """
        try:
            client = await self.get_client()
            await client.ping()
            return True
        except (ConnectionError, TimeoutError, RedisError, Exception) as e:
            logger.error(f"Redis health check failed: {e}")
            return False

    async def info(self, section: Optional[str] = None) -> Dict[str, Any]:
        """Get Redis server information."""
        client = await self.get_client()
        return await client.info(section)

    def get_pool_status(self) -> Dict[str, Any]:
        """Get current connection pool status for monitoring."""
        if not self._pool:
            return {"status": "pool_not_initialized"}

        try:
            # Use correct attributes for redis.asyncio ConnectionPool
            return {
                "max_connections": self._pool.max_connections,
                "available_connections": len(self._pool._available_connections),
                "in_use_connections": len(self._pool._in_use_connections),
            }
        except AttributeError:
            # Fallback for different Redis versions
            return {
                "max_connections": getattr(self._pool, "max_connections", "unknown"),
                "status": "pool_initialized",
            }

    async def close(self) -> None:
        """Close all connections in the pool."""
        if self._pool:
            await self._pool.disconnect()
            self._pool = None
            self._client = None
            logger.info("Redis connections closed")


# Global Redis client instance
REDIS_CLIENT = RedisClient()


# Convenience functions
async def init_redis() -> None:
    """Initialize Redis connection (perform health check)."""
    if await REDIS_CLIENT.health_check():
        logger.info(
            f"Redis connection initialized successfully {REDIS_CLIENT.get_pool_status()}"
        )
    else:
        logger.error("Failed to initialize Redis connection")
        raise ConnectionError("Could not connect to Redis")


async def close_redis() -> None:
    """Close Redis connections."""
    await REDIS_CLIENT.close()
