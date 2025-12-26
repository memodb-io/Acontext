from copy import deepcopy


def flatten_json_schema(schema: dict) -> dict:
    """
    Recursively expand all $ref references in a JSON Schema.

    This ensures compatibility with LLM providers that don't support $ref/$defs
    (e.g., Gemini). The inlined format is semantically equivalent and universally
    compatible across all providers.

    Args:
        schema: A JSON Schema dict potentially containing $defs and $ref

    Returns:
        A new schema dict with all $ref expanded inline and $defs removed
    """
    schema = deepcopy(schema)
    defs = schema.pop("$defs", {})

    def resolve_refs(obj):
        if isinstance(obj, dict):
            if "$ref" in obj:
                ref_path = obj["$ref"]  # e.g., "#/$defs/SOPStep"
                ref_name = ref_path.split("/")[-1]
                resolved = defs.get(ref_name, {})
                return resolve_refs(deepcopy(resolved))
            return {k: resolve_refs(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [resolve_refs(item) for item in obj]
        return obj

    return resolve_refs(schema)


def flatten_tool_schemas(tools: list[dict]) -> list[dict]:
    """
    Flatten JSON schemas in a list of tool definitions.

    Processes each tool's function.parameters to expand $ref references,
    ensuring compatibility with LLM providers like Gemini.

    Args:
        tools: List of tool definitions in OpenAI format

    Returns:
        A new list of tools with flattened parameter schemas
    """
    if not tools:
        return tools

    result = []
    for tool in tools:
        tool = deepcopy(tool)
        if "function" in tool and "parameters" in tool["function"]:
            tool["function"]["parameters"] = flatten_json_schema(
                tool["function"]["parameters"]
            )
        result.append(tool)
    return result
