#!/bin/sh
set -eu

exec /app/.venv/bin/python -m acontext_core.infra.alembic upgrade-head
