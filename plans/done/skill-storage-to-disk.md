# Plan: Migrate Skill Storage from S3 to Disk

## Features / Show Case

Currently, the `agent_skills` module manages its own S3 storage (`AssetMeta`, `FileIndex`) and handles file uploads/downloads/cleanup directly. This plan migrates skill file storage to use the existing **Disk + Artifact** system, keeping only a `disk_id` foreign key on the `agent_skills` table. The Disk system already handles S3 deduplication, reference counting, text extraction, grep/glob search, and sandbox integration — all of which the skill module reimplements independently today.

**What changes:**
- Skill files stored as Disk Artifacts (S3 deduplication + reference counting for free)
- Simplified `agent_skills` DB schema: remove `AssetMeta` and `FileIndex` columns, add `DiskID` FK
- Eliminate direct S3 dependency from both the skills repo and service layers
- Reuse Disk's `download_to_sandbox` infrastructure via ArtifactService

**What stays the same:**
- All 6 skill endpoints keep same request/response shapes, with one addition: `disk_id` is now returned in Create and Get responses
- All documentation stays current

---

## Designs Overview

### Schema: `agent_skills` Table — Before vs After

| Column | Before | After |
|--------|--------|-------|
| `id` | `uuid PK` | unchanged |
| `project_id` | `uuid FK NOT NULL` | unchanged |
| `user_id` | `uuid FK NULL` | unchanged |
| `name` | `text NOT NULL` | unchanged |
| `description` | `text` | unchanged |
| `asset_meta` | `jsonb` — base S3 key | **Removed from model** (orphaned DB column, see Appendix) |
| `file_index` | `jsonb` — `[{path, mime}]` | **Removed from model** — computed at query time via `gorm:"-" json:"file_index"` |
| `disk_id` | *(does not exist)* | **Added** `uuid FK NOT NULL` → `disks.id`, `OnDelete:CASCADE` |
| `meta` | `jsonb` | unchanged |
| `created_at` | `timestamp` | unchanged |
| `updated_at` | `timestamp` | unchanged |

### Architecture: Before vs After

**Current:**
```
agent_skills table
  ├── AssetMeta (JSONB → base S3 key: "agent_skills/{project}/{id}/{name}/")
  ├── FileIndex (JSONB → [{path, mime}, ...])
  └── Direct S3 ops: UploadFileDirect, DownloadFile, PresignGet, DeleteObjectsByPrefix
```

**New:**
```
agent_skills table                  disks table              artifacts table
  ├── DiskID (FK) ──────────────►  ├── ID                   ├── DiskID (FK)
  ├── Name                         ├── ProjectID            ├── Path (dir part)
  ├── Description                  ├── UserID               ├── Filename
  └── Meta                         └── ...                  ├── AssetMeta (S3)
                                                            └── Meta (__artifact_info__)
```

Each skill gets **one Disk**. Each file in the skill ZIP becomes **one Artifact** under that Disk. S3 storage moves from `agent_skills/{project_id}/...` to `disks/{project_id}/...` (managed by ArtifactService).

### Path Convention

Skill file relative paths map to Artifact `(Path, Filename)` tuples:

| Skill FileInfo.Path | Artifact.Path | Artifact.Filename |
|---------------------|---------------|-------------------|
| `SKILL.md`          | `/`           | `SKILL.md`        |
| `scripts/main.py`   | `/scripts/`   | `main.py`         |
| `data/sub/file.txt` | `/data/sub/`  | `file.txt`        |

Helper functions:

```go
import stdpath "path" // Use "path" (always '/'), NOT "path/filepath" (OS-dependent separator)

func splitSkillPath(relativePath string) (dir, filename string) {
    d := stdpath.Dir(relativePath)
    f := stdpath.Base(relativePath)
    if d == "." {
        return "/", f
    }
    return "/" + d + "/", f
}

func joinSkillPath(artifactPath, filename string) string {
    if artifactPath == "/" {
        return filename
    }
    return strings.TrimPrefix(artifactPath, "/") + filename
}
```

> **IMPORTANT**: Use the `path` package (import as `stdpath` to avoid shadowing), **not** `path/filepath`. ZIP files always use `/` as separator. `filepath.Dir`/`filepath.Base` use OS-native separators which would break on Windows builds.

### Key Design Decisions

**Listing all artifacts**: `ArtifactService.ListByPath(ctx, diskID, "")` with **empty string** returns all artifacts for the disk. Do NOT pass `"/"` — that only returns root-level artifacts.

