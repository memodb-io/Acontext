import pytest
from acontext_core.schema.orm import (
    Block,
    Project,
    Space,
    ToolReference,
    ToolSOP,
)
from acontext_core.schema.orm.block import (
    BLOCK_TYPE_SOP,
    BLOCK_TYPE_PAGE,
    BLOCK_TYPE_TEXT,
)
from acontext_core.infra.db import DatabaseClient
from acontext_core.service.data.block import create_new_path_block
from acontext_core.service.data.block_render import (
    render_sop_block,
    render_text_block,
    render_content_block,
)


class TestRenderSOPBlock:
    @pytest.mark.asyncio
    async def test_render_sop_block_with_tool_sops(self):
        """Test rendering SOP block with multiple tool SOPs"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP block
            sop_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_SOP,
                title="Test SOP",
                sort=0,
                props={"preferences": "Use best practices"},
            )
            session.add(sop_block)
            await session.flush()

            # Create tool references
            tool_ref1 = ToolReference(name="test_tool_1", project_id=project.id)
            tool_ref2 = ToolReference(name="test_tool_2", project_id=project.id)
            session.add_all([tool_ref1, tool_ref2])
            await session.flush()

            # Create ToolSOP entries
            tool_sop1 = ToolSOP(
                sop_block_id=sop_block.id,
                tool_reference_id=tool_ref1.id,
                order=0,
                action="run with debug=true",
            )
            tool_sop2 = ToolSOP(
                sop_block_id=sop_block.id,
                tool_reference_id=tool_ref2.id,
                order=1,
                action="execute with retries=3",
            )
            session.add_all([tool_sop1, tool_sop2])
            await session.flush()

            # Render the SOP block
            result = await render_sop_block(session, space.id, sop_block)
            assert result.ok()

            rendered = result.data
            assert rendered.block_id == sop_block.id
            assert rendered.type == BLOCK_TYPE_SOP
            assert rendered.title == "Test SOP"
            assert rendered.order == 0
            assert rendered.parent_id == parent_id

            # Verify props
            assert rendered.props is not None
            assert rendered.props["use_when"] == "Test SOP"
            assert rendered.props["preferences"] == "Use best practices"
            assert len(rendered.props["tool_sops"]) == 2

            # Verify steps
            step1 = rendered.props["tool_sops"][0]
            assert step1["order"] == 0
            assert step1["tool_name"] == "test_tool_1"
            assert step1["action"] == "run with debug=true"

            step2 = rendered.props["tool_sops"][1]
            assert step2["order"] == 1
            assert step2["tool_name"] == "test_tool_2"
            assert step2["action"] == "execute with retries=3"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_render_sop_block_no_tool_sops(self):
        """Test rendering SOP block with no tool SOPs (only preferences)"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP block with only preferences
            sop_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_SOP,
                title="Preferences Only SOP",
                sort=0,
                props={"preferences": "Always use strict mode"},
            )
            session.add(sop_block)
            await session.flush()

            # Render the SOP block
            result = await render_sop_block(session, space.id, sop_block)
            assert result.ok()

            rendered = result.data
            assert rendered.props is not None
            assert rendered.props["use_when"] == "Preferences Only SOP"
            assert rendered.props["preferences"] == "Always use strict mode"
            assert len(rendered.props["tool_sops"]) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_render_sop_block_empty_preferences(self):
        """Test rendering SOP block with empty preferences"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP block without preferences key
            sop_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_SOP,
                title="SOP without preferences",
                sort=0,
                props={},
            )
            session.add(sop_block)
            await session.flush()

            # Render the SOP block
            result = await render_sop_block(session, space.id, sop_block)
            assert result.ok()

            rendered = result.data
            assert rendered.props is not None
            assert rendered.props["preferences"] == ""  # Should default to empty string

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_render_sop_block_order_preserved(self):
        """Test that tool SOPs are rendered in the correct order"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP block
            sop_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_SOP,
                title="Ordered SOP",
                sort=0,
                props={"preferences": ""},
            )
            session.add(sop_block)
            await session.flush()

            # Create tool references
            tool_refs = []
            for i in range(5):
                tool_ref = ToolReference(name=f"tool_{i}", project_id=project.id)
                session.add(tool_ref)
                tool_refs.append(tool_ref)
            await session.flush()

            # Create ToolSOP entries in reverse order to test ordering
            for i in range(4, -1, -1):
                tool_sop = ToolSOP(
                    sop_block_id=sop_block.id,
                    tool_reference_id=tool_refs[i].id,
                    order=i,
                    action=f"action_{i}",
                )
                session.add(tool_sop)
            await session.flush()

            # Render the SOP block
            result = await render_sop_block(session, space.id, sop_block)
            assert result.ok()

            rendered = result.data
            assert len(rendered.props["tool_sops"]) == 5

            # Verify steps are in correct order
            for i, step in enumerate(rendered.props["tool_sops"]):
                assert step["order"] == i
                assert step["tool_name"] == f"tool_{i}"
                assert step["action"] == f"action_{i}"

            await session.delete(project)


