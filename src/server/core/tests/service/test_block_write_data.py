import pytest
import uuid
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from acontext_core.schema.orm import (
    Block,
    BlockEmbedding,
    Project,
    Space,
    ToolReference,
    ToolSOP,
)
from acontext_core.schema.result import Result
from acontext_core.schema.error_code import Code
from acontext_core.schema.block.sop_block import SOPData, SOPStep
from acontext_core.schema.orm.block import (
    BLOCK_TYPE_FOLDER,
    BLOCK_TYPE_PAGE,
    BLOCK_TYPE_SOP,
)
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import (
    create_new_path_block,
    _find_block_sort,
    move_path_block_to_new_parent,
    delete_block_recursively,
)
from acontext_core.service.data.block_write import write_sop_block_to_parent


class TestPageBlock:
    @pytest.mark.asyncio
    async def test_create_new_page_success(self, mock_block_get_embedding):
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

            # Create multiple pages to test sort ordering
            page_ids = []
            for i in range(3):
                r = await create_new_path_block(session, space.id, f"Test_Page_{i}")
                assert r.ok(), f"Failed to create new page: {r.error}"
                page_id = r.data.id
                assert page_id is not None
                page_ids.append(page_id)
            assert mock_block_get_embedding.await_count == 3
            # Verify pages were created with correct sort order
            for i, page_id in enumerate(page_ids):
                page = await session.get(Block, page_id)
                assert page is not None
                assert page.title == f"Test_Page_{i}"
                assert page.type == BLOCK_TYPE_PAGE
                assert page.sort == i
                assert page.parent_id is None

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_new_page_with_props(self):
        """Test creating a new page block with custom props"""
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

            props = {"custom_field": "custom_value", "count": 42}
            r = await create_new_path_block(
                session, space.id, "Page_with_Props", props=props
            )
            assert r.ok()
            page_id = r.data.id

            page = await session.get(Block, page_id)
            assert page.props == props

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_new_page_with_parent(self):
        """Test creating a new page block with a parent"""
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

            # Create parent page
            r = await create_new_path_block(
                session, space.id, "Parent_Page", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            parent_id = r.data.id

            # Create child pages
            child_ids = []
            for i in range(2):
                r = await create_new_path_block(
                    session, space.id, f"Child_Page_{i}", par_block_id=parent_id
                )
                assert r.ok()
                child_ids.append(r.data.id)

            # Verify children
            for i, child_id in enumerate(child_ids):
                child = await session.get(Block, child_id)
                assert child.parent_id == parent_id
                assert child.sort == i

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_new_page_invalid_parent(self):
        """Test creating a page with non-existent parent fails"""
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

            fake_parent_id = uuid.uuid4()
            r = await create_new_path_block(
                session, space.id, "Test_Page", par_block_id=fake_parent_id
            )
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)


