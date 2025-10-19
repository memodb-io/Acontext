"""
End-to-end usage sample for the Acontext Python SDK.
"""

from acontext import AcontextClient, MessagePart, FileUpload
from acontext.errors import APIError, AcontextError, TransportError


def main() -> None:
    client = AcontextClient(api_key="sk-ac-your-root-api-bearer-token", base_url="http://localhost:8029/api/v1")
    try:
        space = client.spaces.create(configs={"name": "Example Space"})
        space_id = space["id"]

        session = client.sessions.create(space_id=space_id)
        client.sessions.send_message(
            session["id"],
            role="user",
            parts=[MessagePart.text_part("Hello from the example!")],
        )

        # Attach a text file alongside another message
        client.sessions.send_message(
            session["id"],
            role="user",
            format="acontext",
            parts=[
                MessagePart.text_part("Uploading the sprint outline."),
                MessagePart.file_part(
                    FileUpload(
                        filename="sprint_plan.txt",
                        content=b"- Align on scope\n- Demo the new upload flow\n",
                        content_type="text/plain",
                    ),
                    meta={"description": "Sprint TODOs"},
                ),
            ],
        )

        # Upload a file to the artifact store for later reuse
        artifact = client.artifacts.create()
        client.artifacts.files.upload(
            artifact["id"],
            file=FileUpload(
                filename="retro_notes.md",
                content=b"# Retro Notes\nWe shipped file uploads successfully!\n",
                content_type="text/markdown",
            ),
            file_path="notes/retro.md",
            meta={"source": "basic_usage.py"},
        )

        # Organize space content: create a folder, a page within it, then add a block to that page
        folder = client.folders.create(space_id, title="Product Plans")
        page = client.pages.create(space_id, parent_id=folder["id"], title="Sprint Kick-off")
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
