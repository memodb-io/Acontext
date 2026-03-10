---
name: acontext
version: 1.0.0
description: Agent Skills as a Memory Layer — sessions, disks, learning spaces, and skills for production AI agents
trigger_phrases:
  - remember this
  - save to memory
  - recall from memory
  - search my skills
  - learn from this conversation
  - store this context
  - what did I do last time
  - load my previous session
keywords:
  - memory
  - context
  - skills
  - sessions
  - learning
  - agent memory
  - knowledge base
  - disk storage
---

# Acontext — Agent Skill & Memory Guide

Acontext provides Agent Skills as a Memory Layer for production AI agents. It provides persistent sessions, disk-based file storage, learning spaces that distill conversations into reusable skills, and a CLI + API for managing everything.

## When to Use This Skill

Use Acontext when the user or agent needs to:

- **Remember context** across sessions (save and retrieve conversation history)
- **Store files** persistently (upload artifacts to a disk)
- **Learn skills** from past conversations (trigger learning space distillation)
- **Search skills** for reusable knowledge
- **Manage projects** (create, list, select projects and organizations)
- **Track sessions** (create sessions, send messages, review history)

Trigger phrases: "remember this", "save to memory", "recall from memory", "search my skills", "learn from this conversation", "store this context", "what did I do last time", "load my previous session"

---

## Installation

### Option A — Acontext CLI (recommended)

```bash
curl -fsSL https://install.acontext.io | sh
```

After installation, restart your shell or run `source ~/.bashrc` (or `~/.zshrc`).

For system-wide installation:

```bash
curl -fsSL https://install.acontext.io | sh -s -- --system
```

Then log in:

```bash
acontext login
```

- **Interactive (TTY):** Opens a browser for OAuth, then guides you through project selection. Your API key is saved automatically.
- **Non-interactive (agent/CI):** Prints a login URL for the user to open manually. After login completes, run `acontext login --poll` to finish authentication, then set up a project via `acontext dash projects` commands.