class TestSOPBlock:
    @pytest.mark.asyncio
    async def test_write_sop_with_tool_sops(self):
        """Test creating SOP block with tool SOPs"""
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

            # Create parent page for SOP
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP data
            sop_data = SOPData(
                use_when="Testing SOP creation",
                preferences="Use best practices",
                tool_sops=[
                    SOPStep(tool_name="test_tool", action="run with debug=true"),
                    SOPStep(tool_name="another_tool", action="execute with retries=3"),
                ],
            )

            r = await write_sop_block_to_parent(session, space.id, parent_id, sop_data)
            assert r.ok(), f"Failed to write SOP: {r.error if not r.ok() else ''}"
            sop_block_id = r.data

            # Verify SOP block
            sop_block = await session.get(Block, sop_block_id)
            assert sop_block is not None
            assert sop_block.type == BLOCK_TYPE_SOP
            assert sop_block.title == "Testing SOP creation"
            assert sop_block.props["preferences"] == "Use best practices"
            assert sop_block.parent_id == parent_id

            # Verify tool references were created
            query = select(ToolReference).where(ToolReference.project_id == project.id)
            result = await session.execute(query)
            tool_refs = result.scalars().all()
            assert len(tool_refs) == 2
            tool_names = {tr.name for tr in tool_refs}
            assert tool_names == {"test_tool", "another_tool"}

            # Verify ToolSOP entries
            query = select(ToolSOP).where(ToolSOP.sop_block_id == sop_block_id)
            result = await session.execute(query)
            tool_sops = result.scalars().all()
            assert len(tool_sops) == 2

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_write_sop_preferences_only(self):
        """Test creating SOP block with only preferences (no tool SOPs)"""
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

            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            sop_data = SOPData(
                use_when="Preferences only SOP",
                preferences="Always use strict mode",
                tool_sops=[],
            )

            r = await write_sop_block_to_parent(session, space.id, parent_id, sop_data)
            assert r.ok()
            sop_block_id = r.data

            sop_block = await session.get(Block, sop_block_id)
            assert sop_block.props["preferences"] == "Always use strict mode"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_write_sop_reuses_existing_tool_reference(self):
        """Test that SOP creation reuses existing ToolReference"""
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

            # Create existing tool reference
            existing_tool = ToolReference(name="existing_tool", project_id=project.id)
            session.add(existing_tool)
            await session.flush()
            existing_tool_id = existing_tool.id

            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP using the existing tool
            sop_data = SOPData(
                use_when="Reuse tool test",
                preferences="",
                tool_sops=[
                    SOPStep(tool_name="existing_tool", action="run with param=value")
                ],
            )

            r = await write_sop_block_to_parent(session, space.id, parent_id, sop_data)
            assert r.ok()

            # Verify no new ToolReference was created
            query = select(func.count(ToolReference.id)).where(
                ToolReference.project_id == project.id
            )
            result = await session.execute(query)
            count = result.scalar()
            assert count == 1  # Still only one tool reference

            # Verify ToolSOP uses existing reference
            query = (
                select(ToolSOP)
                .join(ToolReference)
                .where(ToolReference.name == "existing_tool")
            )
            result = await session.execute(query)
            tool_sop = result.scalar()
            assert tool_sop.tool_reference_id == existing_tool_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_write_sop_multiple_with_sort(self):
        """Test creating multiple SOPs under same parent with correct sort order"""
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

            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create multiple SOPs
            sop_ids = []
            for i in range(3):
                sop_data = SOPData(
                    use_when=f"SOP {i}",
                    preferences=f"Preference {i}",
                    tool_sops=[],
                )
                r = await write_sop_block_to_parent(
                    session, space.id, parent_id, sop_data
                )
                assert r.ok()
                sop_ids.append(r.data)

            # Verify sort order
            for i, sop_id in enumerate(sop_ids):
                sop = await session.get(Block, sop_id)
                assert sop is not None
                assert sop.sort == i

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_write_sop_empty_data_fails(self):
        """Test that empty SOP data (no tool_sops and empty preferences) fails"""
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

            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            sop_data = SOPData(
                use_when="Empty SOP", preferences="   ", tool_sops=[]  # Only whitespace
            )

            r = await write_sop_block_to_parent(session, space.id, parent_id, sop_data)
            assert not r.ok()
            assert "empty" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_write_sop_empty_tool_name_fails(self):
        """Test that empty tool name fails"""
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

            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            sop_data = SOPData(
                use_when="Invalid tool",
                preferences="Test",
                tool_sops=[SOPStep(tool_name="  ", action="some action")],
            )

            r = await write_sop_block_to_parent(session, space.id, parent_id, sop_data)
            assert not r.ok()
            assert "empty" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_write_sop_tool_name_case_insensitive(self):
        """Test that tool names are normalized to lowercase"""
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

            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            sop_data = SOPData(
                use_when="Case test",
                preferences="Test",
                tool_sops=[SOPStep(tool_name="TestTool", action="run")],
            )

            r = await write_sop_block_to_parent(session, space.id, parent_id, sop_data)
            assert r.ok()

            # Verify tool name is lowercase
            query = select(ToolReference).where(ToolReference.project_id == project.id)
            result = await session.execute(query)
            tool_ref = result.scalar()
            assert tool_ref.name == "testtool"

            await session.delete(project)


