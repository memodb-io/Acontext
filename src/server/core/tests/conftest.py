"""
Shared test fixtures for all tests.

Provides a properly-managed DatabaseClient that disposes its engine after use,
preventing the "coroutine 'Connection._cancel' was never awaited" warning from
leaked asyncpg connections.
"""

import pytest

from acontext_core.infra.alembic import upgrade_database_to_head
from acontext_core.infra.db import DatabaseClient, DB_CLIENT


@pytest.fixture
async def db_client():
    """
    Async fixture that creates a DatabaseClient, upgrades the schema to head,
    and disposes the engine on teardown.
    """
    client = DatabaseClient()
    await upgrade_database_to_head(client.database_url)
    yield client
    await client.close()
    # Also dispose the global DB_CLIENT engine, which gets created at import
    # time and may accumulate leaked connections across tests (e.g. via
    # OpenTelemetry instrumentation holding engine references).
    if DB_CLIENT._engine is not None:
        await DB_CLIENT._engine.dispose()
