## acontext client for python

Python SDK for interacting with the Acontext REST API.

### Installation

```bash
pip install acontext-py
```

### Quickstart

```python
from acontext import AcontextClient, MessagePart

with AcontextClient(api_key="sk_project_token") as client:
    # List spaces for the authenticated project
    spaces = client.spaces.list()

    # Create a session bound to the first space
    session = client.sessions.create(space_id=spaces[0]["id"])

    # Send a text message to the session
    client.sessions.send_message(
        session["id"],
        role="user",
        parts=[MessagePart.text_part("Hello from Python!")],
    )
```

See the inline docstrings for the full list of helpers covering sessions, spaces, artifacts and file uploads.

### Working with pages and blocks

```python
from acontext import AcontextClient

client = AcontextClient(api_key="sk_project_token")

space = client.spaces.create()
try:
    page = client.pages.create(space["id"], title="Kick-off Notes")
    client.blocks.create(
        space["id"],
        parent_id=page["id"],
        block_type="text",
        title="First block",
        props={"text": "Plan the sprint goals"},
    )
finally:
    client.close()
```
