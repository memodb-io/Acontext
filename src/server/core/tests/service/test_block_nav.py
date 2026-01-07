import pytest
from acontext_core.schema.orm import Block, Project, Space
from acontext_core.schema.orm.block import (
    BLOCK_TYPE_FOLDER,
    BLOCK_TYPE_PAGE,
    BLOCK_TYPE_TEXT,
    BLOCK_TYPE_SOP,
    BLOCK_TYPE_REFERENCE,
)
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import create_new_path_block
from acontext_core.schema.block.path_node import repr_path_tree
from acontext_core.service.data.block_nav import (
    list_paths_under_block,
    get_path_info_by_id,
    read_blocks_from_par_id,
)


class TestBlockNav:
    @pytest.mark.asyncio
    async def test_list_paths_under_block_basic(self):
        """Test listing paths under a block with folders and pages"""
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

            # Create folder structure:
            # - Folder1/
            #   - Page1
            #   - Page2
            #   - SubFolder/
            #     - Page3
            # - Page4

            # Create Folder1
            r = await create_new_path_block(
                session, space.id, "Folder1", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder1_id = r.data.id

            # Create Page1 and Page2 under Folder1
            r = await create_new_path_block(
                session, space.id, "Page1", par_block_id=folder1_id
            )
            assert r.ok()
            page1_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "Page2", par_block_id=folder1_id
            )
            assert r.ok()
            page2_id = r.data.id

            # Create SubFolder under Folder1
            r = await create_new_path_block(
                session,
                space.id,
                "SubFolder",
                type=BLOCK_TYPE_FOLDER,
                par_block_id=folder1_id,
            )
            assert r.ok()
            subfolder_id = r.data.id

            # Create Page3 under SubFolder
            r = await create_new_path_block(
                session, space.id, "Page3", par_block_id=subfolder_id
            )
            assert r.ok()
            page3_id = r.data.id

            # Create Page4 at root level
            r = await create_new_path_block(session, space.id, "Page4")
            assert r.ok()
            page4_id = r.data.id

            # Test 1: List all paths at root level with depth=0 (no recursion)
            r = await list_paths_under_block(session, space.id, None, "", depth=0)
            assert r.ok()
            paths, sub_page_num, sub_folder_num = r.data

            # Should have 1 folder (Folder1) and 1 page (Page4) at root
            assert sub_folder_num == 1
            assert sub_page_num == 1
            assert "Page4" in paths
            assert paths["Page4"].id == page4_id
            assert paths["Page4"].type == BLOCK_TYPE_PAGE

            # Test 2: List paths under Folder1 with depth=0
            r = await list_paths_under_block(
                session, space.id, folder1_id, "Folder1/", depth=0
            )
            assert r.ok()
            paths, sub_page_num, sub_folder_num = r.data

            # Should have 1 folder (SubFolder) and 2 pages (Page1, Page2)
            assert sub_folder_num == 1
            assert sub_page_num == 2
            assert "Folder1/Page1" in paths
            assert "Folder1/Page2" in paths
            assert paths["Folder1/Page1"].id == page1_id
            assert paths["Folder1/Page2"].id == page2_id

            # Test 3: List paths under Folder1 with depth=1 (recurse into SubFolder)
            r = await list_paths_under_block(
                session, space.id, folder1_id, "Folder1/", depth=1
            )
            assert r.ok()
            paths, sub_page_num, sub_folder_num = r.data

            # Should include Page3 from SubFolder
            assert "Folder1/Page1" in paths
            assert "Folder1/Page2" in paths
            assert "Folder1/SubFolder/" in paths
            assert "Folder1/SubFolder/Page3" in paths
            assert paths["Folder1/SubFolder/Page3"].id == page3_id
            assert paths["Folder1/SubFolder/"].sub_page_num == 1
            assert paths["Folder1/SubFolder/"].sub_folder_num == 0

            # Test 4: List all paths from root with depth=2 (full tree)
            # Create Page3 under SubFolder
            r = await create_new_path_block(
                session,
                space.id,
                "Dir5",
                par_block_id=subfolder_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert r.ok()
            dir5_id = r.data.id
            r = await create_new_path_block(
                session, space.id, "Page5", par_block_id=dir5_id
            )
            assert r.ok()
            r = await create_new_path_block(
                session, space.id, "Dir6", par_block_id=dir5_id, type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()

            r = await list_paths_under_block(session, space.id, None, "", depth=2)
            assert r.ok()
            paths, sub_page_num, sub_folder_num = r.data

            print(repr_path_tree(paths))
            # Should have all pages accessible from root
            assert "Page4" in paths
            assert "Folder1/" in paths
            assert "Folder1/Page1" in paths
            assert "Folder1/Page2" in paths
            assert "Folder1/SubFolder/" in paths
            assert "Folder1/SubFolder/Page3" in paths

            # Clean up
            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_paths_empty_space(self):
        """Test listing paths in an empty space"""
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

            # List paths in empty space
            r = await list_paths_under_block(session, space.id, None, "", depth=0)
            assert r.ok()
            paths, sub_page_num, sub_folder_num = r.data

            assert len(paths) == 0
            assert sub_page_num == 0
            assert sub_folder_num == 0

            # Clean up
            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_path_info_by_id_basic(self):
        """Test getting path info for a page and folder by ID"""
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

            # Create a folder structure:
            # - TestFolder/
            #   - TestPage

            # Create TestFolder
            r = await create_new_path_block(
                session, space.id, "TestFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Create TestPage under TestFolder
            r = await create_new_path_block(
                session, space.id, "TestPage", par_block_id=folder_id
            )
            assert r.ok()
            page_id = r.data.id

            # Test 1: Get path info for the page
            r = await get_path_info_by_id(session, space.id, page_id)
            assert r.ok()
            path_str, path_node = r.data

            assert path_str == "/TestFolder/TestPage"
            assert path_node.id == page_id
            assert path_node.title == "TestPage"
            assert path_node.type == BLOCK_TYPE_PAGE
            assert path_node.sub_page_num == 0
            assert path_node.sub_folder_num == 0

            # Test 2: Get path info for the folder
            r = await get_path_info_by_id(session, space.id, folder_id)
            assert r.ok()
            path_str, path_node = r.data

            assert path_str == "/TestFolder/"
            assert path_node.id == folder_id
            assert path_node.title == "TestFolder"
            assert path_node.type == BLOCK_TYPE_FOLDER
            assert path_node.sub_page_num == 1  # Contains TestPage
            assert path_node.sub_folder_num == 0

            # Clean up
            await session.delete(project)

    @pytest.mark.asyncio
    async def test_read_blocks_from_par_id(self):
        """Test reading blocks from a parent block with type filtering"""
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

            # Create a parent page block
            r = await create_new_path_block(
                session, space.id, "ParentPage", type=BLOCK_TYPE_PAGE
            )
            assert r.ok()
            parent_id = r.data.id

            # Create child blocks of different types
            # Text block 1
            text_block_1 = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_TEXT,
                title="Text Block 1",
                sort=0,
            )
            session.add(text_block_1)
            await session.flush()

            # Text block 2
            text_block_2 = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_TEXT,
                title="Text Block 2",
                sort=1,
            )
            session.add(text_block_2)
            await session.flush()

            # SOP block
            sop_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_SOP,
                title="SOP Block",
                sort=2,
            )
            session.add(sop_block)
            await session.flush()

            # Reference block (not in CONTENT_BLOCK)
            ref_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_REFERENCE,
                title="Reference Block",
                sort=3,
            )
            session.add(ref_block)
            await session.flush()

            # Test 1: Read all content blocks (default behavior)
            r = await read_blocks_from_par_id(session, space.id, parent_id)
            assert r.ok()
            blocks = r.data

            # Should return only TEXT and SOP blocks (CONTENT_BLOCK)
            assert len(blocks) == 3
            assert blocks[0].id == text_block_1.id
            assert blocks[0].type == BLOCK_TYPE_TEXT
            assert blocks[1].id == text_block_2.id
            assert blocks[1].type == BLOCK_TYPE_TEXT
            assert blocks[2].id == sop_block.id
            assert blocks[2].type == BLOCK_TYPE_SOP

            # Test 2: Read only TEXT blocks
            r = await read_blocks_from_par_id(
                session, space.id, parent_id, allowed_types={BLOCK_TYPE_TEXT}
            )
            assert r.ok()
            blocks = r.data

            assert len(blocks) == 2
            assert blocks[0].type == BLOCK_TYPE_TEXT
            assert blocks[1].type == BLOCK_TYPE_TEXT
            assert blocks[0].id == text_block_1.id
            assert blocks[1].id == text_block_2.id

            # Test 3: Read only SOP blocks
            r = await read_blocks_from_par_id(
                session, space.id, parent_id, allowed_types={BLOCK_TYPE_SOP}
            )
            assert r.ok()
            blocks = r.data

            assert len(blocks) == 1
            assert blocks[0].type == BLOCK_TYPE_SOP
            assert blocks[0].id == sop_block.id

            # Test 4: Read REFERENCE blocks
            r = await read_blocks_from_par_id(
                session, space.id, parent_id, allowed_types={BLOCK_TYPE_REFERENCE}
            )
            assert r.ok()
            blocks = r.data

            assert len(blocks) == 1
            assert blocks[0].type == BLOCK_TYPE_REFERENCE
            assert blocks[0].id == ref_block.id

            # Test 5: Read with empty allowed_types (should return empty)
            r = await read_blocks_from_par_id(
                session, space.id, parent_id, allowed_types=set()
            )
            assert r.ok()
            blocks = r.data

            assert len(blocks) == 0

            # Test 6: Read from non-existent parent (should return empty)
            import uuid

            non_existent_id = uuid.uuid4()
            r = await read_blocks_from_par_id(session, space.id, non_existent_id)
            assert r.ok()
            blocks = r.data

            assert len(blocks) == 0

            # Clean up
            await session.delete(project)
