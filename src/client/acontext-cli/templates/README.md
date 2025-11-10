# Acontext CLI Template Configuration

## Overview

`templates.yaml` defines the default available project templates and their corresponding GitHub repository paths.

**Default Templates:**
- `python/openai` - Python with OpenAI integration
- `typescript/vercel-ai` - TypeScript with Vercel AI SDK

**Custom Templates:**
You can use any template folder from the [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples) repository via the `--template-path` parameter without modifying the configuration file.

## Configuration Structure

### 1. templates field
Defines specific template configurations organized by language and combination:

```yaml
templates:
  python:
    plain:              # Template identifier
      repo: "..."       # GitHub repository URL
      path: "..."       # Folder path in repository
      description: "..." # Template description
```

### 2. presets field
Defines user-friendly preset options that automatically map to templates:

```yaml
presets:
  python:
    - name: "Basic"      # Display option name
      description: "..."  # Option description
      combination:        # Combination definition (optional)
        language: "python"
        provider: "none"
        framework: "none"
      template: "python.plain"  # Maps to key in templates
```

## Template Naming Rules

Recommended to use dot-separated hierarchical structure:
- `python.plain` - Python basic template
- `python.openai` - Python + OpenAI
- `python.langchain-openai` - Python + LangChain + OpenAI
- `python.llamaindex-claude` - Python + LlamaIndex + Claude

## Adding New Templates

### Method 1: Using Custom Template Path (Recommended)

The easiest way is to create a new template folder directly in the [Acontext-Examples](https://github.com/memodb-io/Acontext-Examples) repository, then use the `--template-path` parameter:

```bash
# 1. Create template in Acontext-Examples repository
# Example: python/my-custom-template/

# 2. Use directly without modifying configuration file
acontext create my-app --template-path "python/my-custom-template"
```

### Method 2: Add to Default Template List

If you need to add the template to the interactive selection list, you need to update `templates.yaml`:

#### 1. Create Template on GitHub
Create a new folder in the `Acontext-Examples` repository:
```
Acontext-Examples/
├── python/
│   ├── openai/
│   └── your-new-template/
└── typescript/
    ├── vercel-ai/
    └── your-new-template/
```

#### 2. Update templates.yaml

```yaml
templates:
  python:
    openai:
      repo: "https://github.com/memodb-io/Acontext-Examples"
      path: "python/openai"
      description: "Python template with OpenAI integration"
    
    your-new-template:  # Add new template
      repo: "https://github.com/memodb-io/Acontext-Examples"
      path: "python/your-new-template"
      description: "Your new template description"

presets:
  python:
    - name: "Python + OpenAI"
      template: "python.openai"
    
    - name: "Your Template Name"  # Add new option
      template: "python.your-new-template"
```

## Usage Examples

### CLI Interactive Flow
```
$ acontext create

? Project name: my-app
? Select language: Python
? Select template: 
  ❯ Python + OpenAI
  
? Deploy with Docker? Yes
```

### Using Custom Templates

```bash
# Use custom templates directly from Acontext-Examples repository
acontext create my-app --template-path "python/custom-template"
acontext create my-app -t "typescript/my-template"
```

The CLI automatically:
1. Reads `templates.yaml` (if `--template-path` is not specified)
2. Filters presets by language
3. Displays user-friendly options
4. Parses the corresponding `template` key after user selection
5. Gets `repo` and `path` from `templates`, or uses the path specified by `--template-path`
6. Downloads the specified path using Git sparse-checkout

## Git Sparse Checkout Implementation

```bash
# 1. Initialize sparse clone
git clone --filter=blob:none --sparse \
  https://github.com/memodb-io/Acontext-Examples \
  /tmp/Acontext-Examples

# 2. Enter directory
cd /tmp/Acontext-Examples

# 3. Enable sparse-checkout
git sparse-checkout init --cone

# 4. Specify checkout path
git sparse-checkout set python/your-new-template

# 5. Copy files to target project
cp -r python/your-new-template/* /path/to/my-app/
```

## Template Structure Recommendations

Each template should include:

```
template-name/
├── README.md              # Template description and quick start
├── .gitignore             # Git ignore rules
├── .env.example           # Environment variables example
├── requirements.txt       # Python dependencies (if applicable)
├── package.json           # Node.js dependencies (if applicable)
├── src/                   # Source code
│   ├── main.py           # Main entry file
│   └── ...
├── config/                # Configuration files
└── examples/              # Example code
    └── basic_usage.py
```

## Best Practices

1. **Keep templates simple**: Only include necessary files and code
2. **Provide clear README**: Explain template purpose and how to use
3. **Consistent naming**: Use consistent folder and file naming conventions
4. **Environment variable documentation**: Comment all configuration items in `.env.example`
5. **Example code**: Provide runnable examples showcasing core functionality
6. **Dependency management**: Clearly list all dependencies and versions
7. **Testing**: Ensure template code can run normally

## Maintenance

- Regularly update templates to match latest SDK version
- Add new LLM Provider support
- Optimize template structure based on user feedback
- Maintain compatibility with main SDK

## References

- [Git Sparse Checkout](https://git-scm.com/docs/git-sparse-checkout)
- [Cobra CLI](https://github.com/spf13/cobra)
- [Acontext Python SDK](../acontext-py/)

