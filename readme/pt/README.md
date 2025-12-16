<div align="center">
  <a href="https://discord.acontext.io">
      <img alt="Show Acontext header banner" src="../../assets/Acontext-header-banner.png">
  </a>
  <p>
    <h3>Engenharia de Contextos, Aprender Habilidades</h3>
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





Acontext é uma **plataforma de dados de contexto** para construir AI Agents **cloud-native**. Pode:

- **Armazenar** contextos e artifacts. 
- Fazer **engenharia de contexto** para você.
- **Observar** tarefas de agentes e feedback do usuário.
- Habilitar o **autoaprendizado** de agentes através da destilação de habilidades das tarefas concluídas do agente.
- Visualizar tudo em um **Painel**.



<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../assets/acontext-components.jpg" width="100%">
    </picture>
  <p>Plataforma de Dados de Contexto que Armazena, Observa e Aprende</p>
</div>





O Acontext pode ajudá-lo a:

- **Construir um produto de agente mais escalável com melhor engenharia de contexto**
- **Construir um produto de Agent verdadeiramente observável.**
- **Melhorar automaticamente sua taxa de sucesso do agente**



# 💡 Principais Recursos

- [**Session**](https://docs.acontext.io/store/messages/multi-provider) - Armazenamento de Mensagens Multi-modal
  - [**Task Agent**](https://docs.acontext.io/observe/agent_tasks) - Agente TODO em segundo plano que coleta status, progresso e preferências da tarefa
  - [**Context Editing**](https://docs.acontext.io/store/editing) - Engenharia de Contexto em uma chamada
- [**Disk**](https://docs.acontext.io/store/disk) - Sistema de arquivos para artifacts
- [**Space**](https://docs.acontext.io/learn/skill-space) - Notion para agentes
  - [**Experience Agent**](https://docs.acontext.io/learn/advance/experience-agent) - Agentes em segundo plano que destilam, salvam e pesquisam habilidades
- [**Dashboard**](https://docs.acontext.io/observe/dashboard) - Visualizar mensagens, artifacts, habilidades, taxas de sucesso e tudo

### Como Eles Trabalham Juntos

```txt
┌──────┐    ┌────────────┐    ┌──────────────┐    ┌───────────────┐
│ User │◄──►│ Your Agent │◄──►│   Session    │    │ Artifact Disk │
└──────┘    └─────▲──────┘    └──────┬───────┘    └───────────────┘
                  │                  │ # if enable
                  │         ┌────────▼────────┐
                  │         │ Observed Tasks  │
                  │         └────────┬────────┘
                  │                  │ # if enable
                  │         ┌────────▼────────┐
                  │         │   Learn Skills  │
                  │         └────────┬────────┘
                  └──────────────────┘
                      Search skills
```




</details>



# 🏗️ Arquitetura

<details>
<summary>Clique para abrir o diagrama de arquitetura, se estiver interessado.</summary>

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

## Estruturas de Dados
<details>
<summary>📖 Estrutura de Tarefa</summary>

```json
{
  "task_description": "Star https://github.com/memodb-io/Acontext",
  "progresses": [
    "I have navigated to Acontext repo",
    "Tried to Star but a pop-up required me to login",
    ...
  ],
  "user_preferences": [
    "user wants to use outlook email to login"
  ]
}
```
</details>



<details>
<summary>📖 Estrutura de Habilidade</summary>


```json
{
    "use_when": "star a repo on github.com",
    "preferences": "use user's outlook account",
    "tool_sops": [
        {"tool_name": "goto", "action": "goto github.com"},
        {"tool_name": "click", "action": "find login button if any. login first"},
        ...
    ]
}
```

</details>



<details>
<summary>📖 Estrutura de Space</summary>

```txt
/
└── github/ (folder)
    └── GTM (page)
        ├── find_trending_repos (sop)
        └── find_contributor_emails (sop)
    └── basic_ops (page)
        ├── create_repo (sop)
        └── delete_repo (sop)
    ...
```
</details>

</details>





# 🚀 Start the Backend Locally

Temos um `acontext-cli` para ajudá-lo a fazer uma prova de conceito rápida. Baixe-o primeiro no seu terminal:

```bash
curl -fsSL https://install.acontext.io | sh
```

Você deve ter [docker](https://www.docker.com/get-started/) instalado e uma Chave API OpenAI para iniciar um backend Acontext no seu computador:

```bash
mkdir acontext_server && cd acontext_server
acontext docker up
```

> [📖 configuração local](https://docs.acontext.io/local#start-acontext-server-locally) Acontext requer pelo menos uma Chave API OpenAI. Recomendamos `gpt-5.1` ou `gpt-4.1` como modelo LLM

`acontext docker up` criará/usará `.env` e `config.yaml` para Acontext, e criará uma pasta `db` para persistir dados.



Quando terminar, você pode acessar os seguintes endpoints:

- Acontext API Base URL: http://localhost:8029/api/v1
- Acontext Dashboard: http://localhost:3000/



<div align="center">
    <picture>
      <img alt="Dashboard" src="../../docs/images/dashboard/BI.png" width="100%">
    </picture>
  <p>Painel de Taxa de Sucesso e outras Métricas</p>
</div>





# 🧐 Use Acontext to build Agent

Baixe scripts de ponta a ponta com `acontext`:

**Python**

```bash
acontext create my-proj --template-path "python/openai-basic"
```

> Mais exemplos em Python:
>
> - `python/openai-agent-basic`: Agent de autoaprendizado no openai agent sdk.
> - `python/agno-basic`: Agent de autoaprendizado no agno framework.
> - `python/openai-agent-artifacts`: Agent que pode editar e baixar Artifacts.

**Typescript**

```bash
acontext create my-proj --template-path "typescript/openai-basic"
```

> Mais exemplos em Typescript:
>
> - `typescript/vercel-ai-basic`: Agent de autoaprendizado no @vercel/ai-sdk



Confira nosso repositório de exemplos para mais modelos: [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples).



## SDK Walk-through

<details>
<summary>Clique para Abrir</summary>


Mantemos SDKs Python [![pypi](https://img.shields.io/pypi/v/acontext.svg)](https://pypi.org/project/acontext/) e Typescript [![npm](https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D)](https://www.npmjs.com/package/@acontext/acontext). Os trechos de código abaixo usam Python.

## Instalar SDKs

```
pip install acontext # for Python
npm i @acontext/acontext # for Typescript
```



## Inicializar Cliente

```python
from acontext import AcontextClient

client = AcontextClient(
    base_url="http://localhost:8029/api/v1",
    api_key="sk-ac-your-root-api-bearer-token"
)
client.ping()

# yes, the default api_key is sk-ac-your-root-api-bearer-token
```

> [📖 async client doc](https://docs.acontext.io/settings/core)



## Armazenar

Acontext pode gerenciar sessões de Agents e Artifacts.

### Salvar Mensagens [📖](https://docs.acontext.io/api-reference/session/send-message-to-session)

Acontext oferece armazenamento persistente para dados de mensagens. Quando você chama `session.send_message`, o Acontext persistirá a mensagem e começará a monitorar esta sessão:

<details>
<summary>Trecho de Código</summary>

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

> [📖](https://docs.acontext.io/store/messages/multi-modal) Também suportamos armazenamento de mensagens multi-modal e SDK anthropic.


</details>

### Carregar Mensagens [📖](https://docs.acontext.io/api-reference/session/get-messages-from-session)

Obtenha as mensagens da sua sessão usando `sessions.get_messages`

<details>
<summary>Trecho de Código</summary>

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
  <p>Você pode visualizar sessões no seu Painel local</p>
</div>


### Artifacts [📖](https://docs.acontext.io/store/disk)

Crie um disco para seu Agent armazenar e ler Artifacts usando caminhos de arquivo:

<details>
<summary>Trecho de Código</summary>

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
  <p>Você pode visualizar Artifacts no seu Painel local</p>
</div>



## Observar [📖](https://docs.acontext.io/observe)

Para cada sessão, o Acontext **automaticamente** iniciará um Agent em segundo plano para rastrear o progresso da tarefa e o feedback do usuário. **É como um Agent TODO em segundo plano**. Acontext o usará para observar sua taxa de sucesso diária do Agent.

Você pode usar o SDK para recuperar o estado atual da sessão do Agent, para Context Engineering como Redução e Compressão. 

<details>
<summary>Script Completo</summary>

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
    print(f"  Title: {task.data.task_description}")
    print(f"  Status: {task.status}")

    # Show progress updates if available
    if task.data.progresses:
        print(f"  Progress updates: {len(task.data.progresses)}")
        for progress in task.data.progresses:
            print(f"    - {progress}")

    # Show user preferences if available
    if task.data.user_preferences:
        print("  User preferences:")
        for pref in task.data.user_preferences:
            print(f"    - {pref}")

```
> `flush` é uma chamada bloqueante, aguardará a conclusão da extração da tarefa.
> Você não precisa chamá-lo em produção, o Acontext tem um mecanismo de buffer para garantir que a extração da tarefa seja concluída no momento certo.

</details>

Exemplo de Retorno de Tarefa:

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



Você pode visualizar os status das tarefas da sessão no Painel:

<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../docs/images/dashboard/session_task_viewer.png" width="100%">
    </picture>
  <p>Uma Demonstração de Tarefa</p>
</div>



## Autoaprendizado

Acontext pode coletar várias sessões e aprender habilidades (SOPs) sobre como chamar ferramentas para certas tarefas.

### Aprender Habilidades em um `Space` [📖](https://docs.acontext.io/learn/skill-space)

<div align="center">
    <picture>
      <img alt="A Space Demo" src="../../assets/acontext_dataflow.png" width="100%">
    </picture>
  <p>Como funciona o autoaprendizado?</p>
</div>

Um `Space` pode armazenar habilidades e memórias em um sistema semelhante ao Notion. Você primeiro precisa conectar uma sessão ao `Space` para habilitar o processo de aprendizado:

```python
# Step 1: Create a Space for skill learning
space = client.spaces.create()
print(f"Created Space: {space.id}")

# Step 2: Create a session attached to the space
session = client.sessions.create(space_id=space.id)

# ... push the agent working context
```

O aprendizado acontece em segundo plano e não é em tempo real (atraso de cerca de 10-30 segundos). 

O que o Acontext fará em segundo plano:

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

Por fim, blocos SOP com padrão de chamada de ferramenta serão salvos no `Space`. Você pode visualizar cada `Space` no Painel:

<div align="center">
    <picture>
      <img alt="A Space Demo" src="../../docs/images/dashboard/skill_viewer.png" width="100%">
    </picture>
  <p>Uma Demonstração de Space</p>
</div>




### Pesquisar Habilidades de um `Space` [📖](https://docs.acontext.io/learn/search-skills)

Para pesquisar habilidades de um `Space` e usá-las na próxima sessão:

```python
result = client.spaces.experience_search(
    space_id=space.id,
    query="I need to implement authentication",
  	mode="fast"
)
```

Acontext suporta modos `fast` e `agentic` para pesquisa. O primeiro usa embeddings para corresponder habilidades. O segundo usa um Experience Agent para explorar todo o `Space` e tenta cobrir cada habilidade necessária.

O retorno é uma lista de blocos sop, que se parecem com isto:

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






# 🔍 Documentação

Para entender melhor o que o Acontext pode fazer, por favor, consulte [nossa documentação](https://docs.acontext.io/)



# ❤️ Mantenha-se Atualizado

Marque o Acontext com uma estrela no Github para apoiar e receber notificações instantâneas 

![click_star](../../assets/star_acontext.gif)



# 🤝 Fiquem Juntos

Junte-se à comunidade para obter suporte e discussões:

-   [Discuta com Construtores no Acontext Discord](https://discord.acontext.io) 👻 
-  [Siga o Acontext no X](https://x.com/acontext_io) 𝕏 



# 🌟 Contribuindo

- Verifique primeiro nosso [roadmap.md](../../ROADMAP.md).
- Leia [contributing.md](../../CONTRIBUTING.md)



# 📑 LICENÇA

Este projeto está atualmente licenciado sob [Apache License 2.0](LICENSE).



# 🥇 Emblemas

![Made with Acontext](../../assets/badge-made-with-acontext.svg) ![Made with Acontext (dark)](../../assets/badge-made-with-acontext-dark.svg)

```md
[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext.svg)](https://acontext.io)

[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext-dark.svg)](https://acontext.io)
```

