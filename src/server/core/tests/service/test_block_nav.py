import pytest
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from acontext_core.schema.orm import Block, Project, Space
from acontext_core.schema.orm.block import (
    BLOCK_TYPE_FOLDER,
    BLOCK_TYPE_PAGE,
    BLOCK_TYPE_SOP,
    BLOCK_TYPE_TEXT,
)
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import create_new_path_block
from acontext_core.service.data.block_nav import list_paths_under_block


class TestListPathsUnderBlock:
    @pytest.mark.asyncio
    async def test_list_paths_empty_space(self):
        """Test listing paths in an empty space returns empty dict"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # List paths at root with no blocks created
            r = await list_paths_under_block(session, space.id)
            assert r.ok()
            assert r.data == {}

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_paths_excludes_sop_and_text_blocks(self):
        """Test that SOP and TEXT blocks are not included in path listing"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a page
            r = await create_new_path_block(
                session, space.id, "TestPage", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Create text block under page
            r = await create_new_path_block(
                session,
                space.id,
                "TextBlock",
                par_block_id=page_id,
                type=BLOCK_TYPE_TEXT,
                props={"preferences": "test"},
            )
            assert r.ok()

            # List paths - should only show the page, not the text block
            r = await list_paths_under_block(session, space.id)
            assert r.ok()
            paths = r.data

            assert len(paths) == 1
            assert paths["TestPage"] == page_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_paths_invalid_block_id(self):
        """Test that listing paths with non-existent block_id fails"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            fake_block_id = uuid.uuid4()
            r = await list_paths_under_block(session, space.id, block_id=fake_block_id)
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_paths_with_page_block_id_fails(self):
        """Test that using a page as block_id fails (must be folder)"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a page
            r = await create_new_path_block(
                session, space.id, "TestPage", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Try to list paths under a page (should fail)
            r = await list_paths_under_block(session, space.id, block_id=page_id)
            assert not r.ok()
            assert "not a folder" in r.error.errmsg.lower()

            await session.delete(project)
