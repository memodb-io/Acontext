from uuid import uuid4

from acontext_core.llm.agent.task import pack_current_message_with_ids
from acontext_core.schema.orm.message import Part
from acontext_core.schema.session.message import MessageBlob


def test_pack_current_message_with_ids_includes_parent_linkage():
    root_id = uuid4()
    child_id = uuid4()

    messages = [
        MessageBlob(
            message_id=root_id,
            parent_id=None,
            role="user",
            parts=[Part(type="text", text="root")],
        ),
        MessageBlob(
            message_id=child_id,
            parent_id=root_id,
            role="assistant",
            parts=[Part(type="text", text="child")],
        ),
    ]

    packed = pack_current_message_with_ids(messages)

    assert f"message_id={root_id}" in packed
    assert "parent_id=None" in packed
    assert f"message_id={child_id}" in packed
    assert f"parent_id={root_id}" in packed
