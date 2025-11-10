# Acontext CLI

A lightweight command-line tool for quickly creating Acontext projects with templates.

## Features

- 🚀 **Quick Setup**: Create projects in seconds with interactive templates
- 🌐 **Multi-Language**: Support for Python and TypeScript
- 🐳 **Docker Ready**: One-command Docker Compose deployment
- 🔧 **Auto Git**: Automatic Git repository initialization
- 🎯 **Simple**: Minimal configuration, maximum productivity

## Installation

```bash
# Install script (Linux, macOS, WSL)
curl -fsSL https://install.acontext.io | sh

# Or with Homebrew (macOS)
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

**Available Templates:**
- `python/openai` - Python with OpenAI integration (default)
- `typescript/vercel-ai` - TypeScript with Vercel AI SDK (default)

You can also use any custom template folder from the [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples) repository by specifying the path with `--template-path`.

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

### Version Management

```bash
# Check version
acontext version

# Check for updates
acontext version check

# Auto-update
acontext version check --upgrade
```

## Development Status

**🎯 Current Progress**: Production Ready (~92% complete)  
**✅ Completed**: 
- ✅ Interactive project creation
- ✅ Multi-language template support (Python/TypeScript)
- ✅ Git repository initialization
- ✅ Docker Compose integration
- ✅ One-command deployment
- ✅ CI/CD with GitHub Actions
- ✅ Automated releases with GoReleaser
- ✅ Comprehensive unit tests

## Documentation

- [Template Configuration](./templates/README.md) - Template configuration guide

## License

MIT