# Fix PR #358 Review Issues — Concurrent Sync & Learn Message

## Features / Showcase

Address 2 medium-priority and 2 low-priority issues found during code review of PR #358:

1. **Concurrent sync race condition** — `service.start()` and `before_agent_start` can trigger `syncSkillsToLocal()` simultaneously, wasting API calls
2. **Misleading post-learn sync** — `syncSkillsToLocal()` is called right after `learnFromSession()` but server-side learning is async, so newly distilled skills won't be available yet
3. **Path traversal dead branch** — `fileDest !== dir` check in `downloadSkillFiles` is unreachable due to `.endsWith(".md")` filter
4. **Skill name collision** — Different skill names can sanitize to the same directory name (document as known limitation)

## Designs Overview

### Fix 1: Promise guard for `syncSkillsToLocal`
Add a `syncInProgress` promise field to `AcontextBridge`. If a sync is already running, return the existing promise instead of starting a new one. Clear the field on completion.

### Fix 2: Remove immediate sync after learn, fix message
- In `acontext_learn_now` tool: remove `await bridge.syncSkillsToLocal()` after learn, update message to say skills will sync once processing completes
- In auto-learn chain: remove `bridge.syncSkillsToLocal()` from the `.then()` chain after learn, just invalidate caches so next `listSkills()` call will trigger sync when manifest is stale

### Fix 3: Simplify path traversal check
Remove the `&& fileDest !== dir` dead branch since `.endsWith(".md")` already prevents that case.

### Fix 4: Document collision risk
Add a JSDoc comment on `sanitizeSkillName` noting the collision risk.

## TODOS

- [x] **Fix 1: Add sync promise guard to `AcontextBridge`**
  - `src/packages/openclaw/index.ts`: add `syncInProgress` field, wrap `syncSkillsToLocal` body

- [x] **Fix 2: Remove post-learn sync, fix messages**
  - `src/packages/openclaw/index.ts`: `acontext_learn_now` tool — remove sync call, update text
  - `src/packages/openclaw/index.ts`: auto-learn chain — remove `syncSkillsToLocal()` (caches already invalidated by `learnFromSession`)

- [x] **Fix 3: Simplify path traversal guard**
  - `src/packages/openclaw/index.ts`: remove `&& fileDest !== dir` from the check

- [x] **Fix 4: Document collision risk on `sanitizeSkillName`**
  - `src/packages/openclaw/index.ts`: add note in JSDoc

- [x] **Add test: concurrent sync deduplication**
  - `src/packages/openclaw/tests/plugin.test.ts`: 2 tests — dedup concurrent calls, allow new sync after completion

- [x] **Update existing tests for changed messages**
  - No changes needed — existing tests don't assert on tool response text

## New Deps

None.

## Test Cases

- [x] Concurrent `syncSkillsToLocal()` calls deduplicate — only one `listSkills` API call
- [x] New sync allowed after previous one completes
- [x] `acontext_learn_now` tool does not call `syncSkillsToLocal` after learn
- [x] Auto-learn chain does not call `syncSkillsToLocal` after learn
- [x] All 49 tests pass (47 original + 2 new)
