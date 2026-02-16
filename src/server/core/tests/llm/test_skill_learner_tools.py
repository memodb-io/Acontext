"""
Tests for skill learner tool handlers: get_skill, get_skill_file,
str_replace_skill_file, create_skill_file, create_skill, delete_skill_file.

Also covers:
- Thinking guard (has_reported_thinking)
- Path traversal validation
- SKILL.md guards
"""

import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from acontext_core.schema.result import Result
from acontext_core.llm.tool.skill_learner_lib.ctx import SkillLearnerCtx
from acontext_core.service.data.learning_space import SkillInfo
from acontext_core.llm.tool.skill_learner_lib.get_skill import get_skill_handler
from acontext_core.llm.tool.skill_learner_lib.get_skill_file import (
    get_skill_file_handler,
    _validate_file_path,
    _split_file_path,
)
from acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file import (
    str_replace_skill_file_handler,
)
from acontext_core.llm.tool.skill_learner_lib.create_skill_file import (
    create_skill_file_handler,
)
from acontext_core.llm.tool.skill_learner_lib.create_skill import (
    create_skill_handler,
)
from acontext_core.llm.tool.skill_learner_lib.delete_skill_file import (
    delete_skill_file_handler,
)
from acontext_core.llm.tool.skill_learner_tools import (
    _skill_learner_thinking_handler,
    SKILL_LEARNER_TOOLS,
)


def _make_skill_info(
    name: str = "test-skill",
    description: str = "A test skill",
    file_paths: list[str] | None = None,
) -> SkillInfo:
    return SkillInfo(
        id=uuid.uuid4(),
        disk_id=uuid.uuid4(),
        name=name,
        description=description,
        file_paths=file_paths or ["SKILL.md"],
    )


def _make_ctx(
    skills: dict[str, SkillInfo] | None = None,
    has_reported_thinking: bool = False,
) -> SkillLearnerCtx:
    return SkillLearnerCtx(
        db_session=AsyncMock(),
        project_id=uuid.uuid4(),
        learning_space_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        skills=skills or {},
        has_reported_thinking=has_reported_thinking,
    )


# =============================================================================
# get_skill tests
# =============================================================================


