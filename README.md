<div align="center">
  <a href="https://discord.acontext.io">
      <img alt="Acontext - The Agent Memory Stack" src="./assets/Acontext-header-banner.png">
  </a>
 	<p align="center">
 	  	<a href="https://acontext.io">🌐 Website</a>
      |
 	  	<a href="https://docs.acontext.app">📚 Document</a>
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






Acontext is the **memory stack** for production AI agents. Think of it as Supabase for agent memory.

Unifies **short-term memory, mid-term state, and long-term skill** for production AI agents.



# ❓ Why use Acontext

#### The Problem

- **Context data is scattered** — messages, files, and skills live in different storages with no unified interface
- **No observability on agent state** — you can't track success rates, replay trajectories, or know if your agent is actually working
- **Your agent's memory is a black box** — vector stores and key-value memory are opaque, not inspectable, and not version controllable

#### Acontext's Approach

- **Short-term Memory** — unified storage for messages, files, and artifacts — integrated with Claude Agent SDK, AI-SDK, OpenAI SDK...
- **Mid-term State** — replay trajectories, track success rates, and monitor agents in real-time
- **Long-term Skill** — agents distill successful/failed task outcomes into reusable, human-readable skill files, improving with every run

<div align="center">
      <img alt="Acontext - The Agent Memory Stack" src="./assets/acontext-components.png">  
</div>


# 💡 Core Features

- **Short-term Memory**
  - [Session](https://docs.acontext.app/store/messages/multi-provider): save agent history from any LLM, any modality
- **Mid-term State**
  - [State Tracking](https://docs.acontext.app/observe/agent_tasks): collect agent tasks and results in near real-time
- **Long-term Skill**
  - [Skill Memory](https://docs.acontext.app/learn/skill-memory) - agents automatically build and update skills from successful/failed sessions

<div align="center">
    <picture>
      <img alt="Dashboard" src="./docs/images/dashboard/BI.png" width="80%">
    </picture>
</div>






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

We have an `acontext-cli` to help you do quick proof-of-concept. Download it first in your terminal:

```bash
curl -fsSL https://install.acontext.io | sh
```

You should have [docker](https://www.docker.com/get-started/) installed and an OpenAI API Key to start an Acontext backend on your computer:

```bash
mkdir acontext_server && cd acontext_server
acontext server up
```

> Make sure your LLM has the ability to [call tools](https://platform.openai.com/docs/guides/function-calling). By default, Acontext will use `gpt-4.1`.

`acontext server up` will create/use  `.env` and `config.yaml` for Acontext, and create a `db` folder to persist data.



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



### The Memory Stack in 3 Steps

Store a message, get agent state, and retrieve learned skills — one API for each layer.

```python
session = client.sessions.create()
space = client.learning_spaces.create()
client.learning_spaces.learn(space.id, session_id=session.id)

# 1. Short-term Memory — store messages in any LLM format
client.sessions.store_message(
    session_id=session.id,
    blob={"role": "user", "content": "Deploy the new API to staging"},
)
# ... your agent runs ...
msgs = client.sessions.get_messages(session_id=session.id)

# 2. Mid-term State — flush to trigger processing, then get state
client.sessions.flush(session.id)
summary = client.sessions.get_session_summary(session_id=session.id)
print(summary)

# 3. Long-term Skill — wait for learning, then retrieve skills
client.learning_spaces.wait_for_learning(space.id, session_id=session.id)
skills = client.learning_spaces.list_skills(space.id)
for skill in skills:
    print(f"{skill.name}: {skill.description}")
```

> `flush` and `wait_for_learning` are blocking helpers for demo purposes. In production, task extraction and learning run in the background automatically — your agent never waits.

### More Features

- **[Context Engineering](https://docs.acontext.app/engineering/editing)** — Compress context with summaries and edit strategies
- **[Disk](https://docs.acontext.app/store/disk)** — Virtual, persistent filesystem for agents
- **[Sandbox](https://docs.acontext.app/store/sandbox)** — Isolated code execution with bash, Python, and [mountable skills](https://docs.acontext.app/tool/bash_tools#mounting-skills-in-sandbox)
- **[Agent Tools](https://docs.acontext.app/tool/whatis)** — Disk tools, sandbox tools, and skill tools for LLM function calling





# 🧐 Use Acontext to build Agent

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





# 🔍 Document

To learn more about long-term skill and what Acontext can do, visit [our docs](https://docs.acontext.app/) or start with [What is Long-term Skill?](https://docs.acontext.app/learn/skill-memory)



# ❤️ Stay Updated

Star Acontext on Github to support and receive instant notifications 

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

