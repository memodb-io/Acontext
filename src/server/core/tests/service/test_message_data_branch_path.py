import json
import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch

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
async def test_fetch_message_branch_path_messages_root_only(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        root = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={},
        )
        session.add(root)
        await session.flush()

        r = await MD.fetch_message_branch_path_messages(
            session, root.id, acontext_session.id
        )
        messages, eil = r.unpack()

        assert eil is None
        assert [message.id for message in messages] == [root.id]


@pytest.mark.asyncio
async def test_fetch_message_branch_path_messages_returns_root_to_leaf_order(db_client):
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

        r = await MD.fetch_message_branch_path_messages(
            session, leaf.id, acontext_session.id
        )
        messages, eil = r.unpack()

        assert eil is None
        assert [message.id for message in messages] == [root.id, child.id, leaf.id]


@pytest.mark.asyncio
async def test_fetch_message_branch_path_messages_rejects_wrong_session(db_client):
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

        r = await MD.fetch_message_branch_path_messages(session, msg.id, session_b.id)
        _, eil = r.unpack()

        assert eil is not None
        assert "does not belong to session" in str(eil)


@pytest.mark.asyncio
async def test_fetch_message_branch_path_messages_rejects_missing_message(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        r = await MD.fetch_message_branch_path_messages(
            session, acontext_session.id, acontext_session.id
        )
        _, eil = r.unpack()

        assert eil is not None
        assert "doesn't exist" in str(eil)


@pytest.mark.asyncio
async def test_fetch_message_branch_path_messages_returns_statuses(db_client):
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

        r = await MD.fetch_message_branch_path_messages(
            session, leaf.id, acontext_session.id
        )
        messages, eil = r.unpack()

        assert eil is None
        assert [message.id for message in messages] == [root.id, child.id, leaf.id]
        assert [message.session_task_process_status for message in messages] == [
            "success",
            "pending",
            "running",
        ]


@pytest.mark.asyncio
async def test_hydrate_message_parts_uses_existing_branch_message_order(db_client):
    _, acontext_session = await _create_project_and_session(db_client)

    async with db_client.get_session_context() as session:
        root = Message(
            session_id=acontext_session.id,
            role="user",
            parts_asset_meta={
                "bucket": "test-bucket",
                "s3_key": "parts/root.json",
                "etag": "etag-root",
                "sha256": "sha-root",
                "mime": "application/json",
                "size_b": 10,
            },
        )
        session.add(root)
        await session.flush()

        leaf = Message(
            session_id=acontext_session.id,
            role="assistant",
            parts_asset_meta={
                "bucket": "test-bucket",
                "s3_key": "parts/leaf.json",
                "etag": "etag-leaf",
                "sha256": "sha-leaf",
                "mime": "application/json",
                "size_b": 11,
            },
            parent_id=root.id,
        )
        session.add(leaf)
        await session.flush()

        branch_result = await MD.fetch_message_branch_path_messages(
            session, leaf.id, acontext_session.id
        )
        messages, eil = branch_result.unpack()

        assert eil is None

        with patch(
            "acontext_core.service.data.message.S3_CLIENT.download_object",
            new_callable=AsyncMock,
            side_effect=[
                json.dumps([{"type": "text", "text": "root"}]).encode("utf-8"),
                json.dumps([{"type": "text", "text": "leaf"}]).encode("utf-8"),
            ],
        ) as mock_download:
            hydrated_result = await MD.hydrate_message_parts(messages)
            hydrated_messages, hydrate_error = hydrated_result.unpack()

        assert hydrate_error is None
        assert [message.id for message in hydrated_messages] == [root.id, leaf.id]
        assert hydrated_messages[0].parts[0].text == "root"
        assert hydrated_messages[1].parts[0].text == "leaf"
        assert mock_download.await_count == 2


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
