# Publishing Guide

## Publishing Steps

### 1. Prerequisites

- Node.js 18+ installed
- Push access to the repository to create tags
- The plugin builds successfully (`npm run build`)

### 2. Update Version Number

Update the version in both `package.json` and `plugin/.claude-plugin/plugin.json`:

```json
{
  "version": "0.1.0"
}
```

Rebuild to ensure the bundled scripts are up to date:

```bash
cd src/packages/claude-code
npm run build
```

Commit and push:

```bash
git add src/packages/claude-code/package.json src/packages/claude-code/plugin/.claude-plugin/plugin.json src/packages/claude-code/plugin/scripts/
git commit -m "chore: bump claude-code plugin to v0.1.0"
git push
```

### 3. Create and Push Release Tag

```bash
git tag package-claude-code/v0.1.0
git push origin package-claude-code/v0.1.0
```

The tag version must match `package.json`. The GitHub Actions workflow will verify this.

### 4. Automated Publishing

Once you push the tag, the GitHub Actions workflow (`.github/workflows/package-release-claude-code.yaml`) will:

1. Verify the tag version matches `package.json` version
2. Build the plugin
3. Publish to npm as `@acontext/claude-code`
4. Create a GitHub Release

### 5. Manual Publishing (Alternative)

First, remove `"private": true` from `package.json`, then:

```bash
cd src/packages/claude-code
npm run build
npm publish --access public
```

### 6. Verify Publication

```bash
npm view @acontext/claude-code version
```

Test in Claude Code:

```bash
claude plugins add @acontext/claude-code
```

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- `MAJOR`: Incompatible config/hook changes
- `MINOR`: New features (new tools, new config options, new hooks)
- `PATCH`: Bug fixes

## Notes

- The `plugin/scripts/*.cjs` bundled files are checked into git — they must be rebuilt before publishing
- Both `package.json` and `plugin/.claude-plugin/plugin.json` versions should be kept in sync