**FileIndex is now computed**: The `file_index` field in GET responses is **computed at query time** from the Disk's Artifacts rather than stored. The old `datatypes.JSONType[[]FileInfo]` always serializes as a JSON array. The new `[]FileInfo` serializes as `null` when nil. Services **must** initialize `FileIndex` as `[]FileInfo{}` (empty slice) to produce `"file_index": []` not `"file_index": null`.

**Cleanup on failure**: Create flow registers a `defer` after disk creation with a `success` flag. If `success` is still `false` when defer runs, `diskSvc.Delete(context.Background(), projectID, diskID)` cascade-deletes all artifacts + decrements S3 refs. Uses `context.Background()` to ensure cleanup even if client disconnects.

**Name sanitization kept**: `sanitizeS3Key(skillName)` is still needed — the name is used in `DownloadToSandbox` sandbox paths (`/skills/{name}`). Removing it would break names with spaces/special chars.

**Delete ordering**: Delete skill record first (removes FK reference), then delete Disk (cascade cleans artifacts). The `OnDelete:CASCADE` on the `DiskID` FK is a **safety net** — if the Disk were deleted first, the skill row would cascade-delete too. But explicit skill-first deletion is preferred: it's clearer, testable, and doesn't rely on implicit cascade behavior for the primary delete path.

**S3 key compatibility**: The current handler calls `coreClient.UploadSandboxFile(projectID, sandboxID, s3Key, destPath)` where `s3Key` was built from `agent_skills/{project_id}/{id}/{name}/...`. After migration, S3 keys come from `artifact.AssetMeta.Data().S3Key` which uses the Artifact system's format (content-hash-based, e.g. `disks/{project_id}/{hash}`). This is fully compatible — `UploadSandboxFile` treats the S3 key as an opaque string and simply passes it to the CORE service for download.

**MIME detection change**: Current code uses `mime.DetectMimeType(content, fileName)`. New flow uses `ArtifactService.CreateFromBytes` → `s3.UploadBytes` which may use a different MIME detection algorithm. Minor MIME value differences are acceptable but worth noting for debugging.

**`errgroup` concurrency**: `errgroup.WithContext(ctx)` — when any goroutine fails, context is cancelled, remaining goroutines fail fast. `g.Wait()` blocks until ALL goroutines complete before defer cleanup runs, so no race condition.

### `CreateArtifactFromBytesInput` Reference

The `ArtifactService.CreateFromBytes` method accepts:

```go
type CreateArtifactFromBytesInput struct {
    ProjectID uuid.UUID // Required — for S3 path construction and asset reference tracking
    DiskID    uuid.UUID // Required — target Disk
    Path      string    // Directory part, e.g. "/" or "/scripts/" (from splitSkillPath)
    Filename  string    // File name, e.g. "main.py" (from splitSkillPath)
    Content   []byte    // Raw file bytes from ZIP entry
}
```

This method performs an **upsert** — if an artifact with the same `(DiskID, Path, Filename)` already exists, it deletes the old one first. It handles S3 upload, deduplication, text extraction, and MIME detection internally.

### New Type: `SkillFileInfo`

```go
// SkillFileInfo represents a file in a skill's disk, with S3 key for sandbox download.
type SkillFileInfo struct {
    Path  string // Joined skill-relative path, e.g. "scripts/main.py" (from joinSkillPath)
    MIME  string // MIME type from artifact's AssetMeta
    S3Key string // S3 key from artifact's AssetMeta (for sandbox upload)
}
```

### API Endpoints — Request/Response Schemas (unchanged)

#### 1. `POST /projects/{project_id}/agent_skills` — Create Skill

**Request**: `multipart/form-data`
| Field | Type | Required |
|-------|------|----------|
| `file` | ZIP file | Yes |
| `user` | string | No |
| `meta` | JSON string | No |

