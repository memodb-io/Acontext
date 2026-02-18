# Fix Skill Learner Agent: Files Created by Agent Can't Be Rendered in UI

## Features / Showcase

Files created by the skill learner agent in CORE are currently **invisible** in the UI — clicking on them returns a 500 error. Two root causes:

1. **No S3 upload** — the CORE stores content only inline in `asset_meta.content` with empty `s3_key` and `bucket`. The API's `GetArtifact` handler requires a valid S3 key for both presigned URL generation and content serving, so it returns HTTP 500.
2. **`meta.__artifact_info__` is missing** — the CORE never populates the `meta` column, so the UI tooltip shows "-" for mime/size, and image detection fails.

**The API is the source of truth.** The fix is to make the CORE's artifact creation match the API's behavior: upload to S3, populate `asset_meta` with real S3 fields, and populate `meta.__artifact_info__`.

**After the fix:** Files created by the agent will render correctly in the UI — text/code files display in the code editor, correct mime/size in tooltips, and presigned URLs work for downloads.

## Designs Overview

### CORE vs API Artifact Data Layer — Full Audit

| # | Operation | CORE | API | Match? | Notes |
|---|-----------|------|-----|--------|-------|
| 1 | Get by path | `get_artifact_by_path` | `repo.GetByPath` | ✅ | Same query |
| 2 | Exists check | `artifact_exists` | `repo.ExistsByPathAndFilename` | ✅ | API has optional `excludeID`, not needed in CORE |
| 3 | List by path | `list_artifacts_by_path` | `repo.ListByPath` | ✅ | Same query |
| 4 | Glob search | `glob_artifacts` | `repo.GlobArtifacts` | ✅ | CORE lacks `limit` param; acceptable |
| 5 | Grep search | `grep_artifacts` | `repo.GrepArtifacts` | ✅ | CORE has extra `case_sensitive` option |
| 6 | **Create / Upsert** | `upsert_artifact` | `service.Create` / `CreateFromBytes` | ❌ | **3 issues — see below** |
| 7 | **Delete** | `delete_artifact_by_path` | `repo.DeleteByPath` | ⚠️ | No AssetReference decrement |
| 8 | Update meta only | *(N/A)* | `service.UpdateArtifactMetaByPath` | N/A | CORE doesn't need this |

### Issue 6: `upsert_artifact` vs API Create — 3 Problems

**6a. No S3 Upload**

CORE's callers (`create_skill_file`, `create_skill`, `str_replace_skill_file`) all build `asset_meta` with empty S3 fields:
```python
# Current (broken) — seen in create_skill_file.py:48-57 and agent_skill.py:126-134
asset_meta = {
    "bucket": "",       # ← empty
    "s3_key": "",       # ← empty → GetPresignedURL fails → HTTP 500
    "etag": "",         # ← empty
    "sha256": hashlib.sha256(content_bytes).hexdigest(),
    "mime": "text/plain",
    "size_b": len(content_bytes),
    "content": content,
}
```

API uploads to S3 first, then uses the returned S3 metadata:
```go
// api/go/internal/modules/service/artifact.go:96-103
asset = s3.UploadBytes(ctx, "disks/"+projectID.String(), filename, content)
// asset = {Bucket, S3Key, ETag, SHA256, MIME, SizeB}
// S3Key pattern: "disks/{projectID}/{YYYY/MM/DD}/{sha256hex}{.ext}"
```

**6b. No `meta.__artifact_info__`**

CORE never passes `meta` to `upsert_artifact` (defaults to `None`). API always sets:
```go
// api/go/internal/modules/service/artifact.go:97-104
meta := map[string]interface{}{
    model.ArtifactInfoKey: map[string]interface{}{
        "path":     in.Path,
        "filename": in.FileHeader.Filename,
        "mime":     asset.MIME,
        "size":     asset.SizeB,
    },
}
```

UI reads from `meta.__artifact_info__`:
- `fileInfo.meta.__artifact_info__?.mime` — tooltip + image detection
- `fileInfo.meta.__artifact_info__?.size` — tooltip (bytes, displayed via `formatBytes`)

**6c. No AssetReference Tracking**

API's `repo.Create` calls `IncrementAssetRef(projectID, asset)` for S3 garbage collection. CORE has no `AssetReference` ORM.

**Decision:** Skip for now. Skill learner creates small text files (< 10KB) infrequently. Orphaned S3 objects are negligible.