class TestGetSkill:
    @pytest.mark.asyncio
    async def test_returns_skill_info(self):
        """get_skill returns skill info with file list."""
        skill = _make_skill_info(
            name="auth-patterns",
            description="Auth best practices",
            file_paths=["SKILL.md", "scripts/check.py"],
        )
        ctx = _make_ctx(skills={"auth-patterns": skill})

        result = await get_skill_handler(ctx, {"skill_name": "auth-patterns"})
        assert result.ok()
        text, _ = result.unpack()
        assert "auth-patterns" in text
        assert "Auth best practices" in text
        assert "SKILL.md" in text
        assert "scripts/check.py" in text

    @pytest.mark.asyncio
    async def test_skill_not_found(self):
        """get_skill returns error for unknown skill."""
        ctx = _make_ctx(skills={"existing": _make_skill_info(name="existing")})
        result = await get_skill_handler(ctx, {"skill_name": "nonexistent"})
        assert result.ok()
        text, _ = result.unpack()
        assert "not found" in text
        assert "existing" in text  # Lists available skills

    @pytest.mark.asyncio
    async def test_works_without_thinking(self):
        """get_skill works regardless of has_reported_thinking."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=False)
        result = await get_skill_handler(ctx, {"skill_name": "test-skill"})
        assert result.ok()
        text, _ = result.unpack()
        assert "test-skill" in text


# =============================================================================
# get_skill_file tests
# =============================================================================


class TestGetSkillFile:
    @pytest.mark.asyncio
    async def test_reads_file_content(self):
        """get_skill_file reads correct file content from artifact."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill})

        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": "# My Skill\nContent here."}

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.get_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await get_skill_file_handler(
                ctx, {"skill_name": "test-skill", "file_path": "SKILL.md"}
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "# My Skill" in text
            assert "Content here." in text

    @pytest.mark.asyncio
    async def test_file_not_found(self):
        """get_skill_file returns error for missing file."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill})

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.get_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.reject("Not found"),
        ):
            result = await get_skill_file_handler(
                ctx, {"skill_name": "test-skill", "file_path": "missing.md"}
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "not found" in text.lower()

    @pytest.mark.asyncio
    async def test_works_without_thinking(self):
        """get_skill_file works regardless of has_reported_thinking."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=False)
        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": "data"}

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.get_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await get_skill_file_handler(
                ctx, {"skill_name": "test-skill", "file_path": "SKILL.md"}
            )
            assert result.ok()


# =============================================================================
# str_replace_skill_file tests
# =============================================================================


class TestStrReplaceSkillFile:
    @pytest.mark.asyncio
    async def test_replaces_string(self):
        """str_replace_skill_file correctly replaces string in file."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": "Hello World", "mime": "text/markdown"}

        with (
            patch(
                "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_artifact_by_path",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_artifact),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.upsert_artifact",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_artifact),
            ) as mock_upsert,
        ):
            result = await str_replace_skill_file_handler(
                ctx,
                {
                    "skill_name": "test-skill",
                    "file_path": "scripts/main.py",
                    "old_string": "Hello",
                    "new_string": "Hi",
                },
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "updated successfully" in text
            # Verify upsert was called with new content
            call_args = mock_upsert.call_args
            asset_meta = call_args[0][4]
            assert asset_meta["content"] == "Hi World"

    @pytest.mark.asyncio
    async def test_rejects_old_string_not_found(self):
        """str_replace_skill_file rejects when old_string is not in file."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": "Hello World", "mime": "text/markdown"}

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await str_replace_skill_file_handler(
                ctx,
                {
                    "skill_name": "test-skill",
                    "file_path": "SKILL.md",
                    "old_string": "NotInFile",
                    "new_string": "Replacement",
                },
            )
            text, _ = result.unpack()
            assert "not found" in text.lower()

    @pytest.mark.asyncio
    async def test_rejects_old_string_multiple_matches(self):
        """str_replace_skill_file rejects when old_string found multiple times."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": "aaa aaa aaa", "mime": "text/plain"}

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await str_replace_skill_file_handler(
                ctx,
                {
                    "skill_name": "test-skill",
                    "file_path": "test.py",
                    "old_string": "aaa",
                    "new_string": "bbb",
                },
            )
            text, _ = result.unpack()
            assert "3 times" in text

    @pytest.mark.asyncio
    async def test_skill_md_updates_description(self):
        """str_replace_skill_file on SKILL.md re-parses YAML and updates description."""
        skill = _make_skill_info(name="my-skill", description="Old description")
        ctx = _make_ctx(skills={"my-skill": skill}, has_reported_thinking=True)

        original_content = "---\nname: my-skill\ndescription: Old description\n---\n# Body"
        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": original_content, "mime": "text/markdown"}

        mock_agent_skill = MagicMock()
        mock_agent_skill.description = "Old description"

        with (
            patch(
                "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_artifact_by_path",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_artifact),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_agent_skill",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_agent_skill),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.upsert_artifact",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_artifact),
            ),
        ):
            result = await str_replace_skill_file_handler(
                ctx,
                {
                    "skill_name": "my-skill",
                    "file_path": "SKILL.md",
                    "old_string": "Old description",
                    "new_string": "New description",
                },
            )
            assert result.ok()
            # Verify AgentSkill.description was updated
            assert mock_agent_skill.description == "New description"
            # Verify context SkillInfo was also updated
            assert skill.description == "New description"

    @pytest.mark.asyncio
    async def test_skill_md_rejects_name_change(self):
        """str_replace_skill_file rejects edits that change the skill name."""
        skill = _make_skill_info(name="my-skill")
        ctx = _make_ctx(skills={"my-skill": skill}, has_reported_thinking=True)

        original_content = "---\nname: my-skill\ndescription: Desc\n---\n# Body"
        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": original_content, "mime": "text/markdown"}

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await str_replace_skill_file_handler(
                ctx,
                {
                    "skill_name": "my-skill",
                    "file_path": "SKILL.md",
                    "old_string": "name: my-skill",
                    "new_string": "name: renamed-skill",
                },
            )
            text, _ = result.unpack()
            assert "forbidden" in text.lower()

    @pytest.mark.asyncio
    async def test_skill_md_rejects_invalid_yaml(self):
        """str_replace_skill_file rejects edit that produces invalid YAML in SKILL.md."""
        skill = _make_skill_info(name="my-skill")
        ctx = _make_ctx(skills={"my-skill": skill}, has_reported_thinking=True)

        original_content = "---\nname: my-skill\ndescription: Desc\n---\n# Body"
        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": original_content, "mime": "text/markdown"}

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await str_replace_skill_file_handler(
                ctx,
                {
                    "skill_name": "my-skill",
                    "file_path": "SKILL.md",
                    "old_string": "name: my-skill\ndescription: Desc",
                    "new_string": "name: [invalid: yaml",
                },
            )
            text, _ = result.unpack()
            assert "rejected" in text.lower()


# =============================================================================
# create_skill_file tests
# =============================================================================


class TestCreateSkillFile:
    @pytest.mark.asyncio
    async def test_creates_new_file(self):
        """create_skill_file creates new artifact with correct content."""
        skill = _make_skill_info(file_paths=["SKILL.md"])
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        mock_artifact = MagicMock()

        with (
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill_file.get_artifact_by_path",
                new_callable=AsyncMock,
                return_value=Result.reject("Not found"),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill_file.upsert_artifact",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_artifact),
            ) as mock_upsert,
        ):
            result = await create_skill_file_handler(
                ctx,
                {
                    "skill_name": "test-skill",
                    "file_path": "scripts/main.py",
                    "content": "print('hello')",
                },
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "created" in text.lower()
            # Verify file_paths updated
            assert "scripts/main.py" in skill.file_paths

    @pytest.mark.asyncio
    async def test_rejects_creating_skill_md(self):
        """create_skill_file rejects creating SKILL.md."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        result = await create_skill_file_handler(
            ctx,
            {
                "skill_name": "test-skill",
                "file_path": "SKILL.md",
                "content": "overwrite",
            },
        )
        text, _ = result.unpack()
        assert "cannot create skill.md" in text.lower()

    @pytest.mark.asyncio
    async def test_rejects_existing_file(self):
        """create_skill_file rejects if file already exists."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        mock_artifact = MagicMock()
        with patch(
            "acontext_core.llm.tool.skill_learner_lib.create_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await create_skill_file_handler(
                ctx,
                {
                    "skill_name": "test-skill",
                    "file_path": "existing.py",
                    "content": "new content",
                },
            )
            text, _ = result.unpack()
            assert "already exists" in text.lower()


# =============================================================================
# create_skill tests
# =============================================================================


class TestCreateSkill:
    @pytest.mark.asyncio
    async def test_creates_skill_and_registers(self):
        """create_skill creates skill, adds to LS, registers in context."""
        ctx = _make_ctx(skills={}, has_reported_thinking=True)

        mock_skill = MagicMock()
        mock_skill.id = uuid.uuid4()
        mock_skill.disk_id = uuid.uuid4()
        mock_skill.name = "new-skill"
        mock_skill.description = "A new skill"

        mock_ls_skill = MagicMock()

        mock_artifact = MagicMock()
        mock_artifact.path = "/"
        mock_artifact.filename = "SKILL.md"

        with (
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill.db_create_skill",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_skill),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill.add_skill_to_learning_space",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_ls_skill),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill.list_artifacts_by_path",
                new_callable=AsyncMock,
                return_value=Result.resolve([mock_artifact]),
            ),
        ):
            content = "---\nname: new-skill\ndescription: A new skill\n---\n# Body"
            result = await create_skill_handler(
                ctx, {"skill_md_content": content}
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "new-skill" in text
            assert "created" in text.lower()
            # Verify skill registered in context
            assert "new-skill" in ctx.skills
            assert ctx.skills["new-skill"].id == mock_skill.id

    @pytest.mark.asyncio
    async def test_uses_ctx_user_id(self):
        """create_skill passes ctx.user_id to the DB function."""
        user_id = uuid.uuid4()
        ctx = _make_ctx(has_reported_thinking=True)
        ctx.user_id = user_id

        mock_skill = MagicMock()
        mock_skill.id = uuid.uuid4()
        mock_skill.disk_id = uuid.uuid4()
        mock_skill.name = "uid-skill"
        mock_skill.description = "Desc"

        with (
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill.db_create_skill",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_skill),
            ) as mock_db_create,
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill.add_skill_to_learning_space",
                new_callable=AsyncMock,
                return_value=Result.resolve(MagicMock()),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill.list_artifacts_by_path",
                new_callable=AsyncMock,
                return_value=Result.resolve([]),
            ),
        ):
            await create_skill_handler(
                ctx,
                {"skill_md_content": "---\nname: uid-skill\ndescription: Desc\n---"},
            )
            # Verify user_id was passed
            call_kwargs = mock_db_create.call_args
            assert call_kwargs.kwargs["user_id"] == user_id


# =============================================================================
# delete_skill_file tests
# =============================================================================


class TestDeleteSkillFile:
    @pytest.mark.asyncio
    async def test_deletes_file(self):
        """delete_skill_file removes artifact and updates context."""
        skill = _make_skill_info(file_paths=["SKILL.md", "scripts/run.sh"])
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        with patch(
            "acontext_core.llm.tool.skill_learner_lib.delete_skill_file.delete_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(None),
        ):
            result = await delete_skill_file_handler(
                ctx,
                {"skill_name": "test-skill", "file_path": "scripts/run.sh"},
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "deleted" in text.lower()
            assert "scripts/run.sh" not in skill.file_paths

    @pytest.mark.asyncio
    async def test_rejects_deleting_skill_md(self):
        """delete_skill_file rejects deleting SKILL.md."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)

        result = await delete_skill_file_handler(
            ctx,
            {"skill_name": "test-skill", "file_path": "SKILL.md"},
        )
        text, _ = result.unpack()
        assert "cannot delete" in text.lower()


