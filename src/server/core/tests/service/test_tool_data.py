"""
Tests for tool storage/search data service.

These tests patch embeddings so they don't depend on external network access.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import UUID

import pytest
import numpy as np
from sqlalchemy import select

from acontext_core.infra.db import DatabaseClient
from acontext_core.env import DEFAULT_CORE_CONFIG
from acontext_core.schema.error_code import Code
from acontext_core.schema.embedding import EmbeddingReturn
from acontext_core.schema.orm import Project, Tool, User
from acontext_core.schema.result import Result
from acontext_core.service.data import tool as TOOL


def test_cursor_roundtrip_is_microsecond_stable():
    dt = datetime(2026, 2, 10, 12, 34, 56, 123457, tzinfo=timezone(timedelta(hours=2)))
    tool_id = UUID("123e4567-e89b-12d3-a456-426614174000")

    cursor = TOOL._encode_cursor(dt, tool_id)
    decoded, eil = TOOL._decode_cursor(cursor).unpack()
    assert eil is None

    decoded_dt, decoded_id = decoded
    assert decoded_id == tool_id
    assert decoded_dt == dt.astimezone(timezone.utc)


@pytest.mark.asyncio
async def test_upsert_tool_updates_in_place_and_serializes():
    db_client = DatabaseClient()
    await db_client.create_tables()

    # Keep a stable key, but ensure cleanup from any previous interrupted run.
    secret_key = "tool_test_key"

    openai_schema_v1 = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "desc-v1",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    }
    openai_schema_v2 = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "desc-v2",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    }

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        # Patch embeddings to avoid external API dependency and keep the test fast.
        with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
            m.return_value = Result.reject("embedding disabled in tests")

            r1 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_v1,
                config={"tag": "web"},
            )
            assert r1.ok()
            tool1 = r1.data

            # Ensure serialization doesn't trigger async IO (regression: MissingGreenlet).
            out1 = TOOL.to_tool_out(tool1, "openai")
            assert out1.name == "github_search"
            assert out1.description == "desc-v1"
            assert out1.user_id is None

            r2 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_v2,
                config=None,  # omit config on update; it should not clear existing config
            )
            assert r2.ok()
            tool2 = r2.data

            # Same name + scope should update, not create a new row.
            assert tool1.id == tool2.id

            out2 = TOOL.to_tool_out(tool2, "openai")
            assert out2.description == "desc-v2"
            assert out2.config == {"tag": "web"}

        await session.delete(project)


@pytest.mark.asyncio
async def test_list_tools_filters_by_config_and_user_and_formats():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_list_test_key"

    openai_schema_a = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "Search GitHub issues and PRs",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    openai_schema_b = {
        "type": "function",
        "function": {
            "name": "slack_search",
            "description": "Search Slack messages",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    openai_schema_user = {
        "type": "function",
        "function": {
            "name": "slack_search_user",
            "description": "Search Slack messages (user-scoped)",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        user = User(project_id=project.id, identifier="alice@example.com")
        session.add(user)
        await session.flush()

        with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
            m.return_value = Result.reject("embedding disabled in tests")

            # Project-scoped tools with different config.
            r1 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_a,
                config={"tag": "web"},
            )
            assert r1.ok()

            r2 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_b,
                config={"tag": "other"},
            )
            assert r2.ok()

            # User-scoped tool with tag "web".
            r3 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=user.id,
                openai_schema=openai_schema_user,
                config={"tag": "web"},
            )
            assert r3.ok()

        # Filter project tools by config.
        listed = await TOOL.list_tools(
            session,
            project_id=project.id,
            user_id=None,
            limit=50,
            cursor=None,
            time_desc=False,
            filter_config={"tag": "web"},
            fmt="anthropic",
        )
        assert listed.ok()
        items = listed.data["items"]
        assert len(items) == 1
        assert items[0].name == "github_search"
        # Anthropic conversion should produce input_schema.
        assert "input_schema" in items[0].schema_

        # Filter user-scoped tools by config.
        listed_user = await TOOL.list_tools(
            session,
            project_id=project.id,
            user_id=user.id,
            limit=50,
            cursor=None,
            time_desc=False,
            filter_config={"tag": "web"},
            fmt="anthropic",
        )
        assert listed_user.ok()
        items_user = listed_user.data["items"]
        assert len(items_user) == 1
        assert items_user[0].name == "slack_search_user"
        assert "input_schema" in items_user[0].schema_

        await session.delete(project)


@pytest.mark.asyncio
async def test_list_tools_rejects_non_object_filter_config():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_list_bad_filter_test_key"

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        listed = await TOOL.list_tools(
            session,
            project_id=project.id,
            user_id=None,
            limit=20,
            cursor=None,
            time_desc=False,
            filter_config=1,  # type: ignore[arg-type]
            fmt="openai",
        )
        _, eil = listed.unpack()
        assert eil is not None
        assert eil.status == Code.BAD_REQUEST
        assert "filter_config" in eil.errmsg

        await session.delete(project)


@pytest.mark.asyncio
async def test_search_tools_semantic_orders_by_distance():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_search_test_key"

    openai_schema_a = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "Search GitHub issues and PRs",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    openai_schema_b = {
        "type": "function",
        "function": {
            "name": "slack_search",
            "description": "Search Slack messages",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    # Produce deterministic embeddings so we can validate ordering.
    dim = DEFAULT_CORE_CONFIG.block_embedding_dim
    doc_vecs = []

    v1 = np.zeros((dim,), dtype=np.float32)
    v1[0] = 1.0
    doc_vecs.append(v1)

    v2 = np.zeros((dim,), dtype=np.float32)
    v2[0] = 0.6
    v2[1] = 0.8
    doc_vecs.append(v2)

    qv = np.zeros((dim,), dtype=np.float32)
    qv[0] = 1.0

    doc_i = 0

    async def fake_get_embedding(texts: list[str], phase: str = "document", model: str | None = None):
        nonlocal doc_i
        if phase == "document":
            v = doc_vecs[doc_i]
            doc_i += 1
            return Result.resolve(
                EmbeddingReturn(
                    embedding=np.array([v]),
                    prompt_tokens=0,
                    total_tokens=0,
                )
            )
        return Result.resolve(
            EmbeddingReturn(
                embedding=np.array([qv]),
                prompt_tokens=0,
                total_tokens=0,
            )
        )

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
            m.side_effect = fake_get_embedding

            r1 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_a,
                config=None,
            )
            assert r1.ok()

            r2 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_b,
                config=None,
            )
            assert r2.ok()

            hits = await TOOL.search_tools(
                session,
                project_id=project.id,
                user_id=None,
                query="find my tool",
                limit=10,
                fmt="openai",
            )
            assert hits.ok()

            assert len(hits.data) == 2
            assert hits.data[0].tool.name == "github_search"
            assert hits.data[1].tool.name == "slack_search"
            assert hits.data[0].distance <= hits.data[1].distance

        await session.delete(project)


@pytest.mark.asyncio
async def test_search_tools_fallback_returns_ranked_distances():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_search_fallback_test_key"

    openai_schema_a = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "Search GitHub issues and PRs",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    openai_schema_b = {
        "type": "function",
        "function": {
            "name": "github_repo_search",
            "description": "Search GitHub repositories",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
            m.return_value = Result.reject("embedding disabled in tests")

            r1 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_a,
                config=None,
            )
            assert r1.ok()

            r2 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_b,
                config=None,
            )
            assert r2.ok()

            hits = await TOOL.search_tools(
                session,
                project_id=project.id,
                user_id=None,
                query="github",
                limit=10,
                fmt="openai",
            )
            assert hits.ok()
            assert len(hits.data) == 2
            assert hits.data[0].distance < hits.data[1].distance

        await session.delete(project)


@pytest.mark.asyncio
async def test_search_tools_falls_back_when_query_embedding_exists_but_docs_do_not():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_search_semantic_empty_fallback_key"

    openai_schema_a = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "Search GitHub issues and PRs",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    openai_schema_b = {
        "type": "function",
        "function": {
            "name": "slack_search",
            "description": "Search Slack messages",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    dim = DEFAULT_CORE_CONFIG.block_embedding_dim
    qv = np.zeros((dim,), dtype=np.float32)
    qv[0] = 1.0

    async def fake_get_embedding(texts: list[str], phase: str = "document", model: str | None = None):
        if phase == "document":
            return Result.reject("document embedding unavailable")
        return Result.resolve(
            EmbeddingReturn(
                embedding=np.array([qv]),
                prompt_tokens=0,
                total_tokens=0,
            )
        )

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
            m.side_effect = fake_get_embedding

            r1 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_a,
                config=None,
            )
            assert r1.ok()

            r2 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_b,
                config=None,
            )
            assert r2.ok()

            hits = await TOOL.search_tools(
                session,
                project_id=project.id,
                user_id=None,
                query="github",
                limit=10,
                fmt="openai",
            )
            assert hits.ok()
            assert len(hits.data) == 1
            assert hits.data[0].tool.name == "github_search"
            assert hits.data[0].distance == 0.0

        await session.delete(project)


@pytest.mark.asyncio
async def test_upsert_tool_concurrent_writes_keep_single_scoped_row():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_upsert_concurrent_test_key"
    openai_schema = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "Search GitHub issues and PRs",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()
        project_id = project.id

    async def run_upsert(i: int):
        schema_i = dict(openai_schema)
        schema_i["function"] = dict(openai_schema["function"])
        schema_i["function"]["description"] = f"desc-{i}"

        async with db_client.get_session_context() as session:
            return await TOOL.upsert_tool(
                session,
                project_id=project_id,
                user_id=None,
                openai_schema=schema_i,
                config={"tag": "web"},
            )

    with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
        m.return_value = Result.reject("embedding disabled in tests")
        results = await asyncio.gather(*(run_upsert(i) for i in range(8)))

    assert all(r.ok() for r in results)

    async with db_client.get_session_context() as session:
        rows = (
            await session.execute(
                select(Tool).where(
                    Tool.project_id == project_id,
                    Tool.user_id.is_(None),
                    Tool.name == "github_search",
                )
            )
        ).scalars().all()
        assert len(rows) == 1
        assert rows[0].config == {"tag": "web"}
        assert rows[0].description.startswith("desc-")

        project = (await session.execute(select(Project).where(Project.id == project_id))).scalars().one()
        await session.delete(project)


@pytest.mark.asyncio
async def test_tool_crud_search_smoke_flow_with_user_scope():
    db_client = DatabaseClient()
    await db_client.create_tables()

    secret_key = "tool_smoke_flow_test_key"

    openai_schema_project = {
        "type": "function",
        "function": {
            "name": "github_search",
            "description": "Search GitHub issues and PRs",
            "parameters": {"type": "object", "properties": {}},
        },
    }
    openai_schema_user = {
        "type": "function",
        "function": {
            "name": "slack_search",
            "description": "Search Slack messages",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    async with db_client.get_session_context() as session:
        existing = (
            await session.execute(select(Project).where(Project.secret_key_hmac == secret_key))
        ).scalars().first()
        if existing:
            await session.delete(existing)
            await session.flush()

        project = Project(secret_key_hmac=secret_key, secret_key_hash_phc=secret_key)
        session.add(project)
        await session.flush()

        user = User(project_id=project.id, identifier="alice@example.com")
        session.add(user)
        await session.flush()

        with patch("acontext_core.service.data.tool.get_embedding", autospec=True) as m:
            m.return_value = Result.reject("embedding disabled in tests")

            r1 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=None,
                openai_schema=openai_schema_project,
                config={"tag": "web"},
            )
            assert r1.ok()

            r2 = await TOOL.upsert_tool(
                session,
                project_id=project.id,
                user_id=user.id,
                openai_schema=openai_schema_user,
                config={"tag": "chat"},
            )
            assert r2.ok()

            listed_project = await TOOL.list_tools(
                session,
                project_id=project.id,
                user_id=None,
                limit=20,
                cursor=None,
                time_desc=False,
                filter_config=None,
                fmt="anthropic",
            )
            assert listed_project.ok()
            assert len(listed_project.data["items"]) == 1
            assert listed_project.data["items"][0].name == "github_search"
            assert "input_schema" in listed_project.data["items"][0].schema_

            listed_user = await TOOL.list_tools(
                session,
                project_id=project.id,
                user_id=user.id,
                limit=20,
                cursor=None,
                time_desc=False,
                filter_config=None,
                fmt="anthropic",
            )
            assert listed_user.ok()
            assert len(listed_user.data["items"]) == 1
            assert listed_user.data["items"][0].name == "slack_search"

            searched_project = await TOOL.search_tools(
                session,
                project_id=project.id,
                user_id=None,
                query="github",
                limit=10,
                fmt="openai",
            )
            assert searched_project.ok()
            assert len(searched_project.data) == 1
            assert searched_project.data[0].tool.name == "github_search"

            searched_user = await TOOL.search_tools(
                session,
                project_id=project.id,
                user_id=user.id,
                query="slack",
                limit=10,
                fmt="openai",
            )
            assert searched_user.ok()
            assert len(searched_user.data) == 1
            assert searched_user.data[0].tool.name == "slack_search"

            deleted_user_tool = await TOOL.delete_tool(
                session,
                project_id=project.id,
                user_id=user.id,
                name="slack_search",
            )
            assert deleted_user_tool.ok()

            listed_user_after_delete = await TOOL.list_tools(
                session,
                project_id=project.id,
                user_id=user.id,
                limit=20,
                cursor=None,
                time_desc=False,
                filter_config=None,
                fmt="openai",
            )
            assert listed_user_after_delete.ok()
            assert listed_user_after_delete.data["items"] == []

        await session.delete(project)