### Issue 7: `delete_artifact_by_path` — No AssetReference Decrement

API's `repo.DeleteByPath` calls `DecrementAssetRef` (deletes S3 object when `ref_count` reaches 0). CORE only deletes the DB record.

**Decision:** Same as 6c — skip for now, address with AssetReference tracking later.

### S3 Failure Behavior

If `S3_CLIENT.upload_object()` fails (network error, S3 down, auth issue), `upload_and_build_artifact_meta` raises an unhandled exception. This propagates through the tool handler → agent loop's `except Exception` → `RuntimeError` → `Result.reject()`, killing the current agent run.

**Decision:** Hard error. S3 upload is mandatory — the whole point of this fix is to ensure S3-backed artifacts. If S3 is down, retrying with inline-only content would re-introduce the exact bug we're fixing. The skill learner consumer has a retry mechanism via MQ, so the task will retry on next trigger.

### Existing Artifacts (No Backfill)

Artifacts created by the CORE before this fix have `s3_key=""` and `meta=None`. They will remain broken in the UI until the agent naturally edits them via `str_replace_skill_file`, which will re-upload to S3 and populate `meta.__artifact_info__`.

**Decision:** Let them heal naturally. No migration script. Rationale: the skill learner is a recent feature with low volume of existing artifacts, and the agent actively revisits and edits skill files.

### Known Limitation: Extensionless Files

`detect_mime_type` only uses the file extension. Files without extensions (e.g., `Makefile`, `Dockerfile`, `LICENSE`) will get `text/plain`. The API's Go implementation also uses `mimetype.Detect(content)` for content-based sniffing, which the CORE does not replicate. This is acceptable — the skill learner primarily creates `.md`, `.py`, `.json`, etc.

### Fix Strategy

