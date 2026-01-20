# Publishing Guide

## How It Works

The template files are automatically copied from `src/server/sandbox/cloudflare` to the `template/` directory before publishing. This ensures:
- ✅ No code duplication - template always references the source
- ✅ Automatic sync - latest changes are included when publishing
- ✅ Template directory is auto-generated (ignored in git)

The `prepublishOnly` script runs automatically before `npm publish` to prepare the template files.

## Publishing Steps

### 1. Prerequisites

Make sure you have:
- Node.js 18+ installed
- An npm account and logged in (`npm login`)
- Permission to publish the `@acontext/sandbox-cloudflare` package on npm (you must be a member of the `@acontext` organization)
- Push access to the repository to create tags

### 2. Local Testing

Before publishing, test locally:

```bash
cd src/packages/sandbox-cloudflare

# Test script syntax
node bin/create.js test-project --skip-install

# Check generated files
cd test-project
# Verify all files are generated correctly
```

### 3. Update Version Number

Update the version number in `package.json`:

```json
{
  "version": "0.1.0"  // Update to new version number
}
```

Commit and push the version change:

```bash
git add src/packages/sandbox-cloudflare/package.json
git commit -m "chore: bump sandbox-cloudflare to v0.1.0"
git push
```

### 4. Create and Push Release Tag

Create a tag following the pattern `package-sandbox-cloudflare/v<VERSION>`:

```bash
# Make sure you're at the repository root
git tag package-sandbox-cloudflare/v0.1.0
git push origin package-sandbox-cloudflare/v0.1.0
```

**Important**: The tag version must match the version in `package.json`. The GitHub Actions workflow will verify this.

### 5. Automated Publishing

Once you push the tag, the GitHub Actions workflow (`.github/workflows/package-release-sandbox-cloudflare.yaml`) will automatically:

1. ✅ Verify the tag version matches `package.json` version
2. ✅ Check if the version already exists on npm
3. ✅ Publish to npm as `@acontext/sandbox-cloudflare`
   - The `prepublishOnly` script automatically runs before publish to:
     - Copy template files from `src/server/sandbox/cloudflare` to `template/`
     - Replace template variables (`{{project-name}}`) in package.json and wrangler.jsonc
4. ✅ Create a GitHub Release

The workflow is triggered by tags matching `package-sandbox-cloudflare/v*` (tag format) for the `sandbox-cloudflare` directory.

### 6. Manual Publishing (Alternative)

If you need to publish manually without using the GitHub Actions workflow:

```bash
cd src/packages/sandbox-cloudflare
npm publish --access public
```

**Note**: Scoped packages (`@acontext/...`) are private by default. Use `--access public` to publish them publicly.

### 7. Verify Publication

After the workflow completes, verify the package was published:

```bash
# Check npm
npm view @acontext/sandbox-cloudflare version

# Test in a temporary directory
mkdir /tmp/test-create && cd /tmp/test-create
npx @acontext/sandbox-cloudflare@latest test-app --skip-install
```

### 8. Using the Latest Version

Users can use it with the following commands:

```bash
# Use latest version
npx @acontext/sandbox-cloudflare@latest my-app
# or: npm create @acontext/sandbox-cloudflare@latest my-app

# Use specific version
npx @acontext/sandbox-cloudflare@0.1.0 my-app

# Skip installing dependencies
npx @acontext/sandbox-cloudflare@latest my-app --skip-install
```

## Version Management

Follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- `MAJOR`: Incompatible API changes
- `MINOR`: Backward-compatible feature additions
- `PATCH`: Backward-compatible bug fixes

## Notes

1. **Template Files**: Ensure the `template/` directory contains all necessary files
2. **Don't Commit**: `node_modules/`, `.env`, lock files, etc. should not be included in the package
3. **package.json files field**: Ensure only necessary files are published (bin and template)
4. **README**: Keep README.md updated with usage instructions
