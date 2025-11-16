<div align="center">
  <br/>
  <br/>
  <a href="https://discord.gg/rpZs5TaSuV">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./assets/Acontext-oneway-dark.gif">
      <img alt="Show Acontext logo" src="./assets/Acontext-oneway.gif" width="418">
    </picture>
  <br/>
  <br/>
  </a>
  <h4>Context Data Platform for Self-learning Agents</h4>
  <p>
    <a href="https://pypi.org/project/acontext/">
      <img src="https://img.shields.io/pypi/v/acontext.svg">
    </a>
    <a href="https://www.npmjs.com/package/@acontext/acontext">
      <img src="https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D">
    </a>
    <a href="https://github.com/memodb-io/acontext/actions/workflows/core-test.yaml">
      <img src="https://github.com/memodb-io/acontext/actions/workflows/core-test.yaml/badge.svg">
    </a>
    <a href="https://github.com/memodb-io/acontext/actions/workflows/api-test.yaml">
      <img src="https://github.com/memodb-io/acontext/actions/workflows/api-test.yaml/badge.svg">
    </a>
    <a href="https://github.com/memodb-io/acontext/actions/workflows/cli-test.yaml">
      <img src="https://github.com/memodb-io/acontext/actions/workflows/cli-test.yaml/badge.svg">
    </a>
  </p>
  <p>
    <a href="https://discord.gg/rpZs5TaSuV">
      <img src="https://dcbadge.limes.pink/api/server/rpZs5TaSuV?style=flat">
    </a>
  </p>
</div>





Acontext is a context data platform that:

- **Stores** contexts & artifacts, using Postgres and S3
- **Observes** agent tasks and user feedback, and offers a nice Dashboard
- Enables agent **self-learning** by collecting experiences (or SOPs)



We're building it because we believe Acontext can help you:

- **Build a more scalable agent product**: Acontext packs Postgres, Redis, S3, RabbitMQ together to enable multi-modal sessions and aritfacts storages, keep your context managment fast, cheap and easy.
- **Improve your agent success rate and reduce running steps**: Acontext has built-in **Experience Agent**, which can manage and search the past experiences of tasks. So once your agent successfully completes a complex task for the user, it will almost never make a mistake again.

so that your agent can be more stable and provide greater value to your users.



<div align="center">
    <picture>
      <img alt="Acontext Learning" src="./docs/images/acontext_data_flow.png" width="80%">
    </picture>
  <p>How Acontext Learns for your Agents?</p>
</div>







# How to Start It? [📖](https://docs.acontext.io/local)

> 📖 means a document link

We have a `acontext-cli` to help you do quick proof-of-concept. Download it first in your terminal:

```bash
curl -fsSL https://install.acontext.io | sh
```

