import pytest
import uuid
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from acontext_core.schema.orm import Task, Project, Space, Session
from acontext_core.schema.result import Result
from acontext_core.schema.error_code import Code
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import create_new_page


class TestPageBlock:
    @pytest.mark.asyncio
    async def test_create_new_page_success(self):
        """Test creating a new page block"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            for i in range(3):
                r = await create_new_page(session, space.id, f"Test Page {i}")
                if not r.ok():
                    assert False, f"Failed to create new page: {r.error}"
                page_id = r.unpack()[0]
                assert page_id is not None

            await session.delete(project)


class TestSOPBlock:
    pass
