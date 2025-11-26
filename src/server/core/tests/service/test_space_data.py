import pytest
import uuid
from sqlalchemy import select
from acontext_core.service.data.space import (
    set_experience_confirmation,
    remove_experience_confirmation,
    list_experience_confirmations,
)
from acontext_core.schema.orm import ExperienceConfirmation, Project, Space
from acontext_core.schema.result import Result
from acontext_core.infra.db import DatabaseClient


class TestSetExperienceConfirmation:
    @pytest.mark.asyncio
    async def test_set_experience_confirmation_success(self):
        """Test creating a new experience confirmation"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp1",
                secret_key_hash_phc="test_key_hash_exp1",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Test creating experience confirmation
            experience_data = {
                "action": "test_action",
                "result": "success",
                "metadata": {"key": "value"},
            }

            result = await set_experience_confirmation(
                session, space.id, experience_data
            )

            assert isinstance(result, Result)
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.space_id == space.id
            assert data.experience_data == experience_data
            assert data.id is not None

            # Verify it was saved to database
            query = select(ExperienceConfirmation).where(
                ExperienceConfirmation.id == data.id
            )
            db_result = await session.execute(query)
            saved_confirmation = db_result.scalars().first()
            assert saved_confirmation is not None
            assert saved_confirmation.experience_data == experience_data

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_set_experience_confirmation_multiple(self):
        """Test creating multiple experience confirmations for the same space"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp2",
                secret_key_hash_phc="test_key_hash_exp2",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create multiple experience confirmations
            for i in range(3):
                experience_data = {
                    "action": f"test_action_{i}",
                    "result": "success",
                    "index": i,
                }
                result = await set_experience_confirmation(
                    session, space.id, experience_data
                )
                data, error = result.unpack()
                assert error is None
                assert data is not None

            # Verify all were created
            query = select(ExperienceConfirmation).where(
                ExperienceConfirmation.space_id == space.id
            )
            db_result = await session.execute(query)
            confirmations = list(db_result.scalars().all())
            assert len(confirmations) == 3

            await session.delete(project)


