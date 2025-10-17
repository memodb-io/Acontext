"""
End-to-end usage sample for the Acontext Python SDK.
"""

from acontext import AcontextClient, MessagePart


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

        page = client.pages.create(space_id, title="Example Page")
        client.blocks.create(
            space_id,
            parent_id=page["id"],
            block_type="text",
            title="First block",
            props={"text": "Plan the sprint goals"},
        )
    finally:
        client.close()


if __name__ == "__main__":
    main()
