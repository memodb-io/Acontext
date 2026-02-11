import pytest
import uuid
from typing import Optional
from acontext_core.service.data.artifact import (
    get_artifact_by_path,
    list_artifacts_by_path,
    glob_artifacts,
    grep_artifacts,
    upsert_artifact,
)
from acontext_core.service.data.disk import create_disk
from acontext_core.service.data.agent_skill import create_skill
from acontext_core.schema.orm import Project, Disk, Artifact
from acontext_core.schema.result import Result


def _make_asset_meta(
    s3_key: str = "test/key",
    mime: str = "text/plain",
    size_b: int = 100,
    content: Optional[str] = None,
) -> dict:
    """Helper to build an asset_meta dict."""
    meta = {
        "bucket": "test-bucket",
        "s3_key": s3_key,
        "etag": "test-etag",
        "sha256": "abc123",
        "mime": mime,
        "size_b": size_b,
    }
    if content is not None:
        meta["content"] = content
    return meta


class TestGetArtifactByPath:
    @pytest.mark.asyncio
    async def test_get_artifact_by_path_found(self, db_client):
        """Fetch an artifact by disk, path, and filename — found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_1",
                secret_key_hash_phc="test_art_hash_1",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            asset_meta = _make_asset_meta(s3_key="assets/test.py", mime="text/x-python")
            artifact = Artifact(
                disk_id=disk.id,
                path="/",
                filename="test.py",
                asset_meta=asset_meta,
            )
            session.add(artifact)
            await session.flush()

            result = await get_artifact_by_path(session, disk.id, "/", "test.py")
            assert result.ok()
            data, error = result.unpack()
            assert error is None
            assert data is not None
            assert data.id == artifact.id
            assert data.asset_meta["s3_key"] == "assets/test.py"
            assert data.asset_meta["mime"] == "text/x-python"
            assert data.asset_meta["size_b"] == 100

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_get_artifact_by_path_not_found(self, db_client):
        """Fetch an artifact with wrong path/filename — not found."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_2",
                secret_key_hash_phc="test_art_hash_2",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            result = await get_artifact_by_path(session, disk.id, "/", "nonexistent.py")
            assert not result.ok()

            await session.delete(project)


