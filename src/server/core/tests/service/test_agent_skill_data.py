import pytest
import uuid
import hashlib
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from acontext_core.service.data.agent_skill import (
    get_agent_skill,
    create_skill,
    _parse_skill_md,
)
from acontext_core.service.data.artifact import get_artifact_by_path
from acontext_core.schema.orm import Project, Disk, AgentSkill
from acontext_core.schema.result import Result


def _mock_upload_meta(content: str) -> tuple[dict, dict]:
    """Build mock return value for upload_and_build_artifact_meta matching given content."""
    content_bytes = content.encode("utf-8")
    sha256_hex = hashlib.sha256(content_bytes).hexdigest()
    return (
        {
            "bucket": "test-bucket",
            "s3_key": f"disks/test/2026/01/01/{sha256_hex}.md",
            "etag": "test-etag",
            "sha256": sha256_hex,
            "mime": "text/markdown",
            "size_b": len(content_bytes),
            "content": content,
        },
        {
            "__artifact_info__": {
                "path": "/",
                "filename": "SKILL.md",
                "mime": "text/markdown",
                "size": len(content_bytes),
            }
        },
    )


class TestParseSkillMd:
    def test_with_front_matter(self):
        """Parse SKILL.md with YAML front matter delimiters."""
        content = "---\nname: my-skill\ndescription: A test skill\n---\n# Body"
        name, desc = _parse_skill_md(content)
        assert name == "my-skill"
        assert desc == "A test skill"

    def test_without_delimiters(self):
        """Parse SKILL.md without front matter delimiters (plain YAML)."""
        content = "name: my-skill\ndescription: A test skill"
        name, desc = _parse_skill_md(content)
        assert name == "my-skill"
        assert desc == "A test skill"

    def test_missing_name(self):
        """Parse SKILL.md missing name — raises ValueError."""
        content = "---\ndescription: only desc\n---"
        with pytest.raises(ValueError, match="name"):
            _parse_skill_md(content)

    def test_missing_description(self):
        """Parse SKILL.md missing description — raises ValueError."""
        content = "---\nname: no-desc\n---"
        with pytest.raises(ValueError, match="description"):
            _parse_skill_md(content)

    def test_empty_content(self):
        """Parse empty SKILL.md — raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            _parse_skill_md("")

    def test_invalid_yaml_syntax(self):
        """Parse SKILL.md with invalid YAML — raises ValueError."""
        content = "---\nname: [invalid: yaml\n---"
        with pytest.raises(ValueError, match="Invalid YAML"):
            _parse_skill_md(content)

    def test_extra_fields_ignored(self):
        """Parse SKILL.md with extra fields — silently ignored."""
        content = "---\nname: s\ndescription: d\nversion: 1.0\n---"
        name, desc = _parse_skill_md(content)
        assert name == "s"
        assert desc == "d"


class TestGetAgentSkill:
    @pytest.mark.asyncio
    async def test_get_agent_skill_found(self, db_client):
        """Fetch a skill by project and skill id — found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_1",
                secret_key_hash_phc="test_skill_hash_1",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            skill = AgentSkill(
                project_id=project.id,
                name="test-skill",
                description="A test skill",
                disk_id=disk.id,
            )
            session.add(skill)
            await session.flush()

            result = await get_agent_skill(session, project.id, skill.id)
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.id == skill.id
            assert data.name == "test-skill"
            assert data.description == "A test skill"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_agent_skill_not_found_wrong_project(self, db_client):
        """Fetch a skill with wrong project_id — not found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_2",
                secret_key_hash_phc="test_skill_hash_2",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            skill = AgentSkill(
                project_id=project.id,
                name="test-skill",
                description="desc",
                disk_id=disk.id,
            )
            session.add(skill)
            await session.flush()

            other_project_id = uuid.uuid4()
            result = await get_agent_skill(session, other_project_id, skill.id)
            assert not result.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_agent_skill_not_found_missing_id(self, db_client):
        """Fetch a skill with non-existent skill_id — not found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_3",
                secret_key_hash_phc="test_skill_hash_3",
            )
            session.add(project)
            await session.flush()

            missing_id = uuid.uuid4()
            result = await get_agent_skill(session, project.id, missing_id)
            assert not result.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_relationship_project_agent_skills(self, db_client):
        """Relationship: Project.agent_skills loads the skill."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_4",
                secret_key_hash_phc="test_skill_hash_4",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            skill = AgentSkill(
                project_id=project.id,
                name="rel-skill",
                description="desc",
                disk_id=disk.id,
            )
            session.add(skill)
            await session.flush()

            # Refresh the project to load the agent_skills relationship from DB
            await session.refresh(project, attribute_names=["agent_skills"])
            assert len(project.agent_skills) == 1
            assert project.agent_skills[0].name == "rel-skill"

            # Delete skill and disk first to avoid SQLAlchemy trying to NULL
            # out FKs on loaded relationship children during project deletion
            await session.delete(skill)
            await session.delete(disk)
            await session.flush()
            await session.delete(project)


class TestCreateSkill:
    @pytest.mark.asyncio
    async def test_create_skill_success(self, db_client):
        """Create a skill from valid SKILL.md content — success."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_5",
                secret_key_hash_phc="test_skill_hash_5",
            )
            session.add(project)
            await session.flush()

            content = "---\nname: test-skill\ndescription: A great skill\n---\n# Test\nBody."
            with patch(
                "acontext_core.service.data.agent_skill.upload_and_build_artifact_meta",
                new_callable=AsyncMock,
                return_value=_mock_upload_meta(content),
            ):
                result = await create_skill(session, project.id, content)
            assert result.ok()
            skill, error = result.unpack()
            assert error is None
            assert skill is not None
            assert skill.name == "test-skill"
            assert skill.description == "A great skill"
            assert skill.project_id == project.id
            assert skill.disk_id is not None

            # Verify SKILL.md artifact exists on the disk
            art_result = await get_artifact_by_path(
                session, skill.disk_id, "/", "SKILL.md"
            )
            assert art_result.ok()
            artifact, _ = art_result.unpack()
            assert artifact.asset_meta["content"] == content

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_skill_with_meta(self, db_client):
        """Create a skill with meta (user_id=None since Core has no User ORM)."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_6",
                secret_key_hash_phc="test_skill_hash_6",
            )
            session.add(project)
            await session.flush()

            content = "---\nname: meta-skill\ndescription: With meta\n---"
            with patch(
                "acontext_core.service.data.agent_skill.upload_and_build_artifact_meta",
                new_callable=AsyncMock,
                return_value=_mock_upload_meta(content),
            ):
                result = await create_skill(
                    session,
                    project.id,
                    content,
                    meta={"version": "1.0"},
                )
            assert result.ok()
            skill, _ = result.unpack()
            assert skill.user_id is None
            assert skill.meta == {"version": "1.0"}

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_skill_name_sanitization(self, db_client):
        """Create a skill with special characters in name — sanitized."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_7",
                secret_key_hash_phc="test_skill_hash_7",
            )
            session.add(project)
            await session.flush()

            content = '---\nname: "my skill/v2"\ndescription: Sanitize test\n---'
            with patch(
                "acontext_core.service.data.agent_skill.upload_and_build_artifact_meta",
                new_callable=AsyncMock,
                return_value=_mock_upload_meta(content),
            ):
                result = await create_skill(session, project.id, content)
            assert result.ok()
            skill, _ = result.unpack()
            assert skill.name == "my-skill-v2"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_skill_invalid_missing_name(self, db_client):
        """Create a skill with content missing name — rejects."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_8",
                secret_key_hash_phc="test_skill_hash_8",
            )
            session.add(project)
            await session.flush()

            content = "---\ndescription: no name here\n---"
            result = await create_skill(session, project.id, content)
            assert not result.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_skill_invalid_empty_content(self, db_client):
        """Create a skill with empty content — rejects."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_9",
                secret_key_hash_phc="test_skill_hash_9",
            )
            session.add(project)
            await session.flush()

            result = await create_skill(session, project.id, "")
            assert not result.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_create_skill_sha256_and_size_b(self, db_client):
        """Create a skill — verify sha256 and size_b in artifact asset_meta."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_skill_hmac_10",
                secret_key_hash_phc="test_skill_hash_10",
            )
            session.add(project)
            await session.flush()

            content = "---\nname: hash-skill\ndescription: Hash test\n---\n# Content"
            with patch(
                "acontext_core.service.data.agent_skill.upload_and_build_artifact_meta",
                new_callable=AsyncMock,
                return_value=_mock_upload_meta(content),
            ):
                result = await create_skill(session, project.id, content)
            assert result.ok()
            skill, _ = result.unpack()

            art_result = await get_artifact_by_path(
                session, skill.disk_id, "/", "SKILL.md"
            )
            assert art_result.ok()
            artifact, _ = art_result.unpack()

            expected_sha = hashlib.sha256(content.encode("utf-8")).hexdigest()
            expected_size = len(content.encode("utf-8"))

            assert artifact.asset_meta["sha256"] == expected_sha
            assert artifact.asset_meta["size_b"] == expected_size

            await session.delete(project)
