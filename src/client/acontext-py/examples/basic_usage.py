"""
End-to-end usage sample for the Acontext Python SDK.
"""

import sys
import os
import json
from openai.types.chat import ChatCompletionUserMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionMessageFunctionToolCallParam
from openai.types.chat.chat_completion_message_function_tool_call_param import Function

from anthropic.types import MessageParam, TextBlockParam, ToolUseBlockParam

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from acontext import AcontextClient, MessagePart, FileUpload
from acontext.messages import build_acontext_message
from acontext.errors import APIError, AcontextError, TransportError


def main() -> None:
    client = AcontextClient(api_key="sk-ac-your-root-api-bearer-token", base_url="http://localhost:8029/api/v1")
    try:
        space = client.spaces.create(configs={"name": "Example Space"})
        space_id = space["id"]

        # use acontext format
        ## normal text
        session = client.sessions.create(space_id=space_id)
        blob = build_acontext_message(
            role="user",
            parts=[MessagePart.text_part("Hello from acontext!")],
        )
        client.sessions.send_message(session["id"], blob=blob, format="acontext")

        ## Attach a file
        file_field = "retro_notes.md"
        blob = build_acontext_message(
            role="user",
            parts=[
                MessagePart.file_field_part(file_field),
            ],
        )
        client.sessions.send_message(
            session["id"],
            blob=blob,
            format="acontext",
            file_field=file_field,
            file=FileUpload(
                filename=file_field,
                content=b"# Retro Notes\nWe shipped file uploads successfully by using acontext format!\n",
                content_type="text/markdown",
            )
        )

        ## Tool call
        blob = build_acontext_message(
            role="assistant",
            parts=[
                MessagePart(
                    type="text",
                    text="Sure! I'll help you create a weather API client. Let me first check what weather APIs are available."
                ),
                MessagePart(
                    type="tool-call",
                    meta={
                        "id": "call_001",
                        "name": "search_apis",
                        "arguments": "{\"query\": \"weather API free\", \"type\": \"public\"}"
                    }
                ),
            ],
        )
        client.sessions.send_message(
            session["id"],
            blob=blob,
            format="acontext",
        )


        # use openai format
        blob = ChatCompletionUserMessageParam(
            role="user",
            content="Hello from openai"
        )
        client.sessions.send_message(session["id"], blob=blob, format="openai")

        blob = ChatCompletionAssistantMessageParam(
            role="assistant",
            content="Sure! I'll help you create a weather API client. Let me first check what weather APIs are available.",
            tool_calls=[
                ChatCompletionMessageFunctionToolCallParam(
                    type="function",
                    id="call_001",
                    function=Function(
                        name="search_apis",
                        arguments="{\"query\": \"weather API free\", \"type\": \"public\"}"
                    )
                )
            ]
        )
        client.sessions.send_message(
            session["id"],
            blob=blob,
            format="openai",
        )


        # use anthropic format
        blob = MessageParam(
            role="user",
            content="Hello from anthropic"
        )
        client.sessions.send_message(session["id"], blob=blob, format="anthropic")

        blob = MessageParam(
            role="assistant",
            content=[
                TextBlockParam(
                    type="text",
                    text="Sure! I'll help you create a weather API client. Let me first check what weather APIs are available."
                ),
                ToolUseBlockParam(
                    id="call_001",
                    type="tool_use",
                    name="search_apis",
                    input={
                        "query": "weather API free",
                        "type": "public"
                    }
                )
            ]
        ) 
        client.sessions.send_message(
            session["id"],
            blob=blob,
            format="anthropic",
        )


        # Get message
        messages = client.sessions.get_messages(
            session["id"],
            limit=5,
            with_asset_public_url=False,
            format="acontext",
        )
        print("Recent messages:", json.dumps(messages, indent=2))

        # Upload a file to a disk-backed artifact store for later reuse
        disk = client.disks.create()
        client.disks.artifacts.upsert(
            disk["id"],
            file=FileUpload(
                filename="retro_notes.md",
                content=b"# Retro Notes\nWe shipped file uploads successfully!\n",
                content_type="text/markdown",
            ),
            file_path="notes/retro.md",
            meta={"source": "basic_usage.py"},
        )

        # Organize space content: create a folder (block type), a page within it, then add a text block
        folder = client.blocks.create(space_id, block_type="folder", title="Product Plans")
        page = client.blocks.create(space_id, parent_id=folder["id"], block_type="page", title="Sprint Kick-off")
        client.blocks.create(
            space_id,
            parent_id=page["id"],
            block_type="text",
            title="First block",
            props={"text": "Plan the sprint goals"},
        )
    except APIError as exc:
        print(f"[API error] status={exc.status_code} code={exc.code} message={exc.message}")
        if exc.payload:
            print(f"payload: {exc.payload}")
    except TransportError as exc:
        print(f"[Transport error] {exc}")
    except AcontextError as exc:
        print(f"[SDK error] {exc}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
