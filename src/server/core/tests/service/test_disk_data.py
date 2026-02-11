import pytest
import uuid
from acontext_core.service.data.disk import get_disk, create_disk
from acontext_core.schema.orm import Project, Disk
from acontext_core.schema.result import Result


class TestGetDisk:
    @pytest.mark.asyncio
    async def test_get_disk_found(self, db_client):
        """Fetch a disk by project and disk id — found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_disk_hmac_1",
                secret_key_hash_phc="test_disk_hash_1",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            result = await get_disk(session, project.id, disk.id)
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.id == disk.id
            assert data.project_id == project.id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_disk_not_found_wrong_project(self, db_client):
        """Fetch a disk with wrong project_id — not found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_disk_hmac_2",
                secret_key_hash_phc="test_disk_hash_2",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            other_project_id = uuid.uuid4()
            result = await get_disk(session, other_project_id, disk.id)
            assert not result.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_disk_not_found_missing_id(self, db_client):
        """Fetch a disk with non-existent disk_id — not found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_disk_hmac_3",
                secret_key_hash_phc="test_disk_hash_3",
            )
            session.add(project)
            await session.flush()

            missing_id = uuid.uuid4()
            result = await get_disk(session, project.id, missing_id)
            assert not result.ok()

            await session.delete(project)


class TestCreateDisk:
    @pytest.mark.asyncio
    async def test_create_disk_success(self, db_client):
        """Create a disk — success."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_disk_hmac_4",
                secret_key_hash_phc="test_disk_hash_4",
            )
            session.add(project)
            await session.flush()

            result = await create_disk(session, project.id)
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.project_id == project.id
            assert data.id is not None
            assert data.created_at is not None
            assert data.user_id is None

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_disk_user_id_none(self, db_client):
        """Create a disk with user_id=None (default) — user_id is null."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_disk_hmac_5",
                secret_key_hash_phc="test_disk_hash_5",
            )
            session.add(project)
            await session.flush()

            result = await create_disk(session, project.id, user_id=None)
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.user_id is None

            await session.delete(project)
