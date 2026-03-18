# @acontext/claude-code

Acontext skill memory plugin for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Your agent learns from conversations, distills reusable skills as Markdown files, and syncs them to Claude Code's native skill directory.

## What it does

1. **Auto-Capture** — Stores each agent turn to an Acontext session via Claude Code hooks, triggering automatic task extraction
2. **Skill Sync** — Downloads learned skills to `~/.claude/skills/` for native loading by Claude Code
3. **Auto-Learn** — Triggers Learning Space skill distillation when enough conversation accumulates
4. **MCP Tools** — 5 tools for explicit skill/memory operations during conversations

## Installation

Add the Acontext marketplace and install the plugin:

```
/plugin marketplace add memodb-io/Acontext
/plugin install acontext
```

## Setup

Get an API key from [dash.acontext.io](https://dash.acontext.io/) and set it in your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
export ACONTEXT_API_KEY=sk-ac-your-api-key
export ACONTEXT_USER_IDENTIFIER=your-identifier
```

Restart Claude Code — the plugin auto-captures conversations and syncs skills to `~/.claude/skills/`.

## Configuration

All settings are via environment variables:

| Env Var | Default | Description |
|---------|---------|-------------|
| `ACONTEXT_API_KEY` | — | **Required.** Acontext API key |
| `ACONTEXT_BASE_URL` | `https://api.acontext.app/api/v1` | Acontext API base URL |
| `ACONTEXT_USER_IDENTIFIER` | `"claude_code"` | User identifier for session scoping |
| `ACONTEXT_LEARNING_SPACE_ID` | auto-created | Explicit Learning Space ID |
| `ACONTEXT_SKILLS_DIR` | `~/.claude/skills` | Directory where skills are synced for native loading |
| `ACONTEXT_AUTO_CAPTURE` | `true` | Store messages after each turn |
| `ACONTEXT_AUTO_LEARN` | `true` | Trigger skill distillation after sessions |
| `ACONTEXT_MIN_TURNS_FOR_LEARN` | `4` | Minimum conversation turns before triggering auto-learn |

> **Note:** `ACONTEXT_MIN_TURNS` is accepted as a legacy fallback for `ACONTEXT_MIN_TURNS_FOR_LEARN`.

## MCP Tools

| Tool | Description |
|------|-------------|
| `acontext_search_skills` | Search through skill files by keyword |
| `acontext_get_skill` | Read the content of a specific skill file |
| `acontext_session_history` | Get task summaries from recent past sessions |
| `acontext_stats` | Show memory statistics (sessions, skills, configuration) |
| `acontext_learn_now` | Trigger skill learning from the current session |

## How it works

### Capture → Extract → Learn → Sync

```
Session 1: User talks to Claude Code
  └→ [session-start hook] Creates Acontext session, syncs existing skills
  └→ [post-tool-use hook] Messages captured from transcript JSONL (incremental)
  └→ CORE extracts structured tasks
  └→ Auto-learn triggers at turn threshold (default: 4)

Session end:
  └→ [stop hook] Final message capture, learning triggered
  └→ Newly learned skills synced to ~/.claude/skills/

Session 2: User returns
  └→ Skills already in ~/.claude/skills/ — Claude Code loads them natively
  └→ New messages captured, skills updated
```

> **Note:** Message capture is incremental — the plugin tracks a cursor so only new messages are stored on each hook invocation. Session state is persisted across hook processes via `.session-state.json`.

### Skill sync

Skills are synced as Markdown files to Claude Code's native skill directory (`~/.claude/skills/` by default). Only changed skills are re-downloaded using server-side `updated_at` timestamps. Sync happens on session start, after learning, and when the manifest cache is stale (30-minute TTL).

### Architecture

The plugin consists of two entry points bundled as CommonJS:

- **Hook handler** (`hook-handler.cjs`) — dispatched by Claude Code hooks for `session-start`, `post-tool-use`, and `stop` lifecycle events
- **MCP server** (`mcp-server.cjs`) — stdio-based MCP server providing 5 tools

Both are independent Node.js processes that share state through the `plugin/data/` directory.

### How it differs from fact-based memory

Unlike plugins that extract discrete facts via LLM, Acontext stores full conversations and distills them into **human-readable, editable Markdown skill files**. You can inspect, modify, and share these files directly.

## Development

```bash
# Install dependencies
npm install

# Build (bundles to plugin/scripts/)
npm run build

# Clean build artifacts
npm run clean
```

## License

Apache-2.0
