# Quick Start

## Project Structure

```
sandbox-cloudflare/
├── bin/
│   └── create.js          # Main entry script
├── template/              # Template files directory
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   ├── wrangler.jsonc
│   └── ...
├── package.json           # npm package configuration
├── README.md              # User documentation
├── PUBLISH.md             # Publishing guide
└── .gitignore
```

## Local Testing

### 1. Test Script

```bash
cd src/packages/sandbox-cloudflare

# Test creating a project (skip installation)
node bin/create.js test-project --skip-install

# Check generated files
cd test-project
ls -la
```

### 2. Verify Template Variable Replacement

Check that `{{project-name}}` in `test-project/package.json` and `test-project/wrangler.jsonc` is correctly replaced.

## Publishing to npm

### 1. Prepare for Publishing

```bash
cd src/packages/sandbox-cloudflare

# Make sure you're logged in to npm
npm login

# Check version number in package.json
cat package.json | grep version
```

### 2. Publish

```bash
npm publish --access public
```

### 3. Verify

After publishing, test in a new directory:

```bash
mkdir /tmp/test-create && cd /tmp/test-create
npx @acontext/sandbox-cloudflare@latest my-test-app --skip-install

# Check generated project
cd my-test-app
cat package.json
cat wrangler.jsonc
```

## User Usage

After publishing, users can use it like this:

```bash
# Create new project
npx @acontext/sandbox-cloudflare@latest my-app
# or: npm create @acontext/sandbox-cloudflare@latest my-app

# Skip installing dependencies
npx @acontext/sandbox-cloudflare@latest my-app --skip-install

# Use --yes to skip all prompts
npx @acontext/sandbox-cloudflare@latest my-app --yes
```

## Features

- ✅ Automatic package manager detection (pnpm/npm/yarn/bun)
- ✅ Template variable replacement support (`{{project-name}}`, `{{project_name}}`)
- ✅ Automatic dependency installation
- ✅ Optional Git initialization
- ✅ Skip unnecessary files (node_modules, lock files)

## Notes

1. **Version Number**: Update the version number in `package.json` before each publish
2. **Template Updates**: If you need to update the template, modify files in the `template/` directory
3. **Testing**: Always test locally before publishing
