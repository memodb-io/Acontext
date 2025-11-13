## acontext client for python

Python SDK for interacting with the Acontext REST API.

### Installation

```bash
pip install acontext
```

> Requires Python 3.10 or newer.

### Quickstart

```python
from acontext import AcontextClient

with AcontextClient(api_key="sk_project_token") as client:
    # Create a space
    space = client.spaces.create()
    
    # Create a session
    session = client.sessions.create(space_id=space.id)
    
    # Send a message
    from acontext.messages import build_acontext_message
    message = build_acontext_message(role="user", parts=["Hello!"])
    client.sessions.send_message(session.id, blob=message, format="acontext")
```

See the sections below for detailed examples of all available APIs.

### Async Client

The SDK provides full async support via `AsyncAcontextClient`. All API methods are available in async form:

```python
import asyncio
from acontext import AsyncAcontextClient

async def main():
    async with AsyncAcontextClient(api_key="sk_project_token") as client:
        # Create a space
        space = await client.spaces.create()
        
        # Create a session
        session = await client.sessions.create(space_id=space.id)
        
        # Send a message
        from acontext.messages import build_acontext_message
        message = build_acontext_message(role="user", parts=["Hello async!"])
        await client.sessions.send_message(session.id, blob=message, format="acontext")
        
        # Perform concurrent operations
        spaces_task = client.spaces.list(limit=10)
        sessions_task = client.sessions.list(limit=10)
        spaces, sessions = await asyncio.gather(spaces_task, sessions_task)

asyncio.run(main())
```

### Spaces API

#### List spaces

```python
spaces = client.spaces.list(limit=10, time_desc=True)
for space in spaces.items:
    print(f"{space.id}: {space.configs}")
```

#### Create space

```python
space = client.spaces.create(configs={"name": "My Space"})
print(f"Created space: {space.id}")
```

#### Delete space

```python
client.spaces.delete(space_id="space-uuid")
```

#### Update space configs

```python
client.spaces.update_configs(
    space_id="space-uuid",
    configs={"name": "Updated Name", "description": "New description"}
)
```

#### Get space configs

```python
space = client.spaces.get_configs(space_id="space-uuid")
print(space.configs)
```

### Sessions API

#### List sessions

```python
sessions = client.sessions.list(
    space_id="space-uuid",
    limit=20,
    time_desc=True
)
for session in sessions.items:
    print(f"{session.id}: {session.space_id}")
```

#### Create session

```python
session = client.sessions.create(
    space_id="space-uuid",
    configs={"mode": "chat"}
)
print(f"Created session: {session.id}")
```

#### Delete session

```python
client.sessions.delete(session_id="session-uuid")
```

#### Update session configs

```python
client.sessions.update_configs(
    session_id="session-uuid",
    configs={"mode": "updated-mode"}
)
```

#### Get session configs

```python
session = client.sessions.get_configs(session_id="session-uuid")
print(session.configs)
```

#### Connect session to space

```python
client.sessions.connect_to_space(
    session_id="session-uuid",
    space_id="space-uuid"
)
```

#### Get tasks

```python
tasks = client.sessions.get_tasks(
    session_id="session-uuid",
    limit=10,
    time_desc=True
)
for task in tasks.items:
    print(f"{task.id}: {task.status}")
```

#### Get messages

```python
messages = client.sessions.get_messages(
    session_id="session-uuid",
    limit=50,
    format="acontext",
    time_desc=True
)
for message in messages.items:
    print(f"{message.role}: {message.parts}")
```

#### Send message (Acontext format)

```python
from acontext.messages import build_acontext_message

# Simple text message
message = build_acontext_message(role="user", parts=["Hello!"])
client.sessions.send_message(
    session_id="session-uuid",
    blob=message,
    format="acontext"
)

# Message with file upload
from acontext import FileUpload

file_message = build_acontext_message(
    role="user",
    parts=[{"type": "file", "file_field": "document"}]
)
client.sessions.send_message(
    session_id="session-uuid",
    blob=file_message,
    format="acontext",
    file_field="document",
    file=FileUpload(
        filename="doc.pdf",
        content=b"file content",
        content_type="application/pdf"
    )
)
```

#### Send message (OpenAI format)