# =============================================================================
# Thinking guard tests
# =============================================================================


class TestThinkingGuard:
    @pytest.mark.asyncio
    async def test_editing_tools_reject_without_thinking(self):
        """All editing tools return hint when has_reported_thinking is False."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=False)

        # str_replace_skill_file
        result = await str_replace_skill_file_handler(
            ctx,
            {
                "skill_name": "test-skill",
                "file_path": "SKILL.md",
                "old_string": "a",
                "new_string": "b",
            },
        )
        text, _ = result.unpack()
        assert "report_thinking" in text

        # create_skill_file
        result = await create_skill_file_handler(
            ctx,
            {"skill_name": "test-skill", "file_path": "new.py", "content": "x"},
        )
        text, _ = result.unpack()
        assert "report_thinking" in text

        # create_skill
        result = await create_skill_handler(
            ctx, {"skill_md_content": "---\nname: x\ndescription: x\n---"}
        )
        text, _ = result.unpack()
        assert "report_thinking" in text

        # delete_skill_file
        result = await delete_skill_file_handler(
            ctx, {"skill_name": "test-skill", "file_path": "scripts/run.sh"}
        )
        text, _ = result.unpack()
        assert "report_thinking" in text

    @pytest.mark.asyncio
    async def test_report_thinking_sets_flag(self):
        """report_thinking sets has_reported_thinking to True."""
        ctx = _make_ctx(has_reported_thinking=False)

        with patch(
            "acontext_core.llm.tool.skill_learner_tools._thinking_handler",
            new_callable=AsyncMock,
            return_value=Result.resolve("Thinking logged."),
        ):
            result = await _skill_learner_thinking_handler(
                ctx, {"thinking": "I should update auth-patterns."}
            )
            assert result.ok()
            assert ctx.has_reported_thinking is True

    @pytest.mark.asyncio
    async def test_editing_proceeds_after_report_thinking(self):
        """After report_thinking is called, editing tools proceed normally (e2e)."""
        skill = _make_skill_info(file_paths=["SKILL.md"])
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=False)

        # Step 1: Call report_thinking — should set flag
        with patch(
            "acontext_core.llm.tool.skill_learner_tools._thinking_handler",
            new_callable=AsyncMock,
            return_value=Result.resolve("Thinking logged."),
        ):
            result = await _skill_learner_thinking_handler(
                ctx, {"thinking": "I should create a new file for test-skill."}
            )
            assert result.ok()
            assert ctx.has_reported_thinking is True

        # Step 2: Editing tool should proceed (not be blocked by thinking guard)
        mock_artifact = MagicMock()
        with (
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill_file.get_artifact_by_path",
                new_callable=AsyncMock,
                return_value=Result.reject("Not found"),
            ),
            patch(
                "acontext_core.llm.tool.skill_learner_lib.create_skill_file.upsert_artifact",
                new_callable=AsyncMock,
                return_value=Result.resolve(mock_artifact),
            ),
        ):
            result = await create_skill_file_handler(
                ctx,
                {
                    "skill_name": "test-skill",
                    "file_path": "scripts/new.py",
                    "content": "print('hello')",
                },
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "created" in text.lower()
            # Must NOT contain the thinking guard message
            assert "report_thinking" not in text

    @pytest.mark.asyncio
    async def test_read_tools_work_without_thinking(self):
        """Read-only tools work regardless of has_reported_thinking."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=False)

        # get_skill — no thinking required
        result = await get_skill_handler(ctx, {"skill_name": "test-skill"})
        assert result.ok()
        text, _ = result.unpack()
        assert "report_thinking" not in text

        # get_skill_file — no thinking required
        mock_artifact = MagicMock()
        mock_artifact.asset_meta = {"content": "data"}
        with patch(
            "acontext_core.llm.tool.skill_learner_lib.get_skill_file.get_artifact_by_path",
            new_callable=AsyncMock,
            return_value=Result.resolve(mock_artifact),
        ):
            result = await get_skill_file_handler(
                ctx, {"skill_name": "test-skill", "file_path": "SKILL.md"}
            )
            assert result.ok()
            text, _ = result.unpack()
            assert "report_thinking" not in text


