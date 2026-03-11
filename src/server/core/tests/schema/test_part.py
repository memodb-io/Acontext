import pytest
from pydantic import ValidationError
from acontext_core.schema.orm.message import Part


VALID_PART_TYPES = [
    "text",
    "image",
    "audio",
    "video",
    "file",
    "tool-call",
    "tool-result",
    "data",
    "thinking",
]


@pytest.mark.parametrize("part_type", VALID_PART_TYPES)
def test_part_accepts_valid_types(part_type):
    part = Part(type=part_type)
    assert part.type == part_type


def test_part_rejects_invalid_type():
    with pytest.raises(ValidationError):
        Part(type="unknown")


def test_thinking_part_with_signature():
    part = Part(
        type="thinking",
        text="Let me think about this.",
        meta={"signature": "abc123"},
    )
    assert part.type == "thinking"
    assert part.text == "Let me think about this."
    assert part.meta["signature"] == "abc123"


def test_thinking_part_minimal():
    part = Part(type="thinking", text="thinking text")
    assert part.type == "thinking"
    assert part.meta is None
