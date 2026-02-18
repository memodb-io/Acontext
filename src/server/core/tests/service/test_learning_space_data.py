"""
Tests for the learning space data service layer.

Covers:
- get_learning_space_for_session
- get_learning_space
- get_learning_space_skill_ids
- get_skills_info
- add_skill_to_learning_space
"""

import pytest
import uuid

from acontext_core.schema.orm import (
    Project,
    Disk,
    Artifact,
    AgentSkill,
    Session,
)
from acontext_core.schema.orm.learning_space import LearningSpace
from acontext_core.schema.orm.learning_space_session import LearningSpaceSession
from acontext_core.schema.orm.learning_space_skill import LearningSpaceSkill
from acontext_core.service.data.learning_space import (
    get_learning_space_for_session,
    get_learning_space,
    get_learning_space_skill_ids,
    get_skills_info,
    add_skill_to_learning_space,
)


class TestGetLearningSpaceForSession:
    @pytest.mark.asyncio
    async def test_session_with_learning_space(self, db_client):
        """Session linked to a learning space returns the junction row."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_1",
                secret_key_hash_phc="test_ls_data_hash_1",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            ls = LearningSpace(project_id=project.id)
            session.add(ls)
            await session.flush()

            ls_session = LearningSpaceSession(
                learning_space_id=ls.id,
                session_id=test_session.id,
            )
            session.add(ls_session)
            await session.flush()

            result = await get_learning_space_for_session(session, test_session.id)
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.learning_space_id == ls.id
            assert data.session_id == test_session.id

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_session_without_learning_space(self, db_client):
        """Session not linked to any learning space returns None."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_2",
                secret_key_hash_phc="test_ls_data_hash_2",
            )
            session.add(project)
            await session.flush()

            test_session = Session(project_id=project.id)
            session.add(test_session)
            await session.flush()

            result = await get_learning_space_for_session(session, test_session.id)
            assert result.ok()
            data, _ = result.unpack()
            assert data is None

            await session.delete(project)


class TestGetLearningSpace:
    @pytest.mark.asyncio
    async def test_get_learning_space_found(self, db_client):
        """Fetch learning space by ID — found, includes user_id."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_3",
                secret_key_hash_phc="test_ls_data_hash_3",
            )
            session.add(project)
            await session.flush()

            ls = LearningSpace(project_id=project.id, user_id=None)
            session.add(ls)
            await session.flush()

            result = await get_learning_space(session, ls.id)
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.id == ls.id
            assert data.user_id is None

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_learning_space_not_found(self, db_client):
        """Fetch non-existent learning space returns error."""
        async with db_client.get_session_context() as session:
            missing_id = uuid.uuid4()
            result = await get_learning_space(session, missing_id)
            assert not result.ok()


class TestGetLearningSpaceSkillIds:
    @pytest.mark.asyncio
    async def test_returns_skill_ids(self, db_client):
        """Learning space with skills returns their IDs."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_4",
                secret_key_hash_phc="test_ls_data_hash_4",
            )
            session.add(project)
            await session.flush()

            ls = LearningSpace(project_id=project.id)
            session.add(ls)
            await session.flush()

            disk1 = Disk(project_id=project.id)
            disk2 = Disk(project_id=project.id)
            session.add_all([disk1, disk2])
            await session.flush()

            skill1 = AgentSkill(
                project_id=project.id,
                name="skill-one",
                description="First skill",
                disk_id=disk1.id,
            )
            skill2 = AgentSkill(
                project_id=project.id,
                name="skill-two",
                description="Second skill",
                disk_id=disk2.id,
            )
            session.add_all([skill1, skill2])
            await session.flush()

            ls_skill1 = LearningSpaceSkill(
                learning_space_id=ls.id, skill_id=skill1.id
            )
            ls_skill2 = LearningSpaceSkill(
                learning_space_id=ls.id, skill_id=skill2.id
            )
            session.add_all([ls_skill1, ls_skill2])
            await session.flush()

            result = await get_learning_space_skill_ids(session, ls.id)
            assert result.ok()
            skill_ids, _ = result.unpack()
            assert set(skill_ids) == {skill1.id, skill2.id}

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_no_skills_returns_empty(self, db_client):
        """Learning space with no skills returns empty list."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_5",
                secret_key_hash_phc="test_ls_data_hash_5",
            )
            session.add(project)
            await session.flush()

            ls = LearningSpace(project_id=project.id)
            session.add(ls)
            await session.flush()

            result = await get_learning_space_skill_ids(session, ls.id)
            assert result.ok()
            skill_ids, _ = result.unpack()
            assert skill_ids == []

            await session.delete(project)


class TestGetSkillsInfo:
    @pytest.mark.asyncio
    async def test_returns_skill_info_with_files(self, db_client):
        """get_skills_info returns SkillInfo with file paths."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_6",
                secret_key_hash_phc="test_ls_data_hash_6",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            skill = AgentSkill(
                project_id=project.id,
                name="info-skill",
                description="Info desc",
                disk_id=disk.id,
            )
            session.add(skill)
            await session.flush()

            # Add artifacts to the disk
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="SKILL.md",
                    asset_meta={"content": "test", "mime": "text/markdown"},
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/scripts/",
                    filename="main.py",
                    asset_meta={"content": "print(1)", "mime": "text/x-python"},
                )
            )
            await session.flush()

            result = await get_skills_info(session, [skill.id])
            assert result.ok()
            infos, _ = result.unpack()
            assert len(infos) == 1
            info = infos[0]
            assert info.id == skill.id
            assert info.disk_id == disk.id
            assert info.name == "info-skill"
            assert info.description == "Info desc"
            assert set(info.file_paths) == {"SKILL.md", "scripts/main.py"}

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_empty_skill_ids_returns_empty(self, db_client):
        """get_skills_info with empty list returns empty list."""
        async with db_client.get_session_context() as session:
            result = await get_skills_info(session, [])
            assert result.ok()
            data, _ = result.unpack()
            assert data == []


class TestAddSkillToLearningSpace:
    @pytest.mark.asyncio
    async def test_adds_junction_row(self, db_client):
        """add_skill_to_learning_space creates a LearningSpaceSkill junction."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_ls_data_hmac_7",
                secret_key_hash_phc="test_ls_data_hash_7",
            )
            session.add(project)
            await session.flush()

            ls = LearningSpace(project_id=project.id)
            session.add(ls)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            skill = AgentSkill(
                project_id=project.id,
                name="add-skill",
                description="Add test",
                disk_id=disk.id,
            )
            session.add(skill)
            await session.flush()

            result = await add_skill_to_learning_space(session, ls.id, skill.id)
            assert result.ok()
            ls_skill, _ = result.unpack()
            assert ls_skill.learning_space_id == ls.id
            assert ls_skill.skill_id == skill.id

            # Verify via get_learning_space_skill_ids
            ids_result = await get_learning_space_skill_ids(session, ls.id)
            ids, _ = ids_result.unpack()
            assert skill.id in ids

            await session.delete(project)
