"""Tests for agent tools (DISK_TOOLS and SKILL_TOOLS)."""

import json
from unittest.mock import MagicMock, patch

import pytest

from acontext.agent.disk import DISK_TOOLS, DiskContext
from acontext.agent.skill import SKILL_TOOLS, SkillContext
from acontext.client import AcontextClient
from acontext.types.disk import Artifact, GetArtifactResp
from acontext.types.skill import GetSkillFileResp, Skill
from acontext.uploads import FileUpload


@pytest.fixture
def mock_client() -> AcontextClient:
    """Create a mock client for testing."""
    client = AcontextClient(api_key="test-token", base_url="http://test.api")
    return client


@pytest.fixture
def disk_ctx(mock_client: AcontextClient) -> DiskContext:
    """Create a disk context for testing."""
    return DISK_TOOLS.format_context(mock_client, "disk-123")


@pytest.fixture
def skill_ctx(mock_client: AcontextClient) -> SkillContext:
    """Create a skill context for testing."""
    return SKILL_TOOLS.format_context(mock_client)


class TestDiskTools:
    """Tests for DISK_TOOLS."""

    def test_disk_tools_schema_generation(self) -> None:
        """Test that tools can generate OpenAI tool schemas."""
        schemas = DISK_TOOLS.to_openai_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 4  # write_file, read_file, replace_string, list_artifacts

        tool_names = [s["function"]["name"] for s in schemas]
        assert "write_file" in tool_names
        assert "read_file" in tool_names
        assert "replace_string" in tool_names
        assert "list_artifacts" in tool_names

    def test_disk_tools_anthropic_schema(self) -> None:
        """Test Anthropic tool schema generation."""
        schemas = DISK_TOOLS.to_anthropic_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 4

    def test_disk_tools_tool_exists(self) -> None:
        """Test tool_exists method."""
        assert DISK_TOOLS.tool_exists("write_file")
        assert DISK_TOOLS.tool_exists("read_file")
        assert not DISK_TOOLS.tool_exists("nonexistent_tool")

    @patch("acontext.client.AcontextClient.request")
    def test_write_file_tool(self, mock_request: MagicMock, disk_ctx: DiskContext) -> None:
        """Test write_file tool execution."""
        mock_request.return_value = {
            "disk_id": "disk-123",
            "path": "/test.txt",
            "filename": "test.txt",
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        result = DISK_TOOLS.execute_tool(
            disk_ctx,
            "write_file",
            {"filename": "test.txt", "content": "Hello, world!"},
        )

        assert "written successfully" in result.lower()
        mock_request.assert_called_once()
        args, kwargs = mock_request.call_args
        assert args[0] == "POST"
        assert args[1] == "/disk/disk-123/artifact"

    @patch("acontext.client.AcontextClient.request")
    def test_read_file_tool(self, mock_request: MagicMock, disk_ctx: DiskContext) -> None:
        """Test read_file tool execution."""
        mock_request.return_value = {
            "artifact": {
                "disk_id": "disk-123",
                "path": "/test.txt",
                "filename": "test.txt",
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            "content": {
                "type": "text",
                "raw": "Line 1\nLine 2\nLine 3\nLine 4\nLine 5",
            },
        }

        result = DISK_TOOLS.execute_tool(
            disk_ctx,
            "read_file",
            {"filename": "test.txt", "line_offset": 1, "line_limit": 2},
        )

        assert "Line 2" in result
        assert "Line 3" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_replace_string_tool(
        self, mock_request: MagicMock, disk_ctx: DiskContext
    ) -> None:
        """Test replace_string tool execution."""
        # Mock read response
        read_response = {
            "artifact": {
                "disk_id": "disk-123",
                "path": "/test.txt",
                "filename": "test.txt",
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            "content": {
                "type": "text",
                "raw": "Hello, world! Hello again!",
            },
        }
        # Mock write response
        write_response = {
            "disk_id": "disk-123",
            "path": "/test.txt",
            "filename": "test.txt",
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        mock_request.side_effect = [read_response, write_response]

        result = DISK_TOOLS.execute_tool(
            disk_ctx,
            "replace_string",
            {
                "filename": "test.txt",
                "old_string": "Hello",
                "new_string": "Hi",
            },
        )

        assert "replaced" in result.lower()
        assert mock_request.call_count == 2  # One read, one write

    @patch("acontext.client.AcontextClient.request")
    def test_list_artifacts_tool(
        self, mock_request: MagicMock, disk_ctx: DiskContext
    ) -> None:
        """Test list_artifacts tool execution."""
        mock_request.return_value = {
            "artifacts": [
                {
                    "disk_id": "disk-123",
                    "path": "/file1.txt",
                    "filename": "file1.txt",
                    "meta": {},
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z",
                }
            ],
            "directories": ["/subdir/"],
        }

        result = DISK_TOOLS.execute_tool(
            disk_ctx,
            "list_artifacts",
            {"file_path": "/"},
        )

        assert "file1.txt" in result
        assert "subdir" in result.lower()
        mock_request.assert_called_once()

    def test_write_file_tool_validation(self, disk_ctx: DiskContext) -> None:
        """Test write_file tool parameter validation."""
        with pytest.raises(ValueError, match="filename is required"):
            DISK_TOOLS.execute_tool(disk_ctx, "write_file", {"content": "test"})

        with pytest.raises(ValueError, match="content is required"):
            DISK_TOOLS.execute_tool(disk_ctx, "write_file", {"filename": "test.txt"})


class TestSkillTools:
    """Tests for SKILL_TOOLS."""

    def test_skill_tools_schema_generation(self) -> None:
        """Test that tools can generate OpenAI tool schemas."""
        schemas = SKILL_TOOLS.to_openai_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 6  # All 6 skill tools

        tool_names = [s["function"]["name"] for s in schemas]
        assert "create_skill" in tool_names
        assert "get_skill" in tool_names
        assert "list_skills" in tool_names
        assert "update_skill" in tool_names
        assert "delete_skill" in tool_names
        assert "get_skill_file" in tool_names

    def test_skill_tools_anthropic_schema(self) -> None:
        """Test Anthropic tool schema generation."""
        schemas = SKILL_TOOLS.to_anthropic_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 6

    def test_skill_tools_tool_exists(self) -> None:
        """Test tool_exists method."""
        assert SKILL_TOOLS.tool_exists("create_skill")
        assert SKILL_TOOLS.tool_exists("get_skill")
        assert not SKILL_TOOLS.tool_exists("nonexistent_tool")

    @patch("builtins.open", create=True)
    @patch("acontext.client.AcontextClient.request")
    def test_create_skill_tool(
        self, mock_request: MagicMock, mock_open: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test create_skill tool execution."""
        # Mock file reading
        mock_file = MagicMock()
        mock_file.read.return_value = b"zip content"
        mock_open.return_value.__enter__.return_value = mock_file

        mock_request.return_value = {
            "id": "skill-1",
            "project_id": "project-id",
            "name": "test-skill",
            "description": "Test skill",
            "file_index": ["SKILL.md"],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "create_skill",
            {"file_path": "/tmp/test.zip"},
        )

        assert "created successfully" in result.lower()
        assert "test-skill" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_by_id_tool(
        self, mock_request: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test get_skill tool with ID."""
        mock_request.return_value = {
            "id": "skill-1",
            "project_id": "project-id",
            "name": "test-skill",
            "description": "Test skill",
            "file_index": ["SKILL.md", "scripts/main.py"],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "get_skill",
            {"skill_id": "skill-1"},
        )

        assert "test-skill" in result
        assert "Test skill" in result
        assert "2 file(s)" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_by_name_tool(
        self, mock_request: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test get_skill tool with name."""
        mock_request.return_value = {
            "id": "skill-1",
            "project_id": "project-id",
            "name": "test-skill",
            "description": "Test skill",
            "file_index": ["SKILL.md"],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "get_skill",
            {"name": "test-skill"},
        )

        assert "test-skill" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_list_skills_tool(
        self, mock_request: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test list_skills tool execution."""
        mock_request.return_value = {
            "items": [
                {
                    "id": "skill-1",
                    "project_id": "project-id",
                    "name": "skill-1",
                    "description": "First skill",
                    "file_index": ["SKILL.md"],
                    "meta": {},
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z",
                },
                {
                    "id": "skill-2",
                    "project_id": "project-id",
                    "name": "skill-2",
                    "description": "Second skill",
                    "file_index": ["SKILL.md", "scripts/main.py"],
                    "meta": {},
                    "created_at": "2024-01-02T00:00:00Z",
                    "updated_at": "2024-01-02T00:00:00Z",
                },
            ],
            "next_cursor": None,
            "has_more": False,
        }

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "list_skills",
            {"limit": 20},
        )

        assert "2 skill(s)" in result
        assert "skill-1" in result
        assert "skill-2" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_update_skill_tool(
        self, mock_request: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test update_skill tool execution."""
        mock_request.return_value = {
            "id": "skill-1",
            "project_id": "project-id",
            "name": "updated-skill",
            "description": "Updated description",
            "file_index": ["SKILL.md"],
            "meta": {"version": "2.0"},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-02T00:00:00Z",
        }

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "update_skill",
            {
                "skill_id": "skill-1",
                "name": "updated-skill",
                "description": "Updated description",
            },
        )

        assert "updated successfully" in result.lower()
        assert "updated-skill" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_delete_skill_tool(
        self, mock_request: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test delete_skill tool execution."""
        # Mock get call (to get skill name before deletion)
        get_response = {
            "id": "skill-1",
            "project_id": "project-id",
            "name": "test-skill",
            "description": "Test skill",
            "file_index": ["SKILL.md"],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
        # Mock delete call
        mock_request.side_effect = [get_response, None]

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "delete_skill",
            {"skill_id": "skill-1"},
        )

        assert "deleted successfully" in result.lower()
        assert "test-skill" in result
        assert mock_request.call_count == 2  # One get, one delete

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_file_tool(
        self, mock_request: MagicMock, skill_ctx: SkillContext
    ) -> None:
        """Test get_skill_file tool execution."""
        mock_request.return_value = {
            "path": "scripts/main.py",
            "mime": "text/x-python",
            "content": {"type": "code", "raw": "print('Hello, World!')"},
        }

        result = SKILL_TOOLS.execute_tool(
            skill_ctx,
            "get_skill_file",
            {
                "skill_id": "skill-1",
                "file_path": "scripts/main.py",
            },
        )

        assert "scripts/main.py" in result
        assert "text/x-python" in result
        assert "Hello, World!" in result
        mock_request.assert_called_once()

    def test_get_skill_tool_validation(self, skill_ctx: SkillContext) -> None:
        """Test get_skill tool parameter validation."""
        with pytest.raises(ValueError, match="Either skill_id or name must be provided"):
            SKILL_TOOLS.execute_tool(skill_ctx, "get_skill", {})

    def test_create_skill_tool_validation(self, skill_ctx: SkillContext) -> None:
        """Test create_skill tool parameter validation."""
        with pytest.raises(ValueError, match="file_path is required"):
            SKILL_TOOLS.execute_tool(skill_ctx, "create_skill", {})

    def test_update_skill_tool_validation(self, skill_ctx: SkillContext) -> None:
        """Test update_skill tool parameter validation."""
        with pytest.raises(ValueError, match="skill_id is required"):
            SKILL_TOOLS.execute_tool(skill_ctx, "update_skill", {})

        with pytest.raises(
            ValueError, match="At least one of name, description, or meta must be provided"
        ):
            SKILL_TOOLS.execute_tool(
                skill_ctx, "update_skill", {"skill_id": "skill-1"}
            )

