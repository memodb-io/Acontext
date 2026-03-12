# Publishing Guide

## Distribution Model

Claude Code plugins are distributed via **marketplaces** — not npm. Users install by adding a marketplace that references this repository, then installing the plugin from it.

The plugin source lives at `src/packages/claude-code/plugin/` in the [Acontext monorepo](https://github.com/memodb-io/Acontext). A marketplace entry points to this path using the `git-subdir` source type.

### How users install

1. Add the marketplace (one-time):
   ```
   /plugin marketplace add memodb-io/Acontext
   ```

2. Install the plugin:
   ```
   /plugin install acontext
   ```

## Release Steps

### 1. Prerequisites

- Node.js 18+ installed
- Push access to the repository
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

> **TODO:** Add the `package-claude-code/vX.Y.Z` tag entry to `AGENTS.md` and create `.github/workflows/package-release-claude-code.yaml` if automated GitHub Releases are desired.

### 4. Verify

Users who have added the marketplace can update to the latest version:

```
/plugin install acontext
```

## Pre-release Checklist

- [ ] Version bumped in `package.json` and `plugin/.claude-plugin/plugin.json` (must match)
- [ ] `npm install` run to regenerate `package-lock.json`
- [ ] `npm run build` succeeds and `plugin/scripts/*.cjs` are up to date
- [ ] Bundled `plugin/scripts/*.cjs` committed to git

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- `MAJOR`: Incompatible config/hook changes
- `MINOR`: New features (new tools, new config options, new hooks)
- `PATCH`: Bug fixes

## Notes

- The `plugin/scripts/*.cjs` bundled files are checked into git — they must be rebuilt before each release
- Both `package.json` and `plugin/.claude-plugin/plugin.json` versions should be kept in sync
- The plugin is **not published to npm** — Claude Code fetches it directly from the git repository via the marketplace system