Add a shared helper `upload_and_build_artifact_meta` in the artifact data layer that:
1. Detects MIME type from filename extension (mirroring API's `extMimeMap`)
2. Computes SHA256
3. Uploads to S3 via `S3_CLIENT.upload_object()`
4. Returns `(asset_meta, artifact_info_meta)` matching the API's format

Then wire this helper into all 4 callers that create/modify artifacts.

### MIME Detection

Python extension→MIME map that exactly mirrors the API's `extMimeMap` from `api/go/internal/pkg/utils/mime/mime.go:12-41`:

```python
_EXT_MIME_MAP = {
    ".md": "text/markdown", ".markdown": "text/markdown",
    ".yaml": "text/yaml", ".yml": "text/yaml",
    ".csv": "text/csv", ".json": "application/json",
    ".xml": "application/xml", ".html": "text/html", ".htm": "text/html",
    ".css": "text/css", ".js": "text/javascript", ".ts": "text/typescript",
    ".go": "text/x-go", ".py": "text/x-python",
    ".rs": "text/x-rust", ".rb": "text/x-ruby",
    ".java": "text/x-java", ".c": "text/x-c", ".cpp": "text/x-c++",
    ".h": "text/x-c", ".hpp": "text/x-c++",
    ".sh": "text/x-shellscript", ".bash": "text/x-shellscript",
    ".sql": "text/x-sql", ".toml": "text/x-toml",
    ".ini": "text/x-ini", ".cfg": "text/x-ini", ".conf": "text/x-ini",
}
```
Fallback: `"text/plain"` (same as API when content detection returns `text/plain` and extension is unknown).

### S3 Key Pattern

Must match the API's `uploadWithDedup` key structure (`api/go/internal/infra/blob/s3.go:231`):
```
disks/{project_id}/{YYYY/MM/DD}/{sha256_hex}{.ext}
```

### ETag Handling

`S3_CLIENT.upload_object()` returns a dict with `ETag` from S3, which is typically quoted (e.g., `'"abc123"'`). The API's `cleanETag` strips surrounding quotes (`api/go/internal/infra/blob/s3.go:167-173`). The helper must do the same.

### `upload_and_build_artifact_meta` Signature and Return Values

```python
async def upload_and_build_artifact_meta(
    project_id: asUUID,
    path: str,
    filename: str,
    content: str,
) -> tuple[dict, dict]:
    """Upload content to S3 and build asset_meta + meta dicts matching API behavior.

    Args:
        project_id: Project UUID, used for S3 key prefix.
        path: Artifact path (e.g., "/" or "/scripts/").
        filename: Artifact filename (e.g., "SKILL.md" or "main.py").
        content: Text content of the file.

    Returns:
        (asset_meta, artifact_info_meta) tuple:
        - asset_meta: dict for the artifact's asset_meta column
        - artifact_info_meta: dict for the artifact's meta column (contains __artifact_info__)
    """
```

Returns:
```python
asset_meta = {
    "bucket": "my-bucket",                                     # S3_CLIENT.bucket
    "s3_key": "disks/{project_id}/2026/02/18/{sha256}.md",     # generated key
    "etag": "abc123",                                          # from S3 response, quotes stripped
    "sha256": "e3b0c44...",                                    # hex digest
    "mime": "text/markdown",                                   # from detect_mime_type()
    "size_b": 1234,                                            # len(content_bytes)
    "content": "# Hello\n...",                                 # inline text for grep
}
artifact_info_meta = {
    "__artifact_info__": {
        "path": "/",
        "filename": "SKILL.md",
        "mime": "text/markdown",
        "size": 1234,                                          # note: "size" not "size_b" — matches API
    }
}
```

## TODOs

### 1. Add `upload_and_build_artifact_meta` helper + `detect_mime_type`

- File: `src/server/core/acontext_core/service/data/artifact.py`
- New imports: `import hashlib`, `import os`, `from datetime import datetime, timezone`, `from ...infra.s3 import S3_CLIENT`
- Add `_EXT_MIME_MAP` dict (copy of API's `extMimeMap`)
- Add `def detect_mime_type(filename: str) -> str` — looks up extension in `_EXT_MIME_MAP`, falls back to `"text/plain"`
- Add `async def upload_and_build_artifact_meta(project_id, path, filename, content) -> tuple[dict, dict]`:
  1. `content_bytes = content.encode("utf-8")`
  2. `sha256_hex = hashlib.sha256(content_bytes).hexdigest()`
  3. `mime = detect_mime_type(filename)`
  4. `ext = os.path.splitext(filename)[1].lower()` (may be empty)
  5. `date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")`
  6. `s3_key = f"disks/{project_id}/{date_prefix}/{sha256_hex}{ext}"`
  7. `response = await S3_CLIENT.upload_object(s3_key, content_bytes, content_type=mime)`
  8. `etag = response.get("ETag", "").strip('"')` — strip surrounding quotes
  9. Build and return `(asset_meta, artifact_info_meta)` as described above

### 2. Fix `create_skill_file.py`

- File: `src/server/core/acontext_core/llm/tool/skill_learner_lib/create_skill_file.py`
- Remove `import hashlib` (no longer needed here)
- Add import: `from ....service.data.artifact import upsert_artifact, artifact_exists, upload_and_build_artifact_meta`
- Replace lines 48-57 (manual `asset_meta` construction) with:
  ```python
  asset_meta, meta = await upload_and_build_artifact_meta(
      ctx.project_id, path, filename, content
  )
  ```
- Change line 58 from `upsert_artifact(ctx.db_session, skill.disk_id, path, filename, asset_meta)` to `upsert_artifact(ctx.db_session, skill.disk_id, path, filename, asset_meta, meta=meta)`

### 3. Fix `agent_skill.py` `create_skill`

- File: `src/server/core/acontext_core/service/data/agent_skill.py`
- Remove `import hashlib` (no longer needed here)
- Change import to: `from .artifact import upsert_artifact, upload_and_build_artifact_meta`
- Replace lines 125-133 (manual `asset_meta` construction) with:
  ```python
  asset_meta, artifact_info_meta = await upload_and_build_artifact_meta(
      project_id, "/", "SKILL.md", content
  )
  ```
- Change line 135-136 from `upsert_artifact(db_session, disk.id, "/", "SKILL.md", asset_meta)` to `upsert_artifact(db_session, disk.id, "/", "SKILL.md", asset_meta, meta=artifact_info_meta)`

### 4. Fix `str_replace_skill_file.py`

- File: `src/server/core/acontext_core/llm/tool/skill_learner_lib/str_replace_skill_file.py`
- Remove `import hashlib`
- Add import: `from ....service.data.artifact import get_artifact_by_path, upsert_artifact, upload_and_build_artifact_meta`
- Replace lines 69-78 (manual `asset_meta` construction) with:
  ```python
  asset_meta, new_artifact_info_meta = await upload_and_build_artifact_meta(
      ctx.project_id, path, filename, new_content
  )
  ```
- Merge meta: preserve existing user keys in `artifact.meta`, only overwrite `__artifact_info__`:
  ```python
  merged_meta = dict(artifact.meta) if artifact.meta else {}
  merged_meta.update(new_artifact_info_meta)
  ```
- Change line 79 to pass `meta=merged_meta`: `upsert_artifact(ctx.db_session, skill.disk_id, path, filename, asset_meta, meta=merged_meta)`

### 5. Fix `mv_skill_file.py`

- File: `src/server/core/acontext_core/llm/tool/skill_learner_lib/mv_skill_file.py`
- After line 64 (`artifact.filename = dst_file`), add meta update:
  ```python
  # Update __artifact_info__ with new path/filename
  if artifact.meta and "__artifact_info__" in artifact.meta:
      updated_meta = dict(artifact.meta)
      updated_info = dict(updated_meta["__artifact_info__"])
      updated_info["path"] = dst_dir
      updated_info["filename"] = dst_file
      updated_meta["__artifact_info__"] = updated_info
      artifact.meta = updated_meta
  ```
- No S3 re-upload needed — content and S3 key stay the same
- Note: for artifacts created before this fix (meta is `None`), the `if` guard prevents errors. These artifacts won't have `__artifact_info__` until they're edited via `str_replace_skill_file`.

### 6. Update existing tests to mock `upload_and_build_artifact_meta`

After this fix, `create_skill_file_handler`, `str_replace_skill_file_handler`, and `create_skill` (in `agent_skill.py`) all call `upload_and_build_artifact_meta`, which hits S3. Existing tests that exercise these paths will break without mocking.

**Mock strategy:** Mock at the `upload_and_build_artifact_meta` level (not `S3_CLIENT.upload_object`). This keeps tests focused on handler logic without coupling to S3 internals.

**Mock return value:**
```python
mock_asset_meta = {
    "bucket": "test-bucket",
    "s3_key": "disks/test-project/2026/01/01/abc123.md",
    "etag": "abc123",
    "sha256": "abc123",
    "mime": "text/markdown",
    "size_b": 14,
    "content": "print('hello')",
}
mock_artifact_info_meta = {
    "__artifact_info__": {
        "path": "/",
        "filename": "test.md",
        "mime": "text/markdown",
        "size": 14,
    }
}
```

**Files to update:**

#### `src/server/core/tests/llm/test_skill_learner_tools.py`

- **`TestCreateSkillFile.test_creates_new_file`** — Add `@patch("acontext_core.llm.tool.skill_learner_lib.create_skill_file.upload_and_build_artifact_meta")` returning `(mock_asset_meta, mock_artifact_info_meta)`. Verify that `upsert_artifact` is called with `meta=mock_artifact_info_meta`.
- **`TestCreateSkillFile.test_editing_proceeds_after_report_thinking`** (in `TestThinkingGuard`) — Same mock needed since it calls `create_skill_file_handler`.
- **`TestStrReplaceSkillFile.test_replaces_string`** — Add `@patch("acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.upload_and_build_artifact_meta")`. Verify merged meta is passed to `upsert_artifact`.
- **`TestStrReplaceSkillFile.test_skill_md_updates_description`** — Same mock needed.
- Tests that exercise early-exit paths (e.g., `test_rejects_old_string_not_found`, `test_rejects_creating_skill_md`) do **NOT** need the mock — they return before reaching the upload call.

#### `src/server/core/tests/service/test_artifact_data.py`

- **`TestIntegrationSkillFileList.test_skill_file_list`** — This calls `create_skill` directly (from `agent_skill.py`). Add `@patch("acontext_core.service.data.agent_skill.upload_and_build_artifact_meta")` returning `(mock_asset_meta, mock_artifact_info_meta)`.

#### `src/server/core/tests/service/test_agent_skill_data.py`

- **`TestCreateSkill.test_create_skill_success`** — Wrap `create_skill()` call with `@patch("acontext_core.service.data.agent_skill.upload_and_build_artifact_meta")` using `_mock_upload_meta(content)` helper.
- **`TestCreateSkill.test_create_skill_with_meta`** — Same mock needed.
- **`TestCreateSkill.test_create_skill_name_sanitization`** — Same mock needed.
- **`TestCreateSkill.test_create_skill_sha256_and_size_b`** — Same mock needed; helper computes correct sha256/size_b from content.
- Tests that exercise early-exit paths (e.g., `test_create_skill_invalid_missing_name`, `test_create_skill_invalid_empty_content`) do **NOT** need the mock — they return before reaching the upload call.

#### `src/server/core/tests/llm/test_skill_learner_agent.py`

- **`TestAgentMultiTurn.test_reads_skill_and_edits_file`** — Add `@patch("acontext_core.llm.tool.skill_learner_lib.str_replace_skill_file.upload_and_build_artifact_meta")` since the agent exercises `str_replace_skill_file` which now calls the upload helper.
- **`TestAgentStatePreservation.test_thinking_preserved_across_iterations`** — Same mock needed; verify `upload_and_build_artifact_meta` receives the replaced content.

## New Deps

None — uses existing `S3_CLIENT` from `acontext_core/infra/s3.py` and standard library (`hashlib`, `datetime`, `os.path`).

## Test Cases

### Unit tests for new helper (`detect_mime_type` + `upload_and_build_artifact_meta`)

These mock `S3_CLIENT.upload_object` at the S3 client level since they test the helper itself.

- [x] `detect_mime_type("SKILL.md")` returns `"text/markdown"`
- [x] `detect_mime_type("main.py")` returns `"text/x-python"`
- [x] `detect_mime_type("config.yaml")` returns `"text/yaml"`
- [x] `detect_mime_type("unknown.xyz")` returns `"text/plain"`
- [x] `detect_mime_type("Makefile")` returns `"text/plain"` (extensionless fallback)
- [x] `upload_and_build_artifact_meta` returns `asset_meta` with non-empty `s3_key`, `bucket`, `etag`
- [x] `upload_and_build_artifact_meta` returns `asset_meta.content` equal to the input content (inline text preserved for grep)
- [x] `upload_and_build_artifact_meta` returns `artifact_info_meta["__artifact_info__"]["mime"]` matching `detect_mime_type` result
- [x] `upload_and_build_artifact_meta` returns `artifact_info_meta["__artifact_info__"]["size"]` equal to `len(content.encode("utf-8"))`
- [x] `upload_and_build_artifact_meta` returns `artifact_info_meta["__artifact_info__"]["path"]` and `["filename"]` matching inputs
- [x] S3 key follows pattern `disks/{project_id}/{YYYY/MM/DD}/{sha256}{ext}`
- [x] ETag in `asset_meta` has no surrounding quotes (e.g., S3 returns `'"abc"'` → stored as `"abc"`)
- [x] `upload_and_build_artifact_meta` raises when `S3_CLIENT.upload_object` raises (hard error — no swallowing)

### Existing tool handler tests (mock `upload_and_build_artifact_meta`)

- [x] `create_skill_file` tool: existing `test_creates_new_file` passes with `upload_and_build_artifact_meta` mocked; verify `upsert_artifact` receives `meta=` from mock
- [x] `str_replace_skill_file` tool: existing `test_replaces_string` passes with mock; verify merged meta passed to `upsert_artifact`
- [x] `str_replace_skill_file` preserves existing user meta keys (e.g., `artifact.meta.custom_key` is retained after edit)
- [x] `create_skill` tool handler: existing tests pass (already mock `db_create_skill`, no change needed)
- [x] `test_editing_proceeds_after_report_thinking`: passes with `upload_and_build_artifact_meta` mocked

### `mv_skill_file` tool tests (no S3 involvement)

- [x] `mv_skill_file` updates `meta.__artifact_info__.path` and `meta.__artifact_info__.filename` to destination values
- [x] `mv_skill_file` does not change `asset_meta.s3_key` (content unchanged)
- [x] `mv_skill_file` handles artifacts with `meta=None` gracefully (no crash)

### Integration test (`test_artifact_data.py`)

- [x] `test_skill_file_list` passes with `upload_and_build_artifact_meta` mocked at `agent_skill` level

### Integration test (`test_agent_skill_data.py`)

- [x] `test_create_skill_success` passes with `upload_and_build_artifact_meta` mocked
- [x] `test_create_skill_with_meta` passes with mock
- [x] `test_create_skill_name_sanitization` passes with mock
- [x] `test_create_skill_sha256_and_size_b` passes with mock (helper computes correct sha256/size_b)

### Agent loop tests (`test_skill_learner_agent.py`)

- [x] `test_reads_skill_and_edits_file` passes with `upload_and_build_artifact_meta` mocked at `str_replace_skill_file` level
- [x] `test_thinking_preserved_across_iterations` passes with mock; verifies upload receives replaced content

### Manual verification

- [ ] Files created by agent render correctly in UI code editor and show correct mime/size in tooltip
