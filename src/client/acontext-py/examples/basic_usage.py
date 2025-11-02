"""
Structured end-to-end exercise for the Acontext Python SDK.

The script drives every public client method so it can double as a
lightweight 2e2 test when pointed at a running Acontext instance.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from anthropic.types import MessageParam, TextBlockParam, ToolUseBlockParam
from openai.types.chat import (
    ChatCompletionAssistantMessageParam,
    ChatCompletionMessageFunctionToolCallParam,
    ChatCompletionUserMessageParam,
)
from openai.types.chat.chat_completion_message_function_tool_call_param import Function

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from acontext import AcontextClient, FileUpload, MessagePart  # noqa: E402
from acontext.errors import APIError, AcontextError, TransportError  # noqa: E402
from acontext.messages import build_acontext_message  # noqa: E402


SPACE_CONFIG_NAME = "sdk-e2e-space"
FILE_NAME = "sdk-e2e-retro.md"
FILE_CONTENT = b"# Retro Notes\nWe shipped file uploads successfully!\n"


def resolve_credentials() -> tuple[str, str]:
    api_key = os.getenv("ACONTEXT_API_KEY", "sk-ac-your-root-api-bearer-token")
    base_url = os.getenv("ACONTEXT_BASE_URL", "http://localhost:8029/api/v1")
    return api_key, base_url


def exercise_spaces(client: AcontextClient) -> tuple[str, dict[str, Any]]:
    summary: dict[str, Any] = {}

    summary["initial_list"] = client.spaces.list()
    space = client.spaces.create(configs={"name": SPACE_CONFIG_NAME})
    space_id = space.id
    summary["created_space"] = space

    configs = client.spaces.get_configs(space_id).configs or {}
    client.spaces.update_configs(space_id, configs={**configs, "sdk_e2e": True})
    summary["updated_configs"] = client.spaces.get_configs(space_id)

    summary["list_after_create"] = client.spaces.list()

    return space_id, summary


def exercise_blocks(client: AcontextClient, space_id: str) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    summary["initial_blocks"] = client.blocks.list(space_id)

    folder = client.blocks.create(space_id, block_type="folder", title="SDK E2E Folder")
    page_a = client.blocks.create(space_id, parent_id=folder.id, block_type="page", title="SDK E2E Page A")
    page_b = client.blocks.create(space_id, parent_id=folder.id, block_type="page", title="SDK E2E Page B")
    text_block = client.blocks.create(
        space_id,
        parent_id=page_a.id,
        block_type="text",
        title="Initial Block",
        props={"text": "Plan the sprint goals"},
    )

    summary["text_block_properties"] = client.blocks.get_properties(space_id, text_block.id)
    client.blocks.update_properties(
        space_id,
        text_block.id,
        title="Updated Block",
        props={"text": "Updated block contents"},
    )

    client.blocks.move(space_id, text_block.id, parent_id=page_b.id)
    client.blocks.update_sort(space_id, text_block.id, sort=0)

    summary["blocks_after_updates"] = client.blocks.list(space_id)

    client.blocks.delete(space_id, text_block.id)
    client.blocks.delete(space_id, page_b.id)
    client.blocks.delete(space_id, page_a.id)
    client.blocks.delete(space_id, folder.id)
    summary["final_blocks"] = client.blocks.list(space_id)

    return summary


def build_file_upload() -> FileUpload:
    return FileUpload(
        filename=FILE_NAME,
        content=FILE_CONTENT,
        content_type="text/markdown",
    )


def exercise_sessions(client: AcontextClient, space_id: str) -> dict[str, Any]:
    summary: dict[str, Any] = {}

    summary["initial_sessions"] = client.sessions.list(space_id=space_id, not_connected=False)
    session = client.sessions.create(space_id=space_id, configs={"mode": "sdk-e2e"})
    session_id = session.id
    summary["session_created"] = session

    client.sessions.update_configs(session_id, configs={"mode": "sdk-e2e-updated"})
    summary["session_configs"] = client.sessions.get_configs(session_id)

    client.sessions.connect_to_space(session_id, space_id=space_id)
    summary["tasks"] = client.sessions.get_tasks(session_id)

    # send message in acontext format
    acontext_blob = build_acontext_message(
        role="user",
        parts=[MessagePart.text_part("Hello from the SDK e2e test!")],
    )
    client.sessions.send_message(session_id, blob=acontext_blob, format="acontext")

    # send message in acontext format with file upload
    file_field = "retro_notes"
    file_blob = build_acontext_message(
        role="user",
        parts=[MessagePart.file_field_part(file_field)],
    )
    client.sessions.send_message(
        session_id,
        blob=file_blob,
        format="acontext",
        file_field=file_field,
        file=build_file_upload(),
    )

    # send tool-call message
    tool_blob = build_acontext_message(
        role="assistant",
        parts=[
            MessagePart(type="text", text="Triggering weather tool."),
            MessagePart(
                type="tool-call",
                meta={
                    "id": "call_001",
                    "name": "search_apis",
                    "arguments": '{"query": "weather API free", "type": "public"}',
                },
            ),
        ],
    )
    client.sessions.send_message(session_id, blob=tool_blob, format="acontext")

    # send OpenAI compatible messages
    openai_user = ChatCompletionUserMessageParam(role="user", content="Hello from OpenAI format")
    client.sessions.send_message(session_id, blob=openai_user, format="openai")

    openai_assistant = ChatCompletionAssistantMessageParam(
        role="assistant",
        content="Answering via OpenAI compatible payload.",
        tool_calls=[
            ChatCompletionMessageFunctionToolCallParam(
                type="function",
                id="call_002",
                function=Function(
                    name="search_apis",
                    arguments='{"query": "weather API free", "type": "public"}',
                ),
            )
        ],
    )
    client.sessions.send_message(session_id, blob=openai_assistant, format="openai")

    # send Anthropic compatible messages
    anthropic_user = MessageParam(role="user", content="Hello from Anthropic format")
    client.sessions.send_message(session_id, blob=anthropic_user, format="anthropic")

    anthropic_assistant = MessageParam(
        role="assistant",
        content=[
            TextBlockParam(
                type="text",
                text="Answering via Anthropic compatible payload.",
            ),
            ToolUseBlockParam(
                id="call_003",
                type="tool_use",
                name="search_apis",
                input={"query": "weather API free", "type": "public"},
            ),
        ],
    )
    client.sessions.send_message(session_id, blob=anthropic_assistant, format="anthropic")

    summary["messages"] = client.sessions.get_messages(
        session_id,
        limit=10,
        with_asset_public_url=True,
        format="acontext",
        time_desc=True,
    )

    client.sessions.delete(session_id)
    summary["sessions_after_delete"] = client.sessions.list(space_id=space_id, not_connected=False)

    return summary


def exercise_disks(client: AcontextClient) -> dict[str, Any]:
    summary: dict[str, Any] = {}

    summary["initial_disks"] = client.disks.list()
    disk = client.disks.create()
    disk_id = disk.id
    summary["disk_created"] = disk

    upload = build_file_upload()
    client.disks.artifacts.upsert(
        disk_id,
        file=upload,
        file_path=f"notes/{upload.filename}",
        meta={"source": "sdk-e2e"},
    )

    summary["artifact_get"] = client.disks.artifacts.get(
        disk_id,
        file_path=f"notes/{upload.filename}",
        with_public_url=True,
        with_content=True,
        expire=60,
    )

    client.disks.artifacts.update(
        disk_id,
        file_path=f"notes/{upload.filename}",
        meta={"source": "sdk-e2e", "reviewed": True},
    )

    summary["artifact_list"] = client.disks.artifacts.list(disk_id, path="/notes/")

    client.disks.artifacts.delete(disk_id, file_path=f"notes/{upload.filename}")
    client.disks.delete(disk_id)
    summary["disks_after_delete"] = client.disks.list()

    return summary


def run() -> dict[str, Any]:
    api_key, base_url = resolve_credentials()
    report: dict[str, Any] = {}

    with AcontextClient(api_key=api_key, base_url=base_url) as client:
        space_id, report["spaces"] = exercise_spaces(client)
        # report["blocks"] = exercise_blocks(client, space_id)
        # report["sessions"] = exercise_sessions(client, space_id)
        # report["disks"] = exercise_disks(client)
        # client.spaces.delete(space_id)
        # report["spaces_after_delete"] = client.spaces.list()

    return report


def main() -> None:
    try:
        report = run()
    except APIError as exc:
        print(f"[API error] status={exc.status_code} code={exc.code} message={exc.message}")
        if exc.payload:
            print(f"payload: {exc.payload}")
        raise
    except TransportError as exc:
        print(f"[Transport error] {exc}")
        raise
    except AcontextError as exc:
        print(f"[SDK error] {exc}")
        raise
    else:
        print(json.dumps(report, indent=2, default=str))
        pass


if __name__ == "__main__":
    main()
