import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from acontext_core.schema.orm import Project, Session

FAKE_KEY = "a" * 32


@pytest.mark.asyncio
async def test_db(db_client):
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

        se = Session(project_id=p.id)
        session.add(se)
        await session.commit()

        pid = p.id
        seid = se.id
    print(pid, seid)
    async with db_client.get_session_context() as session:
        # Use select() with selectinload for session
        se_query = await session.execute(
            select(Session)
            .where(Session.id == seid)
        )
        se_result = se_query.scalar_one()
        print(se_result.id)
        assert se_result.project_id == pid

        # Use select() with selectinload for project and its relationships
        p_query = await session.execute(
            select(Project)
            .options(selectinload(Project.sessions))
            .where(Project.id == pid)
        )
        p_result = p_query.scalar_one()
        print(len(p_result.sessions))
        assert p_result.sessions[0].id == seid
        print("✓ Database ORM relationships are working correctly!")
