"""
Tests for schema_utils module.

Tests the flatten_json_schema and flatten_tool_schemas functions
that ensure compatibility with LLM providers like Gemini.
"""

from acontext_core.llm.complete.schema_utils import (
    flatten_json_schema,
    flatten_tool_schemas,
)


class TestFlattenJsonSchema:
    """Test flatten_json_schema function"""

    def test_schema_without_refs(self):
        """Test that schema without $ref is returned unchanged (except deepcopy)"""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "integer"},
            },
        }
        result = flatten_json_schema(schema)

        assert result == schema
        assert result is not schema  # Should be a copy

    def test_schema_with_simple_ref(self):
        """Test flattening a schema with a simple $ref"""
        schema = {
            "$defs": {
                "Address": {
                    "type": "object",
                    "properties": {
                        "street": {"type": "string"},
                        "city": {"type": "string"},
                    },
                }
            },
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "address": {"$ref": "#/$defs/Address"},
            },
        }
        result = flatten_json_schema(schema)

        assert "$defs" not in result
        assert "$ref" not in result["properties"]["address"]
        assert result["properties"]["address"]["type"] == "object"
        assert "street" in result["properties"]["address"]["properties"]
        assert "city" in result["properties"]["address"]["properties"]

    def test_schema_with_array_ref(self):
        """Test flattening a schema with $ref in array items"""
        schema = {
            "$defs": {
                "SOPStep": {
                    "type": "object",
                    "properties": {
                        "tool_name": {"type": "string"},
                        "action": {"type": "string"},
                    },
                }
            },
            "type": "object",
            "properties": {
                "tool_sops": {
                    "type": "array",
                    "items": {"$ref": "#/$defs/SOPStep"},
                }
            },
        }
        result = flatten_json_schema(schema)

        assert "$defs" not in result
        items = result["properties"]["tool_sops"]["items"]
        assert "$ref" not in items
        assert items["type"] == "object"
        assert "tool_name" in items["properties"]
        assert "action" in items["properties"]

    def test_schema_with_nested_refs(self):
        """Test flattening a schema with nested $ref references"""
        schema = {
            "$defs": {
                "Inner": {
                    "type": "object",
                    "properties": {"value": {"type": "string"}},
                },
                "Outer": {
                    "type": "object",
                    "properties": {"inner": {"$ref": "#/$defs/Inner"}},
                },
            },
            "type": "object",
            "properties": {
                "outer": {"$ref": "#/$defs/Outer"},
            },
        }
        result = flatten_json_schema(schema)

        assert "$defs" not in result
        outer = result["properties"]["outer"]
        assert "$ref" not in outer
        inner = outer["properties"]["inner"]
        assert "$ref" not in inner
        assert inner["properties"]["value"]["type"] == "string"

    def test_original_schema_not_modified(self):
        """Test that the original schema is not modified"""
        schema = {
            "$defs": {"Foo": {"type": "string"}},
            "type": "object",
            "properties": {"foo": {"$ref": "#/$defs/Foo"}},
        }
        original_schema = {
            "$defs": {"Foo": {"type": "string"}},
            "type": "object",
            "properties": {"foo": {"$ref": "#/$defs/Foo"}},
        }

        flatten_json_schema(schema)

        assert schema == original_schema

    def test_pydantic_like_schema(self):
        """Test with a schema similar to what Pydantic generates"""
        # This mimics the SubmitSOPData schema from the bug report
        schema = {
            "$defs": {
                "SOPStep": {
                    "properties": {
                        "tool_name": {
                            "description": "exact corresponding tool name from history",
                            "title": "Tool Name",
                            "type": "string",
                        },
                        "action": {
                            "description": "what to do with this tool",
                            "title": "Action",
                            "type": "string",
                        },
                    },
                    "required": ["tool_name", "action"],
                    "title": "SOPStep",
                    "type": "object",
                }
            },
            "properties": {
                "use_when": {
                    "description": "The scenario when this sop maybe used",
                    "title": "Use When",
                    "type": "string",
                },
                "preferences": {
                    "description": "User preferences on this SOP if any.",
                    "title": "Preferences",
                    "type": "string",
                },
                "tool_sops": {
                    "items": {"$ref": "#/$defs/SOPStep"},
                    "title": "Tool Sops",
                    "type": "array",
                },
                "is_easy_task": {
                    "description": "If the task is easy or not",
                    "title": "Is Easy Task",
                    "type": "boolean",
                },
            },
            "required": ["use_when", "preferences", "tool_sops", "is_easy_task"],
            "title": "SubmitSOPData",
            "type": "object",
        }

        result = flatten_json_schema(schema)

        # Verify $defs and $ref are removed
        assert "$defs" not in result
        items = result["properties"]["tool_sops"]["items"]
        assert "$ref" not in items

        # Verify the inlined structure is correct
        assert items["type"] == "object"
        assert items["properties"]["tool_name"]["type"] == "string"
        assert items["properties"]["action"]["type"] == "string"
        assert items["required"] == ["tool_name", "action"]


