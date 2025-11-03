import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from acontext_core.schema.orm import Block, Project, Space
from acontext_core.schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import create_new_path_block
from acontext_core.schema.block.path_node import repr_path_tree
from acontext_core.service.data.block_nav import list_paths_under_block


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