# =============================================================================
# Validation tests (path traversal, etc.)
# =============================================================================


class TestPathValidation:
    def test_validate_rejects_traversal(self):
        """_validate_file_path rejects paths with '..'."""
        assert _validate_file_path("../etc/passwd") is not None
        assert _validate_file_path("foo/../bar") is not None

    def test_validate_rejects_absolute(self):
        """_validate_file_path rejects absolute paths."""
        assert _validate_file_path("/etc/passwd") is not None

    def test_validate_accepts_valid(self):
        """_validate_file_path accepts valid relative paths."""
        assert _validate_file_path("SKILL.md") is None
        assert _validate_file_path("scripts/main.py") is None
        assert _validate_file_path("a/b/c.txt") is None

    def test_split_root_file(self):
        """_split_file_path splits root file correctly."""
        path, filename = _split_file_path("SKILL.md")
        assert path == "/"
        assert filename == "SKILL.md"

    def test_split_nested_file(self):
        """_split_file_path splits nested file correctly."""
        path, filename = _split_file_path("scripts/main.py")
        assert path == "scripts/"
        assert filename == "main.py"

    @pytest.mark.asyncio
    async def test_get_skill_file_rejects_traversal(self):
        """get_skill_file rejects path with '..' traversal."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill})
        result = await get_skill_file_handler(
            ctx, {"skill_name": "test-skill", "file_path": "../secret.txt"}
        )
        text, _ = result.unpack()
        assert "traversal" in text.lower()

    @pytest.mark.asyncio
    async def test_delete_skill_file_rejects_traversal(self):
        """delete_skill_file rejects path with '..' traversal."""
        skill = _make_skill_info()
        ctx = _make_ctx(skills={"test-skill": skill}, has_reported_thinking=True)
        result = await delete_skill_file_handler(
            ctx, {"skill_name": "test-skill", "file_path": "../../etc/passwd"}
        )
        text, _ = result.unpack()
        assert "traversal" in text.lower()


class TestToolPoolRegistration:
    def test_pool_has_8_tools(self):
        """SKILL_LEARNER_TOOLS has all 8 tools."""
        assert len(SKILL_LEARNER_TOOLS) == 8

    def test_pool_tool_names(self):
        """SKILL_LEARNER_TOOLS has correct tool names."""
        expected = {
            "get_skill",
            "get_skill_file",
            "str_replace_skill_file",
            "create_skill_file",
            "create_skill",
            "delete_skill_file",
            "finish",
            "report_thinking",
        }
        assert set(SKILL_LEARNER_TOOLS.keys()) == expected
