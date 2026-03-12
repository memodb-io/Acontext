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

Acontext provides Agent Skills as a Memory Layer for production AI agents. It provides persistent sessions, disk-based file storage, learning spaces that distill conversations into reusable skills, and a CLI + API for managing everything.

## Installation

### 1. Install Acontext CLI

```bash
curl -fsSL https://install.acontext.io | sh
```
After installation, restart your shell or run `source ~/.bashrc` (or `~/.zshrc`) to make sure the CLI is in your PATH.

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
- Read the cli output to get the api key and user login email, you will need it.

### 3. Add Acontext to Your Agent

#### Option A: Claude Code Plugin

Add the Acontext marketplace and install the plugin (run inside Claude Code):

```
/plugin marketplace add memodb-io/Acontext
/plugin install acontext
```

Then set the required environment variables in your shell profile (`~/.bashrc` or `~/.zshrc`):

```bash
export ACONTEXT_API_KEY="<your-api-key>"
export ACONTEXT_USER_ID="<your-login-email>"
```

Restart Claude Code — the plugin auto-captures conversations and syncs skills to `~/.claude/skills/`.

#### Option B: OpenClaw Plugin

```bash
openclaw plugins install @acontext/openclaw
```

Then you will need API Key and a USER identifier to configure the plugin:
1. Use the API key and user login email from the `acontext login` return.
2. Add to your `openclaw.json`:
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
          "userId": "${ACONTEXT_USER_MAIL}"
        }
      }
    }
  }
}
```
3. Restart the gateway:

```bash
openclaw gateway
```

---

## Acontext Project Management

After you have logged in, you can manage Acontext projects via CLI:

1. `acontext dash projects list --json` — list available projects
2. If user ask you to use a existing Acontext project, you should let the user to provider the api key. And then switch to this project `acontext dash projects select --project <project-id>`. 
3. To create, ask for an org name and project name, then run: `acontext dash projects create --name <project-name> --org <org-id>`, this command would return the API Key to you, and then select to the new project.

## CLI Commands Reference


All dashboard commands are under `acontext dash`:

| Command Group   | Subcommands                         | Description                            |
| --------------- | ----------------------------------- | -------------------------------------- |
| `dash projects` | `list`, `select`, `create`, `stats` | Manage projects and organizations      |
| `dash open`     | —                                   | Open the Acontext Dashboard in browser |

### Other CLI Commands

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `acontext login`   | Log in via browser OAuth          |
| `acontext logout`  | Clear stored credentials          |
| `acontext whoami`  | Show the currently logged-in user |
| `acontext version` | Show version info                 |
| `acontext upgrade` | Upgrade CLI to latest version     |

---

## Claude Code Plugin Configuration

All settings are via environment variables:

| Env Var                        | Default                           | Description                                                     |
| ------------------------------ | --------------------------------- | --------------------------------------------------------------- |
| `ACONTEXT_API_KEY`             | —                                 | **Required.** Acontext API key                                  |
| `ACONTEXT_BASE_URL`            | `https://api.acontext.app/api/v1` | API base URL                                                    |
| `ACONTEXT_USER_ID`             | `"default"`                       | Scope sessions per user                                         |
| `ACONTEXT_LEARNING_SPACE_ID`   | auto-created                      | Explicit Learning Space ID                                      |
| `ACONTEXT_SKILLS_DIR`          | `~/.claude/skills`                | Directory where skills are synced                                |
| `ACONTEXT_AUTO_CAPTURE`        | `true`                            | Store messages after each agent turn                            |
| `ACONTEXT_AUTO_LEARN`          | `true`                            | Trigger skill distillation after sessions                       |
| `ACONTEXT_MIN_TURNS_FOR_LEARN` | `4`                               | Minimum turns before triggering auto-learn                      |

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

All settings are in `openclaw.json` under the plugin config:

| Key                | Type      | Default                           | Description                                                     |
| ------------------ | --------- | --------------------------------- | --------------------------------------------------------------- |
| `apiKey`           | `string`  | —                                 | **Required.** Acontext API key (supports `${ACONTEXT_API_KEY}`) |
| `baseUrl`          | `string`  | `https://api.acontext.app/api/v1` | API base URL                                                    |
| `userId`           | `string`  | `"default"`                       | Scope sessions per user                                         |
| `learningSpaceId`  | `string`  | auto-created                      | Explicit Learning Space ID                                      |
| `skillsDir`        | `string`  | `~/.openclaw/skills`              | Directory where skills are synced                               |
| `autoCapture`      | `boolean` | `true`                            | Store messages after each agent turn                            |
| `autoLearn`        | `boolean` | `true`                            | Trigger skill distillation after sessions                       |
| `minTurnsForLearn` | `number`  | `4`                               | Minimum turns before triggering auto-learn                      |

### OpenClaw Agent Tools

| Tool                       | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `acontext_search_skills`   | Search through skill files by keyword           |
| `acontext_session_history` | Get task summaries from recent past sessions    |
| `acontext_learn_now`       | Trigger skill learning from the current session |

### OpenClaw CLI Commands

| Command                  | Description                               |
| ------------------------ | ----------------------------------------- |
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

- Verify your API key with `acontext whoami`
- Re-login with `acontext login`
- For CI/CD, ensure `ACONTEXT_API_KEY` is set correctly

### Claude Code plugin not working

- Ensure `ACONTEXT_API_KEY` is exported in your shell profile
- Check Claude Code logs for `[info] acontext:` or `[warn] acontext:` messages
- Verify the plugin is installed: `/plugin list`
- Skills should appear in `~/.claude/skills/` after the first session

### OpenClaw plugin not loading

- Confirm `plugins.slots.memory` is set to `"acontext"` in `openclaw.json`
- Run `openclaw gateway` to restart
- Check that `ACONTEXT_API_KEY` is exported in your environment

### No projects found

- Run `acontext dash projects list` to check
- Create one with `acontext dash projects create --name my-project --org <org-id>`
- Or visit [dash.acontext.io](https://dash.acontext.io/) to create projects in the browser
