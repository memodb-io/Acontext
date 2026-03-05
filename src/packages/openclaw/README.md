# @acontext/openclaw

Acontext skill memory plugin for [OpenClaw](https://github.com/openclaw/openclaw). Your agent learns from conversations, distills reusable skills as Markdown files, and syncs them to OpenClaw's native skill directory.

## What it does

1. **Auto-Capture** — Stores each agent turn to an Acontext session, triggering automatic task extraction
2. **Skill Sync** — Downloads learned skills to `~/.openclaw/skills/` for native loading by OpenClaw
3. **Auto-Learn** — Triggers Learning Space skill distillation when enough conversation accumulates
4. **Agent Tools** — 3 tools for explicit skill/memory operations during conversations

## Installation

```bash
openclaw plugins install @acontext/openclaw
```

## Setup

Get an API key from [dash.acontext.io](https://dash.acontext.io/) and set it in your environment:

```bash
export ACONTEXT_API_KEY=sk-ac-your-api-key
```

Add to your `openclaw.json`:

```json5
{
  plugins: {
    // Select Acontext as the active memory plugin
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

> **Note:** OpenClaw only loads one memory plugin at a time. Setting `plugins.slots.memory` to `"acontext"` replaces the default (`memory-core`). To switch back, set it to `"memory-core"` or `"none"`.

Restart the gateway:

```bash
openclaw gateway
```

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiKey` | `string` | — | **Required.** Acontext API key (supports `${ACONTEXT_API_KEY}`) |
| `baseUrl` | `string` | `https://api.acontext.app/api/v1` | Acontext API base URL |
| `userId` | `string` | `"default"` | Scope sessions per user |
| `learningSpaceId` | `string` | auto-created | Explicit Learning Space ID |
| `skillsDir` | `string` | `~/.openclaw/skills` | Directory where skills are synced for native loading |
| `autoCapture` | `boolean` | `true` | Store messages after each turn |
| `autoLearn` | `boolean` | `true` | Trigger skill distillation after sessions |
| `minTurnsForLearn` | `number` | `4` | Minimum conversation turns before triggering auto-learn |

## Agent Tools

| Tool | Description |
|------|-------------|
| `acontext_search_skills` | Search through skill files by keyword |
| `acontext_session_history` | Get task summaries from recent past sessions |
| `acontext_learn_now` | Trigger skill learning from the current session |

## CLI Commands

```bash
# List learned skills
openclaw acontext skills

# Show memory statistics
openclaw acontext stats
```

## How it works

### Capture → Extract → Learn → Sync

```
Session 1: User talks to agent
  └→ Messages stored to Acontext session
  └→ CORE extracts structured tasks
  └→ Learning Space distills skills as Markdown

Session 2: User returns
  └→ Skills synced to ~/.openclaw/skills/ (native loading)
  └→ OpenClaw auto-loads skill files
  └→ New messages captured (auto-capture)
  └→ Skills updated (auto-learn)
```

### Skill sync

Skills are synced as Markdown files to OpenClaw's native skill directory (`~/.openclaw/skills/` by default). Only changed skills are re-downloaded using server-side `updated_at` timestamps. Sync happens on service start, before each agent turn (if stale), and after learning.

### How it differs from fact-based memory

Unlike plugins that extract discrete facts via LLM, Acontext stores full conversations and distills them into **human-readable, editable Markdown skill files**. You can inspect, modify, and share these files directly.

## License

Apache-2.0
