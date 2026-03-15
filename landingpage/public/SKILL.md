---
name: acontext-installer
version: 1.0.0
description: Install Acontext, Login & Init Acontext Project, Add Skill Memory to Agent.
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

> **IMPORTANT — Save this skill for reuse:** After reading this document, save it to your local skill directory so it persists across sessions and you don't need to fetch it again.
> - **Claude Code:** Create the directory `~/.claude/skills/acontext-installer/` and write this entire document to `~/.claude/skills/acontext-installer/SKILL.md`
> - **OpenClaw:** Create the directory `~/.openclaw/skills/acontext-installer/` and write this entire document to `~/.openclaw/skills/acontext-installer/SKILL.md`

Acontext provides Agent Skills as a Memory Layer for production AI agents. It provides persistent sessions, disk-based file storage, learning spaces that distill conversations into reusable skills, and a CLI + API for managing everything.

## Installation

### 1. Install Acontext CLI

If Acontext CLI is already installed, check for updates first:
```bash
acontext upgrade
```

If not installed, install it:
```bash
curl -fsSL https://install.acontext.io | sh
```

> For system-wide installation:
> ```bash
> curl -fsSL https://install.acontext.io | sh -s -- --system
> ```

### 2. Login to Acontext

```bash
acontext login
```
- If you're in a Interactive Terminal(TTY), this command will open a browser for OAuth, then guides you through project creation. Your API key is saved automatically.
- If you're in a Non-interactive Terminal(agent/CI), this command will print a login URL for the user to open manually. After user completes, run `acontext login --poll` to finish authentication.
- Set up a project via `acontext dash projects` commands. If Acontext has existing projects, make sure the user wants to use an existing project or create a new project for you.

### 3. Add Acontext to Your Agent

Both plugins automatically read your API key and user email from `~/.acontext/credentials.json` and `~/.acontext/auth.json` (written by `acontext login`). No manual configuration is needed after login.

#### Option A: Claude Code Plugin

Add the Acontext marketplace and install the plugin (run inside Claude Code):

```
/plugin marketplace add memodb-io/Acontext
/plugin install acontext
```

Restart Claude Code — the plugin auto-captures conversations and syncs skills to `~/.claude/skills/`.

#### Option B: OpenClaw Plugin

```bash
openclaw plugins install @acontext/openclaw
```

Add a minimal config to `openclaw.json`:

```json5
{
  plugins: {
    slots: { memory: "acontext" },
    entries: {
      "acontext": { enabled: true, config: {} }
    }
  }
}
```

Restart the gateway:

```bash
openclaw gateway
```

---

## Acontext Project Management

After you have logged in, you can manage Acontext projects via CLI:

1. `acontext dash projects list --json` — list available projects
2. If user ask you to use a existing Acontext project, you should let the user to provide the api key. And then switch to this project `acontext dash projects select --project <project-id> --api-key <sk-ac-...>`.
3. To create, ask for an org name and project name, then run: `acontext dash projects create --name <project-name> --org <org-id>`. This command returns the API key and auto-saves it as the default project (no need to run `select` afterwards).
4. After select or create, verify the project is configured correctly:
   - Check that `~/.acontext/credentials.json` contains the project key.
   - Run `acontext dash ping` to verify API connectivity. A successful response confirms the project is reachable.

## CLI Commands Reference


All dashboard commands are under `acontext dash`:

| Command Group   | Subcommands                                   | Description                            |
| --------------- | --------------------------------------------- | -------------------------------------- |
| `dash projects` | `list`, `select`, `create`, `delete`, `stats` | Manage projects and organizations      |
| `dash ping`     | —                                             | Verify API connectivity for the current project |
| `dash open`     | —                                             | Open the Acontext Dashboard in browser |

### Skill Commands

| Command                             | Description                                |
| ----------------------------------- | ------------------------------------------ |
| `acontext skill upload <directory>` | Upload a local skill directory to Acontext |

Example — upload a skill directory:
```bash
acontext skill upload ./my-skill-dir
```
The directory must contain a `SKILL.md` with name and description in YAML front-matter.

### Other CLI Commands

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `acontext login`   | Log in via browser OAuth          |
| `acontext logout`  | Clear stored credentials (auth.json + credentials.json) |
| `acontext whoami`  | Show the currently logged-in user |
| `acontext version` | Show version info                 |
| `acontext upgrade` | Upgrade CLI to latest version     |

