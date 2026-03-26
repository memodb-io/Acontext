<div align="center">
  <a href="https://discord.acontext.io">
      <img alt="Acontext - Agent Skills as a Memory Layer" src="./assets/Acontext-header-banner.png">
  </a>
 	<p align="center">
 	  	<a href="https://acontext.io">🌐 Website</a>
      |
 	  	<a href="https://docs.acontext.io">📚 Document</a>
  </p>
  <p align="center">
    <a href="https://pypi.org/project/acontext/"><img src="https://img.shields.io/pypi/v/acontext.svg"></a>
    <a href="https://www.npmjs.com/package/@acontext/acontext"><img src="https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D"></a>
    <a href="https://github.com/memodb-io/acontext/actions/workflows/core-test.yaml"><img src="https://github.com/memodb-io/acontext/actions/workflows/core-test.yaml/badge.svg"></a>
    <a href="https://github.com/memodb-io/acontext/actions/workflows/api-test.yaml"><img src="https://github.com/memodb-io/acontext/actions/workflows/api-test.yaml/badge.svg"></a>
    <a href="https://github.com/memodb-io/acontext/actions/workflows/cli-test.yaml"><img src="https://github.com/memodb-io/acontext/actions/workflows/cli-test.yaml/badge.svg"></a>
  </p>
<p align="center">
 	  	<a href="https://x.com/acontext_io"><img src="https://img.shields.io/twitter/follow/acontext_io?style=social" alt="Twitter Follow"></a>
    <a href="https://discord.acontext.io"><img src="https://img.shields.io/badge/dynamic/json?label=Acontext&style=flat&query=approximate_member_count&url=https%3A%2F%2Fdiscord.com%2Fapi%2Fv10%2Finvites%2FSG9xJcqVBu%3Fwith_counts%3Dtrue&logo=discord&logoColor=white&suffix=+members&color=36393f&labelColor=5765F2" alt="Acontext Discord"></a>
  </p>
</div>






## What is Acontext?

Acontext is an open-source skill memory layer for AI agents. It **automatically** captures learnings from agent runs and stores them as **agent skill files** — files you can read, edit, and share across agents, LLMs, and frameworks.

If you want the agent you build to **learn from its mistakes** and **reuse what worked** — without opaque memory polluting your context — give Acontext a try.



## Skill is All You Need

Agent memory is getting increasingly complicated🤢 — hard to understand, hard to debug, and hard for users to inspect or correct. Acontext takes a different approach: if agent skills can represent every piece of knowledge an agent needs as simple files, so can the memory.

- **Acontext builds memory in the agent skills format**, so everyone can see and understand what the memory actually contains.
- **Skill is Memory, Memory is Skill**. Whether a skill comes from one you downloaded from Clawhub or one you created yourself, Acontext can follow it and evolve it over time.



## The Philosophy of Acontext

- **Plain file, any framework** — Skill memories are Markdown files. Use them with LangGraph, Claude, AI SDK, or anything that reads files. No embeddings, no API lock-in. Git, grep, and mount to the sandbox.
- **You design the structure** — Attach more skills to define the schema, naming, and file layout of the memory. For example: one file per contact, one per project by uploading a working context skill.
- **Progressive disclosure, not search** — The agent can use  `get_skill` and `get_skill_file` to fetch what it needs. Retrieval is by tool use and reasoning, not semantic top-k.
- **Download as ZIP, reuse anywhere** — Export skill files as ZIP. Run locally, in another agent, or with another LLM. No vendor lock-in; no re-embedding or migration step.

## How It Works

### Store — How skills get memorized?

```mermaid
flowchart LR
  A[Session messages] --> C[Task complete/failed]
  C --> D[Distillation]
  D --> E[Skill Agent]
  E --> F[Update Skills]
```

- **Session messages** — Conversation (and optionally tool calls, artifacts) is the raw input. Tasks are extracted from the message stream automatically (or inferred from explicit outcome reporting).
- **Task complete or failed** — When a task is marked done or failed (e.g. by agent report or automatic detection), that outcome is the trigger for learning.
- **Distillation** — An LLM pass infers from the conversation and execution trace what worked, what failed, and user preferences.
- **Skill Agent** — Decides where to store (existing skill or new) and writes according to your `SKILL.md` schema.
- **Update Skills** — Skills are updated. You define the structure in `SKILL.md`; the system does extraction, routing, and writing.