You should have [docker](https://www.docker.com/get-started/) installed and an OpenAI API Key to start an Acontext backend on your computer:

```bash
acontext docker up
```

> [📖](https://docs.acontext.io/settings/core) Acontext requires an LLM provider and an embedding provider. 
>
> We support OpenAI and Anthropic SDK formats and OpenAI and jina.ai embedding API formats

Once it's done, you can access the following endpoints:

- Acontext API Base URL: http://localhost:8029/api/v1
- Acontext Dashboard: http://localhost:3000/



<div align="center">
    <picture>
      <img alt="Dashboard" src="./docs/images/dashboard/BI.png" width="80%">
    </picture>
  <p>Dashboard of Success Rate and other Metrics</p>
</div>




# How to Use It?

We're maintaining Python [![pypi](https://img.shields.io/pypi/v/acontext.svg)](https://pypi.org/project/acontext/) and Typescript [![npm](https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D)]("https://www.npmjs.com/package/@acontext/acontext") SDKs. Below snippets are using Python.



## Install SDKs

```
pip install acontext # for Python
npm i @acontext/acontext # for Typescript
```



## Initialize Client

```python
from acontext import AcontextClient

client = AcontextClient(
    base_url="http://localhost:8029/api/v1"
    api_key="sk-ac-your-root-api-bearer-token"
)
client.ping()

# yes, the default api_key is sk-ac-your-root-api-bearer-token
```

> [📖 async client doc](https://docs.acontext.io/settings/core)



## Store

Acontext can manage your sessions and artifacts.

### Save Messages [📖](https://docs.acontext.io/api-reference/session/send-message-to-session)

Acontext offers persistent storage for message data.

```python
session = client.sessions.create()
messages = [{"role": "user", "content": "Hello, how are you?"}]

r = openai_client.chat.completions.create(model="gpt-4.1", messages=messages)
print(r.choices[0].message.content)

client.sessions.send_message(session_id=session.id, blob=messages[0])
client.sessions.send_message(session_id=session.id, blob=r.choices[0].message)
```

> [📖](https://docs.acontext.io/store/messages/multi-provider#anthropic-format) We support Anthropic SDK as well. 
>
> [📖](https://docs.acontext.io/store/messages/multi-modal) We support multi-modal message storage.

### Load Messages [📖](https://docs.acontext.io/api-reference/session/get-messages-from-session)

Obtain your session messages:

```python
r = client.sessions.get_messages(session.id)
new_msg = r.items

new_msg.append({"role": "user", "content": "Hello again"})
r = openai_client.chat.completions.create(model="gpt-4.1", messages=new_msg)
print(r.choices[0].message.content)
```

<div align="center">
    <picture>
      <img alt="Session" src="./docs/images/dashboard/message_viewer.png" width="50%">
    </picture>
  <p>You can view sessions in your local Dashboard</p>
</div>


### Artifacts [📖](https://docs.acontext.io/store/disk)

Create a disk for your agent to store and read artifacts using file paths:

<details>
<summary>Code Snippet</summary>

```python
from acontext import FileUpload

disk = client.disks.create()

file = FileUpload(
    filename="todo.md",
    content=b"# Sprint Plan\n\n## Goals\n- Complete user authentication\n- Fix critical bugs"
)
artifact = client.disks.artifacts.upsert(
    disk.id,
    file=file,
    file_path="/todo/"
)


print(client.disks.artifacts.list(
    disk.id,
    path="/todo/"
))

result = client.disks.artifacts.get(
    disk.id,
    file_path="/todo/",
    filename="todo.md",
    with_public_url=True,
    with_content=True
)
print(f"✓ File content: {result.content.raw}")
print(f"✓ Download URL: {result.public_url}")        
```
</details>



<div align="center">
    <picture>
      <img alt="Artifacts" src="./docs/images/dashboard/artifact_viewer.png" width="50%">
    </picture>
  <p>You can view artifacts in your local Dashboard</p>
</div>



## Observe [📖](https://docs.acontext.io/observe)

For every session, Acontext will launch a background agent to track the task progress and user feedback.

You can use the SDK to retrieve the current state of the agent session.

<details>
<summary>Code Snippet</summary>

```python
from acontext import AcontextClient

# Initialize client
client = AcontextClient(
    base_url="http://localhost:8029/api/v1", api_key="sk-ac-your-root-api-bearer-token"
)

# Create a project and session
session = client.sessions.create()

# Conversation messages
messages = [
    {"role": "user", "content": "I need to write a landing page of iPhone 15 pro max"},
    {
        "role": "assistant",
        "content": "Sure, my plan is below:\n1. Search for the latest news about iPhone 15 pro max\n2. Init Next.js project for the landing page\n3. Deploy the landing page to the website",
    },
    {
        "role": "user",
        "content": "That sounds good. Let's first collect the message and report to me before any landing page coding.",
    },
    {
        "role": "assistant",
        "content": "Sure, I will first collect the message then report to you before any landing page coding.",
    },
]

# Send messages in a loop
for msg in messages:
    client.sessions.send_message(session_id=session.id, blob=msg, format="openai")

# Wait for task extraction to complete
client.sessions.flush(session.id)
# Display extracted tasks
tasks_response = client.sessions.get_tasks(session.id)
print(tasks_response)
for task in tasks_response.items:
    print(f"\nTask #{task.order}:")
    print(f"  ID: {task.id}")
    print(f"  Title: {task.data['task_description']}")
    print(f"  Status: {task.status}")

    # Show progress updates if available
    if "progresses" in task.data:
        print(f"  Progress updates: {len(task.data['progresses'])}")
        for progress in task.data["progresses"]:
            print(f"    - {progress}")

    # Show user preferences if available
    if "user_preferences" in task.data:
        print("  User preferences:")
        for pref in task.data["user_preferences"]:
            print(f"    - {pref}")

```
</details>

You can view the sessions tasks' statuses in Dashboard:

<div align="center">
    <picture>
      <img alt="Acontext Learning" src="./docs/images/dashboard/session_task_viewer.png" width="50%">
    </picture>
  <p>A Task Demo</p>
</div>



## Self-learning

Acontext can gather a bunch of sessions and learn skills (SOPs) on how to call tools for certain tasks.

### Learn Skills to a `Space` [📖](https://docs.acontext.io/learn/skill-space)

A `Space` can store skills, experiences, and memories in a Notion-like system.

```python
# Step 1: Create a Space for skill learning
space = client.spaces.create()
print(f"Created Space: {space.id}")

# Step 2: Create a session attached to the space
session = client.sessions.create(space_id=space.id)

# ... push the agent working context
```

The learning happens in the background and is not real-time (delay around 10-30s).

You can view every `Space` in the Dashboard:

<div align="center">
    <picture>
      <img alt="A Space Demo" src="./docs/images/dashboard/skill_viewer.png" width="50%">
    </picture>
  <p>A Space Demo</p>
</div>




### Search Skills from a `Space` [📖](https://docs.acontext.io/learn/search-skills)

To search skills from `Space` and use it in the next session:

```python
result = client.spaces.experience_search(
    space_id=space.id,
    query="I need to implement authentication",
  	mode="fast"
)
```

Acontext supports `fast` and `agentic` modes for search. The former uses embedding to match skills. The latter uses a Notion Agent to explore the entire `Space` and tries to cover every skill needed.





# Stay Updated

Star Acontext on Github to support and receive instant notifications ❤️

![click_star](./assets/star_acontext.gif)



# Stay Together

Join the community for support and discussions:

-   [Discuss with Builders on Acontext Discord](https://discord.gg/rpZs5TaSuV) 👻 
-  [Follow Acontext on X](https://x.com/acontext_io) 𝕏 