class TestFindBlockSort:
    @pytest.mark.asyncio
    async def test_find_block_sort_no_parent(self):
        """Test _find_block_sort with no parent (root level)"""
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

            # First call should return 0
            r = await _find_block_sort(
                session, space.id, None, block_type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            assert r.unpack()[0] == 0

            # Create a page
            await create_new_path_block(session, space.id, "Page 1")

            # Second call should return 1
            r = await _find_block_sort(
                session, space.id, None, block_type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            assert r.unpack()[0] == 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_sort_with_parent(self):
        """Test _find_block_sort with a parent block"""
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

            # Create parent
            r = await create_new_path_block(
                session, space.id, "Parent", type=BLOCK_TYPE_FOLDER
            )
            parent_id = r.data.id

            # First child should get sort 0
            r = await _find_block_sort(session, space.id, parent_id, BLOCK_TYPE_PAGE)
            assert r.ok()
            assert r.unpack()[0] == 0

            # Create a child
            await create_new_path_block(
                session,
                space.id,
                "Child 1",
                par_block_id=parent_id,
                type=BLOCK_TYPE_PAGE,
            )

            # Second child should get sort 1
            r = await _find_block_sort(session, space.id, parent_id, BLOCK_TYPE_PAGE)
            assert r.ok()
            assert r.unpack()[0] == 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_sort_invalid_parent(self):
        """Test _find_block_sort with invalid parent ID"""
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

            fake_parent_id = uuid.uuid4()
            r = await _find_block_sort(
                session, space.id, fake_parent_id, BLOCK_TYPE_PAGE
            )
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)


class TestFolderBlock:
    @pytest.mark.asyncio
    async def test_create_new_folder_success(self):
        """Test creating a new folder block"""
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

            # Create folders to test sort ordering
            folder_ids = []
            for i in range(3):
                r = await create_new_path_block(
                    session, space.id, f"Test_Folder_{i}", type=BLOCK_TYPE_FOLDER
                )
                assert r.ok(), f"Failed to create new folder: {r.error}"
                folder_id = r.data.id
                assert folder_id is not None
                folder_ids.append(folder_id)

            # Verify folders were created with correct sort order
            for i, folder_id in enumerate(folder_ids):
                folder = await session.get(Block, folder_id)
                assert folder is not None
                assert folder.title == f"Test_Folder_{i}"
                assert folder.type == BLOCK_TYPE_FOLDER
                assert folder.sort == i
                assert folder.parent_id is None

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_nested_folders(self):
        """Test creating nested folder structure"""
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

            # Create parent folder
            r = await create_new_path_block(
                session, space.id, "Parent_Folder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            parent_id = r.data.id

            # Create child folders
            child_ids = []
            for i in range(2):
                r = await create_new_path_block(
                    session,
                    space.id,
                    f"Child_Folder_{i}",
                    par_block_id=parent_id,
                    type=BLOCK_TYPE_FOLDER,
                )
                assert r.ok()
                child_ids.append(r.data.id)

            # Verify children
            for i, child_id in enumerate(child_ids):
                child = await session.get(Block, child_id)
                assert child.parent_id == parent_id
                assert child.type == BLOCK_TYPE_FOLDER
                assert child.sort == i

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_page_in_folder(self):
        """Test creating a page inside a folder"""
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

            # Create folder
            r = await create_new_path_block(
                session, space.id, "Documents", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Create pages inside the folder
            page_ids = []
            for i in range(2):
                r = await create_new_path_block(
                    session,
                    space.id,
                    f"Document_{i}",
                    par_block_id=folder_id,
                    type=BLOCK_TYPE_PAGE,
                )
                assert r.ok()
                page_ids.append(r.data.id)

            # Verify pages are in the folder
            for i, page_id in enumerate(page_ids):
                page = await session.get(Block, page_id)
                assert page.parent_id == folder_id
                assert page.type == BLOCK_TYPE_PAGE
                assert page.title == f"Document_{i}"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_folder_with_props(self):
        """Test creating a folder with custom props"""
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

            props = {"color": "blue", "icon": "folder"}
            r = await create_new_path_block(
                session, space.id, "Special_Folder", props=props, type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            folder = await session.get(Block, folder_id)
            assert folder.props == props

            await session.delete(project)


class TestBlockParentChildRelationships:
    """Test various parent-child relationship constraints between blocks"""

    @pytest.mark.asyncio
    async def test_sop_with_folder_parent_fails(self):
        """Test that SOP cannot have a folder as parent (must be page)"""
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

            # Create folder
            r = await create_new_path_block(
                session, space.id, "Parent_Folder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Try to create SOP under folder (should fail)
            sop_data = SOPData(
                use_when="Testing invalid parent",
                preferences="Should fail",
                tool_sops=[],
            )
            r = await write_sop_block_to_parent(session, space.id, folder_id, sop_data)
            assert not r.ok()
            assert "not allowed" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_sop_with_root_parent_fails(self):
        """Test that SOP cannot be created at root level (must have page parent)"""
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

            # Try to create SOP at root level (should fail)
            sop_data = SOPData(
                use_when="Root level SOP",
                preferences="Should fail",
                tool_sops=[],
            )
            r = await write_sop_block_to_parent(session, space.id, None, sop_data)
            assert not r.ok()
            # Should fail because SOP requires a page parent

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_page_with_page_parent_fails(self):
        """Test that page cannot have another page as parent"""
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

            # Create parent page
            r = await create_new_path_block(
                session, space.id, "Parent_Page", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Try to create child page under page (should fail)
            r = await create_new_path_block(
                session,
                space.id,
                "Child_Page",
                par_block_id=page_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert not r.ok()
            assert "not allowed" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_folder_with_page_parent_fails(self):
        """Test that folder cannot have a page as parent"""
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

            # Create parent page
            r = await create_new_path_block(
                session, space.id, "Parent_Page", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Try to create folder under page (should fail)
            r = await create_new_path_block(
                session,
                space.id,
                "Child_Folder",
                par_block_id=page_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert not r.ok()
            assert "not allowed" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_text_block_with_page_parent_success(self):
        """Test creating a text block under a page (valid relationship)"""
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

            # Create parent page
            r = await create_new_path_block(
                session, space.id, "Parent_Page", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Create text block under page (should succeed)
            from acontext_core.schema.orm.block import BLOCK_TYPE_TEXT

            props = {"preferences": "Use proper grammar"}
            r = await create_new_path_block(
                session,
                space.id,
                "Text_Block",
                par_block_id=page_id,
                type=BLOCK_TYPE_TEXT,
                props=props,
            )
            assert r.ok()
            text_id = r.data.id

            # Verify the text block
            text_block = await session.get(Block, text_id)
            assert text_block is not None
            assert text_block.type == BLOCK_TYPE_TEXT
            assert text_block.parent_id == page_id
            assert text_block.props["preferences"] == "Use proper grammar"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_text_block_with_folder_parent_fails(self):
        """Test that text block cannot have a folder as parent (must be page)"""
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

            # Create folder
            r = await create_new_path_block(
                session, space.id, "Parent_Folder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Try to create text block under folder (should fail)
            from acontext_core.schema.orm.block import BLOCK_TYPE_TEXT

            r = await create_new_path_block(
                session,
                space.id,
                "Text_Block",
                par_block_id=folder_id,
                type=BLOCK_TYPE_TEXT,
            )
            assert not r.ok()
            assert "not allowed" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_text_block_with_root_parent_fails(self):
        """Test that text block cannot be created at root level (must have page parent)"""
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

            # Try to create text block at root level (should fail)
            from acontext_core.schema.orm.block import BLOCK_TYPE_TEXT

            r = await create_new_path_block(
                session, space.id, "Root_Text_Block", type=BLOCK_TYPE_TEXT
            )
            assert not r.ok()
            # Should fail because TEXT requires a page parent

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_multiple_text_blocks_under_page(self):
        """Test creating multiple text blocks under the same page with proper sorting"""
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

            # Create parent page
            r = await create_new_path_block(
                session, space.id, "Parent_Page", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Create multiple text blocks
            from acontext_core.schema.orm.block import BLOCK_TYPE_TEXT

            text_ids = []
            for i in range(3):
                r = await create_new_path_block(
                    session,
                    space.id,
                    f"Text_Block_{i}",
                    par_block_id=page_id,
                    type=BLOCK_TYPE_TEXT,
                    props={"preferences": f"Preference_{i}"},
                )
                assert r.ok()
                text_ids.append(r.data.id)

            # Verify sort order
            for i, text_id in enumerate(text_ids):
                text_block = await session.get(Block, text_id)
                assert text_block is not None
                assert text_block.sort == i
                assert text_block.parent_id == page_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_mixed_children_under_page(self):
        """Test that a page can have both SOP and TEXT children with proper sorting"""
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

            # Create parent page
            r = await create_new_path_block(
                session, space.id, "Parent_Page", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Create text block
            from acontext_core.schema.orm.block import BLOCK_TYPE_TEXT

            r = await create_new_path_block(
                session,
                space.id,
                "Text_Block",
                par_block_id=page_id,
                type=BLOCK_TYPE_TEXT,
                props={"preferences": "Test"},
            )
            assert r.ok()
            text_id = r.data.id

            # Create SOP block
            sop_data = SOPData(
                use_when="Mixed content test",
                preferences="SOP preferences",
                tool_sops=[],
            )
            r = await write_sop_block_to_parent(session, space.id, page_id, sop_data)
            assert r.ok()
            sop_id = r.data

            # Verify both children exist with proper sort
            text_block = await session.get(Block, text_id)
            assert text_block.parent_id == page_id
            assert text_block.sort == 0

            sop_block = await session.get(Block, sop_id)
            assert sop_block.parent_id == page_id
            assert sop_block.sort == 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_deep_folder_nesting(self):
        """Test creating deeply nested folder structure"""
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

            # Create nested folders: Root -> Folder1 -> Folder2 -> Folder3
            parent_id = None
            folder_ids = []
            for i in range(4):
                r = await create_new_path_block(
                    session,
                    space.id,
                    f"Folder_Level_{i}",
                    par_block_id=parent_id,
                    type=BLOCK_TYPE_FOLDER,
                )
                assert r.ok()
                folder_id = r.data.id
                folder_ids.append(folder_id)
                parent_id = folder_id  # Next folder will be child of this one

            # Verify the hierarchy
            for i, folder_id in enumerate(folder_ids):
                folder = await session.get(Block, folder_id)
                if i == 0:
                    assert folder.parent_id is None  # First folder is at root
                else:
                    assert folder.parent_id == folder_ids[i - 1]  # Child of previous

            await session.delete(project)


class TestMovePathBlock:
    """Test moving path blocks (pages and folders) to new parents"""

    @pytest.mark.asyncio
    async def test_move_page_to_folder_success(self):
        """Test successfully moving a page to a new folder parent"""
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

            # Create two folders
            r = await create_new_path_block(
                session, space.id, "Folder1", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder1_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "Folder2", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder2_id = r.data.id

            # Create a page in Folder1
            r = await create_new_path_block(
                session, space.id, "Page1", par_block_id=folder1_id
            )
            assert r.ok()
            page_id = r.data.id

            # Verify initial parent
            page = await session.get(Block, page_id)
            assert page.parent_id == folder1_id

            # Move page to Folder2
            r = await move_path_block_to_new_parent(
                session, space.id, page_id, folder2_id
            )
            assert r.ok()

            # Verify page was moved
            await session.refresh(page)
            assert page.parent_id == folder2_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_folder_to_folder_success(self):
        """Test successfully moving a folder to a new folder parent"""
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

            # Create folders: ParentFolder, ChildFolder (initially at root)
            r = await create_new_path_block(
                session, space.id, "ParentFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            parent_folder_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "ChildFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            child_folder_id = r.data.id

            # Verify ChildFolder is at root level
            child_folder = await session.get(Block, child_folder_id)
            assert child_folder.parent_id is None

            # Move ChildFolder into ParentFolder
            r = await move_path_block_to_new_parent(
                session, space.id, child_folder_id, parent_folder_id
            )
            assert r.ok()

            # Verify folder was moved
            await session.refresh(child_folder)
            assert child_folder.parent_id == parent_folder_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_page_block_not_found(self):
        """Test moving a non-existent page fails"""
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

            # Create a folder
            r = await create_new_path_block(
                session, space.id, "Folder1", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Try to move non-existent page
            fake_page_id = uuid.uuid4()
            r = await move_path_block_to_new_parent(
                session, space.id, fake_page_id, folder_id
            )
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_invalid_block_type(self):
        """Test moving a block that is not a folder or page fails"""
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

            # Create a page and a folder
            r = await create_new_path_block(
                session, space.id, "ParentPage", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "TargetFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Create an SOP block under the page
            sop_data = SOPData(
                use_when="Test SOP",
                preferences="Test preferences",
                tool_sops=[],
            )
            r = await write_sop_block_to_parent(session, space.id, page_id, sop_data)
            assert r.ok()
            sop_id = r.data

            # Try to move SOP block (should fail - only folders and pages can be moved)
            r = await move_path_block_to_new_parent(
                session, space.id, sop_id, folder_id
            )
            assert not r.ok()
            assert "not a folder or page" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_page_to_non_folder_fails(self):
        """Test moving a page to a non-folder parent fails"""
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

            # Create two pages
            r = await create_new_path_block(
                session, space.id, "Page1", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page1_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "Page2", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page2_id = r.data.id

            # Try to move Page2 into Page1 (should fail - pages can't be parents)
            r = await move_path_block_to_new_parent(
                session, space.id, page2_id, page1_id
            )
            assert not r.ok()
            # The error message should indicate that the parent is not a folder

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_page_to_nonexistent_parent_fails(self):
        """Test moving a page to a non-existent parent fails"""
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
                session, space.id, "Page1", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id

            # Try to move to non-existent parent
            fake_parent_id = uuid.uuid4()
            r = await move_path_block_to_new_parent(
                session, space.id, page_id, fake_parent_id
            )
            assert not r.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_folder_to_its_own_child_fails(self):
        """Test moving a folder into its own child creates a cycle and fails"""
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

            # Create folder hierarchy: Parent -> Child -> Grandchild
            r = await create_new_path_block(
                session, space.id, "Parent", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            parent_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "Child",
                par_block_id=parent_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert r.ok()
            child_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "Grandchild",
                par_block_id=child_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert r.ok()
            grandchild_id = r.data.id

            # Try to move Parent into Child (would create cycle)
            r = await move_path_block_to_new_parent(
                session, space.id, parent_id, child_id
            )
            assert not r.ok()
            assert "cycle" in r.error.errmsg.lower()

            # Try to move Parent into Grandchild (would create cycle)
            r = await move_path_block_to_new_parent(
                session, space.id, parent_id, grandchild_id
            )
            assert not r.ok()
            assert "cycle" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_folder_to_itself_fails(self):
        """Test moving a folder to itself fails"""
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

            # Create a folder
            r = await create_new_path_block(
                session, space.id, "Folder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Try to move folder into itself (cycle detection)
            r = await move_path_block_to_new_parent(
                session, space.id, folder_id, folder_id
            )
            assert not r.ok()
            assert "cycle" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_page_with_children(self):
        """Test moving a folder with children successfully moves the entire subtree"""
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

            # Create folder structure: Folder1 with Page1, and Folder2 (target)
            r = await create_new_path_block(
                session, space.id, "Folder1", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder1_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "Page1", par_block_id=folder1_id
            )
            assert r.ok()
            page1_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "Folder2", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder2_id = r.data.id

            # Move Folder1 (with its child Page1) into Folder2
            r = await move_path_block_to_new_parent(
                session, space.id, folder1_id, folder2_id
            )
            assert r.ok()

            # Verify Folder1's parent changed
            folder1 = await session.get(Block, folder1_id)
            assert folder1.parent_id == folder2_id

            # Verify Page1 is still a child of Folder1 (not affected by the move)
            page1 = await session.get(Block, page1_id)
            assert page1.parent_id == folder1_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_multiple_pages_to_same_folder(self):
        """Test moving multiple pages to the same folder"""
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

            # Create a target folder
            r = await create_new_path_block(
                session, space.id, "TargetFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            target_folder_id = r.data.id

            # Create multiple pages at root level
            page_ids = []
            for i in range(3):
                r = await create_new_path_block(
                    session, space.id, f"Page{i}", type=BLOCK_TYPE_PAGE
                )
                assert r.ok()
                page_ids.append(r.data.id)

            # Move all pages to TargetFolder
            for page_id in page_ids[::-1]:
                r = await move_path_block_to_new_parent(
                    session, space.id, page_id, target_folder_id
                )
                assert r.ok()

            # Verify all pages are now in TargetFolder
            for page_id in page_ids:
                page = await session.get(Block, page_id)
                assert page.parent_id == target_folder_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_pages_to_same_folder_with_sort(self):
        """Test moving multiple pages to the same folder"""
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

            r = await create_new_path_block(
                session, space.id, "Page 0", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            page_id = r.data.id  # sort=0
            # Create a target folder
            r = await create_new_path_block(
                session, space.id, "TargetFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            target_folder_id = r.data.id  # sort=1

            # Create multiple pages
            for i in range(3):
                r = await create_new_path_block(
                    session,
                    space.id,
                    f"Page{i}",
                    type=BLOCK_TYPE_PAGE,
                    par_block_id=target_folder_id,
                )
                assert r.ok()

            # Move all pages to TargetFolder
            r = await move_path_block_to_new_parent(
                session, space.id, page_id, target_folder_id
            )
            assert r.ok()
            page = r.data

            # Verify all pages are now in TargetFolder
            assert page.title == "Page_0"
            assert page.parent_id == target_folder_id
            assert page.sort == 3

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_move_page_updates_original_parent_children_sort(self):
        """Test that moving a page updates the sort order of remaining children in the original parent"""
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

            # Create source folder with 4 pages
            r = await create_new_path_block(
                session, space.id, "SourceFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            source_folder_id = r.data.id

            # Create 4 pages in SourceFolder (sort: 0, 1, 2, 3)
            page_ids = []
            for i in range(4):
                r = await create_new_path_block(
                    session,
                    space.id,
                    f"Page{i}",
                    type=BLOCK_TYPE_PAGE,
                    par_block_id=source_folder_id,
                )
                assert r.ok()
                page_ids.append(r.data.id)

            # Verify initial sort order
            for i, page_id in enumerate(page_ids):
                page = await session.get(Block, page_id)
                assert page.sort == i, f"Page{i} should have sort={i}"
                assert page.parent_id == source_folder_id

            # Create target folder
            r = await create_new_path_block(
                session, space.id, "TargetFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            target_folder_id = r.data.id

            # Move Page1 (sort=1) to TargetFolder
            r = await move_path_block_to_new_parent(
                session, space.id, page_ids[1], target_folder_id
            )
            assert r.ok()

            # Verify moved page is now in TargetFolder with sort=0
            moved_page = await session.get(Block, page_ids[1])
            assert moved_page.parent_id == target_folder_id
            assert (
                moved_page.sort == 0
            ), "Moved page should be first child in target folder"

            # Verify remaining children in SourceFolder have updated sort values
            # Page0 (originally sort=0) should remain at sort=0
            page0 = await session.get(Block, page_ids[0])
            assert page0.parent_id == source_folder_id
            assert page0.sort == 0, "Page0 should remain at sort=0"

            # Page2 (originally sort=2) should now be at sort=1
            page2 = await session.get(Block, page_ids[2])
            assert page2.parent_id == source_folder_id
            assert page2.sort == 1, "Page2 should be decremented to sort=1"

            # Page3 (originally sort=3) should now be at sort=2
            page3 = await session.get(Block, page_ids[3])
            assert page3.parent_id == source_folder_id
            assert page3.sort == 2, "Page3 should be decremented to sort=2"

            # Verify there are exactly 3 children left in SourceFolder
            query = select(func.count()).where(Block.parent_id == source_folder_id)
            result = await session.execute(query)
            count = result.scalar()
            assert count == 3, "SourceFolder should have 3 children after move"

            await session.delete(project)


class TestDeleteBlock:
    @pytest.mark.asyncio
    async def test_delete_simple_page(self):
        """Test deleting a simple page block"""
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

            # Create pages
            r = await create_new_path_block(session, space.id, "Page_0")
            assert r.ok()
            page0_id = r.data.id

            r = await create_new_path_block(session, space.id, "Page_1")
            assert r.ok()
            page1_id = r.data.id

            r = await create_new_path_block(session, space.id, "Page_2")
            assert r.ok()
            page2_id = r.data.id

            # Delete the middle page
            r = await delete_block_recursively(session, space.id, page1_id)
            assert r.ok()

            # Verify page is deleted
            deleted_page = await session.get(Block, page1_id)
            assert deleted_page is None

            # Verify embedding is deleted
            query = select(BlockEmbedding).where(BlockEmbedding.block_id == page1_id)
            result = await session.execute(query)
            embeddings = result.scalars().all()
            assert len(embeddings) == 0

            # Verify other pages still exist
            page0 = await session.get(Block, page0_id)
            assert page0 is not None
            assert page0.sort == 0

            page2 = await session.get(Block, page2_id)
            assert page2 is not None
            assert page2.sort == 1  # Should be decremented from 2 to 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_folder_with_children(self):
        """Test deleting a folder with child pages"""
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

            # Create a folder
            r = await create_new_path_block(
                session, space.id, "TestFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Create child pages
            child_ids = []
            for i in range(3):
                r = await create_new_path_block(
                    session, space.id, f"ChildPage_{i}", par_block_id=folder_id
                )
                assert r.ok()
                child_ids.append(r.data.id)

            # Delete the folder
            r = await delete_block_recursively(session, space.id, folder_id)
            assert r.ok()

            # Verify folder is deleted
            deleted_folder = await session.get(Block, folder_id)
            assert deleted_folder is None

            # Verify all children are deleted
            for child_id in child_ids:
                deleted_child = await session.get(Block, child_id)
                assert deleted_child is None

            # Verify embeddings are deleted for all blocks
            for block_id in [folder_id] + child_ids:
                query = select(BlockEmbedding).where(
                    BlockEmbedding.block_id == block_id
                )
                result = await session.execute(query)
                embeddings = result.scalars().all()
                assert len(embeddings) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_nested_folder_structure(self):
        """Test deleting a deeply nested folder structure"""
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

            # Create root folder
            r = await create_new_path_block(
                session, space.id, "RootFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            root_folder_id = r.data.id

            # Create nested folders
            r = await create_new_path_block(
                session,
                space.id,
                "SubFolder1",
                type=BLOCK_TYPE_FOLDER,
                par_block_id=root_folder_id,
            )
            assert r.ok()
            sub_folder1_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "SubFolder2",
                type=BLOCK_TYPE_FOLDER,
                par_block_id=sub_folder1_id,
            )
            assert r.ok()
            sub_folder2_id = r.data.id

            # Create pages at different levels
            r = await create_new_path_block(
                session, space.id, "RootPage", par_block_id=root_folder_id
            )
            assert r.ok()
            root_page_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "SubPage1", par_block_id=sub_folder1_id
            )
            assert r.ok()
            sub_page1_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "SubPage2", par_block_id=sub_folder2_id
            )
            assert r.ok()
            sub_page2_id = r.data.id

            all_block_ids = [
                root_folder_id,
                sub_folder1_id,
                sub_folder2_id,
                root_page_id,
                sub_page1_id,
                sub_page2_id,
            ]

            # Delete the root folder
            r = await delete_block_recursively(session, space.id, root_folder_id)
            assert r.ok()

            # Verify all blocks are deleted
            for block_id in all_block_ids:
                deleted_block = await session.get(Block, block_id)
                assert deleted_block is None, f"Block {block_id} should be deleted"

            # Verify all embeddings are deleted
            for block_id in all_block_ids:
                query = select(BlockEmbedding).where(
                    BlockEmbedding.block_id == block_id
                )
                result = await session.execute(query)
                embeddings = result.scalars().all()
                assert len(embeddings) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_page_with_sop_blocks(self):
        """Test deleting a page that has SOP blocks"""
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
            r = await create_new_path_block(session, space.id, "PageWithSOP")
            assert r.ok()
            page_id = r.data.id

            # Create SOP blocks
            sop_data = SOPData(
                use_when="When doing task X",
                preferences="Follow best practices",
                tool_sops=[
                    SOPStep(tool_name="tool1", action="Do action 1"),
                    SOPStep(tool_name="tool2", action="Do action 2"),
                ],
            )
            r = await write_sop_block_to_parent(session, space.id, page_id, sop_data)
            assert r.ok()
            sop_block_id = r.data

            # Delete the page
            r = await delete_block_recursively(session, space.id, page_id)
            assert r.ok()

            # Verify page is deleted
            deleted_page = await session.get(Block, page_id)
            assert deleted_page is None

            # Verify SOP block is deleted
            deleted_sop = await session.get(Block, sop_block_id)
            assert deleted_sop is None

            # Verify ToolSOP entries are deleted
            query = select(ToolSOP).where(ToolSOP.sop_block_id == sop_block_id)
            result = await session.execute(query)
            tool_sops = result.scalars().all()
            assert len(tool_sops) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_block_not_found(self):
        """Test deleting a non-existent block"""
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

            # Try to delete a non-existent block
            fake_id = uuid.uuid4()
            r = await delete_block_recursively(session, space.id, fake_id)
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_block_wrong_space(self):
        """Test deleting a block from the wrong space"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space1 = Space(project_id=project.id)
            session.add(space1)
            await session.flush()

            space2 = Space(project_id=project.id)
            session.add(space2)
            await session.flush()

            # Create a page in space1
            r = await create_new_path_block(session, space1.id, "Page")
            assert r.ok()
            page_id = r.data.id

            # Try to delete from space2
            r = await delete_block_recursively(session, space2.id, page_id)
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            # Verify page still exists in space1
            page = await session.get(Block, page_id)
            assert page is not None
            assert page.space_id == space1.id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_block_sort_order_adjustment(self):
        """Test that sort order is correctly adjusted after deletion"""
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

            # Create a folder
            r = await create_new_path_block(
                session, space.id, "Folder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Create multiple pages in the folder
            page_ids = []
            for i in range(5):
                r = await create_new_path_block(
                    session, space.id, f"Page_{i}", par_block_id=folder_id
                )
                assert r.ok()
                page_ids.append(r.data.id)

            # Verify initial sort order
            for i, page_id in enumerate(page_ids):
                page = await session.get(Block, page_id)
                assert page.sort == i

            # Delete Page_2 (sort=2)
            r = await delete_block_recursively(session, space.id, page_ids[2])
            assert r.ok()

            # Verify sort order is adjusted
            page0 = await session.get(Block, page_ids[0])
            assert page0.sort == 0

            page1 = await session.get(Block, page_ids[1])
            assert page1.sort == 1

            # page_ids[2] is deleted

            page3 = await session.get(Block, page_ids[3])
            assert page3.sort == 2  # Decremented from 3

            page4 = await session.get(Block, page_ids[4])
            assert page4.sort == 3  # Decremented from 4

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_delete_multiple_blocks_in_sequence(self):
        """Test deleting multiple blocks in sequence"""
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

            # Create pages
            page_ids = []
            for i in range(5):
                r = await create_new_path_block(session, space.id, f"Page_{i}")
                assert r.ok()
                page_ids.append(r.data.id)

            # Delete pages 1, 3, and 4
            for idx in [1, 3, 4]:
                r = await delete_block_recursively(session, space.id, page_ids[idx])
                assert r.ok()

            # Verify only pages 0 and 2 remain
            page0 = await session.get(Block, page_ids[0])
            assert page0 is not None
            assert page0.sort == 0

            page2 = await session.get(Block, page_ids[2])
            assert page2 is not None
            assert page2.sort == 1

            # Verify deleted pages
            for idx in [1, 3, 4]:
                deleted_page = await session.get(Block, page_ids[idx])
                assert deleted_page is None

            await session.delete(project)
