<div align="center">
  <a href="https://discord.acontext.io">
      <img alt="Show Acontext header banner" src="../../assets/Acontext-header-banner.png">
  </a>
  <p>
    <h4>Context Data Platform for Building Cloud-native AI Agents</h4>
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


*Jeder erzählt Ihnen, wie Sie deren Agents verwenden. Aber wenn SIE einen Agent für 100.000 Benutzer erstellen müssen, wo würden Sie anfangen?*

**📦 Problem 1: 99% Ihrer DB sind LLM-Nachrichten.** 

> Schlechtes Schema-Design macht Ihre wertvollsten Daten teuer und langsam. Acontext übernimmt Kontextspeicherung und -abruf via PG, Redis und S3.
>
> ChatGPT, Gemini, Anthropic, Bilder, Audio, Dateien... wir haben Sie abgedeckt.

**⏰ Problem 2: Lang laufende Agents sind ein Albtraum.** 

> Sie kennen Context Engineering, aber Sie schreiben es immer von Grund auf. Acontext kommt mit eingebauten Kontext-Bearbeitungsmethoden und einem sofort einsatzbereiten Todo Agent.
>
> Agent-Status verwalten? Ein Kinderspiel.

**👀 Problem 3: Sie können nicht sehen, wie Ihr Agent arbeitet.** 

> Wie zufrieden sind Ihre Benutzer wirklich? Acontext verfolgt Aufgaben pro Sitzung und zeigt Ihnen die tatsächliche Erfolgsrate Ihres Agents.
>
> Hören Sie auf, sich über Token-Kosten zu besessen, verbessern Sie zuerst den Agent.

**🧠 Problem 4: Ihr Agent ist unberechenbar.**

> Kann er aus seinen Erfolgen lernen? Acontexts Experience Agent erinnert sich an erfolgreiche Ausführungen und wandelt sie in wiederverwendbare Tool-Use SOPs um.
>
> Konsistenz ist alles.



Um diese Probleme auf einmal zu lösen, wird Acontext zur **Context Data Platform**:

<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../assets/acontext-components.jpg" width="100%">
    </picture>
  <p>Kontextdatenplattform die Speichert, Beobachtet und Lernt</p>
</div>


# 💡 Kernfunktionen

