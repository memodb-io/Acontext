"""Tests for agent tools (DISK_TOOLS, SKILL_TOOLS, and SANDBOX_TOOLS)."""

from unittest.mock import MagicMock, patch

import pytest

from acontext.agent.disk import DISK_TOOLS, DiskContext
from acontext.agent.sandbox import SANDBOX_TOOLS
from acontext.agent.skill import SKILL_TOOLS, SkillContext
from acontext.client import AcontextClient


def _validate_openai_schema_properties(properties: dict, path: str = "") -> None:
    """Validate that OpenAI tool schema properties are correctly defined.

    OpenAI requires array types to have 'items' defined.

    Args:
        properties: The properties dict from a JSON schema.
        path: Current path for error messages.

    Raises:
        AssertionError: If schema validation fails.
    """
    for prop_name, prop_schema in properties.items():
        current_path = f"{path}.{prop_name}" if path else prop_name
        prop_type = prop_schema.get("type")

        # Handle type as list (e.g., ["array", "null"])
        types_to_check = prop_type if isinstance(prop_type, list) else [prop_type]

        for t in types_to_check:
            if t == "array":
                assert "items" in prop_schema, (
                    f"Property '{current_path}' has type 'array' but missing 'items'. "
                    f"OpenAI requires array schemas to define items."
                )

        # Recursively check nested properties
        if "properties" in prop_schema:
            _validate_openai_schema_properties(
                prop_schema["properties"], current_path
            )


@pytest.fixture
def mock_client() -> AcontextClient:
    """Create a mock client for testing."""
    client = AcontextClient(api_key="test-token", base_url="http://test.api")
    return client


@pytest.fixture
def disk_ctx(mock_client: AcontextClient) -> DiskContext:
    """Create a disk context for testing."""
    return DISK_TOOLS.format_context(mock_client, "disk-123")


class TestDiskTools:
    """Tests for DISK_TOOLS."""

    def test_disk_tools_schema_generation(self) -> None:
        """Test that tools can generate OpenAI tool schemas."""
        schemas = DISK_TOOLS.to_openai_tool_schema()
        assert isinstance(schemas, list)
        assert (
            len(schemas) == 7
        )  # write_file_disk, read_file_disk, replace_string_disk, list_disk, grep_disk, glob_disk, download_file_disk

        tool_names = [s["function"]["name"] for s in schemas]
        assert "write_file_disk" in tool_names
        assert "read_file_disk" in tool_names
        assert "replace_string_disk" in tool_names
        assert "list_disk" in tool_names
        assert "grep_disk" in tool_names
        assert "glob_disk" in tool_names
        assert "download_file_disk" in tool_names

    def test_disk_tools_anthropic_schema(self) -> None:
        """Test Anthropic tool schema generation."""
        schemas = DISK_TOOLS.to_anthropic_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 7

    def test_disk_tools_tool_exists(self) -> None:
        """Test tool_exists method."""
        assert DISK_TOOLS.tool_exists("write_file_disk")
        assert DISK_TOOLS.tool_exists("read_file_disk")
        assert not DISK_TOOLS.tool_exists("nonexistent_tool")

    @patch("acontext.client.AcontextClient.request")
    def test_write_file_tool(
        self, mock_request: MagicMock, disk_ctx: DiskContext
    ) -> None:
        """Test write_file_disk tool execution."""
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
            "write_file_disk",
            {"filename": "test.txt", "content": "Hello, world!"},
        )

        assert "written successfully" in result.lower()
        mock_request.assert_called_once()
        args, kwargs = mock_request.call_args
        assert args[0] == "POST"
        assert args[1] == "/disk/disk-123/artifact"

    @patch("acontext.client.AcontextClient.request")
    def test_read_file_tool(
        self, mock_request: MagicMock, disk_ctx: DiskContext
    ) -> None:
        """Test read_file_disk tool execution."""
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
            "read_file_disk",
            {"filename": "test.txt", "line_offset": 1, "line_limit": 2},
        )

        assert "Line 2" in result
        assert "Line 3" in result
        mock_request.assert_called_once()

    @patch("acontext.client.AcontextClient.request")
    def test_replace_string_tool(
        self, mock_request: MagicMock, disk_ctx: DiskContext
    ) -> None:
        """Test replace_string_disk tool execution."""
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
            "replace_string_disk",
            {
                "filename": "test.txt",
                "old_string": "Hello",
                "new_string": "Hi",
            },
        )

        assert "replaced" in result.lower()
        assert mock_request.call_count == 2  # One read, one write

    @patch("acontext.client.AcontextClient.request")
    def test_list_tool(self, mock_request: MagicMock, disk_ctx: DiskContext) -> None:
        """Test list_disk tool execution."""
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
            "list_disk",
            {"file_path": "/"},
        )

        assert "file1.txt" in result
        assert "subdir" in result.lower()
        mock_request.assert_called_once()

    def test_write_file_tool_validation(self, disk_ctx: DiskContext) -> None:
        """Test write_file_disk tool parameter validation."""
        with pytest.raises(ValueError, match="filename is required"):
            DISK_TOOLS.execute_tool(disk_ctx, "write_file_disk", {"content": "test"})

        with pytest.raises(ValueError, match="content is required"):
            DISK_TOOLS.execute_tool(disk_ctx, "write_file_disk", {"filename": "test.txt"})