```python
openai_message = {
    "role": "user",
    "content": "Hello from OpenAI format!"
}
client.sessions.send_message(
    session_id="session-uuid",
    blob=openai_message,
    format="openai"
)
```

#### Send message (Anthropic format)

```python
anthropic_message = {
    "role": "user",
    "content": "Hello from Anthropic format!"
}
client.sessions.send_message(
    session_id="session-uuid",
    blob=anthropic_message,
    format="anthropic"
)
```

#### Flush session buffer

```python
result = client.sessions.flush(session_id="session-uuid")
print(result)  # {"status": 0, "errmsg": ""}
```

### Tools API

#### Get tool names

```python
tools = client.tools.get_tool_name()
for tool in tools:
    print(f"{tool.name} (used in {tool.sop_count} SOPs)")
```

#### Rename tool names

```python
result = client.tools.rename_tool_name(
    rename=[
        {"old_name": "calculate", "new_name": "calculate_math"},
        {"old_name": "search", "new_name": "search_web"},
    ]
)
print(result.status)  # 0 for success
```

### Blocks API

#### List blocks

```python
blocks = client.blocks.list(
    space_id="space-uuid",
    parent_id="parent-uuid",
    block_type="page"
)
for block in blocks:
    print(f"{block.id}: {block.title}")
```

#### Create block

```python
# Create a page
page = client.blocks.create(
    space_id="space-uuid",
    block_type="page",
    title="My Page"
)

# Create a text block under the page
text_block = client.blocks.create(
    space_id="space-uuid",
    parent_id=page["id"],
    block_type="text",
    title="Content",
    props={"text": "Block content here"}
)
```

#### Delete block

```python
client.blocks.delete(space_id="space-uuid", block_id="block-uuid")
```

#### Get block properties

```python
block = client.blocks.get_properties(
    space_id="space-uuid",
    block_id="block-uuid"
)
print(f"{block.title}: {block.props}")
```

#### Update block properties

```python
client.blocks.update_properties(
    space_id="space-uuid",
    block_id="block-uuid",
    title="Updated Title",
    props={"text": "Updated content"}
)
```

#### Move block

```python
# Move to a different parent
client.blocks.move(
    space_id="space-uuid",
    block_id="block-uuid",
    parent_id="new-parent-uuid"
)

# Update sort order
client.blocks.move(
    space_id="space-uuid",
    block_id="block-uuid",
    sort=0
)
```

#### Update block sort

```python
client.blocks.update_sort(
    space_id="space-uuid",
    block_id="block-uuid",
    sort=5
)
```

### Disks API

#### List disks

```python
disks = client.disks.list(limit=10, time_desc=True)
for disk in disks.items:
    print(f"Disk: {disk.id}")
```

#### Create disk

```python
disk = client.disks.create()
print(f"Created disk: {disk.id}")
```

#### Delete disk

```python
client.disks.delete(disk_id="disk-uuid")
```

### DiskArtifacts API

#### Upsert artifact

```python
from acontext import FileUpload

artifact = client.disks.artifacts.upsert(
    disk_id="disk-uuid",
    file=FileUpload(
        filename="notes.md",
        content=b"# Notes\nContent here",
        content_type="text/markdown"
    ),
    file_path="/documents/",
    meta={"source": "api", "version": "1.0"}
)
print(f"Uploaded: {artifact.filename}")
```

#### Get artifact

```python
artifact = client.disks.artifacts.get(
    disk_id="disk-uuid",
    file_path="/documents/",
    filename="notes.md",
    with_public_url=True,
    with_content=True
)
print(f"Content: {artifact.content}")
print(f"URL: {artifact.public_url}")
```

#### Update artifact metadata

```python
artifact = client.disks.artifacts.update(
    disk_id="disk-uuid",
    file_path="/documents/",
    filename="notes.md",
    meta={"source": "api", "version": "2.0", "updated": True}
)
```

#### Delete artifact

```python
client.disks.artifacts.delete(
    disk_id="disk-uuid",
    file_path="/documents/",
    filename="notes.md"
)
```

#### List artifacts

```python
artifacts = client.disks.artifacts.list(
    disk_id="disk-uuid",
    path="/documents/"
)
for artifact in artifacts.items:
    print(f"{artifact.filename} ({artifact.size_b} bytes)")
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
results = client.spaces.semantic_glob(
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
