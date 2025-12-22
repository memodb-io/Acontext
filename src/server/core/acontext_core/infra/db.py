import traceback
import os
from typing import Optional
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncEngine,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.pool import AsyncAdaptedQueuePool
from sqlalchemy import text
from sqlalchemy.exc import DisconnectionError, OperationalError

# from ..schema.orm import Base
from ..schema.orm import ORM_BASE, BlockEmbedding
from ..schema.orm.block_embedding import check_legal_embedding_dim
from ..env import LOG as logger
from ..env import DEFAULT_CORE_CONFIG


class DatabaseClient:
    """
    Best-practice SQLAlchemy database client with connection pooling.

    Features:
    - Async SQLAlchemy with connection pooling
    - Automatic connection recovery
    - Proper session management
    - Connection pool monitoring
    - Health checks
    """

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or DEFAULT_CORE_CONFIG.database_url
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")

        # Convert postgres:// to postgresql+asyncpg:// if needed
        if self.database_url.startswith("postgresql://"):
            self.database_url = self.database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        elif self.database_url.startswith("postgres://"):
            self.database_url = self.database_url.replace(
                "postgres://", "postgresql+asyncpg://", 1
            )

        logger.debug(f"SQLAlchemy Engine URL: {self.database_url}")
        self._engine: AsyncEngine | None = self._create_engine()
        self._table_created: bool = False
        self._sessionmaker: async_sessionmaker[AsyncSession] | None = (
            async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=True,
                autocommit=False,
            )
        )

    @property
    def engine(self) -> AsyncEngine:
        """Get the database engine, creating it if necessary."""
        if self._engine is None:
            raise ValueError("Engine not initialized")
        return self._engine

    @property
    def sessionmaker(self) -> async_sessionmaker[AsyncSession]:
        """Get the session maker, creating it if necessary."""
        if self._sessionmaker is None:
            raise ValueError("Sessionmaker not initialized")
        return self._sessionmaker

    def _create_engine(self) -> AsyncEngine:
        """Create the SQLAlchemy async engine with optimal settings."""
        engine = create_async_engine(
            self.database_url,
            # Connection pool settings
            poolclass=AsyncAdaptedQueuePool,
            pool_size=DEFAULT_CORE_CONFIG.database_pool_size,  # Number of connections to maintain
            max_overflow=DEFAULT_CORE_CONFIG.database_pool_size,  # Additional connections beyond pool_size
            pool_timeout=30,  # Seconds to wait for a connection
            pool_recycle=600,  # Recycle connections after 10 minutes
            pool_pre_ping=True,  # Verify connections before use
            # Engine settings
            echo=False,  # Set to True for SQL debugging
            echo_pool=False,  # Set to True for pool debugging
            future=True,  # Use SQLAlchemy 2.0 behavior
            # Connection arguments for asyncpg
            connect_args={
                "server_settings": {
                    "application_name": "acontext_server",
                    "jit": "off",  # Disable JIT for better performance in some cases
                },
                "command_timeout": 60,  # Query timeout in seconds
                "prepared_statement_cache_size": 0,  # Disable prepared statements cache
            },
        )

        # Set up event listeners for connection monitoring
        self._setup_event_listeners(engine)

        # Instrument with OpenTelemetry if enabled
        try:
            from ..telemetry.config import TelemetryConfig

            telemetry_config = TelemetryConfig.from_env()
            if telemetry_config.enabled:
                from ..telemetry.otel import instrument_sqlalchemy

                instrument_sqlalchemy(engine)
                logger.debug("SQLAlchemy OpenTelemetry instrumentation enabled")
        except Exception as e:
            logger.warning(
                f"Failed to instrument SQLAlchemy with OpenTelemetry, continuing without tracing: {e}",
                exc_info=True,
            )

        return engine

    def _setup_event_listeners(self, engine: AsyncEngine) -> None:
        """PLACEHOLDER Set up event listeners for connection pool monitoring."""
        pass
        # @event.listens_for(engine.sync_engine, "connect")
        # def on_connect(dbapi_connection, connection_record):
        #     logger.debug("New database connection established")

        # @event.listens_for(engine.sync_engine, "checkout")
        # def on_checkout(dbapi_connection, connection_record, connection_proxy):
        #     logger.debug("Connection checked out from pool")

        # @event.listens_for(engine.sync_engine, "checkin")
        # def on_checkin(dbapi_connection, connection_record):
        #     logger.debug("Connection returned to pool")

        # @event.listens_for(engine.sync_engine, "invalidate")
        # def on_invalidate(dbapi_connection, connection_record, exception):
        #     logger.warning(f"Connection invalidated: {exception}")

    async def get_session(self) -> AsyncSession:
        """
        Get a new database session.

        Note: Remember to close the session when done, or use get_session_context().
        """
        return self.sessionmaker()

    @asynccontextmanager
    async def get_session_context(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Get a database session with automatic cleanup.

        Usage:
            async with db_client.get_session_context() as session:
                # Use session here
                result = await session.execute(select(User))
        """
        session = await self.get_session()
        try:
            yield session
            await session.commit()
        except Exception as e:
            logger.error(
                f"DB Session failed: {str(e)}. Rollback...",
                extra={"traceback": traceback.format_exc()},
            )
            await session.rollback()
            raise e
        finally:
            await session.close()

    async def health_check(self) -> bool:
        """
        Perform a health check on the database connection.

        Returns:
            True if the database is accessible, False otherwise.
        """
        try:
            async with self.get_session_context() as session:
                await session.execute(text("SELECT 1"))
                return True
        except (DisconnectionError, OperationalError, Exception) as e:
            logger.error(f"Database health check failed: {e}")
            return False

    async def create_tables(self) -> None:
        """Create all tables defined in the ORM models.

        Note: When running under pytest, this also truncates all ORM tables to
        ensure tests are isolated even when they share a persistent database.
        """
        if self._table_created:
            if os.getenv("PYTEST_CURRENT_TEST"):
                await self.truncate_tables()
            return
        async with self.get_session_context() as db_session:
            await db_session.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        logger.info("pgvector extension init")
        async with self.engine.begin() as conn:
            await conn.run_sync(ORM_BASE.metadata.create_all)

        if os.getenv("PYTEST_CURRENT_TEST"):
            await self.truncate_tables()

        self._table_created = True

    async def truncate_tables(self) -> None:
        """Truncate all ORM tables (postgres only).

        This is primarily intended for test isolation when using a shared
        database instance.
        """
        table_names: list[str] = []
        for table in reversed(ORM_BASE.metadata.sorted_tables):
            if table.schema:
                table_names.append(f'"{table.schema}"."{table.name}"')
            else:
                table_names.append(f'"{table.name}"')

        if not table_names:
            return

        async with self.engine.begin() as conn:
            await conn.execute(
                text(
                    "TRUNCATE TABLE "
                    + ", ".join(table_names)
                    + " RESTART IDENTITY CASCADE;"
                )
            )

    async def drop_tables(self) -> None:
        """Drop all tables defined in the ORM models."""
        async with self.engine.begin() as conn:
            await conn.run_sync(ORM_BASE.metadata.drop_all)
        logger.warning("All database tables dropped")
        self._table_created = False

    async def close(self) -> None:
        """Close the database engine and all connections."""
        if self._engine:
            await self._engine.dispose()
            self._engine = None
            self._sessionmaker = None
            logger.info("Database connections closed")

    def get_pool_status(self) -> dict[str, int | str]:
        """Get current connection pool status for monitoring."""
        if not self._engine:
            return {"status": "engine_not_initialized"}

        pool = self._engine.pool
        return {
            "size": pool.size(),  # pyright: ignore[reportAttributeAccessIssue]
            "checked_in": pool.checkedin(),  # pyright: ignore[reportAttributeAccessIssue]
            "checked_out": pool.checkedout(),  # pyright: ignore[reportAttributeAccessIssue]
        }


# Lazy Loading Global database client instance
DB_CLIENT = DatabaseClient()


# Convenience functions
async def init_database() -> None:
    """Initialize the database (create tables)."""
    await DB_CLIENT.create_tables()
    assert await DB_CLIENT.health_check(), "Database health check failed"
    async with DB_CLIENT.get_session_context() as db_session:
        await check_legal_embedding_dim(
            BlockEmbedding, db_session, DEFAULT_CORE_CONFIG.block_embedding_dim
        )
    logger.info(f"Database created successfully {DB_CLIENT.get_pool_status()}")


async def close_database() -> None:
    """Close database connections."""
    await DB_CLIENT.close()
    logger.info("Database closed")