class TestSkillTools:
    """Tests for SKILL_TOOLS."""

    def test_skill_tools_schema_generation(self) -> None:
        """Test that tools can generate OpenAI tool schemas."""
        schemas = SKILL_TOOLS.to_openai_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 2  # get_skill, get_skill_file

        tool_names = [s["function"]["name"] for s in schemas]
        assert "get_skill" in tool_names
        assert "get_skill_file" in tool_names

    def test_skill_tools_anthropic_schema(self) -> None:
        """Test Anthropic tool schema generation."""
        schemas = SKILL_TOOLS.to_anthropic_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 2

    def test_skill_tools_tool_exists(self) -> None:
        """Test tool_exists method."""
        assert SKILL_TOOLS.tool_exists("get_skill")
        assert SKILL_TOOLS.tool_exists("get_skill_file")
        assert not SKILL_TOOLS.tool_exists("nonexistent_tool")

    @patch("acontext.client.AcontextClient.request")
    def test_skill_context_creation(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test SkillContext.create preloads skills and maps by name."""
        mock_request.side_effect = [
            {
                "id": "skill-1",
                "name": "test-skill",
                "description": "Test skill",
                "disk_id": "disk-1",
                "file_index": [{"path": "SKILL.md", "mime": "text/markdown"}],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            {
                "id": "skill-2",
                "name": "another-skill",
                "description": "Another skill",
                "disk_id": "disk-2",
                "file_index": [],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
        ]

        ctx = SkillContext.create(mock_client, ["skill-1", "skill-2"])

        assert len(ctx.skills) == 2
        assert "test-skill" in ctx.skills
        assert "another-skill" in ctx.skills
        assert ctx.skills["test-skill"].id == "skill-1"
        assert ctx.skills["another-skill"].id == "skill-2"
        assert mock_request.call_count == 2

    @patch("acontext.client.AcontextClient.request")
    def test_skill_context_duplicate_name_error(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test SkillContext.create raises error on duplicate skill names."""
        mock_request.side_effect = [
            {
                "id": "skill-1",
                "name": "same-name",
                "description": "First skill",
                "disk_id": "disk-1",
                "file_index": [],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            {
                "id": "skill-2",
                "name": "same-name",
                "description": "Second skill with same name",
                "disk_id": "disk-2",
                "file_index": [],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
        ]

        with pytest.raises(ValueError, match="Duplicate skill name"):
            SkillContext.create(mock_client, ["skill-1", "skill-2"])

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_tool(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test get_skill tool execution."""
        mock_request.return_value = {
            "id": "skill-1",
            "name": "test-skill",
            "description": "Test skill",
            "disk_id": "disk-1",
            "file_index": [
                {"path": "SKILL.md", "mime": "text/markdown"},
                {"path": "scripts/main.py", "mime": "text/x-python"},
            ],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        ctx = SKILL_TOOLS.format_context(mock_client, ["skill-1"])
        result = SKILL_TOOLS.execute_tool(
            ctx,
            "get_skill",
            {"skill_name": "test-skill"},
        )

        assert "test-skill" in result
        assert "Test skill" in result
        assert "2 file(s)" in result
        # Check that all files are listed with path and mime
        assert "SKILL.md" in result
        assert "text/markdown" in result
        assert "scripts/main.py" in result
        assert "text/x-python" in result

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_file_tool(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test get_skill_file tool execution."""
        # First call for context creation, second for get_file
        mock_request.side_effect = [
            {
                "id": "skill-1",
                "name": "test-skill",
                "description": "Test skill",
                "disk_id": "disk-1",
                "file_index": [{"path": "scripts/main.py", "mime": "text/x-python"}],
                "meta": {},
                "created_at": "2024-01-01T00:00:00Z",
                "updated_at": "2024-01-01T00:00:00Z",
            },
            {
                "path": "scripts/main.py",
                "mime": "text/x-python",
                "content": {"type": "code", "raw": "print('Hello, World!')"},
            },
        ]

        ctx = SKILL_TOOLS.format_context(mock_client, ["skill-1"])
        result = SKILL_TOOLS.execute_tool(
            ctx,
            "get_skill_file",
            {
                "skill_name": "test-skill",
                "file_path": "scripts/main.py",
            },
        )

        assert "scripts/main.py" in result
        assert "text/x-python" in result
        assert "Hello, World!" in result
        assert mock_request.call_count == 2

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_tool_not_found(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test get_skill tool with skill not in context."""
        mock_request.return_value = {
            "id": "skill-1",
            "name": "test-skill",
            "description": "Test skill",
            "disk_id": "disk-1",
            "file_index": [],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }

        ctx = SKILL_TOOLS.format_context(mock_client, ["skill-1"])

        with pytest.raises(
            ValueError, match="Skill 'unknown-skill' not found in context"
        ):
            SKILL_TOOLS.execute_tool(ctx, "get_skill", {"skill_name": "unknown-skill"})

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_tool_validation(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test get_skill tool parameter validation."""
        mock_request.return_value = {
            "id": "skill-1",
            "name": "test-skill",
            "description": "Test skill",
            "disk_id": "disk-1",
            "file_index": [],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
        ctx = SKILL_TOOLS.format_context(mock_client, ["skill-1"])

        with pytest.raises(ValueError, match="skill_name is required"):
            SKILL_TOOLS.execute_tool(ctx, "get_skill", {})

    @patch("acontext.client.AcontextClient.request")
    def test_get_skill_file_tool_validation(
        self, mock_request: MagicMock, mock_client: AcontextClient
    ) -> None:
        """Test get_skill_file tool parameter validation."""
        mock_request.return_value = {
            "id": "skill-1",
            "name": "test-skill",
            "description": "Test skill",
            "disk_id": "disk-1",
            "file_index": [],
            "meta": {},
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z",
        }
        ctx = SKILL_TOOLS.format_context(mock_client, ["skill-1"])

        with pytest.raises(ValueError, match="skill_name is required"):
            SKILL_TOOLS.execute_tool(ctx, "get_skill_file", {"file_path": "test.py"})

        with pytest.raises(ValueError, match="file_path is required"):
            SKILL_TOOLS.execute_tool(
                ctx, "get_skill_file", {"skill_name": "test-skill"}
            )


class TestSandboxTools:
    """Tests for SANDBOX_TOOLS."""

    def test_sandbox_tools_schema_generation(self) -> None:
        """Test that tools can generate OpenAI tool schemas."""
        schemas = SANDBOX_TOOLS.to_openai_tool_schema()
        assert isinstance(schemas, list)
        assert (
            len(schemas) == 3
        )  # bash_execution_sandbox, text_editor_sandbox, export_file_sandbox

        tool_names = [s["function"]["name"] for s in schemas]
        assert "bash_execution_sandbox" in tool_names
        assert "text_editor_sandbox" in tool_names
        assert "export_file_sandbox" in tool_names

    def test_sandbox_tools_anthropic_schema(self) -> None:
        """Test Anthropic tool schema generation."""
        schemas = SANDBOX_TOOLS.to_anthropic_tool_schema()
        assert isinstance(schemas, list)
        assert len(schemas) == 3

    def test_sandbox_tools_tool_exists(self) -> None:
        """Test tool_exists method."""
        assert SANDBOX_TOOLS.tool_exists("bash_execution_sandbox")
        assert SANDBOX_TOOLS.tool_exists("text_editor_sandbox")
        assert SANDBOX_TOOLS.tool_exists("export_file_sandbox")
        assert not SANDBOX_TOOLS.tool_exists("nonexistent_tool")

    def test_openai_schema_array_types_have_items(self) -> None:
        """Test that all array types in OpenAI schema have 'items' defined.

        OpenAI Function Calling requires array types to specify their items schema.
        This test ensures we don't regress on this requirement.
        """
        schemas = SANDBOX_TOOLS.to_openai_tool_schema()

        for schema in schemas:
            func_name = schema["function"]["name"]
            properties = schema["function"]["parameters"].get("properties", {})
            _validate_openai_schema_properties(properties, func_name)

    def test_text_editor_view_range_schema(self) -> None:
        """Test that text_editor_sandbox view_range has correct schema."""
        schemas = SANDBOX_TOOLS.to_openai_tool_schema()

        text_editor_schema = next(
            s for s in schemas if s["function"]["name"] == "text_editor_sandbox"
        )
        properties = text_editor_schema["function"]["parameters"]["properties"]

        # view_range should be array|null with items
        view_range = properties["view_range"]
        assert view_range["type"] == ["array", "null"]
        assert "items" in view_range
        assert view_range["items"]["type"] == "integer"


class TestAllToolsSchemaValidation:
    """Cross-cutting tests for all tool pools."""

    def test_all_tool_pools_openai_schema_valid(self) -> None:
        """Validate OpenAI schemas for all tool pools have valid array definitions."""
        tool_pools = [
            ("DISK_TOOLS", DISK_TOOLS),
            ("SKILL_TOOLS", SKILL_TOOLS),
            ("SANDBOX_TOOLS", SANDBOX_TOOLS),
        ]

        for pool_name, pool in tool_pools:
            schemas = pool.to_openai_tool_schema()
            for schema in schemas:
                func_name = f"{pool_name}.{schema['function']['name']}"
                properties = schema["function"]["parameters"].get("properties", {})
                _validate_openai_schema_properties(properties, func_name)