**Response** `201`:
```json
{
  "code": 201,
  "data": {
    "id": "uuid",
    "user_id": "uuid|null",
    "name": "string",
    "description": "string",
    "disk_id": "uuid",
    "file_index": [{"path": "string", "mime": "string"}],
    "meta": {},
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

#### 2. `GET /projects/{project_id}/agent_skills/{id}` — Get Skill

**Response** `200`: same shape as Create response above (includes `disk_id`).

#### 3. `GET /projects/{project_id}/agent_skills` — List Skills

**Response** `200` (note: `file_index` is **not** included in list items):
```json
{
  "code": 200,
  "data": {
    "items": [{
      "id": "uuid", "user_id": "uuid|null", "name": "string",
      "description": "string", "meta": {},
      "created_at": "timestamp", "updated_at": "timestamp"
    }],
    "next_cursor": "string|omitempty",
    "has_more": true
  }
}
```

#### 4. `DELETE /projects/{project_id}/agent_skills/{id}` — Delete Skill

**Response** `200`: `{ "code": 200 }`

#### 5. `GET /projects/{project_id}/agent_skills/{id}/file` — Get File

**Response** `200`:
```json
{
  "code": 200,
  "data": {
    "path": "string", "mime": "string",
    "content": {"raw": "string", "parsed": {}} | null,
    "url": "string|null"
  }
}
```

#### 6. `POST /projects/{project_id}/agent_skills/{id}/download_to_sandbox` — Download to Sandbox

**Request**: `{ "sandbox_id": "string" }`

**Response** `200`:
```json
{
  "code": 200,
  "data": { "success": true, "dir_path": "string", "name": "string", "description": "string" }
}
```

### Performance Notes

- **`GetFile` handler double-query**: `GetByID` lists ALL artifacts to populate `FileIndex`, then `GetFile` queries a SINGLE artifact by path. As an optimization, `GetFile` could accept `(ctx, projectID, skillID, filePath, expire)` and skip the `GetByID` call entirely.
- **`DownloadToSandbox` double-query**: `GetByID` populates `FileIndex`, then `ListFiles` also lists artifacts. Could add a lightweight `GetSkillMeta` that skips `FileIndex` population. Both optimizations are minor and can be deferred.

---

## TODOs

### 1. Model changes
- [x] Remove `AssetMeta datatypes.JSONType[Asset]` field, remove `GetFileS3Key()` method, keep `FileInfo` struct, keep `sanitizeS3Key()`. Add `DiskID uuid.UUID` with `gorm:"type:uuid;not null" json:"-"`. Add `Disk *model.Disk` relationship with `gorm:"foreignKey:DiskID;constraint:OnDelete:CASCADE" json:"-"`. Change `FileIndex` to `[]FileInfo` with `gorm:"-" json:"file_index"`. Keep `datatypes` import (still used by `Meta`).
  - `src/server/api/go/internal/modules/model/agent_skills.go`

### 2. Repository: remove S3 dependency
- [x] Remove `s3 *blob.S3Deps` from struct fields. Simplify `NewAgentSkillsRepo(db *gorm.DB)`. Simplify `Delete()` to DB-only (remove `DeleteObjectsByPrefix` and the S3 prefix-building logic). Keep `Create`, `GetByID`, `Update`, `ListWithCursor` unchanged.
  - `src/server/api/go/internal/modules/repo/agent_skills.go`

### 3. Service: replace S3 with Disk+Artifact dependencies
- [x] Replace `s3 *blob.S3Deps` with `diskSvc DiskService` + `artifactSvc ArtifactService`. Update constructor to `NewAgentSkillsService(r AgentSkillsRepo, diskSvc DiskService, artifactSvc ArtifactService)`. Add `splitSkillPath()` and `joinSkillPath()` helpers (use `path` package, NOT `path/filepath`).
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 4a. Service: rewrite `Create()` — ZIP parsing (pre-Disk)
- [x] Steps that run **before** Disk creation (no cleanup needed on failure): (1) Parse ZIP + extract SKILL.md front matter (name, description), (2) detect root prefix + filter macOS resource fork files (`__MACOSX/`, `._*`), (3) sanitize name via `sanitizeS3Key`.
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 4b. Service: rewrite `Create()` — Disk + Artifact uploads
- [x] Steps that create infrastructure (cleanup required on failure): (4) Create Disk via `diskSvc.Create(ctx, projectID, userID)`, (5) register `defer` cleanup with `success` flag — on failure: `diskSvc.Delete(context.Background(), projectID, diskID)` cascade-deletes all artifacts + S3 refs, (6) create Artifacts via `artifactSvc.CreateFromBytes` in `errgroup` with limit 10, passing `CreateArtifactFromBytesInput{ProjectID, DiskID, Path (from splitSkillPath), Filename (from splitSkillPath), Content}` for each ZIP entry.
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 4c. Service: rewrite `Create()` — DB record + response
- [x] Steps that finalize the skill: (7) build `fileIndex` from created artifacts as `[]FileInfo{}` (never nil — nil serializes as `"file_index": null`), (8) create skill DB record with `DiskID` via `repo.Create`, (9) set `skill.FileIndex = fileIndex` manually (it's a `gorm:"-"` field, not persisted), (10) set `success = true` so defer cleanup is skipped.
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 5. Service: rewrite `GetByID()`
- [x] After fetching skill record, call `artifactSvc.ListByPath(ctx, skill.DiskID, "")` (empty string = all). Map artifacts to `FileInfo` via `joinSkillPath`. Initialize `FileIndex` as `[]FileInfo{}` even when empty.
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 6. Service: rewrite `Delete()`
- [x] Get skill to find DiskID. Delete skill record via `repo.Delete()` (DB-only). Then delete Disk via `diskSvc.Delete(ctx, projectID, diskID)` (cascade handles artifacts + S3).
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 7. Service: rewrite `GetFile()`
- [x] Split `filePath` via `splitSkillPath`. Call `artifactSvc.GetByPath(ctx, skill.DiskID, path, filename)`. Get MIME from `artifact.AssetMeta.Data().MIME`. Use `fileparser.NewFileParser().CanParseFile()` to check parseability. For text: `artifactSvc.GetFileContent`. For binary: `artifactSvc.GetPresignedURL`. Return same `GetFileOutput` shape.
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 8. Service: add `ListFiles()` method
- [x] Add `SkillFileInfo` type and `ListFiles(ctx, projectID, id) ([]SkillFileInfo, error)` to interface + implementation. Fetches skill for `DiskID`, lists all artifacts, maps each to `SkillFileInfo{Path: joinSkillPath(...), MIME: ..., S3Key: ...}`.
  - `src/server/api/go/internal/modules/service/agent_skills.go`

### 9. Handler: rewrite `DownloadToSandbox`
- [x] Use `svc.GetByID` for skill name/description. Use `svc.ListFiles` for file list with S3 keys. Build `destPath = baseDirPath + "/" + file.Path` (pre-joined). Keep 409 conflict check. Keep `errgroup` with limit 10. No handler dependency changes needed.
  - `src/server/api/go/internal/modules/handler/agent_skills.go`

### 10. DI Container: update wiring
- [x] Update `AgentSkillsRepo` provider: `repo.NewAgentSkillsRepo(db)` (remove S3). Update `AgentSkillsService` provider: `service.NewAgentSkillsService(repo, diskSvc, artifactSvc)` (replace S3 with DiskService + ArtifactService). No handler provider changes.
  - `src/server/api/go/internal/bootstrap/container.go`

### 11. Service tests: full rewrite
- [x] Full rewrite of `testAgentSkillsService` — the current test has a struct that duplicates entire service business logic (~180 lines). **Recommended**: test the real `agentSkillsService` with mocked deps instead. Remove `MockAgentSkillsS3`. Add `MockDiskService` (Create, Delete). Add `MockArtifactService` (CreateFromBytes, ListByPath, GetByPath, GetFileContent, GetPresignedURL). Keep all existing test scenarios. Add test for `ListFiles()`.
  - `src/server/api/go/internal/modules/service/agent_skills_test.go`

### 12. Handler tests: minimal mock plumbing only (regression gate)
- [x] The handler tests are the **regression gate** proving the API contract is unchanged. **All HTTP assertions (status codes, response shapes, error messages) must remain identical.** Only update internal mock plumbing forced by model changes:
  - Add `ListFiles` method to `MockAgentSkillsService` (new interface method).
  - In `createTestAgentSkills()`: remove `AssetMeta` field, change `FileIndex` from `datatypes.NewJSONType([]model.FileInfo{...})` to `[]model.FileInfo{...}`, add `DiskID: uuid.New()`.
  - In `createEmptySkill()` (DownloadToSandbox test): same changes — remove `AssetMeta`, change `FileIndex` to `[]model.FileInfo{}`, add `DiskID: uuid.New()`.
  - In `TestAgentSkillsHandler_CreateAgentSkill`: update `expectedAgentSkills` and `expectedAgentSkillsWithOuterDir` to use `[]model.FileInfo{...}` instead of `datatypes.NewJSONType(...)`, add `DiskID`.
  - Remove `"gorm.io/datatypes"` import (no longer needed).
  - **DO NOT** change any `assert.*` calls, expected status codes, expected error strings, or response shape checks.
  - `src/server/api/go/internal/modules/handler/agent_skills_test.go`

### 13. AutoMigrate deprecation comment
- [x] Add comment near `AutoMigrate` call documenting that `agent_skills.asset_meta` and `agent_skills.file_index` DB columns are deprecated and safe to drop manually.
  - `src/server/api/go/internal/bootstrap/container.go`

---

## New Deps

None. All dependencies (`DiskService`, `ArtifactService`) already exist in the codebase.

---

## Test Cases

### Helper Functions
- [x] `splitSkillPath` — root file: `"SKILL.md"` → `("/", "SKILL.md")`
- [x] `splitSkillPath` — nested file: `"a/b/c/file.txt"` → `("/a/b/c/", "file.txt")`
- [x] `splitSkillPath` — single dir: `"scripts/main.py"` → `("/scripts/", "main.py")`
- [x] `joinSkillPath` — root: `("/", "SKILL.md")` → `"SKILL.md"`
- [x] `joinSkillPath` — nested: `("/scripts/", "main.py")` → `"scripts/main.py"`
- [x] `joinSkillPath` roundtrip: `joinSkillPath(splitSkillPath(path))` == original `path` for various inputs

### Service — Create
- [x] Create skill → verify Disk created, all ZIP files become Artifacts with correct `(Path, Filename)`, response has correct `file_index` (as `[]FileInfo`, not nil)
- [x] Create skill — response `file_index` is array → verify JSON marshaling produces `"file_index": [...]` not `"file_index": null`
- [x] Create skill — name sanitization → verify names with spaces/special chars sanitized via `sanitizeS3Key`
- [x] Create with invalid ZIP → verify error before Disk creation (steps 1-2 fail before step 4), no cleanup needed
- [x] Create with missing SKILL.md → verify error before Disk creation (step 1 fails), no cleanup needed
- [x] Create failure mid-upload → verify partial artifacts + Disk cleaned up by defer (`success` flag stays false)
- [x] Create failure on skill DB insert → verify Disk cleaned up by defer (Disk created, skill was not)
- [x] Create skill with only `SKILL.md` (no other files) → verify `file_index` contains single entry `[{path: "SKILL.md", mime: "text/markdown"}]`, Disk has one Artifact

### Service — GetByID / List / Delete / GetFile / ListFiles
- [x] Get skill by ID → verify `file_index` populated from Disk artifacts, is `[]FileInfo{}` (not nil) when empty
- [x] List skills → verify `file_index` NOT in list items (computed field not populated for list)
- [x] Delete skill → verify skill record deleted first, then Disk deleted, all Artifacts cleaned up
- [x] Get file (text) → verify parsed content returned via `ArtifactService.GetFileContent`
- [x] Get file (binary) → verify presigned URL returned via `ArtifactService.GetPresignedURL`
- [x] Get file with nested path → `scripts/sub/file.py` resolves to artifact `(Path="/scripts/sub/", Filename="file.py")`
- [x] ListFiles → verify returns `[]SkillFileInfo` with pre-joined paths and correct S3 keys
- [x] Create + Delete in same test → verify cleanup (workspace rule)

### Handler — DownloadToSandbox
- [x] Download to sandbox → verify files downloaded using `ListFiles()` return values at correct paths
- [x] Download to sandbox — empty skill → verify success response with empty file list (no sandbox ops)
- [x] Download to sandbox — conflict → verify 409 when skill directory already exists

---

## Edge Cases & Considerations

1. **Path convention**: Artifact unique constraint is `(disk_id, path, filename)`. `splitSkillPath()` must produce leading `/` and trailing `/` for directory paths, and `/` for root. **Use `path.Dir`/`path.Base`** (not `filepath`).

2. **ListByPath with empty string**: Pass `""` to list ALL artifacts. `"/"` only returns root-level.

3. **`CreateFromBytes` requires `ProjectID`**: For S3 path construction and asset reference tracking.

4. **Concurrent uploads with `errgroup`**: `errgroup.WithContext(ctx)` cancels remaining goroutines on first error. `g.Wait()` blocks until ALL complete before defer runs — no race condition.

5. **Delete ordering**: Skill record first, then Disk. `OnDelete:CASCADE` on the FK is a safety net, not the primary delete path.

6. **DownloadToSandbox S3 key**: S3 keys come from `artifact.AssetMeta.Data().S3Key` via `ListFiles()`. The key format changes from `agent_skills/...` to the Artifact system's content-hash-based format, but `UploadSandboxFile` treats it as an opaque string — fully compatible.

7. **`file_index` in List endpoint**: Computed field naturally excluded — `GetByID` populates it, `ListWithCursor` does not.

8. **Data migration (if production data exists)**: Create Disk per skill, re-upload files via `CreateFromBytes`, set `disk_id`, clean old S3 objects.

9. **`repo.Update()` unused in create path**: Keep method for future use but not called during creation.

10. **`FileIndex` JSON serialization**: Always initialize as `[]FileInfo{}` — nil slice serializes as `null`.

11. **MIME detection change**: New flow uses `s3.UploadBytes` detection instead of `mime.DetectMimeType`. Minor differences possible.

12. **Disk UserID**: Pass skill's `UserID` to `DiskService.Create` for ownership consistency.

13. **Orphan Disk cleanup**: `defer` with `success` flag after disk creation. Flag naturally handles the case where disk creation itself fails (defer not yet registered).

14. **SKILL.md-only ZIP**: A ZIP containing only `SKILL.md` and no other files is valid. `FileIndex` will contain a single entry. No special-casing needed.

15. **AutoMigrate NOT NULL caveat**: Adding `DiskID` as NOT NULL on a table with existing rows will fail. Safe for production (no skill data exists), but staging/dev may need table truncation or a two-step migration (nullable → backfill → NOT NULL).

---

## Appendix: DB Migration Notes

The project uses **GORM AutoMigrate**. Since there is no production data with existing skills, we use a clean-cut approach:

- Add `DiskID uuid.UUID` as **NOT NULL** — AutoMigrate adds the column
- Remove `AssetMeta` and `FileIndex` from the GORM model — AutoMigrate won't drop DB columns automatically, the orphaned columns are harmless

> **Caveat**: Adding a `NOT NULL` column via AutoMigrate on a table with existing rows will fail (no default value). This is safe for now because there is no production skill data. If staging or dev environments have test skills, either truncate the `agent_skills` table before deploying, or temporarily add the column as nullable (`gorm:"type:uuid"`) and enforce NOT NULL in a follow-up migration after backfilling.

- Add deprecation comment in `container.go`:
  ```go
  // NOTE: agent_skills.asset_meta and agent_skills.file_index columns are
  // deprecated as of the Disk migration. They are no longer used by the
  // application. Safe to drop manually:
  //   ALTER TABLE agent_skills DROP COLUMN IF EXISTS asset_meta;
  //   ALTER TABLE agent_skills DROP COLUMN IF EXISTS file_index;
  ```

---

## Impact Files

### Must change
| File | Change |
|------|--------|
| `src/server/api/go/internal/modules/model/agent_skills.go` | Remove AssetMeta, FileIndex, GetFileS3Key; add DiskID + Disk relationship |
| `src/server/api/go/internal/modules/repo/agent_skills.go` | Remove S3 dep, simplify Delete (DB-only) |
| `src/server/api/go/internal/modules/service/agent_skills.go` | Rewrite Create/GetByID/Delete/GetFile; add ListFiles; add path helpers |
| `src/server/api/go/internal/modules/handler/agent_skills.go` | Rewrite DownloadToSandbox to use ListFiles |
| `src/server/api/go/internal/bootstrap/container.go` | Update DI wiring + add deprecation comment |
| `src/server/api/go/internal/modules/service/agent_skills_test.go` | Full rewrite: replace S3 mocks with DiskService + ArtifactService mocks |
| `src/server/api/go/internal/modules/handler/agent_skills_test.go` | Update mock service, add ListFiles expectations |

### No change expected
| File | Reason |
|------|--------|
| `src/server/api/go/internal/modules/service/disk.go` | Used as-is |
| `src/server/api/go/internal/modules/service/artifact.go` | Used as-is |
| `src/server/api/go/internal/modules/repo/artifact.go` | `ListByPath(diskID, "")` already works |
| `src/server/api/go/internal/modules/repo/disk.go` | Used as-is |
| `src/server/api/go/internal/router/router.go` | No route changes |
| `src/server/api/go/internal/modules/model/artifact.go` | No model changes |
| `src/server/core/` | No ORM models for agent_skills in CORE |
| `src/client/acontext-py/src/acontext/types/skill.py` | Added `disk_id` field to `Skill` model |
| `src/client/acontext-ts/src/types/skill.ts` | Added `disk_id` field to `SkillSchema` |
