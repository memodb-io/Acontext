import uuid
from unittest.mock import AsyncMock

import pytest

from acontext_core.schema.orm import Session
from acontext_core.service.data.session import update_session_display_title_once


class TestUpdateSessionDisplayTitleOnce:
    @pytest.mark.asyncio
    async def test_writes_title_when_display_title_is_empty(self):
        db_session = AsyncMock()
        db_session.get = AsyncMock(
            return_value=Session(project_id=uuid.uuid4(), display_title=None)
        )

        written, error = (
            await update_session_display_title_once(
                db_session, uuid.uuid4(), "First task title"
            )
        ).unpack()

        assert error is None
        assert written is True
        assert db_session.get.return_value.display_title == "First task title"
        db_session.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_skips_write_when_display_title_exists(self):
        db_session = AsyncMock()
        db_session.get = AsyncMock(
            return_value=Session(
                project_id=uuid.uuid4(), display_title="Existing title"
            )
        )

        written, error = (
            await update_session_display_title_once(
                db_session, uuid.uuid4(), "First task title"
            )
        ).unpack()

        assert error is None
        assert written is False
        assert db_session.get.return_value.display_title == "Existing title"
        db_session.flush.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_returns_not_found_when_session_does_not_exist(self):
        db_session = AsyncMock()
        db_session.get = AsyncMock(return_value=None)
        session_id = uuid.uuid4()

        written, error = (
            await update_session_display_title_once(
                db_session, session_id, "First task title"
            )
        ).unpack()

        assert written is None
        assert error is not None
        assert error.errmsg == f"Session {session_id} not found"
        db_session.flush.assert_not_awaited()