---

## Claude Code Plugin Configuration

After `acontext login`, the plugin works automatically — API key and user are read from `~/.acontext/`. The following env vars can override defaults if needed:

| Env Var                        | Default                           | Description                            |
| ------------------------------ | --------------------------------- | -------------------------------------- |
| `ACONTEXT_BASE_URL`            | `https://api.acontext.app/api/v1` | API base URL                           |
| `ACONTEXT_LEARNING_SPACE_ID`   | auto-created                      | Explicit Learning Space ID             |
| `ACONTEXT_SKILLS_DIR`          | `~/.claude/skills`                | Directory where skills are synced      |
| `ACONTEXT_AUTO_CAPTURE`        | `true`                            | Store messages after each agent turn   |
| `ACONTEXT_AUTO_LEARN`          | `true`                            | Trigger skill distillation after sessions |
| `ACONTEXT_MIN_TURNS_FOR_LEARN` | `4`                               | Minimum turns before triggering auto-learn |

### Claude Code MCP Tools

| Tool                       | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `acontext_search_skills`   | Search through skill files by keyword                    |
| `acontext_get_skill`       | Read the content of a specific skill file                |
| `acontext_session_history` | Get task summaries from recent past sessions             |
| `acontext_stats`           | Show memory statistics (sessions, skills, configuration) |
| `acontext_learn_now`       | Trigger skill learning from the current session          |

---

## OpenClaw Plugin Configuration

After `acontext login`, the plugin works automatically — API key and user are read from `~/.acontext/`. Optional overrides in `openclaw.json` config:

| Key                | Type      | Default                           | Description                              |
| ------------------ | --------- | --------------------------------- | ---------------------------------------- |
| `baseUrl`          | `string`  | `https://api.acontext.app/api/v1` | API base URL                             |
| `learningSpaceId`  | `string`  | auto-created                      | Explicit Learning Space ID               |
| `skillsDir`        | `string`  | `~/.openclaw/skills`              | Directory where skills are synced        |
| `autoCapture`      | `boolean` | `true`                            | Store messages after each agent turn     |
| `autoLearn`        | `boolean` | `true`                            | Trigger skill distillation after sessions |
| `minTurnsForLearn` | `number`  | `4`                               | Minimum turns before triggering auto-learn |

### OpenClaw Agent Tools

| Tool                       | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `acontext_search_skills`   | Search through skill files by keyword           |
| `acontext_session_history` | Get task summaries from recent past sessions    |
| `acontext_learn_now`       | Trigger skill learning from the current session |

### OpenClaw CLI Commands

| Command                    | Description                               |
| -------------------------- | ----------------------------------------- |
| `openclaw acontext skills` | List learned skills in the Learning Space |
| `openclaw acontext stats`  | Show Acontext memory statistics           |

---

## Troubleshooting

### "command not found: acontext"

Restart your shell or run `source ~/.bashrc` / `source ~/.zshrc`. The installer adds `~/.acontext/bin` to your PATH.

### Login fails or times out

- Ensure you have internet access and can reach `dash.acontext.io`
- In non-TTY mode, make sure to run `acontext login --poll` after the user completes browser login
- Check `~/.acontext/auth.json` for stored credentials

### API returns 401 Unauthorized

- Run `acontext dash ping` to check if the current project key is valid
- If ping fails, re-select with a valid API key: `acontext dash projects select --project <id> --api-key <sk-ac-...>`
- Verify login status with `acontext whoami`
- Re-login with `acontext login` if needed

### Claude Code plugin not working

- Run `acontext whoami` to verify you are logged in
- Check that `~/.acontext/credentials.json` exists and has a default project
- Check Claude Code logs for `[info] acontext:` or `[warn] acontext:` messages
- Verify the plugin is installed: `/plugin list`
- Skills should appear in `~/.claude/skills/` after the first session

### OpenClaw plugin not loading

- Confirm `plugins.slots.memory` is set to `"acontext"` in `openclaw.json`
- Run `acontext whoami` to verify you are logged in
- Run `openclaw gateway` to restart

### No projects found

- Run `acontext dash projects list` to check
- Create one with `acontext dash projects create --name my-project --org <org-id>`
- Or visit [dash.acontext.io](https://dash.acontext.io/) to create projects in the browser
