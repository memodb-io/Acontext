# Acontext CLI

A lightweight command-line tool for quickly creating Acontext projects with templates.

## Features

- 🚀 **Quick Setup**: Create projects in seconds with interactive templates
- 🌐 **Multi-Language**: Support for Python and TypeScript
- 🐳 **Docker Ready**: One-command Docker Compose deployment
- 🏖️ **Sandbox Management**: Create and manage sandbox projects (Cloudflare, etc.)
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

### Homebrew (macOS)

```bash
brew install acontext/tap/acontext-cli
```

## Usage

### Create a New Project

```bash
# Interactive mode
acontext create

# Use default templates (Python OpenAI or TypeScript Vercel AI)
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

### Docker Deployment

```bash
# Start all services
acontext docker up

# Check status
acontext docker status

# View logs
acontext docker logs

# Stop services
acontext docker down
```

### Sandbox Management

```bash
# List available sandbox commands
acontext sandbox

# Start or create a sandbox project
acontext sandbox start
```

The `sandbox start` command will:
- Scan for existing sandbox projects in `sandbox/` directory
- List available sandbox types to create (e.g., Cloudflare)
- Allow you to select an existing project to start or create a new one
- Automatically detect and use the appropriate package manager (pnpm, npm, yarn, bun)
- Start the development server automatically

**Example workflow:**
1. Run `acontext sandbox start`
2. Select from existing projects (e.g., `cloudflare (Local)`) or create new (`cloudflare (Create)`)
3. If creating, choose a package manager
4. The project will be created in `sandbox/cloudflare` and the dev server will start

### Version Management

```bash
# Check version (automatically checks for updates)
acontext version

# Upgrade to the latest version
acontext upgrade
```

The CLI automatically checks for updates after each command execution. If a new version is available, you'll see a notification prompting you to run `acontext upgrade`.

## Development Status

**🎯 Current Progress**: Production Ready (~95% complete)  
**✅ Completed**: 
- ✅ Interactive project creation
- ✅ Multi-language template support (Python/TypeScript)
- ✅ Dynamic template discovery from repository
- ✅ Git repository initialization
- ✅ Docker Compose integration
- ✅ One-command deployment
- ✅ Sandbox project management (Cloudflare)
- ✅ Package manager auto-detection (pnpm, npm, yarn, bun)
- ✅ Version checking and auto-update
- ✅ CI/CD with GitHub Actions
- ✅ Automated releases with GoReleaser
- ✅ Comprehensive unit tests

## Documentation

- [Template Configuration](./templates/README.md) - Template configuration guide

## License

MIT