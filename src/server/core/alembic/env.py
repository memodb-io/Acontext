from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from acontext_core.infra.alembic import get_alembic_async_database_url
from acontext_core.schema.orm import ORM_BASE

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = ORM_BASE.metadata


def _configure_database_url() -> str:
    url = config.get_main_option("sqlalchemy.url") or get_alembic_async_database_url()
    config.set_main_option("sqlalchemy.url", url)
    return url


def run_migrations_offline() -> None:
    url = _configure_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    _configure_database_url()
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    import asyncio

    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
