# Publishing Guide

## Publishing Steps

### 1. Prerequisites

- Node.js 18+ installed
- An npm account and logged in (`npm login`)
- Permission to publish the `@acontext/openclaw` package (member of `@acontext` npm org)
- Push access to the repository to create tags

### 2. Update Version Number

Update the version in `package.json`:

```json
{
  "version": "0.1.0"
}
```

Commit and push:

```bash
git add src/packages/openclaw/package.json
git commit -m "chore: bump openclaw plugin to v0.1.0"
git push
```

### 3. Create and Push Release Tag

```bash
git tag package-openclaw/v0.1.0
git push origin package-openclaw/v0.1.0
```

The tag version must match `package.json`. The GitHub Actions workflow will verify this.

### 4. Automated Publishing

Once you push the tag, the GitHub Actions workflow (`.github/workflows/package-release-openclaw.yaml`) will:

1. Verify the tag version matches `package.json` version
2. Check if the version already exists on npm
3. Publish to npm as `@acontext/openclaw`
4. Create a GitHub Release

### 5. Manual Publishing (Alternative)

```bash
cd src/packages/openclaw
npm publish --access public
```

### 6. Verify Publication

```bash
npm view @acontext/openclaw version
```

Test in an OpenClaw project:

```bash
openclaw plugins install @acontext/openclaw
```

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- `MAJOR`: Incompatible API/config changes
- `MINOR`: New features (new tools, new config options)
- `PATCH`: Bug fixes
