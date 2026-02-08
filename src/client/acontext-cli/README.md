# Acontext CLI

A lightweight command-line tool for quickly creating Acontext projects with templates and managing local development environments.

## Features

- 🚀 **Quick Setup**: Create projects in seconds with interactive templates
- 🌐 **Multi-Language**: Support for Python and TypeScript
- 🖥️ **Split-Screen TUI**: Run sandbox and Docker services together with real-time logs
- 📦 **Package Manager Detection**: Auto-detect pnpm, npm, yarn, or bun
- 🔧 **Auto Git**: Automatic Git repository initialization
- 🔄 **Auto Update**: Automatic version checking and one-command upgrade
- 🎯 **Simple**: Minimal configuration, maximum productivity

## Installation

### User Installation (No sudo required - Recommended)

By default, the CLI installs to `~/.acontext/bin` and automatically updates your shell profile (`.bashrc`, `.zshrc`, etc.):

```bash
# Install script (Linux, macOS, WSL)
curl -fsSL https://install.acontext.io | sh
```

After installation, restart your shell or run `source ~/.bashrc` (or `~/.zshrc` for zsh).

### System-wide Installation (Requires sudo)

For system-wide installation to `/usr/local/bin`:

```bash
curl -fsSL https://install.acontext.io | sh -s -- --system
```

## Usage

### Create a New Project

```bash
# Interactive mode
acontext create

# Create with project name
acontext create my-project

# Use custom template from Acontext-Examples repository
acontext create my-project --template-path "python/custom-template"
# or
acontext create my-project -t "typescript/my-custom-template"
```

**Templates:**

The CLI automatically discovers all available templates from the [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples) repository. When you run `acontext create`, you'll see a list of all templates available for your selected language.

Templates are organized by language:
- `python/` - Python templates (openai, anthropic, etc.)
- `typescript/` - TypeScript templates (vercel-ai, langchain, etc.)

You can also use any custom template folder by specifying the path with `--template-path`.

### Server Management (Split-Screen TUI)

Start both sandbox and Docker services in a unified split-screen terminal interface:

```bash
# Start server with sandbox and docker in split-screen view
acontext server up
```

The `server up` command will:
- Check if `sandbox/cloudflare` exists, create it if missing
- Start the sandbox development server
- Start all Docker Compose services
- Display both outputs in a split-screen terminal UI with real-time logs
- Show Docker service status indicators (healthy/running/exited)
- Support mouse wheel scrolling for both panels

Press `q` or `Ctrl+C` to stop all services.

### Version Management

```bash
# Check version (automatically checks for updates)
acontext version

# Upgrade to the latest version
acontext upgrade
```

The CLI automatically checks for updates after each command execution. If a new version is available, you'll see a notification prompting you to run `acontext upgrade`.

## Environment Configuration

When running `acontext server up`, if `.env` file doesn't exist, a default one will be created. You can edit it to configure:

1. **LLM SDK**: `openai` or `anthropic`
2. **LLM API Key**: Your API key for the selected SDK
3. **LLM Base URL**: API endpoint (defaults to official API URLs)
4. **Acontext API Token**: A string to build your Acontext API key (`sk-ac-<your-token>`)
5. **Config File Path**: Optional path to a `config.yaml` file (copy `config.yaml.example` as a starting point)

## Development Status

**🎯 Current Progress**: Production Ready  
**✅ Completed**: 
- ✅ Interactive project creation
- ✅ Multi-language template support (Python/TypeScript)
- ✅ Dynamic template discovery from repository
- ✅ Git repository initialization
- ✅ Docker Compose integration with health checks
- ✅ One-command deployment
- ✅ Split-screen TUI for server management
- ✅ Sandbox project management (Cloudflare)
- ✅ Package manager auto-detection (pnpm, npm, yarn, bun)
- ✅ Interactive .env configuration
- ✅ Version checking and auto-update
- ✅ CI/CD with GitHub Actions
- ✅ Automated releases with GitHub Actions
- ✅ Comprehensive unit tests
- ✅ Telemetry for usage analytics

## Command Reference

| Command | Description |
|---------|-------------|
| `acontext create [name]` | Create a new project with templates |
| `acontext server up` | Start sandbox + Docker in split-screen TUI |
| `acontext version` | Show version info |
| `acontext upgrade` | Upgrade to latest version |
| `acontext help` | Show help information |

## License

MIT