- **Context Engineering**
  - [Session](https://docs.acontext.io/store/messages/multi-provider): einheitlicher Nachrichtenspeicher für jedes LLM, jede Modalität.
  - [Disk](https://docs.acontext.io/store/disk): Artifacts mit Dateipfad speichern/herunterladen.
  - [Context Editing](https://docs.acontext.io/store/editing) - verwalten Sie Ihr Kontextfenster in einer API.

<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../assets/acontext-context-engineering.png" width="80%">
    </picture>
  <p>Context Engineering in Acontext</p>
</div>

- **Agent-Aufgaben und Benutzerfeedback beobachten**
  - [Task](https://docs.acontext.io/observe/agent_tasks): Arbeitsstatus, Fortschritt und Präferenzen des Agents in nahezu Echtzeit erfassen.
- **Agent-Selbstlernen**
  - [Experience](https://docs.acontext.io/learn/advance/experience-agent): Agent SOPs für jeden Benutzer lernen lassen.
- **Alles in einem [Dashboard](https://docs.acontext.io/observe/dashboard) anzeigen**

<div align="center">
    <picture>
      <img alt="Dashboard" src="../../docs/images/dashboard/BI.png" width="80%">
    </picture>
  <p>Dashboard für Agent-Erfolgsrate und andere Metriken</p>
</div>



# 🏗️ Wie funktioniert es?

<details>
<summary>Klicken zum Öffnen</summary>

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

## Wie sie zusammenarbeiten

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



## Datenstrukturen

<details>
<summary>📖 Aufgabenstruktur</summary>

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
<summary>📖 Fähigkeitsstruktur</summary>


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
<summary>📖 Space-Struktur</summary>

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





# 🚀 Mit Acontext verbinden

1. Gehen Sie zu [Acontext.io](https://acontext.io), holen Sie sich Ihre kostenlosen Credits.
2. Durchlaufen Sie ein One-Click-Onboarding, um Ihren API Key zu erhalten: `sk-ac-xxx`

<div align="center">
    <picture>
      <img alt="Dashboard" src="../../assets/onboard.png" width="80%">
    </picture>
</div>




<details>
<summary>💻 Acontext selbst hosten</summary>

Wir haben ein `acontext-cli`, um Ihnen bei einem schnellen Proof-of-Concept zu helfen. Laden Sie es zuerst in Ihrem Terminal herunter:

```bash
curl -fsSL https://install.acontext.io | sh
```

Sie sollten [docker](https://www.docker.com/get-started/) installiert haben und einen OpenAI API Key besitzen, um ein Acontext-Backend auf Ihrem Computer zu starten:

```bash
mkdir acontext_server && cd acontext_server
acontext docker up
```

> [!IMPORTANT]
>
> Stellen Sie sicher, dass Ihr LLM die Fähigkeit hat, [Tools aufzurufen](https://platform.openai.com/docs/guides/function-calling). Standardmäßig verwendet Acontext `gpt-4.1`.

`acontext docker up` wird `.env` und `config.yaml` für Acontext erstellen/verwenden und einen `db`-Ordner erstellen, um Daten zu speichern.



Sobald es fertig ist, können Sie auf die folgenden Endpunkte zugreifen:

- Acontext API Base URL: http://localhost:8029/api/v1
- Acontext Dashboard: http://localhost:3000/

</details>






# 🧐 Acontext verwenden, um Agent zu erstellen

Laden Sie End-to-End-Skripte mit `acontext` herunter:

**Python**

```bash
acontext create my-proj --template-path "python/openai-basic"
```

> Weitere Beispiele für Python:
>
> - `python/openai-agent-basic`: selbstlernender Agent im openai agent sdk.
> - `python/agno-basic`: selbstlernender Agent im agno framework.
> - `python/openai-agent-artifacts`: Agent, der Artifacts bearbeiten und herunterladen kann.

**Typescript**

```bash
acontext create my-proj --template-path "typescript/openai-basic"
```

> Weitere Beispiele für Typescript:
>
> - `typescript/vercel-ai-basic`: selbstlernender Agent in @vercel/ai-sdk



> [!NOTE]
>
> Schauen Sie sich unser Beispiel-Repository für weitere Vorlagen an: [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples).
>
> Wir bereiten weitere Full-Stack Agent-Anwendungen vor! [Sagen Sie uns, was Sie wollen!](https://discord.acontext.io)



## Schritt-für-Schritt Schnellstart

<details>
<summary>Zum Öffnen klicken</summary>


Wir pflegen Python [![pypi](https://img.shields.io/pypi/v/acontext.svg)](https://pypi.org/project/acontext/) und Typescript [![npm](https://img.shields.io/npm/v/@acontext/acontext.svg?logo=npm&logoColor=fff&style=flat&labelColor=2C2C2C&color=28CF8D)](https://www.npmjs.com/package/@acontext/acontext) SDKs. Die folgenden Code-Snippets verwenden Python.

## SDKs installieren

```
pip install acontext # for Python
npm i @acontext/acontext # for Typescript
```



## Client initialisieren

```python
import os
from acontext import AcontextClient

client = AcontextClient(
    api_key=os.getenv("ACONTEXT_API_KEY"),
)

# Wenn Sie selbst gehostetes Acontext verwenden:
# client = AcontextClient(
#     base_url="http://localhost:8029/api/v1",
#     api_key="sk-ac-your-root-api-bearer-token",
# )
```

> [📖 async client doc](https://docs.acontext.io/settings/core)



## Speichern

Acontext kann Agent Sessions und Artifacts verwalten.

### Nachrichten speichern [📖](https://docs.acontext.io/api-reference/session/store-message-to-session)

Acontext bietet persistente Speicherung für Nachrichtendaten. Wenn Sie `session.store_message` aufrufen, speichert Acontext die Nachricht und beginnt, diese Sitzung zu überwachen:

<details>
<summary>Code-Snippet</summary>

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
    client.sessions.store_message(session_id=session.id, blob=msg, format="openai")
```

> [📖](https://docs.acontext.io/store/messages/multi-modal) Wir unterstützen auch Multi-Modal-Nachrichtenspeicherung und anthropic SDK.


</details>

### Nachrichten laden [📖](https://docs.acontext.io/api-reference/session/get-messages-from-session)

Rufen Sie Ihre Sitzungsnachrichten mit `sessions.get_messages` ab

<details>
<summary>Code-Snippet</summary>

```python
r = client.sessions.get_messages(session.id)
new_msg = r.items

new_msg.append({"role": "user", "content": "How are you doing?"})
r = openai_client.chat.completions.create(model="gpt-4.1", messages=new_msg)
print(r.choices[0].message.content)
client.sessions.store_message(session_id=session.id, blob=r.choices[0].message)
```

</details>

<div align="center">
    <picture>
      <img alt="Session" src="../../docs/images/dashboard/message_viewer.png" width="100%">
    </picture>
  <p>Sie können Sitzungen in Ihrem lokalen Dashboard anzeigen</p>
</div>


### Artifacts [📖](https://docs.acontext.io/store/disk)

Erstellen Sie eine Festplatte für Ihren Agent, um Artifacts mit Dateipfaden zu speichern und zu lesen:

<details>
<summary>Code-Snippet</summary>

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
  <p>Sie können Artifacts in Ihrem lokalen Dashboard anzeigen</p>
</div>



## Beobachten [📖](https://docs.acontext.io/observe)

Für jede Sitzung startet Acontext **automatisch** einen Hintergrund Agent, um den Aufgabenfortschritt und das Benutzerfeedback zu verfolgen. **Es ist wie ein Hintergrund TODO Agent**. Acontext verwendet ihn, um Ihre tägliche Agent Success Rate zu beobachten.

Sie können das SDK verwenden, um den aktuellen Status der Agent Session abzurufen, für Context Engineering wie Reduktion und Kompression. 

<details>
<summary>Vollständiges Skript</summary>

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

# Store messages in a loop
for msg in messages:
    client.sessions.store_message(session_id=session.id, blob=msg, format="openai")

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
> `flush` ist ein blockierender Aufruf, der auf den Abschluss der Aufgabenextraktion wartet.
> Sie müssen ihn in der Produktion nicht aufrufen, Acontext hat einen [Puffer-Mechanismus](https://docs.acontext.io/observe/buffer), um sicherzustellen, dass die Aufgabenextraktion rechtzeitig abgeschlossen wird.

</details>

Beispiel-Aufgabenrückgabe:

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



Sie können die Status der Sitzungsaufgaben im Dashboard anzeigen:

<div align="center">
    <picture>
      <img alt="Acontext Learning" src="../../docs/images/dashboard/session_task_viewer.png" width="100%">
    </picture>
  <p>Eine Aufgaben-Demo</p>
</div>



## Selbstlernen

Acontext kann eine Reihe von Sitzungen sammeln und Fähigkeiten (SOPs) lernen, wie man Tools für bestimmte Aufgaben aufruft.

### Fähigkeiten in einem `Space` lernen [📖](https://docs.acontext.io/learn/skill-space)

<div align="center">
    <picture>
      <img alt="A Space Demo" src="../../assets/acontext_dataflow.png" width="100%">
    </picture>
  <p>Wie funktioniert Selbstlernen?</p>
</div>

Ein `Space` kann Fähigkeiten und Erinnerungen in einem Notion-ähnlichen System speichern. Sie müssen zuerst eine Sitzung mit `Space` verbinden, um den Lernprozess zu aktivieren:

```python
# Step 1: Create a Space for skill learning
space = client.spaces.create()
print(f"Created Space: {space.id}")

# Step 2: Create a session attached to the space
session = client.sessions.create(space_id=space.id)

# ... push the agent working context
```

Das Lernen erfolgt im Hintergrund und ist nicht in Echtzeit (Verzögerung etwa 10-30 Sekunden). 

Was Acontext im Hintergrund tun wird:

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

Schließlich werden SOP-Blöcke mit Tool-Call-Muster in `Space` gespeichert. Sie können jeden `Space` im Dashboard anzeigen:

<div align="center">
    <picture>
      <img alt="A Space Demo" src="../../docs/images/dashboard/skill_viewer.png" width="100%">
    </picture>
  <p>Eine Space-Demo</p>
</div>




### Fähigkeiten aus einem `Space` durchsuchen [📖](https://docs.acontext.io/learn/search-skills)

Um Fähigkeiten aus einem `Space` zu durchsuchen und in der nächsten Sitzung zu verwenden:

```python
result = client.spaces.experience_search(
    space_id=space.id,
    query="I need to implement authentication",
  	mode="fast"
)
```

Acontext unterstützt `fast` und `agentic` Modi für die Suche. Ersteres verwendet Embeddings, um Fähigkeiten abzugleichen. Letzteres verwendet einen Experience Agent, um den gesamten `Space` zu erkunden und versucht, jede benötigte Fähigkeit abzudecken.

Die Rückgabe ist eine Liste von sop-Blöcken, die wie folgt aussehen:

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







# 🔍 Dokumentation

Um besser zu verstehen, was Acontext kann, sehen Sie sich [unsere Dokumentation](https://docs.acontext.io/) an



# ❤️ Auf dem Laufenden bleiben

Markieren Sie Acontext auf Github mit einem Stern, um zu unterstützen und sofortige Benachrichtigungen zu erhalten 

![click_star](../../assets/star_acontext.gif)



# 🤝 Zusammen bleiben

Treten Sie der Community bei, um Unterstützung und Diskussionen zu erhalten:

-   [Diskutieren Sie mit Buildern auf Acontext Discord](https://discord.acontext.io) 👻 
-  [Folgen Sie Acontext auf X](https://x.com/acontext_io) 𝕏 



# 🌟 Beitragen

- Schauen Sie sich zuerst unser [roadmap.md](../../ROADMAP.md) an.
- Lesen Sie [contributing.md](../../CONTRIBUTING.md)



# 📑 LIZENZ

Dieses Projekt ist derzeit unter [Apache License 2.0](LICENSE) lizenziert.



# 🥇 Abzeichen

![Made with Acontext](../../assets/badge-made-with-acontext.svg) ![Made with Acontext (dark)](../../assets/badge-made-with-acontext-dark.svg)

```md
[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext.svg)](https://acontext.io)

[![Made with Acontext](https://assets.memodb.io/Acontext/badge-made-with-acontext-dark.svg)](https://acontext.io)
```