class TestListArtifactsByPath:
    @pytest.mark.asyncio
    async def test_list_all(self, db_client):
        """List all artifacts on a disk (path='')."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_3",
                secret_key_hash_phc="test_art_hash_3",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            for name in ["a.py", "b.py", "c.md"]:
                artifact = Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename=name,
                    asset_meta=_make_asset_meta(),
                )
                session.add(artifact)

            artifact_sub = Artifact(
                disk_id=disk.id,
                path="/scripts/",
                filename="run.sh",
                asset_meta=_make_asset_meta(),
            )
            session.add(artifact_sub)
            await session.flush()

            result = await list_artifacts_by_path(session, disk.id, "")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 4

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_filtered(self, db_client):
        """List artifacts filtered by a specific path."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_4",
                secret_key_hash_phc="test_art_hash_4",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="a.py",
                    asset_meta=_make_asset_meta(),
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/scripts/",
                    filename="run.sh",
                    asset_meta=_make_asset_meta(),
                )
            )
            await session.flush()

            result = await list_artifacts_by_path(session, disk.id, "/scripts/")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1
            assert data[0].filename == "run.sh"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_list_empty_disk(self, db_client):
        """List artifacts on a disk with no artifacts — empty list."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_5",
                secret_key_hash_phc="test_art_hash_5",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            result = await list_artifacts_by_path(session, disk.id, "")
            assert result.ok()
            data, _ = result.unpack()
            assert data == []

            await session.delete(project)


class TestGlobArtifacts:
    @pytest.mark.asyncio
    async def test_wildcard_extension(self, db_client):
        """Glob *.py matches only Python files."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_6",
                secret_key_hash_phc="test_art_hash_6",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            for name in ["main.py", "utils.py", "README.md"]:
                session.add(
                    Artifact(
                        disk_id=disk.id,
                        path="/",
                        filename=name,
                        asset_meta=_make_asset_meta(),
                    )
                )
            await session.flush()

            result = await glob_artifacts(session, disk.id, "/*.py")
            assert result.ok()
            data, _ = result.unpack()
            filenames = {a.filename for a in data}
            assert filenames == {"main.py", "utils.py"}

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_path_prefix(self, db_client):
        """Glob /scripts/* matches only artifacts under /scripts/."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_7",
                secret_key_hash_phc="test_art_hash_7",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="root.py",
                    asset_meta=_make_asset_meta(),
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/scripts/",
                    filename="run.sh",
                    asset_meta=_make_asset_meta(),
                )
            )
            await session.flush()

            result = await glob_artifacts(session, disk.id, "/scripts/*")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1
            assert data[0].filename == "run.sh"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_single_char_wildcard(self, db_client):
        """Glob /?.py matches single-char filenames only."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_8",
                secret_key_hash_phc="test_art_hash_8",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="a.py",
                    asset_meta=_make_asset_meta(),
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="main.py",
                    asset_meta=_make_asset_meta(),
                )
            )
            await session.flush()

            result = await glob_artifacts(session, disk.id, "/?.py")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1
            assert data[0].filename == "a.py"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_recursive_pattern(self, db_client):
        """Glob **/*.py matches Python files at any depth."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_9",
                secret_key_hash_phc="test_art_hash_9",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="SKILL.md",
                    asset_meta=_make_asset_meta(),
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/scripts/",
                    filename="run.sh",
                    asset_meta=_make_asset_meta(),
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/scripts/lib/",
                    filename="utils.py",
                    asset_meta=_make_asset_meta(),
                )
            )
            await session.flush()

            # **/*.py should match only utils.py
            result = await glob_artifacts(session, disk.id, "**/*.py")
            assert result.ok()
            data, _ = result.unpack()
            filenames = {a.filename for a in data}
            assert filenames == {"utils.py"}

            # /scripts/** should match run.sh and utils.py
            result = await glob_artifacts(session, disk.id, "/scripts/**")
            assert result.ok()
            data, _ = result.unpack()
            filenames = {a.filename for a in data}
            assert filenames == {"run.sh", "utils.py"}

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_literal_percent_and_underscore(self, db_client):
        """Glob with literal % and _ in filenames — matches API behavior (no escaping)."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_10",
                secret_key_hash_phc="test_art_hash_10",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="100%_done.txt",
                    asset_meta=_make_asset_meta(),
                )
            )
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="other.txt",
                    asset_meta=_make_asset_meta(),
                )
            )
            await session.flush()

            result = await glob_artifacts(session, disk.id, "/*100%*")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1
            assert data[0].filename == "100%_done.txt"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_no_matches(self, db_client):
        """Glob with no matching files — empty list."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_11",
                secret_key_hash_phc="test_art_hash_11",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="main.py",
                    asset_meta=_make_asset_meta(),
                )
            )
            await session.flush()

            result = await glob_artifacts(session, disk.id, "/*.rs")
            assert result.ok()
            data, _ = result.unpack()
            assert data == []

            await session.delete(project)


class TestGrepArtifacts:
    @pytest.mark.asyncio
    async def test_substring_match(self, db_client):
        """Grep for a substring in artifact content."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_12",
                secret_key_hash_phc="test_art_hash_12",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="main.py",
                    asset_meta=_make_asset_meta(
                        content="def hello_world():\n    print('hi')"
                    ),
                )
            )
            await session.flush()

            result = await grep_artifacts(session, disk.id, "hello_world")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1
            assert data[0].filename == "main.py"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_case_insensitive_default(self, db_client):
        """Grep is case-insensitive by default (uses ~* operator)."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_13",
                secret_key_hash_phc="test_art_hash_13",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="readme.md",
                    asset_meta=_make_asset_meta(content="Hello World"),
                )
            )
            await session.flush()

            # Default is case-insensitive — lowercase query SHOULD match
            result = await grep_artifacts(session, disk.id, "hello world")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_case_sensitive(self, db_client):
        """Grep with case_sensitive=True uses ~ (case-sensitive regex)."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_14",
                secret_key_hash_phc="test_art_hash_14",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="readme.md",
                    asset_meta=_make_asset_meta(content="Hello World"),
                )
            )
            await session.flush()

            # Lowercase query should NOT match with case_sensitive=True
            result = await grep_artifacts(
                session, disk.id, "hello world", case_sensitive=True
            )
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 0

            # Exact case should match
            result = await grep_artifacts(
                session, disk.id, "Hello World", case_sensitive=True
            )
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_skips_binary_no_content(self, db_client):
        """Grep skips artifacts without content or with non-text MIME types."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_15",
                secret_key_hash_phc="test_art_hash_15",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            # Binary artifact — no content key
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="image.png",
                    asset_meta=_make_asset_meta(mime="image/png"),
                )
            )
            # Text artifact — has content
            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="main.py",
                    asset_meta=_make_asset_meta(content="def anything(): pass"),
                )
            )
            await session.flush()

            result = await grep_artifacts(session, disk.id, "anything")
            assert result.ok()
            data, _ = result.unpack()
            assert len(data) == 1
            assert data[0].filename == "main.py"

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_no_matches(self, db_client):
        """Grep with no matching content — empty list."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_16",
                secret_key_hash_phc="test_art_hash_16",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            session.add(
                Artifact(
                    disk_id=disk.id,
                    path="/",
                    filename="main.py",
                    asset_meta=_make_asset_meta(content="def foo(): pass"),
                )
            )
            await session.flush()

            result = await grep_artifacts(session, disk.id, "nonexistent_symbol")
            assert result.ok()
            data, _ = result.unpack()
            assert data == []

            await session.delete(project)


