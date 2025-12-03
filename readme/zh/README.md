<div align="center">
  <a href="https://discord.acontext.io">
      <img alt="Show Acontext header banner" src="../../assets/Acontext-header-banner.png">
  </a>
  <p>
    <h3>扩展上下文，学习经验</h3>
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
  <div align="center">
    <!-- Keep these links. Translations will automatically update with the README. -->
    <a href="../../readme/de/README.md">Deutsch</a> | 
    <a href="../../readme/es/README.md">Español</a> | 
    <a href="../../readme/fr/README.md">Français</a> | 
    <a href="../../readme/ja/README.md">日本語</a> | 
    <a href="../../readme/ko/README.md">한국어</a> | 
    <a href="../../readme/pt/README.md">Português</a> | 
    <a href="../../readme/ru/README.md">Русский</a> | 
    <a href="../../readme/zh/README.md">中文</a>
  </div>
  <br/>
</div>





Acontext 是一个用于**云原生** AI Agent 应用程序的**上下文数据平台**。

它可以：

- **存储** 上下文和 Artifacts
- **观察** Agent 任务和用户反馈。
- 通过将经验（SOP）收集到长期记忆中，实现 Agent **自我学习**。
- 提供**本地仪表板**来查看消息、任务、 Artifacts 和经验。



<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../assets/acontext_dataflow.png" width="100%">
    </picture>
  <p>存储、观察和学习</p>
</div>





我们正在构建它，因为我们相信 Acontext 可以帮助您：

- **构建更具可扩展性的 Agent 产品**
- **提高 Agent 成功率并减少运行步骤**

这样您的 Agent 可以更加稳定，并为用户提供更大的价值。



# 🌲 核心概念

