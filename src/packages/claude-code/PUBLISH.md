# Publishing Guide

> **Status:** The automated release workflow (`package-release-claude-code.yaml`) and AGENTS.md release tag entry have not been set up yet. The steps below describe the intended process — some are not functional until the CI pipeline is created.

## Publishing Steps

### 1. Prerequisites

- Node.js 18+ installed
- An npm account and logged in (`npm login`)
- Permission to publish the `@acontext/claude-code` package (member of `@acontext` npm org)
- Push access to the repository to create tags
- The plugin builds successfully (`npm run build`)

### 2. Update Version Number

Update the version in **two places**:

1. `package.json` → `"version"`
2. `plugin/.claude-plugin/plugin.json` → `"version"`

Rebuild to ensure the bundled scripts are up to date, and regenerate the lock file:

```bash
cd src/packages/claude-code
npm install
npm run build
```

Commit and push:

```bash
git add src/packages/claude-code/package.json src/packages/claude-code/package-lock.json src/packages/claude-code/plugin/.claude-plugin/plugin.json src/packages/claude-code/plugin/scripts/
git commit -m "chore: bump claude-code plugin to v0.1.0"
git push
```

### 3. Create and Push Release Tag

```bash
git tag package-claude-code/v0.1.0
git push origin package-claude-code/v0.1.0
```

The tag version must match `package.json`.

### 4. Automated Publishing

> **TODO:** Create `.github/workflows/package-release-claude-code.yaml` and add the `package-claude-code/vX.Y.Z` tag entry to `AGENTS.md`.

Once the workflow exists, pushing the tag will:

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

## Pre-publish Checklist

- [ ] Version bumped in `package.json` and `plugin/.claude-plugin/plugin.json` (must match)
- [ ] `npm install` run to regenerate `package-lock.json`
- [ ] `npm run build` succeeds and `plugin/scripts/*.cjs` are up to date
- [ ] `"private": true` removed from `package.json` (if publishing to npm)
- [ ] Release workflow exists (`.github/workflows/package-release-claude-code.yaml`)
- [ ] AGENTS.md updated with `package-claude-code/vX.Y.Z` tag pattern

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- `MAJOR`: Incompatible config/hook changes
- `MINOR`: New features (new tools, new config options, new hooks)
- `PATCH`: Bug fixes

## Notes

- The `plugin/scripts/*.cjs` bundled files are checked into git — they must be rebuilt before publishing
- Both `package.json` and `plugin/.claude-plugin/plugin.json` versions should be kept in sync