class TestFlattenToolSchemas:
    """Test flatten_tool_schemas function"""

    def test_none_tools(self):
        """Test with None input"""
        result = flatten_tool_schemas(None)
        assert result is None

    def test_empty_tools(self):
        """Test with empty list"""
        result = flatten_tool_schemas([])
        assert result == []

    def test_tools_without_refs(self):
        """Test tools without $ref are handled correctly"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get weather info",
                    "parameters": {
                        "type": "object",
                        "properties": {"city": {"type": "string"}},
                    },
                },
            }
        ]
        result = flatten_tool_schemas(tools)

        assert len(result) == 1
        assert result[0]["function"]["name"] == "get_weather"
        assert result is not tools  # Should be a copy

    def test_tools_with_refs(self):
        """Test tools with $ref are flattened"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "submit_sop",
                    "description": "Submit an SOP",
                    "parameters": {
                        "$defs": {
                            "SOPStep": {
                                "type": "object",
                                "properties": {
                                    "tool_name": {"type": "string"},
                                    "action": {"type": "string"},
                                },
                            }
                        },
                        "type": "object",
                        "properties": {
                            "tool_sops": {
                                "type": "array",
                                "items": {"$ref": "#/$defs/SOPStep"},
                            }
                        },
                    },
                },
            }
        ]
        result = flatten_tool_schemas(tools)

        params = result[0]["function"]["parameters"]
        assert "$defs" not in params
        items = params["properties"]["tool_sops"]["items"]
        assert "$ref" not in items
        assert items["type"] == "object"

    def test_multiple_tools(self):
        """Test multiple tools are all processed"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "tool1",
                    "description": "Tool 1",
                    "parameters": {
                        "$defs": {"Foo": {"type": "string"}},
                        "type": "object",
                        "properties": {"foo": {"$ref": "#/$defs/Foo"}},
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "tool2",
                    "description": "Tool 2",
                    "parameters": {
                        "type": "object",
                        "properties": {"bar": {"type": "number"}},
                    },
                },
            },
        ]
        result = flatten_tool_schemas(tools)

        assert len(result) == 2
        assert "$defs" not in result[0]["function"]["parameters"]
        assert result[1]["function"]["parameters"]["properties"]["bar"]["type"] == "number"

    def test_original_tools_not_modified(self):
        """Test that original tools list is not modified"""
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "test",
                    "description": "Test",
                    "parameters": {
                        "$defs": {"Foo": {"type": "string"}},
                        "type": "object",
                        "properties": {"foo": {"$ref": "#/$defs/Foo"}},
                    },
                },
            }
        ]

        flatten_tool_schemas(tools)

        # Original should still have $defs
        assert "$defs" in tools[0]["function"]["parameters"]