- [**Session**](https://docs.acontext.io/store/messages/multi-provider) - 一个对话线程，支持多模态消息存储。 
  - [**Task Agent**](https://docs.acontext.io/observe/agent_tasks) - 后台 TODO Agent，收集任务的状态、进度和偏好。
- [**Disk**](https://docs.acontext.io/store/disk) - 用于 Agent Artifacts 的文件存储。
- [**Space**](https://docs.acontext.io/learn/skill-space) - 一个类似 Notion 的 Agents `Space`，用于存储学习的技能。 
  - [**Experience Agent**](https://docs.acontext.io/learn/advance/experience-agent) - 后台 Agents，用于提炼、保存和搜索技能。

### 它们如何协同工作

```txt
┌──────┐    ┌────────────┐    ┌──────────────┐    ┌───────────────┐
│ User │◄──►│ Your Agent │◄──►│   Session    │    │ Artifact Disk │
└──────┘    └─────▲──────┘    └──────┬───────┘    └───────────────┘
                  │                  │
                  │         ┌────────▼────────┐
                  │         │ Observed Tasks  │
                  │         └────────┬────────┘
                  │                  │
                  │         ┌────────▼────────┐
                  │         │  Space (learn)  │ # or wait for user confirmation
                  │         └────────┬────────┘
                  │                  │
                  └──────────────────┘
                  技能指导 Agent
```

您的 Agent 技能看起来像：

```json
{
    "use_when": "star a repo on github.com",
    "preferences": "use personal account. star but not fork",
    "tool_sops": [
        {"tool_name": "goto", "action": "goto github.com"},
        {"tool_name": "click", "action": "find login button if any. login first"},
        ...
    ]
}
```



Agent 经验将存储在结构化的 `Space` 中，包含文件夹、页面和块。例如：

```txt
/
└── github/ (folder)
    └── GTM (page)
        ├── find_trending_repos (sop block)
        └── find_contributor_emails (sop block)
    └── basic_ops (page)
        ├── create_repo (sop block)
        └── delete_repo (sop block)
    ...
```



# 🚀 如何开始？

我们有一个 `acontext-cli` 来帮助您快速进行概念验证。首先在终端中下载它：

```bash
curl -fsSL https://install.acontext.io | sh
```

您应该安装 [docker](https://www.docker.com/get-started/) 并拥有 OpenAI API 密钥，以便在计算机上启动 Acontext 后端：

```bash
mkdir acontext_server && cd acontext_server
acontext docker up
```

> [📖 本地设置](https://docs.acontext.io/local#start-acontext-server-locally) Acontext 至少需要一个 OpenAI API 密钥。我们推荐使用 `gpt-5.1` 或 `gpt-4.1` 作为 LLM 模型

`acontext docker up` 将为 Acontext 创建/使用 `.env` 和 `config.yaml`，并创建 `db` 文件夹来持久化数据。



完成后，您可以访问以下端点：

- Acontext API Base URL: http://localhost:8029/api/v1
- Acontext Dashboard: http://localhost:3000/



<div align="center">
    <picture>
      <img alt="Dashboard" src="../../docs/images/dashboard/BI.png" width="100%">
    </picture>
  <p>成功率和其他指标的仪表板</p>
</div>





# 🧐 如何使用？

使用 `acontext` 下载端到端脚本：

**Python**

```bash
acontext create my-proj --template-path "python/openai-basic"
```

> Python 的更多示例：
>
> - `python/openai-agent-basic`: openai agent sdk 中的自学习 Agent。
> - `python/agno-basic`: agno framework 中的自学习 Agent。
> - `python/openai-agent-artifacts`: 可以编辑和下载 Artifacts 的 Agent。

**Typescript**

```bash
acontext create my-proj --template-path "typescript/openai-basic"
```

> Typescript 的更多示例：
>
> - `typescript/vercel-ai-basic`: @vercel/ai-sdk 中的自学习 Agent



查看我们的示例仓库以获取更多模板：[Acontext-Examples](https://github.com/memodb-io/Acontext-Examples)。



## 逐步说明

<details>
<summary>点击打开</summary>


我们维护 Python [![pypi](https://img.shields.io/pypi/v/acontext.svg)](https://pypi.org/project/acontext/) 和 Typescript [![npm](https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D)](https://www.npmjs.com/package/@acontext/acontext) SDK。下面的代码片段使用 Python。

## 安装 SDK

```
pip install acontext # for Python
npm i @acontext/acontext # for Typescript
```



## 初始化客户端

```python
from acontext import AcontextClient

client = AcontextClient(
    base_url="http://localhost:8029/api/v1",
    api_key="sk-ac-your-root-api-bearer-token"
)
client.ping()

# yes, the default api_key is sk-ac-your-root-api-bearer-token
```

> [📖 异步客户端文档](https://docs.acontext.io/settings/core)



## 存储

Acontext 可以管理 Agent 会话和 Artifacts。

### 保存消息 [📖](https://docs.acontext.io/api-reference/session/send-message-to-session)

Acontext 为消息数据提供持久化存储。当您调用 `session.send_message` 时，Acontext 将持久化消息并开始监控此会话：

<details>
<summary>代码片段</summary>

```python
session = client.sessions.create()

messages = [
    {"role": "user", "content": "I need to write a landing page of iPhone 15 pro max"},
    {
        "role": "assistant",
        "content": "Sure, my plan is below:\n1. Search for the latest news about iPhone 15 pro max\n2. Init Next.js project for the landing page\n3. Deploy the landing page to the website",
    }
]

# Save messages
for msg in messages:
    client.sessions.send_message(session_id=session.id, blob=msg, format="openai")
```

> [📖](https://docs.acontext.io/store/messages/multi-modal) 我们还支持多模态消息存储和 anthropic SDK。


</details>

### 加载消息 [📖](https://docs.acontext.io/api-reference/session/get-messages-from-session)

使用 `sessions.get_messages` 获取您的会话消息

<details>
<summary>代码片段</summary>

```python
r = client.sessions.get_messages(session.id)
new_msg = r.items

new_msg.append({"role": "user", "content": "How are you doing?"})
r = openai_client.chat.completions.create(model="gpt-4.1", messages=new_msg)
print(r.choices[0].message.content)
client.sessions.send_message(session_id=session.id, blob=r.choices[0].message)
```

</details>

<div align="center">
    <picture>
      <img alt="Session" src="../../docs/images/dashboard/message_viewer.png" width="100%">
    </picture>
  <p>您可以在本地仪表板中查看会话</p>
</div>


### Artifacts [📖](https://docs.acontext.io/store/disk)

为您的 Agent 创建一个磁盘，使用文件路径存储和读取 Artifacts：

<details>
<summary>代码片段</summary>

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
      <img alt="Artifacts" src="../../docs/images/dashboard/artifact_viewer.png" width="100%">
    </picture>
  <p>您可以在本地仪表板中查看 Artifacts</p>
</div>



## 观察 [📖](https://docs.acontext.io/observe)

对于每个会话，Acontext 将**自动**启动一个后台 Agent 来跟踪任务进度和用户反馈。**它就像一个后台 TODO Agent**。Acontext 将使用它来观察您日常 Agent 的成功率。

您可以使用 SDK 检索 Agent 会话的当前状态，用于上下文工程，如减少和压缩。 

<details>
<summary>完整脚本</summary>

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
      	"tool_calls": [
            {
                "id": "call_001",
                "type": "function",
                "function": {
                    "name": "search_news",
                    "arguments": "{\"query\": \"iPhone news\"}"
                }
            }
        ]
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
> `flush` 是一个阻塞调用，它将等待任务提取完成。
> 您不需要在生产环境中调用它，Acontext 有一个缓冲机制来确保任务提取在正确的时间完成。

</details>

示例任务返回：

```txt
Task #1:
  Title: Search for the latest news about iPhone 15 Pro Max and report findings to the user before any landing page coding.
  Status: success
  Progress updates: 2
    - I confirmed that the first step will be reporting before moving on to landing page development.
    - I have already collected all the iPhone 15 pro max info and reported to the user, waiting for approval for next step.
  User preferences:
    - user expects a report on latest news about iPhone 15 pro max before any coding work on the landing page.

Task #2:
  Title: Initialize a Next.js project for the iPhone 15 Pro Max landing page.
  Status: pending

Task #3:
  Title: Deploy the completed landing page to the website.
  Status: pending
```



您可以在仪表板中查看会话任务的状态：

<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../docs/images/dashboard/session_task_viewer.png" width="100%">
    </picture>
  <p>任务演示</p>
</div>



## 自我学习

Acontext 可以收集大量会话，并学习如何为某些任务调用工具的技能（SOP）。

### 将技能学习到 `Space` [📖](https://docs.acontext.io/learn/skill-space)

`Space` 可以在类似 Notion 的系统中存储技能、经验和记忆。您首先需要将会话连接到 `Space` 以启用学习过程：

```python
# Step 1: Create a Space for skill learning
space = client.spaces.create()
print(f"Created Space: {space.id}")

# Step 2: Create a session attached to the space
session = client.sessions.create(space_id=space.id)

# ... push the agent working context
```

学习在后台进行，不是实时的（延迟约 10-30 秒）。 

Acontext 在后台将执行的操作：

```mermaid
graph LR
    A[Task Completed] --> B[Task Extraction]
    B --> C{Space Connected?}
    C -->|Yes| D[Queue for Learning]
    C -->|No| E[Skip Learning]
    D --> F[Extract SOP]
    F --> G{Hard Enough?}
    G -->|No - Too Simple| H[Skip Learning]
    G -->|Yes - Complex| I[Store as Skill Block]
    I --> J[Available for Future Sessions]
```

最终，带有工具调用模式的 SOP 块将被保存到 `Space`。您可以在仪表板中查看每个 `Space`：

<div align="center">
    <picture>
      <img alt="A Space Demo" src="../../docs/images/dashboard/skill_viewer.png" width="100%">
    </picture>
  <p>Space 演示</p>
</div>




### 从 `Space` 搜索技能 [📖](https://docs.acontext.io/learn/search-skills)

要从 `Space` 搜索技能并在下一个会话中使用它们：

```python
result = client.spaces.experience_search(
    space_id=space.id,
    query="I need to implement authentication",
  	mode="fast"
)
```

Acontext 支持 `fast` 和 `agentic` 搜索模式。前者使用嵌入来匹配技能。后者使用 Experience Agents 探索整个 `Space`，并尝试涵盖所需的每个技能。

返回的是一个 sop 块列表，如下所示：

```json
{
    "use_when": "star a github repo",
    "preferences": "use personal account. star but not fork",
    "tool_sops": [
        {"tool_name": "goto", "action": "goto the user given github repo url"},
        {"tool_name": "click", "action": "find login button if any, and start to login first"},
        ...
    ]
}
```

</details>






# 🔍 文档

要更好地了解 Acontext 的功能，请查看 [我们的文档](https://docs.acontext.io/)



# ❤️ 保持更新

在 Github 上为 Acontext 加星标以支持并接收即时通知 

![click_star](../../assets/star_acontext.gif)



# 🤝 保持联系

加入社区以获得支持和讨论：

-   [在 Acontext Discord 上与构建者讨论](https://discord.acontext.io) 👻 
-  [在 X 上关注 Acontext](https://x.com/acontext_io) 𝕏 



# 🌟 贡献

- 首先查看我们的 [roadmap.md](../../ROADMAP.md)。
- 阅读 [contributing.md](../../CONTRIBUTING.md)



# 📑 许可证

本项目目前根据 [Apache License 2.0](LICENSE) 许可。



# 🥇 徽章

![Made with Acontext](../../assets/badge-made-with-acontext.svg) ![Made with Acontext (dark)](../../assets/badge-made-with-acontext-dark.svg)

```md
[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext.svg)](https://acontext.io)

[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext-dark.svg)](https://acontext.io)
```

