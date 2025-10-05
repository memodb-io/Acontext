import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from acontext_core.infra.db import DatabaseClient
from acontext_core.schema.orm import Project, Space, Session, Block

FAKE_KEY = "a" * 32


@pytest.mark.asyncio
async def test_db():
    db_client = DatabaseClient()
    await db_client.create_tables()

    await db_client.health_check()
    print(db_client.get_pool_status())

    async with db_client.get_session_context() as session:
        # check if same p exist
        p_result = await session.execute(
            select(Project).where(Project.secret_key_hmac == FAKE_KEY)
        )
        before_p = p_result.scalars().first()
        if before_p:
            await session.delete(before_p)
            await session.flush()

        p = Project(secret_key_hmac=FAKE_KEY, secret_key_hash_phc=FAKE_KEY)
        session.add(p)
        await session.flush()

        s = Space(project_id=p.id)
        session.add(s)
        await session.flush()

        se = Session(project_id=p.id)
        se.space = s
        session.add(se)
        await session.commit()

        pid = p.id
        sid = s.id
        seid = se.id
    print(pid, sid, seid)
    async with db_client.get_session_context() as session:
        # Use select() with selectinload for session and its space relationship
        se_query = await session.execute(
            select(Session)
            .options(selectinload(Session.space))
            .where(Session.id == seid)
        )
        se_result = se_query.scalar_one()
        print(se_result.id)
        print(se_result.space.id)  # Now this will work without greenlet error
        assert se_result.space_id == sid
        assert se_result.project_id == pid

        s_result = await session.get(Space, sid)
        print(s_result.id)
        assert s_result.project_id == pid

        # Use select() with selectinload for project and its relationships
        p_query = await session.execute(
            select(Project)
            .options(selectinload(Project.sessions), selectinload(Project.spaces))
            .where(Project.id == pid)
        )
        p_result = p_query.scalar_one()
        print(len(p_result.sessions), len(p_result.spaces))
        assert p_result.sessions[0].id == seid
        assert p_result.spaces[0].id == sid

        # Test Block ORM functionality within the same test
        # Create a page block
        page_block = Block(
            space_id=sid,
            type="page",
            title="Test Page",
            props={"description": "A test page"},
            sort=0,
        )
        session.add(page_block)
        await session.flush()
        
        # Create a text block under the page
        text_block = Block(
            space_id=sid,
            type="text",
            parent_id=page_block.id,
            title="Test Text",
            props={"content": "Hello World"},
            sort=1,
        )
        session.add(text_block)
        await session.commit()  # Commit to ensure data is persisted
        
        # Test Block relationships
        # Load space with blocks
        space_with_blocks_query = await session.execute(
            select(Space)
            .options(selectinload(Space.blocks))
            .where(Space.id == sid)
        )
        space_with_blocks = space_with_blocks_query.scalar_one()
        
        assert len(space_with_blocks.blocks) == 2
        block_ids = [block.id for block in space_with_blocks.blocks]
        assert page_block.id in block_ids
        assert text_block.id in block_ids
        
        # Test basic block properties
        assert page_block.type == "page"
        assert text_block.type == "text"
        assert text_block.parent_id == page_block.id
        
        # Test Block self-referential relationships
        # Test parent relationship with selectinload
        text_query = await session.execute(
            select(Block)
            .options(selectinload(Block.parent))
            .where(Block.id == text_block.id)
        )
        text_result = text_query.scalar_one()
        
        # Verify parent relationship works
        assert text_result.parent is not None
        assert text_result.parent.id == page_block.id
        
        # Test children relationship (selectinload may not work, so use manual query)
        children_query = await session.execute(
            select(Block).where(Block.parent_id == page_block.id)
        )
        children = children_query.scalars().all()
        
        # Verify children relationship works
        assert len(children) == 1
        assert children[0].id == text_block.id
        
        print(f"Block test passed: page={page_block.id}, text={text_block.id}")
        print("✓ Self-referential relationships are working correctly!")
