import pytest

from acontext_core.llm.complete.mock_sdk import mock_complete


class _ObjMessage:
    def __init__(self, content: str):
        self.content = content


@pytest.mark.asyncio
async def test_session_title_trigger_works_with_dict_history_messages():
    response = await mock_complete(
        history_messages=[{"role": "user", "content": "SESSION_TITLE_E2E create task"}],
    )

    assert response.tool_calls is not None
    assert len(response.tool_calls) == 1
    assert response.tool_calls[0].function.name == "insert_task"


@pytest.mark.asyncio
async def test_simple_hello_still_works_with_object_history_messages():
    response = await mock_complete(history_messages=[_ObjMessage("Simple Hello")])

    assert response.content == "Hello World"