class TestRemoveExperienceConfirmation:
    @pytest.mark.asyncio
    async def test_remove_experience_confirmation_success(self):
        """Test removing an existing experience confirmation"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp3",
                secret_key_hash_phc="test_key_hash_exp3",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create an experience confirmation
            experience_data = {"action": "test_action", "result": "success"}
            create_result = await set_experience_confirmation(
                session, space.id, experience_data
            )
            created_confirmation, _ = create_result.unpack()
            confirmation_id = created_confirmation.id

            # Remove it
            result = await remove_experience_confirmation(session, confirmation_id)

            data, error = result.unpack()
            assert error is None
            assert data is None

            # Verify it was actually deleted
            query = select(ExperienceConfirmation).where(
                ExperienceConfirmation.id == confirmation_id
            )
            db_result = await session.execute(query)
            deleted_confirmation = db_result.scalars().first()
            assert deleted_confirmation is None

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_remove_nonexistent_experience_confirmation(self):
        """Test removing a non-existent experience confirmation"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            non_existent_id = uuid.uuid4()

            result = await remove_experience_confirmation(session, non_existent_id)

            data, error = result.unpack()
            assert error is not None
            assert "not found" in error.errmsg.lower()
            assert data is None

    @pytest.mark.asyncio
    async def test_remove_experience_confirmation_isolation(self):
        """Test that removing one confirmation doesn't affect others"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp4",
                secret_key_hash_phc="test_key_hash_exp4",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create multiple confirmations
            confirmation_ids = []
            for i in range(3):
                experience_data = {"action": f"test_action_{i}", "index": i}
                create_result = await set_experience_confirmation(
                    session, space.id, experience_data
                )
                created_confirmation, _ = create_result.unpack()
                confirmation_ids.append(created_confirmation.id)

            # Remove the middle one
            result = await remove_experience_confirmation(session, confirmation_ids[1])
            data, error = result.unpack()
            assert error is None

            # Verify only one was removed
            query = select(ExperienceConfirmation).where(
                ExperienceConfirmation.space_id == space.id
            )
            db_result = await session.execute(query)
            remaining_confirmations = list(db_result.scalars().all())
            assert len(remaining_confirmations) == 2
            remaining_ids = {c.id for c in remaining_confirmations}
            assert confirmation_ids[0] in remaining_ids
            assert confirmation_ids[2] in remaining_ids
            assert confirmation_ids[1] not in remaining_ids

            await session.delete(project)


class TestListExperienceConfirmations:
    @pytest.mark.asyncio
    async def test_list_experience_confirmations_success(self):
        """Test listing experience confirmations for a space"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp5",
                secret_key_hash_phc="test_key_hash_exp5",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create multiple confirmations
            for i in range(5):
                experience_data = {"action": f"test_action_{i}", "index": i}
                await set_experience_confirmation(session, space.id, experience_data)

            # List all confirmations
            result = await list_experience_confirmations(session, space.id)

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert len(data) == 5

            # Verify they are ordered by created_at descending (newest first)
            for i in range(len(data) - 1):
                assert data[i].created_at >= data[i + 1].created_at

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_experience_confirmations_with_pagination(self):
        """Test listing experience confirmations with limit and offset"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp6",
                secret_key_hash_phc="test_key_hash_exp6",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # Create 10 confirmations
            for i in range(10):
                experience_data = {"action": f"test_action_{i}", "index": i}
                await set_experience_confirmation(session, space.id, experience_data)

            # Test pagination: first page
            result = await list_experience_confirmations(
                session, space.id, limit=3, offset=0
            )
            data, error = result.unpack()
            assert error is None
            assert len(data) == 3

            # Test pagination: second page
            result = await list_experience_confirmations(
                session, space.id, limit=3, offset=3
            )
            data, error = result.unpack()
            assert error is None
            assert len(data) == 3

            # Test pagination: third page (partial)
            result = await list_experience_confirmations(
                session, space.id, limit=3, offset=6
            )
            data, error = result.unpack()
            assert error is None
            assert len(data) == 3

            # Test pagination: fourth page (should be empty or partial)
            result = await list_experience_confirmations(
                session, space.id, limit=3, offset=9
            )
            data, error = result.unpack()
            assert error is None
            assert len(data) == 1  # Only 1 remaining

            # Test pagination: beyond available data
            result = await list_experience_confirmations(
                session, space.id, limit=3, offset=10
            )
            data, error = result.unpack()
            assert error is None
            assert len(data) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_experience_confirmations_empty(self):
        """Test listing confirmations for a space with no confirmations"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp7",
                secret_key_hash_phc="test_key_hash_exp7",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # List confirmations (should be empty)
            result = await list_experience_confirmations(session, space.id)

            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert len(data) == 0

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_experience_confirmations_space_isolation(self):
        """Test that confirmations from different spaces are isolated"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp8",
                secret_key_hash_phc="test_key_hash_exp8",
            )
            session.add(project)
            await session.flush()

            space1 = Space(project_id=project.id)
            space2 = Space(project_id=project.id)
            session.add_all([space1, space2])
            await session.flush()

            # Create confirmations for space1
            for i in range(3):
                experience_data = {"action": f"space1_action_{i}"}
                await set_experience_confirmation(session, space1.id, experience_data)

            # Create confirmations for space2
            for i in range(2):
                experience_data = {"action": f"space2_action_{i}"}
                await set_experience_confirmation(session, space2.id, experience_data)

            # List confirmations for space1
            result = await list_experience_confirmations(session, space1.id)
            data, error = result.unpack()
            assert error is None
            assert len(data) == 3
            assert all(c.space_id == space1.id for c in data)

            # List confirmations for space2
            result = await list_experience_confirmations(session, space2.id)
            data, error = result.unpack()
            assert error is None
            assert len(data) == 2
            assert all(c.space_id == space2.id for c in data)

            await session.delete(project)


class TestExperienceConfirmationIntegration:
    @pytest.mark.asyncio
    async def test_full_lifecycle(self):
        """Test complete lifecycle: create, list, remove"""
        db_client = DatabaseClient()
        await db_client.create_tables()

        async with db_client.get_session_context() as session:
            # Create test data
            project = Project(
                secret_key_hmac="test_key_hmac_exp9",
                secret_key_hash_phc="test_key_hash_exp9",
            )
            session.add(project)
            await session.flush()

            space = Space(project_id=project.id)
            session.add(space)
            await session.flush()

            # 1. Create multiple confirmations
            confirmation_ids = []
            for i in range(5):
                experience_data = {"action": f"lifecycle_action_{i}", "index": i}
                create_result = await set_experience_confirmation(
                    session, space.id, experience_data
                )
                created_confirmation, _ = create_result.unpack()
                confirmation_ids.append(created_confirmation.id)

            # 2. List all confirmations
            list_result = await list_experience_confirmations(session, space.id)
            confirmations, _ = list_result.unpack()
            assert len(confirmations) == 5

            # 3. Remove one confirmation
            remove_result = await remove_experience_confirmation(
                session, confirmation_ids[2]
            )
            _, error = remove_result.unpack()
            assert error is None

            # 4. Verify it's gone from the list
            list_result = await list_experience_confirmations(session, space.id)
            confirmations, _ = list_result.unpack()
            assert len(confirmations) == 4
            remaining_ids = {c.id for c in confirmations}
            assert confirmation_ids[2] not in remaining_ids

            await session.delete(project)
