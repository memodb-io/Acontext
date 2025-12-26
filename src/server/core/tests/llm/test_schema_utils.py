"""
Tests for FunctionSchema's automatic JSON Schema flattening.

Tests that $ref/$defs are automatically expanded when creating FunctionSchema,
ensuring compatibility with LLM providers like Gemini.
"""

from acontext_core.schema.llm import FunctionSchema, _flatten_json_schema


class TestFlattenJsonSchema:
    """Test _flatten_json_schema function"""

    def test_schema_without_refs(self):
        """Test that schema without $ref is returned unchanged (except deepcopy)"""
        schema = {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "integer"},
            },
        }
        result = _flatten_json_schema(schema)

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
        result = _flatten_json_schema(schema)

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
        result = _flatten_json_schema(schema)

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
        result = _flatten_json_schema(schema)

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

        _flatten_json_schema(schema)

        assert schema == original_schema


class TestFunctionSchemaFlattening:
    """Test FunctionSchema automatically flattens parameters"""

    def test_function_schema_flattens_refs(self):
        """Test that FunctionSchema flattens $ref in parameters at creation"""
        schema_with_refs = {
            "$defs": {
                "Item": {
                    "type": "object",
                    "properties": {"name": {"type": "string"}},
                }
            },
            "type": "object",
            "properties": {
                "items": {"type": "array", "items": {"$ref": "#/$defs/Item"}}
            },
        }

        func_schema = FunctionSchema(
            name="test_func",
            description="Test function",
            parameters=schema_with_refs,
        )

        # Verify flattening happened
        assert "$defs" not in func_schema.parameters
        assert "$ref" not in str(func_schema.parameters)
        assert func_schema.parameters["properties"]["items"]["items"]["type"] == "object"

    def test_function_schema_preserves_simple_schema(self):
        """Test that FunctionSchema preserves schema without refs"""
        simple_schema = {
            "type": "object",
            "properties": {"name": {"type": "string"}},
        }

        func_schema = FunctionSchema(
            name="test_func",
            description="Test function",
            parameters=simple_schema,
        )

        assert func_schema.parameters == simple_schema
