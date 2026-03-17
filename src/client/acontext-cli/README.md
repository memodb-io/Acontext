# Acontext CLI

A command-line tool for managing Acontext projects, authentication, and local development environments.

## Installation

### User Installation (Recommended)

```bash
curl -fsSL https://install.acontext.io | sh
```

After installation, restart your shell or run `source ~/.bashrc` (or `~/.zshrc` for zsh).

### System-wide Installation

```bash
curl -fsSL https://install.acontext.io | sh -s -- --system
```

## Quick Start

```bash
# 1. Log in
acontext login

# 2. Set up a project (interactive selection after login)
acontext dash projects list
acontext dash projects select --project <id> --api-key <sk-ac-...>

# 3. Verify connectivity
acontext dash ping
```

## Command Reference

### Authentication

| Command | Description |
|---------|-------------|
| `acontext login` | Log in via browser OAuth |
| `acontext login --poll` | Complete a pending non-interactive login |
| `acontext logout` | Log out and clear credentials |
| `acontext whoami` | Show the currently logged-in user |

### Project Management

| Command | Description |
|---------|-------------|
| `acontext dash projects list` | List organizations and projects |
| `acontext dash projects select` | Select a default project (interactive or `--project <id>`) |
| `acontext dash projects create --name <name>` | Create a new project |
| `acontext dash projects delete <id>` | Delete a project |
| `acontext dash projects stats <id>` | Show project statistics |
| `acontext dash ping` | Verify API connectivity |
| `acontext dash open` | Open the Dashboard in browser |

### Skills

| Command | Description |
|---------|-------------|
| `acontext skill upload <directory>` | Upload a local skill directory to Acontext |

### Project Scaffolding

```bash
# Interactive mode
acontext create

# With project name and custom template
acontext create my-project --template-path "python/custom-template"
```

Templates are discovered from the [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples) repository, organized by language (`python/`, `typescript/`).

### Local Development

```bash
# Start sandbox + Docker in split-screen TUI
acontext server up
```

Press `q` or `Ctrl+C` to stop all services.

### Version Management

| Command | Description |
|---------|-------------|
| `acontext version` | Show version info |
| `acontext upgrade` | Upgrade to latest version |

## License

MIT