See the [Login & API Key](#login--api-key) section below for full details.

### Option B — OpenClaw Plugin

```bash
openclaw plugins install @acontext/openclaw
```

Get an API key from [dash.acontext.io](https://dash.acontext.io/) and set it:

```bash
export ACONTEXT_API_KEY=sk-ac-your-api-key
```

Add to your `openclaw.json`:

```json5
{
  plugins: {
    slots: {
      memory: "acontext"
    },
    entries: {
      "acontext": {
        enabled: true,
        config: {
          "apiKey": "${ACONTEXT_API_KEY}",
          "userId": "your-user-id"
        }
      }
    }
  }
}
```

Restart the gateway:

```bash
openclaw gateway
```

---

## Login & API Key

### Interactive (TTY) Flow

```bash
acontext login
```

1. Opens browser for OAuth authentication
2. Polls for completion automatically
3. Prompts you to select (or create) a project
4. Saves API key locally — no further config needed

### Non-Interactive (Agent) Flow

When running inside an agent without a TTY:

```bash
acontext login
```

This prints a login URL. Show it to the user and ask them to open it in their browser. After the user completes login, run:

```bash
acontext login --poll
```

Then set up a project:

1. `acontext dash projects list --json` — list available projects
2. If projects exist, ask the user to pick one, then run:
   `acontext dash projects select --project <project-id>`
3. If no projects exist, ask for an org name and project name, then run:
   `acontext dash projects create --name <project-name> --org <org-id>`

### Environment Variable

For CI/CD or headless environments, set the API key directly:

```bash
export ACONTEXT_API_TOKEN=sk-ac-your-api-key
```

---

## What You Can Do After Login

### CLI Command Reference

All dashboard commands are under `acontext dash`:

| Command Group | Subcommands | Description |
|---|---|---|
| `dash projects` | `list`, `select`, `create`, `delete`, `stats` | Manage projects and organizations |
| `dash sessions` | `list`, `get`, `create`, `delete` | Manage conversation sessions |
| `dash disks` | `list`, `get`, `create`, `delete` | Manage persistent disk storage |
| `dash spaces` | `list`, `get`, `create`, `delete`, `learn` | Manage learning spaces and trigger skill distillation |
| `dash skills` | `list`, `get`, `create`, `delete` | Manage agent skills |
| `dash artifacts` | `ls`, `upload`, `delete` | Manage files within a disk |
| `dash messages` | `list`, `send` | Manage messages within a session |
| `dash users` | `list`, `delete` | Manage users |
| `dash open` | — | Open the Acontext Dashboard in browser |

### Other CLI Commands

| Command | Description |
|---|---|
| `acontext create [name]` | Create a new project from a template |
| `acontext server up` | Start sandbox + Docker services in split-screen TUI |
| `acontext login` | Log in via browser OAuth |
| `acontext logout` | Clear stored credentials |
| `acontext whoami` | Show the currently logged-in user |
| `acontext version` | Show version info |
| `acontext upgrade` | Upgrade CLI to latest version |

---

## API Reference

Base URL: `https://api.acontext.app/api/v1`

All requests require an API key header:

```
Authorization: Bearer sk-ac-your-api-key
```

### Sessions

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/session` | Create a new session |
| `GET` | `/session` | List sessions |
| `GET` | `/session/:session_id` | Get session details |
| `DELETE` | `/session/:session_id` | Delete a session |
| `POST` | `/session/:session_id/messages` | Store messages in a session |
| `GET` | `/session/:session_id/messages` | Retrieve messages from a session |
| `PUT` | `/session/:session_id/configs` | Update session configs |
| `GET` | `/session/:session_id/configs` | Get session configs |
| `GET` | `/session/:session_id/token_counts` | Get token counts |

### Disks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/disk` | Create a new disk |
| `GET` | `/disk` | List disks |
| `DELETE` | `/disk/:disk_id` | Delete a disk |

### Learning Spaces

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/learning_spaces` | Create a learning space |
| `GET` | `/learning_spaces` | List learning spaces |
| `GET` | `/learning_spaces/:id` | Get learning space details |
| `PATCH` | `/learning_spaces/:id` | Update a learning space |
| `DELETE` | `/learning_spaces/:id` | Delete a learning space |
| `POST` | `/learning_spaces/:id/learn` | Trigger skill distillation from sessions |
| `POST` | `/learning_spaces/:id/skills` | Add a skill to a learning space |
| `GET` | `/learning_spaces/:id/skills` | List skills in a learning space |
| `DELETE` | `/learning_spaces/:id/skills/:skill_id` | Remove a skill from a learning space |
| `GET` | `/learning_spaces/:id/sessions` | List sessions in a learning space |
| `GET` | `/learning_spaces/:id/sessions/:session_id` | Get session in a learning space |

### Agent Skills

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/agent_skills` | Create an agent skill |
| `GET` | `/agent_skills` | List agent skills |
| `GET` | `/agent_skills/:id` | Get agent skill details |
| `DELETE` | `/agent_skills/:id` | Delete an agent skill |
| `GET` | `/agent_skills/:id/file` | Download skill file |

### Users

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/user/ls` | List users |
| `GET` | `/user/:identifier/resources` | Get user resources |
| `DELETE` | `/user/:identifier` | Delete a user |

---

## OpenClaw Plugin Configuration

| Key | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | — | **Required.** Acontext API key (supports `${ACONTEXT_API_KEY}`) |
| `baseUrl` | `string` | `https://api.acontext.app/api/v1` | API base URL |
| `userId` | `string` | `"default"` | Scope sessions per user |
| `learningSpaceId` | `string` | auto-created | Explicit Learning Space ID |
| `skillsDir` | `string` | `~/.openclaw/skills` | Directory where skills are synced |
| `autoCapture` | `boolean` | `true` | Store messages after each agent turn |
| `autoLearn` | `boolean` | `true` | Trigger skill distillation after sessions |
| `minTurnsForLearn` | `number` | `4` | Minimum turns before triggering auto-learn |

### OpenClaw Agent Tools

| Tool | Description |
|---|---|
| `acontext_search_skills` | Search through skill files by keyword |
| `acontext_session_history` | Get task summaries from recent past sessions |
| `acontext_learn_now` | Trigger skill learning from the current session |

---

## Troubleshooting

### "command not found: acontext"

Restart your shell or run `source ~/.bashrc` / `source ~/.zshrc`. The installer adds `~/.acontext/bin` to your PATH.

### Login fails or times out

- Ensure you have internet access and can reach `dash.acontext.io`
- In non-TTY mode, make sure to run `acontext login --poll` after the user completes browser login
- Check `~/.acontext/auth.json` for stored credentials

### API returns 401 Unauthorized

- Verify your API key with `acontext whoami`
- Re-login with `acontext login`
- For CI/CD, ensure `ACONTEXT_API_TOKEN` is set correctly

### OpenClaw plugin not loading

- Confirm `plugins.slots.memory` is set to `"acontext"` in `openclaw.json`
- Run `openclaw gateway` to restart
- Check that `ACONTEXT_API_KEY` is exported in your environment

### No projects found

- Run `acontext dash projects list` to check
- Create one with `acontext dash projects create --name my-project --org <org-id>`
- Or visit [dash.acontext.io](https://dash.acontext.io/) to create projects in the browser
