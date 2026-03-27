import pytest
from uuid import uuid4

from acontext_core.schema.orm import Message, Project, Session
from acontext_core.service.data import message as MD


async def _create_project_and_session(db_client):
    unique_key = uuid4().hex
    async with db_client.get_session_context() as session:
        project = Project(
            secret_key_hmac=unique_key,
            secret_key_hash_phc=unique_key,
        )
        session.add(project)
        await session.flush()

        acontext_session = Session(project_id=project.id)
        session.add(acontext_session)
        await session.flush()

        return project, acontext_session


@pytest.mark.asyncio
async def test_fetch_message_branch_path_ids_root_only(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        root = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
        )
        session.add(root)
        await session.flush()

        r = await MD.fetch_message_branch_path_ids(
            session, root.id, acontext_session.id
        )
        message_ids, eil = r.unpack()

        assert eil is None
        assert message_ids == [root.id]


@pytest.mark.asyncio
async def test_fetch_message_branch_path_ids_returns_root_to_leaf_order(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        root = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
        )
        session.add(root)
        await session.flush()

        child = Message(
            session_id=acontext_session.id,
            role="assistant",
            parts_asset_meta={},
            parent_id=root.id,
        )
        session.add(child)
        await session.flush()

        leaf = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
            parent_id=child.id,
        )
        session.add(leaf)
        await session.flush()

        r = await MD.fetch_message_branch_path_ids(
            session, leaf.id, acontext_session.id
        )
        message_ids, eil = r.unpack()

        assert eil is None
        assert message_ids == [root.id, child.id, leaf.id]


@pytest.mark.asyncio
async def test_fetch_message_branch_path_ids_rejects_wrong_session(db_client):
    _, session_a = await _create_project_and_session(db_client)
    _, session_b = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        msg = Message(
            session_id=session_a.id,
            role="user",
            parts_asset_meta={},
        )
        session.add(msg)
        await session.flush()

        r = await MD.fetch_message_branch_path_ids(session, msg.id, session_b.id)
        _, eil = r.unpack()

        assert eil is not None
        assert "does not belong to session" in str(eil)


@pytest.mark.asyncio
async def test_fetch_message_branch_path_ids_rejects_missing_message(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        r = await MD.fetch_message_branch_path_ids(
            session, acontext_session.id, acontext_session.id
        )
        _, eil = r.unpack()

        assert eil is not None
        assert "doesn't exist" in str(eil)


@pytest.mark.asyncio
async def test_fetch_message_branch_path_rows_returns_statuses(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        root = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
            session_task_process_status="success",
        )
        session.add(root)
        await session.flush()

        child = Message(
            session_id=acontext_session.id,
            role="assistant",
            parts_asset_meta={},
            parent_id=root.id,
            session_task_process_status="pending",
        )
        session.add(child)
        await session.flush()

        leaf = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
            parent_id=child.id,
            session_task_process_status="running",
        )
        session.add(leaf)
        await session.flush()

        r = await MD.fetch_message_branch_path_rows(
            session, leaf.id, acontext_session.id
        )
        rows, eil = r.unpack()

        assert eil is None
        assert [row["id"] for row in rows] == [root.id, child.id, leaf.id]
        assert [row["session_task_process_status"] for row in rows] == [
            "success",
            "pending",
            "running",
        ]


@pytest.mark.asyncio
async def test_branch_pending_message_length_ignores_sibling_branches(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        root = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
            session_task_process_status="success",
        )
        session.add(root)
        await session.flush()

        branch_a = Message(
            session_id=acontext_session.id,
            role="assistant",
            parts_asset_meta={},
            parent_id=root.id,
            session_task_process_status="pending",
        )
        session.add(branch_a)
        await session.flush()

        branch_b = Message(
            session_id=acontext_session.id,
            role="assistant",
            parts_asset_meta={},
            parent_id=root.id,
            session_task_process_status="pending",
        )
        session.add(branch_b)
        await session.flush()

        leaf_a = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
            parent_id=branch_a.id,
            session_task_process_status="pending",
        )
        session.add(leaf_a)
        await session.flush()

        r = await MD.branch_pending_message_length(
            session, leaf_a.id, session_id=acontext_session.id
        )
        pending_count, eil = r.unpack()

        assert eil is None
        assert pending_count == 2
