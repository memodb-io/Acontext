from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

DISPLAY_TITLE_COLUMN_PATCH_NAME = "sessions.display_title"
DISPLAY_TITLE_COLUMN_PATCH_SQL = text(
    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS display_title TEXT;"
)


async def apply_runtime_schema_patches(db_session: AsyncSession) -> list[str]:
    """Apply idempotent runtime schema patches for existing deployments."""
    applied_patch_names: list[str] = []

    await db_session.execute(DISPLAY_TITLE_COLUMN_PATCH_SQL)
    applied_patch_names.append(DISPLAY_TITLE_COLUMN_PATCH_NAME)

    return applied_patch_names
