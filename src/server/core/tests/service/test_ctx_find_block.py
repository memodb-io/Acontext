import pytest
import uuid
from acontext_core.schema.orm import Block, Project, Space
from acontext_core.schema.orm.block import BLOCK_TYPE_FOLDER, BLOCK_TYPE_PAGE
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import create_new_path_block
from acontext_core.llm.tool.space_lib.ctx import SpaceCtx


class TestSpaceCtxFindBlock:
    """Test SpaceCtx.find_block method for finding blocks by path"""

    @pytest.mark.asyncio
    async def test_find_page_at_root(self, mock_block_get_embedding):
        """Test finding a page at root level"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a page at root
            r = await create_new_path_block(session, space.id, "TestPage")
            assert r.ok()
            page_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block
            r = await ctx.find_block("TestPage")
            assert r.ok()
            path_node = r.data
            assert path_node.id == page_id
            assert path_node.title == "TestPage"
            assert path_node.type == BLOCK_TYPE_PAGE

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_folder_at_root(self):
        """Test finding a folder at root level"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a folder at root
            r = await create_new_path_block(
                session, space.id, "TestFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block with trailing slash (folder notation)
            r = await ctx.find_block("TestFolder/")
            assert r.ok()
            path_node = r.data
            assert path_node.id == folder_id
            assert path_node.title == "TestFolder"
            assert path_node.type == BLOCK_TYPE_FOLDER

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_page_in_folder(self):
        """Test finding a page inside a folder"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
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

            # Create page in folder
            r = await create_new_path_block(
                session,
                space.id,
                "Report",
                par_block_id=folder_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            page_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block
            r = await ctx.find_block("Documents/Report")
            assert r.ok()
            path_node = r.data
            assert path_node.id == page_id
            assert path_node.title == "Report"
            assert path_node.type == BLOCK_TYPE_PAGE

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_nested_folders(self):
        """Test finding deeply nested folders"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create nested structure: Level1/Level2/Level3/
            r = await create_new_path_block(
                session, space.id, "Level1", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            level1_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "Level2",
                par_block_id=level1_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert r.ok()
            level2_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "Level3",
                par_block_id=level2_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert r.ok()
            level3_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block at each level
            r = await ctx.find_block("Level1/")
            assert r.ok()
            assert r.data.id == level1_id
            assert r.data.title == "Level1"

            r = await ctx.find_block("Level1/Level2/")
            assert r.ok()
            assert r.data.id == level2_id
            assert r.data.title == "Level2"

            r = await ctx.find_block("Level1/Level2/Level3/")
            assert r.ok()
            assert r.data.id == level3_id
            assert r.data.title == "Level3"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_page_in_nested_folders(self):
        """Test finding a page in deeply nested folders"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create structure: Projects/2024/Q4/Report
            r = await create_new_path_block(
                session, space.id, "Projects", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            projects_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "2024",
                par_block_id=projects_id,
                type=BLOCK_TYPE_FOLDER,
            )
            assert r.ok()
            year_id = r.data.id

            r = await create_new_path_block(
                session, space.id, "Q4", par_block_id=year_id, type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            quarter_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "Report",
                par_block_id=quarter_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            page_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block
            r = await ctx.find_block("Projects/2024/Q4/Report")
            assert r.ok()
            path_node = r.data
            assert path_node.id == page_id
            assert path_node.title == "Report"
            assert path_node.type == BLOCK_TYPE_PAGE

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_caching(self):
        """Test that find_block caches results"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a page
            r = await create_new_path_block(session, space.id, "CachedPage")
            assert r.ok()
            page_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # First call should fetch from DB
            r1 = await ctx.find_block("CachedPage")
            assert r1.ok()
            assert len(ctx.path_2_block_ids) == 1
            assert "CachedPage" in ctx.path_2_block_ids

            # Second call should use cache
            r2 = await ctx.find_block("CachedPage")
            assert r2.ok()
            # Both results should be the same
            assert r1.data.id == r2.data.id
            assert r1.data.title == r2.data.title

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_nonexistent_page(self):
        """Test finding a page that doesn't exist"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block for non-existent page
            r = await ctx.find_block("NonExistentPage")
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_nonexistent_folder(self):
        """Test finding a folder that doesn't exist"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block for non-existent folder
            r = await ctx.find_block("NonExistentFolder/")
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_partial_path_not_exists(self):
        """Test finding a path where intermediate folder doesn't exist"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create only root folder
            r = await create_new_path_block(
                session, space.id, "ExistingFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block for path with non-existent intermediate folder
            r = await ctx.find_block("ExistingFolder/NonExistent/Page")
            assert not r.ok()
            assert "not found" in r.error.errmsg.lower()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_with_leading_slash(self):
        """Test finding a block with leading slash in path"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create a page
            r = await create_new_path_block(session, space.id, "TestPage")
            assert r.ok()
            page_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block with leading slash
            r = await ctx.find_block("/TestPage")
            assert r.ok()
            assert r.data.id == page_id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_folder_with_children_counts(self):
        """Test that finding a folder includes sub_page_num and sub_folder_num"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
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
                session, space.id, "ParentFolder", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            parent_id = r.data.id

            # Create 2 pages and 3 folders inside
            for i in range(2):
                await create_new_path_block(
                    session,
                    space.id,
                    f"Page{i}",
                    par_block_id=parent_id,
                    type=BLOCK_TYPE_PAGE,
                )
            for i in range(3):
                await create_new_path_block(
                    session,
                    space.id,
                    f"Folder{i}",
                    par_block_id=parent_id,
                    type=BLOCK_TYPE_FOLDER,
                )

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block
            r = await ctx.find_block("ParentFolder/")
            assert r.ok()
            path_node = r.data
            assert path_node.id == parent_id
            assert path_node.title == "ParentFolder"
            assert path_node.type == BLOCK_TYPE_FOLDER
            assert path_node.sub_page_num == 2
            assert path_node.sub_folder_num == 3

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_multiple_pages_different_paths(self):
        """Test finding multiple pages with different paths"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create structure:
            # - Folder1/PageA
            # - Folder2/PageB
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

            r = await create_new_path_block(
                session,
                space.id,
                "PageA",
                par_block_id=folder1_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            pageA_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "PageB",
                par_block_id=folder2_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            pageB_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block for both pages
            r = await ctx.find_block("Folder1/PageA")
            assert r.ok()
            assert r.data.id == pageA_id
            assert r.data.title == "PageA"

            r = await ctx.find_block("Folder2/PageB")
            assert r.ok()
            assert r.data.id == pageB_id
            assert r.data.title == "PageB"

            # Verify cache has both paths
            assert len(ctx.path_2_block_ids) == 2

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_with_spaces_in_name(self):
        """Test finding blocks with spaces in their names"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create folder and page with spaces
            r = await create_new_path_block(
                session, space.id, "My Documents", type=BLOCK_TYPE_FOLDER
            )
            assert r.ok()
            folder_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "Project Report",
                par_block_id=folder_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            page_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block
            r = await ctx.find_block("My Documents/Project Report")
            assert r.ok()
            assert r.data.id == page_id
            assert r.data.title == "Project_Report"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_cache_preserves_across_calls(self):
        """Test that cache is preserved across multiple find_block calls"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create multiple pages
            page_ids = []
            for i in range(3):
                r = await create_new_path_block(session, space.id, f"Page{i}")
                assert r.ok()
                page_ids.append(r.data.id)

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Find all pages
            for i in range(3):
                r = await ctx.find_block(f"Page{i}")
                assert r.ok()

            # Cache should have all 3 entries
            assert len(ctx.path_2_block_ids) == 3

            # Re-find the first page - should use cache
            r = await ctx.find_block("Page0")
            assert r.ok()
            assert r.data.id == page_ids[0]
            # Cache size should still be 3
            assert len(ctx.path_2_block_ids) == 3

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_find_block_same_name_different_folders(self):
        """Test finding blocks with same name in different folders"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Setup
            project = Project(
                secret_key_hmac="test_key_hmac", secret_key_hash_phc="test_key_hash"
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create structure:
            # - Folder1/README
            # - Folder2/README
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

            r = await create_new_path_block(
                session,
                space.id,
                "README",
                par_block_id=folder1_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            readme1_id = r.data.id

            r = await create_new_path_block(
                session,
                space.id,
                "README",
                par_block_id=folder2_id,
                type=BLOCK_TYPE_PAGE,
            )
            assert r.ok()
            readme2_id = r.data.id

            # Create SpaceCtx
            ctx = SpaceCtx(
                db_session=session,
                project_id=project.id,
                space_id=space.id,
                candidate_data=[],
                already_inserted_candidate_data=[],
                path_2_block_ids={},
            )

            # Test find_block for both README pages
            r = await ctx.find_block("Folder1/README")
            assert r.ok()
            assert r.data.id == readme1_id

            r = await ctx.find_block("Folder2/README")
            assert r.ok()
            assert r.data.id == readme2_id

            # Verify they are different pages
            assert readme1_id != readme2_id

            await session.delete(project)
