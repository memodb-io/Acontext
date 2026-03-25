import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from acontext_core.schema.result import Result
from acontext_core.schema.orm import Task
from acontext_core.service.data.task import insert_task, update_task


MODULE = "acontext_core.service.data.task"


class TestTaskTitleSync:
    @pytest.mark.asyncio
    async def test_insert_task_syncs_session_title_from_first_task(self):
        db_session = AsyncMock()
        db_session.add = MagicMock()
        db_session.execute = AsyncMock(return_value=MagicMock())
        db_session.flush = AsyncMock()
        project_id = uuid.uuid4()
        session_id = uuid.uuid4()

        with (
            patch(
                f"{MODULE}.fetch_first_task_description",
                new_callable=AsyncMock,
                return_value=Result.resolve("First task title"),
            ),
            patch(
                f"{MODULE}.SD.update_session_display_title_once",
                new_callable=AsyncMock,
                return_value=Result.resolve(True),
            ) as update_title_mock,
        ):
            result = await insert_task(
                db_session,
                project_id,
                session_id,
                after_order=0,
                data={"task_description": "First task title"},
            )

            assert result.ok()
            update_title_mock.assert_awaited_once_with(
                db_session, session_id, "First task title"
            )

    @pytest.mark.asyncio
    async def test_update_task_syncs_session_title_from_first_task(self):
        db_session = AsyncMock()
        task = Task(
            session_id=uuid.uuid4(),
            project_id=uuid.uuid4(),
            order=1,
            data={"task_description": "Old title"},
            status="pending",
        )
        query_result = MagicMock()
        query_result.scalars.return_value.first.return_value = task
        db_session.execute = AsyncMock(return_value=query_result)
        db_session.flush = AsyncMock()

        with (
            patch(
                f"{MODULE}.fetch_first_task_description",
                new_callable=AsyncMock,
                return_value=Result.resolve("First task title"),
            ),
            patch(
                f"{MODULE}.SD.update_session_display_title_once",
                new_callable=AsyncMock,
                return_value=Result.resolve(True),
            ) as update_title_mock,
        ):
            result = await update_task(
                db_session,
                task.id,
                patch_data={"task_description": "New title"},
            )

            assert result.ok()
            update_title_mock.assert_awaited_once_with(
                db_session, task.session_id, "First task title"
            )

    @pytest.mark.asyncio
    async def test_skips_title_write_when_first_task_title_is_missing(self):
        db_session = AsyncMock()
        db_session.add = MagicMock()
        db_session.execute = AsyncMock(return_value=MagicMock())
        db_session.flush = AsyncMock()

        with (
            patch(
                f"{MODULE}.fetch_first_task_description",
                new_callable=AsyncMock,
                return_value=Result.resolve(None),
            ),
            patch(
                f"{MODULE}.SD.update_session_display_title_once",
                new_callable=AsyncMock,
                return_value=Result.resolve(True),
            ) as update_title_mock,
        ):
            result = await insert_task(
                db_session,
                uuid.uuid4(),
                uuid.uuid4(),
                after_order=0,
                data={"task_description": "First task title"},
            )

            assert result.ok()
            update_title_mock.assert_not_awaited()