class TestUpsertArtifact:
    @pytest.mark.asyncio
    async def test_insert_new(self, db_client):
        """Upsert a new artifact on an empty disk."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_17",
                secret_key_hash_phc="test_art_hash_17",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            asset_meta = _make_asset_meta(s3_key="assets/new.py")
            result = await upsert_artifact(
                session, disk.id, "/", "new.py", asset_meta
            )
            assert result.ok()
            data, _ = result.unpack()
            assert data is not None
            assert data.disk_id == disk.id
            assert data.path == "/"
            assert data.filename == "new.py"
            assert data.asset_meta["s3_key"] == "assets/new.py"

            # Verify via get
            verify = await get_artifact_by_path(session, disk.id, "/", "new.py")
            assert verify.ok()

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_update_existing(self, db_client):
        """Upsert an existing artifact — updates asset_meta, preserves id and created_at."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_18",
                secret_key_hash_phc="test_art_hash_18",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            # First insert
            asset_meta_v1 = _make_asset_meta(s3_key="assets/v1.py")
            result1 = await upsert_artifact(
                session, disk.id, "/", "file.py", asset_meta_v1
            )
            assert result1.ok()
            data1, _ = result1.unpack()
            original_id = data1.id
            original_created_at = data1.created_at

            # Update via upsert
            asset_meta_v2 = _make_asset_meta(s3_key="assets/v2.py")
            result2 = await upsert_artifact(
                session, disk.id, "/", "file.py", asset_meta_v2
            )
            assert result2.ok()
            data2, _ = result2.unpack()

            # Check updated data
            assert data2.asset_meta["s3_key"] == "assets/v2.py"
            # id and created_at should be preserved
            assert data2.id == original_id
            assert data2.created_at == original_created_at

            # Verify only one row exists
            list_result = await list_artifacts_by_path(session, disk.id, "/")
            list_data, _ = list_result.unpack()
            matching = [a for a in list_data if a.filename == "file.py"]
            assert len(matching) == 1

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_updates_updated_at(self, db_client):
        """Upsert updates the updated_at timestamp."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_19",
                secret_key_hash_phc="test_art_hash_19",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            asset_meta = _make_asset_meta(s3_key="assets/ts.py")
            result1 = await upsert_artifact(
                session, disk.id, "/", "ts.py", asset_meta
            )
            data1, _ = result1.unpack()
            original_updated_at = data1.updated_at

            # Upsert again with new data
            asset_meta2 = _make_asset_meta(s3_key="assets/ts_v2.py")
            result2 = await upsert_artifact(
                session, disk.id, "/", "ts.py", asset_meta2
            )
            data2, _ = result2.unpack()

            assert data2.updated_at >= original_updated_at

            await session.delete(project)

    @pytest.mark.asyncio
    async def test_meta_handling(self, db_client):
        """Upsert meta is overwritten, not merged."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_20",
                secret_key_hash_phc="test_art_hash_20",
            )
            session.add(project)
            await session.flush()

            disk = Disk(project_id=project.id)
            session.add(disk)
            await session.flush()

            asset_meta = _make_asset_meta()

            # Insert with meta
            result1 = await upsert_artifact(
                session, disk.id, "/", "meta.py", asset_meta, meta={"key": "value"}
            )
            data1, _ = result1.unpack()
            assert data1.meta == {"key": "value"}

            # Upsert with meta=None
            result2 = await upsert_artifact(
                session, disk.id, "/", "meta.py", asset_meta, meta=None
            )
            data2, _ = result2.unpack()
            assert data2.meta is None

            await session.delete(project)


class TestIntegrationSkillFileList:
    @pytest.mark.asyncio
    async def test_skill_file_list(self, db_client):
        """Integration: Create a skill, then list its artifacts."""
        async with db_client.get_session_context() as session:
            project = Project(
                secret_key_hmac="test_art_hmac_21",
                secret_key_hash_phc="test_art_hash_21",
            )
            session.add(project)
            await session.flush()

            # Create a skill with known content
            content = "---\nname: test-skill\ndescription: A test skill\n---\n# Test Skill\nBody here."
            from acontext_core.service.data.agent_skill import get_agent_skill

            skill_result = await create_skill(session, project.id, content)
            assert skill_result.ok()
            skill, _ = skill_result.unpack()

            # Get the skill and use disk_id to list artifacts
            result = await get_agent_skill(session, project.id, skill.id)
            assert result.ok()
            fetched_skill, _ = result.unpack()

            artifacts_result = await list_artifacts_by_path(
                session, fetched_skill.disk_id, ""
            )
            assert artifacts_result.ok()
            artifacts, _ = artifacts_result.unpack()

            assert len(artifacts) == 1
            assert artifacts[0].filename == "SKILL.md"
            assert artifacts[0].asset_meta["mime"] == "text/markdown"
            assert artifacts[0].asset_meta["content"] == content

            await session.delete(project)
