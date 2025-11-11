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

with AcontextClient(api_key="sk-ac-your-root-api-bearer-token") as client:
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

client = AcontextClient(api_key="sk-ac-your-root-api-bearer-token")
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

client = AcontextClient(api_key="sk-ac-your-root-api-bearer-token")

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

### Semantic search within spaces

The SDK provides three powerful semantic search APIs for finding content within your spaces:

#### 1. Experience Search (Advanced AI-powered search)

The most sophisticated search that can operate in two modes: **fast** (quick semantic search) or **agentic** (AI-powered iterative refinement).

```python
from acontext import AcontextClient

client = AcontextClient(api_key="sk_project_token")

# Fast mode - quick semantic search
result = client.spaces.experience_search(
    space_id="space-uuid",
    query="How to implement authentication?",
    limit=10,
    mode="fast",
)

# Agentic mode - AI-powered iterative search
result = client.spaces.experience_search(
    space_id="space-uuid",
    query="What are the best practices for API security?",
    limit=10,
    mode="agentic",
    max_iterations=20,
)

# Access results
for block in result.cited_blocks:
    print(f"{block.title} (distance: {block.distance})")

if result.final_answer:
    print(f"AI Answer: {result.final_answer}")
```

#### 2. Semantic Global (Search page/folder titles)

Search for pages and folders by their titles using semantic similarity (like a semantic version of `glob`):

```python
# Find pages about authentication
results = client.spaces.semantic_global(
    space_id="space-uuid",
    query="authentication and authorization pages",
    limit=10,
    threshold=1.0,  # Only show results with distance < 1.0
)

for block in results:
    print(f"{block.title} - {block.type}")
```

#### 3. Semantic Grep (Search content blocks)

Search through actual content blocks using semantic similarity (like a semantic version of `grep`):

```python
# Find code examples for JWT validation
results = client.spaces.semantic_grep(
    space_id="space-uuid",
    query="JWT token validation code examples",
    limit=15,
    threshold=0.7,
)

for block in results:
    print(f"{block.title} - distance: {block.distance}")
    print(f"Content: {block.props.get('text', '')[:100]}...")
```

See `examples/search_usage.py` for more detailed examples including async usage.