### Recall — How the agent uses skills on the next run

```mermaid
flowchart LR
  E[Any Agent] --> F[list_skills/get_skill]
  F --> G[Appear in context]
```

Give your agent **Skill Content Tools** (`get_skill`, `get_skill_file`). The agent decides what it needs, calls the tools, and gets the skill content. No embedding search — **progressive disclosure, agent in the loop**.



# 🪜 Use It to Improve your Agent

Claude Code: 

```text
Read https://acontext.io/SKILL.md and follow the instructions to install and configure Acontext for Claude Code
```

OpenClaw:

```text
Read https://acontext.io/SKILL.md and follow the instructions to install and configure Acontext for OpenClaw
```




# 🚀 Step-by-step Quickstart

### Connect to Acontext

1. Go to [Acontext.io](https://acontext.io), claim your free credits.
2. Go through a one-click onboarding to get your API Key (starts with `sk-ac`)

<div align="center">
    <picture>
      <img alt="Dashboard" src="./assets/onboard.png" width="80%">
    </picture>
</div>




<details>
<summary>💻 Self-host Acontext</summary>

We have an `acontext-cli` to help you do a quick proof-of-concept. Download it first in your terminal:

```bash
curl -fsSL https://install.acontext.io | sh
```

You should have [docker](https://www.docker.com/get-started/) installed and an OpenAI API Key to start an Acontext backend on your computer:

```bash
mkdir acontext_server && cd acontext_server
acontext server up
```

> Make sure your LLM has the ability to [call tools](https://platform.openai.com/docs/guides/function-calling). By default, Acontext will use `gpt-4.1`. You can also use other LLM providers by setting `LLM_SDK` to `anthropic` or `minimax` in your `.env` file.

`acontext server up` will create/use `.env` and `config.yaml` for Acontext, and create a `db` folder to persist data.



Once it's done, you can access the following endpoints:

- Acontext API Base URL: http://localhost:8029/api/v1
- Acontext Dashboard: http://localhost:3000/

</details>



### Install SDKs

We're maintaining Python [![pypi](https://img.shields.io/pypi/v/acontext.svg)](https://pypi.org/project/acontext/) and Typescript [![npm](https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D)](https://www.npmjs.com/package/@acontext/acontext) SDKs. The snippets below are using Python.

> Click the doc link to see TS SDK Quickstart.

```bash
pip install acontext
```


### Initialize Client

```python
import os
from acontext import AcontextClient

# For cloud:
client = AcontextClient(
    api_key=os.getenv("ACONTEXT_API_KEY"),
)

# For self-hosted:
client = AcontextClient(
    base_url="http://localhost:8029/api/v1",
    api_key="sk-ac-your-root-api-bearer-token",
)
```



### Skill Memory in Action

Create a learning space, attach a session, and let the agent learn — skills are written as Markdown files automatically.

```python
from acontext import AcontextClient

client = AcontextClient(api_key="sk-ac-...")

# Create a learning space and attach a session
space = client.learning_spaces.create()
session = client.sessions.create()
client.learning_spaces.learn(space.id, session_id=session.id)

# Run your agent, store messages — when tasks complete, learning runs automatically
client.sessions.store_message(session.id, blob={"role": "user", "content": "My name is Gus"})
client.sessions.store_message(session.id, blob={"role": "assistant", "content": "Hi Gus! How can I help you today?"})
# ... agent runs ...

# List learned skills (Markdown files)
client.learning_spaces.wait_for_learning(space.id, session_id=session.id)
skills = client.learning_spaces.list_skills(space.id)

# Download all skill files to a local directory
for skill in skills:
    client.skills.download(skill_id=skill.id, path=f"./skills/{skill.name}")
```

> `wait_for_learning` is a blocking helper for demo purposes. In production, task extraction and learning run in the background automatically — your agent never waits.

### More Features

- **[Context Engineering](https://docs.acontext.io/engineering/editing)** — Compress context with summaries and edit strategies
- **[Disk](https://docs.acontext.io/store/disk)** — Virtual, persistent filesystem for agents
- **[Sandbox](https://docs.acontext.io/store/sandbox)** — Isolated code execution with bash, Python, and [mountable skills](https://docs.acontext.io/tool/bash_tools#mounting-skills-in-sandbox)
- **[Agent Tools](https://docs.acontext.io/tool/whatis)** — Disk tools, sandbox tools, and skill tools for LLM function calling





# 🧐 Use Acontext to Build Agents

Download end-to-end scripts with `acontext`:

**Python**

```bash
acontext create my-proj --template-path "python/openai-basic"
```

More examples on Python:

- `python/openai-agent-basic`: openai agent sdk template
- `python/openai-agent-artifacts`: agent can edit and download artifacts
- `python/claude-agent-sdk`: claude agent sdk with `ClaudeAgentStorage`
- `python/agno-basic`: agno framework template
- `python/smolagents-basic`: smolagents (huggingface) template
- `python/interactive-agent-skill`: interactive sandbox with mountable agent skills

**Typescript**

```bash
acontext create my-proj --template-path "typescript/openai-basic"
```

More examples on Typescript:
- `typescript/vercel-ai-basic`: agent in @vercel/ai-sdk
- `typescript/claude-agent-sdk`: claude agent sdk with `ClaudeAgentStorage`
- `typescript/interactive-agent-skill`: interactive sandbox with mountable agent skills



> [!NOTE]
>
> Check our example repo for more templates: [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples).
>
> We're cooking more full-stack Agent Applications! [Tell us what you want!](https://discord.acontext.io)





# 🔍 Documentation

To learn more about skill memory and what Acontext can do, visit [our docs](https://docs.acontext.io/) or start with [What is Skill Memory?](https://docs.acontext.io/learn/quick)



# ❤️ Stay Updated

Star Acontext on GitHub to support us and receive instant notifications.

![click_star](./assets/star_acontext.gif)



# 🏗️ Architecture

<details>
<summary>click to open</summary>

```mermaid
graph TB
    subgraph "Client Layer"
        PY["pip install acontext"]
        TS["npm i @acontext/acontext"]
    end
    
    subgraph "Acontext Backend"
      subgraph " "
          API["API<br/>localhost:8029"]
          CORE["Core"]
          API -->|FastAPI & MQ| CORE
      end
      
      subgraph " "
          Infrastructure["Infrastructures"]
          PG["PostgreSQL"]
          S3["S3"]
          REDIS["Redis"]
          MQ["RabbitMQ"]
      end
    end
    
    subgraph "Dashboard"
        UI["Web Dashboard<br/>localhost:3000"]
    end
    
    PY -->|RESTFUL API| API
    TS -->|RESTFUL API| API
    UI -->|RESTFUL API| API
    API --> Infrastructure
    CORE --> Infrastructure

    Infrastructure --> PG
    Infrastructure --> S3
    Infrastructure --> REDIS
    Infrastructure --> MQ
    
    
    style PY fill:#3776ab,stroke:#fff,stroke-width:2px,color:#fff
    style TS fill:#3178c6,stroke:#fff,stroke-width:2px,color:#fff
    style API fill:#00add8,stroke:#fff,stroke-width:2px,color:#fff
    style CORE fill:#ffd43b,stroke:#333,stroke-width:2px,color:#333
    style UI fill:#000,stroke:#fff,stroke-width:2px,color:#fff
    style PG fill:#336791,stroke:#fff,stroke-width:2px,color:#fff
    style S3 fill:#ff9900,stroke:#fff,stroke-width:2px,color:#fff
    style REDIS fill:#dc382d,stroke:#fff,stroke-width:2px,color:#fff
    style MQ fill:#ff6600,stroke:#fff,stroke-width:2px,color:#fff
```

</details>

# 🤝 Stay Together

Join the community for support and discussions:

-   [Discuss with Builders on Acontext Discord](https://discord.acontext.io) 👻 
-  [Follow Acontext on X](https://x.com/acontext_io) 𝕏 



# 🌟 Contributing

- Check our [roadmap.md](./ROADMAP.md) first.
- Read [contributing.md](./CONTRIBUTING.md)



# 🥇 Badges

![Made with Acontext](./assets/badge-made-with-acontext.svg) ![Made with Acontext (dark)](./assets/badge-made-with-acontext-dark.svg)

```md
[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext.svg)](https://acontext.io)

[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext-dark.svg)](https://acontext.io)
```





# 📑 LICENSE

This project is currently licensed under [Apache License 2.0](LICENSE).

