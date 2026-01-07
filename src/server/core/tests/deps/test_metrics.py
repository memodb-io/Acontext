import asyncio
from datetime import date

import pytest
from sqlalchemy import select, func

from acontext_core.infra.db import DatabaseClient
from acontext_core.schema.orm import Project, Metric
from acontext_core.telemetry.capture_metrics import capture_increment
from acontext_core.telemetry.get_metrics import get_metrics


FAKE_KEY = "b" * 32


@pytest.mark.asyncio
async def test_capture_increment_creates_and_increments_metric():
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        # Ensure we start from a clean state for this project/tag
        proj_query = await session.execute(
            select(Project).where(Project.secret_key_hmac == FAKE_KEY)
        )
        existing_project = proj_query.scalars().first()
        if existing_project:
            await session.delete(existing_project)
            await session.flush()

        project = Project(secret_key_hmac=FAKE_KEY, secret_key_hash_phc=FAKE_KEY)
        session.add(project)
        await session.flush()
        project_id = project.id

    tag = "test-metric"

    # Call capture_increment multiple times (including concurrently) to ensure atomicity
    increments = [1, 2, 3, 4]
    await asyncio.gather(
        *[
            capture_increment(
                project_id=project_id, tag=tag, increment=i, db_client=db_client
            )
            for i in increments
        ]
    )

    # Verify there is exactly one metric row for today and its increment is the sum
    async with db_client.get_session_context() as session:
        stmt = select(Metric).where(
            Metric.project_id == project_id,
            Metric.tag == tag,
            func.date(Metric.created_at) == date.today(),
        )
        result = await session.execute(stmt)
        metric = result.scalars().one()

        assert metric.increment == sum(increments)
        await session.delete(project)


@pytest.mark.asyncio
async def test_get_metrics_returns_latest_increment():
    """Test that get_metrics returns the most recent increment value for a project and tag."""
    db_client = DatabaseClient()
    await db_client.create_tables()

    async with db_client.get_session_context() as session:
        # Ensure we start from a clean state for this project/tag
        proj_query = await session.execute(
            select(Project).where(Project.secret_key_hmac == FAKE_KEY)
        )
        existing_project = proj_query.scalars().first()
        if existing_project:
            await session.delete(existing_project)
            await session.flush()

        project = Project(secret_key_hmac=FAKE_KEY, secret_key_hash_phc=FAKE_KEY)
        session.add(project)
        await session.flush()
        project_id = project.id

    tag = "test-get-metric"

    # Initially, get_metrics should return None (no metrics exist)
    result = await get_metrics(project_id=project_id, tag=tag, db_client=db_client)
    assert result is None

    # Capture some increments
    await capture_increment(
        project_id=project_id, tag=tag, increment=5, db_client=db_client
    )
    await capture_increment(
        project_id=project_id, tag=tag, increment=10, db_client=db_client
    )

    # get_metrics should return the latest increment value (5 + 10 = 15)
    result = await get_metrics(project_id=project_id, tag=tag, db_client=db_client)
    assert result == 15

    # Test with a different tag that doesn't exist
    result_other_tag = await get_metrics(
        project_id=project_id, tag="nonexistent-tag", db_client=db_client
    )
    assert result_other_tag is None

    # Clean up: delete the project
    async with db_client.get_session_context() as session:
        proj_query = await session.execute(
            select(Project).where(Project.id == project_id)
        )
        project = proj_query.scalars().first()
        if project:
            await session.delete(project)
