from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from ..env import DEFAULT_CORE_CONFIG

ALEMBIC_ROOT = Path(__file__).resolve().parents[2]
ALEMBIC_INI_PATH = ALEMBIC_ROOT / "alembic.ini"
ALEMBIC_SCRIPT_LOCATION = ALEMBIC_ROOT / "alembic"
BASELINE_REVISION = "0001_core_schema_baseline"
BASELINE_MARKER_TABLES = {"projects", "sessions", "tasks", "messages"}


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql://", 1)
    return database_url


def get_alembic_async_database_url(database_url: str | None = None) -> str:
    raw_database_url = _normalize_database_url(
        database_url or DEFAULT_CORE_CONFIG.database_url
    )
    if raw_database_url.startswith("postgresql+asyncpg://"):
        return raw_database_url
    if raw_database_url.startswith("postgresql://"):
        return raw_database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    raise ValueError(f"Unsupported database URL for Alembic: {raw_database_url}")


def _build_alembic_config(database_url: str | None = None) -> Config:
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(ALEMBIC_SCRIPT_LOCATION))
    config.set_main_option("sqlalchemy.url", get_alembic_async_database_url(database_url))
    return config


async def _get_database_table_names(database_url: str | None = None) -> set[str]:
    engine = create_async_engine(
        get_alembic_async_database_url(database_url),
        poolclass=NullPool,
    )
    try:
        async with engine.connect() as connection:
            return set(
                await connection.run_sync(
                    lambda sync_connection: inspect(sync_connection).get_table_names()
                )
            )
    finally:
        await engine.dispose()


def _stamp_and_upgrade(database_url: str | None, should_stamp_baseline: bool) -> None:
    config = _build_alembic_config(database_url)
    if should_stamp_baseline:
        command.stamp(config, BASELINE_REVISION)
    command.upgrade(config, "head")


async def upgrade_database_to_head(database_url: str | None = None) -> None:
    table_names = await _get_database_table_names(database_url)
    has_version_table = "alembic_version" in table_names
    legacy_marker_tables = table_names & BASELINE_MARKER_TABLES

    if not has_version_table and legacy_marker_tables:
        if legacy_marker_tables != BASELINE_MARKER_TABLES:
            raise RuntimeError(
                "Found a partial core schema without Alembic history. "
                "Finish the previous migration work or stamp the database manually."
            )
        await asyncio.to_thread(_stamp_and_upgrade, database_url, True)
        return

    await asyncio.to_thread(_stamp_and_upgrade, database_url, False)


def main(argv: list[str] | None = None) -> int:
    args = argv or sys.argv[1:]
    command_name = args[0] if args else "upgrade-head"

    if command_name != "upgrade-head":
        print(f"Unsupported command: {command_name}", file=sys.stderr)
        return 2

    asyncio.run(upgrade_database_to_head())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
