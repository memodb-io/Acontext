## acontext client for python

Python SDK for interacting with the Acontext REST API.

### Installation

```bash
pip install acontext
```

> Requires Python 3.10 or newer.

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

See the inline docstrings for the full list of helpers covering sessions, spaces, disks, and artifact uploads.

### Managing disks and artifacts

Artifacts now live under project disks. Create a disk first, then upload files through the disk-scoped helper:

```python
from acontext import AcontextClient, FileUpload

client = AcontextClient(api_key="sk_project_token")
try:
    disk = client.disks.create()
    client.disks.artifacts.upsert(
        disk["id"],
        file=FileUpload(
            filename="retro_notes.md",
            content=b"# Retro Notes\nWe shipped file uploads successfully!\n",
            content_type="text/markdown",
        ),
        file_path="/notes/",
        meta={"source": "readme-demo"},
    )
finally:
    client.close()
```

### Working with blocks

```python
from acontext import AcontextClient

client = AcontextClient(api_key="sk_project_token")

space = client.spaces.create()
try:
    page = client.blocks.create(space["id"], block_type="page", title="Kick-off Notes")
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
