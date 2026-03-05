# Fix PR #358 Review Issues — OpenClaw Native Skill Sync

## Features / Showcase

Fix 4 issues identified during code review of PR #358 (openclaw native skill sync refactor):

1. **Path traversal vulnerability** in `downloadSkillFiles` — malicious `fi.path` from API can write files outside skill directory
2. **Empty `sanitizeSkillName` crash** — skill names with only special characters produce empty string, causing `skillDir()` to return `skillsDir` root, leading to recursive deletion of entire skills directory
3. **Stale files on skill update** — when a skill's content changes (same name), old files aren't cleaned before re-download
4. **Missing unit tests** — core sync/sanitize/download logic has zero test coverage

## Designs Overview

### Fix 1: Path traversal guard
Add a check in `downloadSkillFiles` that validates `path.resolve(dir, fi.path)` stays within `dir`. If it escapes, log a warning and skip the file.

### Fix 2: Empty sanitizeSkillName guard
Throw an error if `sanitizeSkillName` produces an empty string. This prevents `skillDir()` from returning the skills root.

### Fix 3: Clean target directory before re-download
In `syncSkillsToLocal`, always `rm -rf` the target skill directory before calling `downloadSkillFiles` when a skill's `updatedAt` has changed (not just when the name changes).

### Fix 4: Unit tests
Export `sanitizeSkillName` for testing. Add tests for:
- `sanitizeSkillName` edge cases (normal, special chars, empty result, unicode)
- `AcontextBridge.syncSkillsToLocal` (incremental sync, manifest, skill removal, rename cleanup)
- `AcontextBridge.downloadSkillFiles` (path traversal rejection)

## TODOS

- [x] **Fix 1: Add path traversal guard in `downloadSkillFiles`**
  - `src/packages/openclaw/index.ts`: validate resolved `fileDest` stays under `dir` before writing

- [x] **Fix 2: Guard against empty `sanitizeSkillName` result**
  - `src/packages/openclaw/index.ts`: throw error when sanitized name is empty

- [x] **Fix 3: Clean skill directory before re-download on update**
  - `src/packages/openclaw/index.ts`: in `syncSkillsToLocal`, `rm -rf` target dir before `downloadSkillFiles` when `updatedAt` changed

- [x] **Fix 4: Add unit tests for core sync logic**
  - `src/packages/openclaw/index.ts`: export `sanitizeSkillName` for testing
  - `src/packages/openclaw/tests/plugin.test.ts`: add test suites for `sanitizeSkillName`, `AcontextBridge` sync, path traversal

## New Deps

None.

## Test Cases

- [x] `sanitizeSkillName("My Cool Skill")` → `"my-cool-skill"`
- [x] `sanitizeSkillName("@#$")` → throws error (empty result)
- [x] `sanitizeSkillName("")` → throws error (empty result)
- [x] `sanitizeSkillName("---")` → throws error (empty result after trim)
- [x] `sanitizeSkillName("skill_v2-beta")` → `"skill_v2-beta"` (underscores preserved)
- [x] `sanitizeSkillName("  spaces  ")` → `"spaces"`
- [x] `downloadSkillFiles` rejects path traversal (`../../etc/passwd.md`)
- [x] `downloadSkillFiles` accepts normal nested paths (`docs/guide.md`)
- [x] `syncSkillsToLocal` cleans stale files when skill content updated
- [x] `syncSkillsToLocal` removes deleted skills
- [x] `syncSkillsToLocal` handles skill rename (old dir removed)
- [x] `syncSkillsToLocal` incremental sync (unchanged skills not re-downloaded)