class TestRenderTextBlock:
    @pytest.mark.asyncio
    async def test_render_text_block_with_notes(self):
        """Test rendering text block with notes"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create text block
            text_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_TEXT,
                title="Text Block Title",
                sort=0,
                props={"notes": "These are my notes"},
            )
            session.add(text_block)
            await session.flush()

            # Render the text block
            result = await render_text_block(session, space.id, text_block)
            assert result.ok()

            rendered = result.data
            assert rendered.block_id == text_block.id
            assert rendered.type == BLOCK_TYPE_TEXT
            assert rendered.title == "Text Block Title"
            assert rendered.order == 0
            assert rendered.parent_id == parent_id

            # Verify props
            assert rendered.props is not None
            assert rendered.props["use_when"] == "Text Block Title"
            assert rendered.props["notes"] == "These are my notes"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_render_text_block_empty_notes(self):
        """Test rendering text block with empty notes"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create text block without notes
            text_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_TEXT,
                title="Text Block",
                sort=0,
                props={},
            )
            session.add(text_block)
            await session.flush()

            # Render the text block
            result = await render_text_block(session, space.id, text_block)
            assert result.ok()

            rendered = result.data
            assert rendered.props["notes"] == ""  # Should default to empty string

            await session.delete(project)


class TestRenderContentBlock:
    @pytest.mark.asyncio
    async def test_render_content_block_sop(self):
        """Test rendering content block with SOP type"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create SOP block
            sop_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_SOP,
                title="Test SOP",
                sort=0,
                props={"preferences": "Test"},
            )
            session.add(sop_block)
            await session.flush()

            # Render using render_content_block
            result = await render_content_block(session, space.id, sop_block)
            assert result.ok()

            rendered = result.data
            assert rendered.type == BLOCK_TYPE_SOP

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_render_content_block_text(self):
        """Test rendering content block with TEXT type"""
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
            r = await create_new_path_block(session, space.id, "Parent Page")
            assert r.ok()
            parent_id = r.data.id

            # Create text block
            text_block = Block(
                space_id=space.id,
                parent_id=parent_id,
                type=BLOCK_TYPE_TEXT,
                title="Text Block",
                sort=0,
                props={"notes": "Test notes"},
            )
            session.add(text_block)
            await session.flush()

            # Render using render_content_block
            result = await render_content_block(session, space.id, text_block)
            assert result.ok()

            rendered = result.data
            assert rendered.type == BLOCK_TYPE_TEXT

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_render_content_block_unsupported_type(self):
        """Test rendering content block with unsupported type"""
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

            # Create a block with unsupported type (PAGE)
            page_block = Block(
                space_id=space.id,
                parent_id=None,
                type=BLOCK_TYPE_PAGE,
                title="Page Block",
                sort=0,
                props={},
            )
            session.add(page_block)
            await session.flush()

            # Render using render_content_block (should fail)
            result = await render_content_block(session, space.id, page_block)
            assert not result.ok()
            assert "not supported to render" in result.error.errmsg

            await session.delete(project)
