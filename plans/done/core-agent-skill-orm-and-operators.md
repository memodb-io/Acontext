# Plan: Add Agent Skill Table (ORM) and Related Operators in Core

## Features / Show case

- **Read-only skill access from Core**: Core can query the existing `agent_skills` table (created and owned by the API) to fetch skill metadata by ID. This supports future CORE features (e.g. agent flows that need skill name/description/disk_id).
- **ORM sync with API**: Add SQLAlchemy ORM models in Core that mirror the API's GORM schemas: `AgentSkill`, **Disk**, and **Artifact** (per AGENTS.md: "Sync ORMs between API and CORE"). Skill storage lives on Disk; skill files are Artifacts on that disk, so Core needs Disk and Artifact ORM + read-only operators too.
- **Data layer operators**: Add async data-layer functions for skills (get, **create from SKILL.md content**) and for **Disk** (get, create) and **Artifact** (get by path, list by path, glob by pattern, grep by content, **upsert**) so Core can e.g. build a skill's file list, resolve S3 keys for sandbox, search skill files by name/content, write artifact records, or programmatically create skills from content — all without calling the API.
- **Create skill from content**: A composite operator that takes a raw SKILL.md content string, parses its YAML front matter (name + description), creates a Disk, stores the content as an Artifact, and creates the AgentSkill record — enabling agent flows to programmatically generate skills.

**Out of scope**: Delete/Update of skills and disks remain in the API only. Core does not add HTTP routes for skills/disks/artifacts unless a separate task does so. S3 upload is not part of the artifact upsert or create_skill operators — the SKILL.md content is stored inline in `asset_meta.content`.

---

## Design overview

### Ownership model

The `agent_skills`, `disks`, and `artifacts` tables are **created and owned by the API** (GORM AutoMigrate). Core uses the same PostgreSQL DB and **maps** the existing tables. Core can both read and write these tables (e.g. `create_skill`, `create_disk`, `upsert_artifact`), but the API remains the primary owner for schema migrations.

Key implications:
- Core's `create_tables()` runs `ORM_BASE.metadata.create_all()` with `checkfirst=True` (default), so adding these ORMs is safe — SQLAlchemy will not recreate existing tables.
- All relationships from Core must use `passive_deletes=True` with **no cascade** (unlike Core-owned tables like Session/Task which use `cascade="all, delete-orphan"`).
- Core must not define `ForeignKey` to tables it doesn't have an ORM for (e.g. `users`). Nullable `user_id` columns are plain UUID columns in Core.
- Core write operators (`create_skill`, `create_disk`, `upsert_artifact`) do not manage S3 uploads or asset reference counting — those are API-side concerns. Core stores text content inline in `asset_meta.content`.

### Schema: `agent_skills` (mirror of API)

API model: `src/server/api/go/internal/modules/model/agent_skills.go`

| Column       | API (GORM)                    | Core (SQLAlchemy) equivalent        |
|-------------|--------------------------------|------------------------------------|
| `id`        | `uuid PK, default:gen_random_uuid()` | Via `CommonMixin` |
| `project_id`| `uuid NOT NULL, index, FK→projects (CASCADE)` | `UUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True` |
| `user_id`   | `*uuid, index` (FK via GORM relationship to User) | `UUID, nullable=True, index=True` (no FK — no User ORM in Core) |
| `name`      | `text NOT NULL`               | `String (text), nullable=False`    |
| `description` | `text`                      | `String (text), nullable=True`     |
| `disk_id`   | `uuid NOT NULL` (FK via GORM relationship to Disk, onDelete:CASCADE) | `UUID, ForeignKey("disks.id", ondelete="CASCADE"), nullable=False` |
| `meta`      | `jsonb`                       | `JSONB, nullable=True`            |
| `created_at`| `timestamp NOT NULL, autoCreateTime, default:CURRENT_TIMESTAMP` | Via `CommonMixin` |
| `updated_at`| `timestamp NOT NULL, autoUpdateTime, default:CURRENT_TIMESTAMP` | Via `CommonMixin` |

- **Not in Core ORM**: `file_index` — API exposes it as `gorm:"-"` (computed from Disk Artifacts at query time). Core can compute it using Artifact operators (`list_artifacts_by_path(disk_id, "")`).
- **Relationships**: `project` → `relationship("Project", back_populates="agent_skills")`, `disk` → `relationship("Disk", back_populates="agent_skills")`. Both with `passive_deletes=True`, no cascade.
- **Class name**: `AgentSkill` (singular, Python convention). API uses `AgentSkills` (plural Go struct).

### Schema: `disks` (mirror of API)

API model: `src/server/api/go/internal/modules/model/artifact.go` (Disk struct).

| Column       | API (GORM)                    | Core (SQLAlchemy) |
|-------------|--------------------------------|-------------------|
| `id`        | `uuid PK, default:gen_random_uuid()` | Via `CommonMixin` |
| `project_id`| `uuid NOT NULL, index, FK→projects (CASCADE)` | `UUID, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True` |
| `user_id`   | `*uuid, index` (FK via GORM relationship to User) | `UUID, nullable=True, index=True` (no FK in Core) |
| `created_at`| `timestamp NOT NULL, autoCreateTime, default:CURRENT_TIMESTAMP` | Via `CommonMixin` |
| `updated_at`| `timestamp NOT NULL, autoUpdateTime, default:CURRENT_TIMESTAMP` | Via `CommonMixin` |

- **Relationships**: `project` → `relationship("Project", back_populates="disks")`, `artifacts` → `relationship("Artifact", back_populates="disk")`, `agent_skills` → `relationship("AgentSkill", back_populates="disk")`. All with `passive_deletes=True`, no cascade.

### Schema: `artifacts` (mirror of API)

API model: `src/server/api/go/internal/modules/model/artifact.go` (Artifact struct). Asset shape: `asset_reference.go` (Asset struct).

| Column       | API (GORM)                    | Core (SQLAlchemy) |
|-------------|--------------------------------|-------------------|
| `id`        | `uuid PK, default:gen_random_uuid()` | Via `CommonMixin` |
| `disk_id`   | `uuid NOT NULL, index, uniqueIndex:idx_disk_path_filename` | `UUID, ForeignKey("disks.id", ondelete="CASCADE"), nullable=False, index=True` |
| `path`      | `text NOT NULL, uniqueIndex:idx_disk_path_filename` (dir part, e.g. `/` or `/scripts/`) | `String(text), nullable=False` |
| `filename`  | `text NOT NULL, uniqueIndex:idx_disk_path_filename` | `String(text), nullable=False` |
| `meta`      | `jsonb`                       | `JSONB, nullable=True` |
| `asset_meta`| `jsonb NOT NULL` (JSONType[Asset]) | `JSONB, nullable=False` — store as dict; callers access keys directly (`s3_key`, `mime`, `size_b`, etc.) |
| `created_at`| `timestamp NOT NULL, autoCreateTime, default:CURRENT_TIMESTAMP` | Via `CommonMixin` |
| `updated_at`| `timestamp NOT NULL, autoUpdateTime, default:CURRENT_TIMESTAMP` | Via `CommonMixin` |

- **Unique constraint**: `UniqueConstraint("disk_id", "path", "filename", name="idx_disk_path_filename")` in `__table_args__` to match the API's composite unique index.
- **Asset shape** (for reading `asset_meta`): `{"bucket": str, "s3_key": str, "etag": str, "sha256": str, "mime": str, "size_b": int, "content": str (optional)}`. Core only reads; no need to mirror the `asset_references` table.
- **Note on existing `Asset` Pydantic model**: Core already has an `Asset` class in `schema/orm/message.py` (used for Message `parts`), but it lacks the `content` field that the API's `Asset` struct has (`Content string \`json:"content,omitempty"\``). The Artifact's `asset_meta` column is stored as a raw `dict`/JSONB — **not** typed via the existing `Asset` model — so this discrepancy is harmless. If Core ever needs a typed Pydantic model for artifact assets, either extend the existing `Asset` with an optional `content: Optional[str] = None` field, or create a separate `ArtifactAsset` model. For now, raw dict access is sufficient.
- **Relationships**: `disk` → `relationship("Disk", back_populates="artifacts")` with `passive_deletes=True`, no cascade.

### Data layer (operators)

- **Location**: `acontext_core/service/data/agent_skill.py`, `disk.py`, `artifact.py` (new files).
- **Pattern**: Async functions taking `AsyncSession` and IDs (typed as `asUUID`), returning `Result[T]`, consistent with `project.py`, `session.py`, `task.py`. Most operators are read-only; write operators are `create_skill`, `create_disk`, and `upsert_artifact`.
- **Not-found handling**: Use `Result.reject(msg)` for not-found cases, consistent with `fetch_session` in `session.py` and `get_project_config` in `project.py`.

**Skill operators**

| Operator | Purpose |
|----------|--------|
| `get_agent_skill(db_session, project_id, skill_id) -> Result[AgentSkill]` | Fetch one skill by project and skill id. Returns the ORM instance. Rejects if not found. |
| `create_skill(db_session, project_id, content, *, user_id=None, meta=None) -> Result[AgentSkill]` | **Write. Composite.** Parse `content` as SKILL.md (YAML front matter → name, description). Create a Disk, upsert the SKILL.md as an Artifact on that disk, create the AgentSkill record. Returns the created skill. Rejects if SKILL.md parsing fails (missing name or description). |

**Disk operators**

| Operator | Purpose |
|----------|--------|
| `get_disk(db_session, project_id, disk_id) -> Result[Disk]` | Fetch one disk by project and disk id. Rejects if not found. |
| `create_disk(db_session, project_id, *, user_id=None) -> Result[Disk]` | **Write.** Insert a new Disk record for a project. Returns the created Disk instance. |

**Artifact operators**

| Operator | Purpose |
|----------|--------|
| `get_artifact_by_path(db_session, disk_id, path, filename) -> Result[Artifact]` | Fetch one artifact by disk and path/filename. Rejects if not found. Used to resolve S3 key for a skill file. |
| `list_artifacts_by_path(db_session, disk_id, path="") -> Result[List[Artifact]]` | List artifacts in a disk; empty `path` means all artifacts (matches API `ListByPath(diskID, "")`). Used to build skill file_index. Always resolves (empty list if none). |
| `glob_artifacts(db_session, disk_id, pattern) -> Result[List[Artifact]]` | Match artifacts by glob pattern against their full path (`path` + `filename`). Translates glob syntax (`*`, `?`, `**`) to SQL `LIKE`/`ILIKE`. E.g. `*.py` finds all Python files, `scripts/*.sh` finds shell scripts under `scripts/`. Always resolves (empty list if no matches). |
| `grep_artifacts(db_session, disk_id, query, *, case_sensitive=False) -> Result[List[Artifact]]` | Search artifact text content via `asset_meta->>'content'` JSONB extraction. Uses SQL `LIKE`/`ILIKE` for substring match. Only returns artifacts whose `asset_meta.content` is non-null and contains the query string. Always resolves (empty list if no matches). |
| `upsert_artifact(db_session, disk_id, path, filename, asset_meta, *, meta=None) -> Result[Artifact]` | **Write.** Insert a new artifact or update an existing one matched by `(disk_id, path, filename)`. Uses PostgreSQL `INSERT ... ON CONFLICT (disk_id, path, filename) DO UPDATE SET asset_meta=..., meta=..., updated_at=now()`. Callers must upload to S3 first and pass the resulting `asset_meta` dict. Returns the upserted ORM instance. |

Return types: Return ORM instances for flexibility; callers can map to schemas if needed.

**Glob pattern translation**: Convert glob to SQL LIKE in two steps: (1) escape literal `%` and `_` in the input pattern (these are SQL LIKE metacharacters), (2) then replace glob wildcards — `**` → `%`, `*` → `%`, `?` → `_`. The `**` replacement must happen before `*` (or simply replace all `*` globally since both map to `%`). The full path for matching is constructed as `path || filename` (both are text columns). Since the `path` column already encodes directory structure (e.g. `/scripts/`), `**` naturally matches across directories.

**Grep limitation**: Only searches the `content` field inside `asset_meta` JSONB, which is populated for text-searchable files (`text/*`, `application/json`, `application/x-*`). Binary files without `content` are silently excluded.

**Upsert strategy**: The API uses a delete-then-create pattern (to handle S3 asset reference counting). Core uses a simpler PostgreSQL `ON CONFLICT DO UPDATE` since Core doesn't manage asset references — the caller is responsible for S3 upload and asset reference bookkeeping. The upsert updates `asset_meta`, `meta`, and `updated_at` on conflict; `id` and `created_at` are preserved for existing rows. After executing the upsert statement, do a follow-up `get_artifact_by_path` query to return a full ORM instance (do **not** use `returning()` — it returns a `Row`, not an ORM-mapped instance in SQLAlchemy async).

**`create_skill` flow** (mirrors API's `agentSkillsService.Create` but from a content string instead of a zip):

1. **Parse SKILL.md** — Extract YAML front matter from `content` using `_parse_skill_md(content) -> (name, description)`. The parser follows the same logic as the API's `extractYAMLFrontMatter`: looks for `---` delimiters; if found, extracts YAML between them; if not found, treats entire content as YAML. Then parses `name` and `description` fields. Rejects if either is missing.
2. **Sanitize name** — Replace special characters (`/ \ : * ? " < > |` and spaces) with `-`, same as API's `sanitizeS3Key`.
3. **Create Disk** — Call `create_disk(db_session, project_id, user_id=user_id)`.
4. **Upsert SKILL.md artifact** — Call `upsert_artifact(db_session, disk_id, "/", "SKILL.md", asset_meta)` where `asset_meta = {"bucket": "", "s3_key": "", "etag": "", "sha256": sha256(content), "mime": "text/markdown", "size_b": len(content_bytes), "content": content}`. No S3 upload — content is stored inline.
5. **Create AgentSkill record** — Insert `AgentSkill(project_id, user_id, name, description, disk_id, meta)` via `session.add()` + `flush()`.
6. **Return** the created `AgentSkill` via `Result.resolve(skill)`.

All steps use the same `db_session` — if any step fails, the session's transaction rolls back everything (the caller's `get_session_context()` handles commit/rollback).

**`_parse_skill_md` helper** — Private function in `service/data/agent_skill.py`. Uses `pyyaml` (`yaml.safe_load`) which is already a Core dependency (`pyyaml>=6.0.2` in `pyproject.toml`). Returns `(name: str, description: str)` or raises `ValueError` on parse failure. Note: `description` is **required** by this parser even though the DB column is nullable — this is a deliberate business-logic choice: skills created programmatically from content should always have a description. Skills created via the API (zip upload) may have nullable descriptions through a different code path.

### Files to add/change

| File | Action |
|------|--------|
| `src/server/core/acontext_core/schema/orm/agent_skill.py` | **New** — AgentSkill ORM model. |
| `src/server/core/acontext_core/schema/orm/disk.py` | **New** — Disk ORM model. |
| `src/server/core/acontext_core/schema/orm/artifact.py` | **New** — Artifact ORM model. |
| `src/server/core/acontext_core/schema/orm/__init__.py` | **Update** — Export `AgentSkill`, `Disk`, `Artifact`; add to `__all__`. |
| `src/server/core/acontext_core/schema/orm/project.py` | **Update** — Add `agent_skills`, `disks` relationships (passive_deletes, no cascade). |
| `src/server/core/acontext_core/service/data/agent_skill.py` | **New** — `get_agent_skill`, `create_skill`, `_parse_skill_md`. |
| `src/server/core/acontext_core/service/data/disk.py` | **New** — `get_disk`, `create_disk`. |
| `src/server/core/acontext_core/service/data/artifact.py` | **New** — `get_artifact_by_path`, `list_artifacts_by_path`, `glob_artifacts`, `grep_artifacts`, `upsert_artifact`. |
| `src/server/core/tests/service/test_agent_skill_data.py` | **New** — Tests for `get_agent_skill`, `create_skill`, `_parse_skill_md`. |
| `src/server/core/tests/service/test_disk_data.py` | **New** — Tests for `get_disk`, `create_disk`. |
| `src/server/core/tests/service/test_artifact_data.py` | **New** — Tests for `get_artifact_by_path`, `list_artifacts_by_path`, `glob_artifacts`, `grep_artifacts`, `upsert_artifact`, and integration test (skill file list). |

---

## TODOs

**AgentSkill ORM and data**

- [x] **AgentSkill ORM model** — Create `agent_skill.py` under `acontext_core/schema/orm/`. Use `@ORM_BASE.mapped` + `@dataclass` + inherit `CommonMixin`. Table name `agent_skills`. Columns (via `field(metadata={"db": Column(...)})`) : `project_id` (UUID FK→projects.id, ondelete CASCADE, nullable=False, index=True), `user_id` (UUID, nullable=True, index=True, **no FK** — no User ORM in Core), `name` (String/text, nullable=False), `description` (String/text, nullable=True), `disk_id` (UUID FK→disks.id, ondelete CASCADE, nullable=False), `meta` (JSONB, nullable=True). `id`, `created_at`, `updated_at` come from `CommonMixin`. Relationships: `project` (back_populates="agent_skills", passive_deletes=True), `disk` (back_populates="agent_skills", passive_deletes=True). No `file_index` field.  
  - Files: `src/server/core/acontext_core/schema/orm/agent_skill.py`

- [x] **Project relationships** — Add to `Project` ORM: `agent_skills: List["AgentSkill"]` and `disks: List["Disk"]` using `field(default_factory=list, metadata={"db": relationship(..., back_populates="project", passive_deletes=True)})`. **Do NOT use** `cascade="all, delete-orphan"` — these tables are owned by the API. Add `TYPE_CHECKING` imports for `AgentSkill` and `Disk`.  
  - Files: `src/server/core/acontext_core/schema/orm/project.py`

- [x] **ORM exports** — Import `AgentSkill`, `Disk`, `Artifact` in `schema/orm/__init__.py` and add to `__all__`.  
  - Files: `src/server/core/acontext_core/schema/orm/__init__.py`

- [x] **Data: get_agent_skill** — Create `agent_skill.py` under `acontext_core/service/data/`. Implement `get_agent_skill(db_session: AsyncSession, project_id: asUUID, skill_id: asUUID) -> Result[AgentSkill]` using `select(AgentSkill).where(AgentSkill.id == skill_id, AgentSkill.project_id == project_id)`, `result.scalars().first()`. Return `Result.resolve(skill)` if found, `Result.reject(f"AgentSkill {skill_id} not found")` if not.  
  - Files: `src/server/core/acontext_core/service/data/agent_skill.py`

- [x] **Helper: _parse_skill_md** — In the same file, implement `_parse_skill_md(content: str) -> tuple[str, str]`. Logic: split `content` by lines, find first `---` line, find second `---` line; if both found extract YAML between them, otherwise treat entire content as YAML. Parse with `yaml.safe_load()`. Return `(name, description)`. Raise `ValueError` if `name` or `description` is missing/empty. Catch `yaml.YAMLError` and re-raise as `ValueError` with a descriptive message. Extra fields in the YAML front matter are silently ignored. This mirrors the API's `extractYAMLFrontMatter` + `SkillMetadata` validation.  
  - Files: `src/server/core/acontext_core/service/data/agent_skill.py`

- [x] **Data: create_skill** — In the same file, implement `create_skill(db_session: AsyncSession, project_id: asUUID, content: str, *, user_id: Optional[asUUID] = None, meta: Optional[dict] = None) -> Result[AgentSkill]`. Steps: (1) call `_parse_skill_md(content)` → catch `ValueError` and return `Result.reject(...)` on failure; (2) sanitize name (replace `/ \ : * ? " < > |` and spaces with `-`); (3) call `create_disk(db_session, project_id, user_id=user_id)` → unpack result, reject on error; (4) build `asset_meta = {"bucket": "", "s3_key": "", "etag": "", "sha256": hashlib.sha256(content.encode()).hexdigest(), "mime": "text/markdown", "size_b": len(content.encode()), "content": content}`; (5) call `upsert_artifact(db_session, disk.id, "/", "SKILL.md", asset_meta)` → unpack, reject on error; (6) create `AgentSkill(project_id=project_id, user_id=user_id, name=sanitized_name, description=description, disk_id=disk.id, meta=meta)`, `session.add(skill)`, `await session.flush()`; (7) return `Result.resolve(skill)`. Import `hashlib` for SHA256 and `yaml` for parsing.  
  - Files: `src/server/core/acontext_core/service/data/agent_skill.py`

**Disk ORM and data**

- [x] **Disk ORM model** — Create `disk.py` under `acontext_core/schema/orm/`. Use `@ORM_BASE.mapped` + `@dataclass` + inherit `CommonMixin`. Table name `disks`. Columns: `project_id` (UUID FK→projects.id, ondelete CASCADE, nullable=False, index=True), `user_id` (UUID, nullable=True, index=True, **no FK**). Relationships: `project` (back_populates="disks", passive_deletes=True), `artifacts` (back_populates="disk", passive_deletes=True), `agent_skills` (back_populates="disk", passive_deletes=True).  
  - Files: `src/server/core/acontext_core/schema/orm/disk.py`

- [x] **Data: get_disk** — Create `disk.py` under `acontext_core/service/data/`. Implement `get_disk(db_session: AsyncSession, project_id: asUUID, disk_id: asUUID) -> Result[Disk]`. Return `Result.reject(...)` if not found.  
  - Files: `src/server/core/acontext_core/service/data/disk.py`

- [x] **Data: create_disk** — In the same file, implement `create_disk(db_session: AsyncSession, project_id: asUUID, *, user_id: Optional[asUUID] = None) -> Result[Disk]`. Create `Disk(project_id=project_id, user_id=user_id)`, `session.add(disk)`, `await session.flush()` (to populate `id` and timestamps). Return `Result.resolve(disk)`.  
  - Files: `src/server/core/acontext_core/service/data/disk.py`

**Artifact ORM and data**

- [x] **Artifact ORM model** — Create `artifact.py` under `acontext_core/schema/orm/`. Use `@ORM_BASE.mapped` + `@dataclass` + inherit `CommonMixin`. Table name `artifacts`. Columns: `disk_id` (UUID FK→disks.id, ondelete CASCADE, nullable=False, index=True), `path` (String/text, nullable=False), `filename` (String/text, nullable=False), `meta` (JSONB, nullable=True), `asset_meta` (JSONB, nullable=False). Add `__table_args__` with `UniqueConstraint("disk_id", "path", "filename", name="idx_disk_path_filename")`. Relationship: `disk` (back_populates="artifacts", passive_deletes=True).  
  - Files: `src/server/core/acontext_core/schema/orm/artifact.py`

- [x] **Data: get_artifact_by_path** — Create `artifact.py` under `acontext_core/service/data/`. Implement `get_artifact_by_path(db_session: AsyncSession, disk_id: asUUID, path: str, filename: str) -> Result[Artifact]`. Filter by `Artifact.disk_id == disk_id, Artifact.path == path, Artifact.filename == filename`. Return `Result.reject(...)` if not found.  
  - Files: `src/server/core/acontext_core/service/data/artifact.py`

- [x] **Data: list_artifacts_by_path** — In the same file, implement `list_artifacts_by_path(db_session: AsyncSession, disk_id: asUUID, path: str = "") -> Result[List[Artifact]]`. If `path` is empty, return all artifacts for the disk; otherwise filter by `Artifact.path == path`. Always `Result.resolve(list)` (empty list is valid).  
  - Files: `src/server/core/acontext_core/service/data/artifact.py`

- [x] **Data: glob_artifacts** — In the same file, implement `glob_artifacts(db_session: AsyncSession, disk_id: asUUID, pattern: str) -> Result[List[Artifact]]`. Convert the glob `pattern` to a SQL LIKE pattern: escape literal `%` and `_` in input, then replace `*` → `%` and `?` → `_`. Build a computed column `Artifact.path + Artifact.filename` and filter with `.like(sql_pattern)`. Filter by `Artifact.disk_id == disk_id`. Always `Result.resolve(list)`.  
  - Files: `src/server/core/acontext_core/service/data/artifact.py`

- [x] **Data: grep_artifacts** — In the same file, implement `grep_artifacts(db_session: AsyncSession, disk_id: asUUID, query: str, *, case_sensitive: bool = False) -> Result[List[Artifact]]`. Extract the text content column as `Artifact.asset_meta["content"].astext`. Filter: `disk_id` match, `asset_meta->>'content'` is not null, and content `.ilike(f"%{escaped_query}%")` (or `.like(...)` if `case_sensitive=True`). Escape `%`, `_` in the query string before wrapping. Always `Result.resolve(list)`.  
  - Files: `src/server/core/acontext_core/service/data/artifact.py`

- [x] **Data: upsert_artifact** — In the same file, implement `upsert_artifact(db_session: AsyncSession, disk_id: asUUID, path: str, filename: str, asset_meta: dict, *, meta: Optional[dict] = None) -> Result[Artifact]`. Use `insert(Artifact).values(disk_id=..., path=..., filename=..., asset_meta=..., meta=...).on_conflict_do_update(index_elements=["disk_id", "path", "filename"], set_={"asset_meta": asset_meta, "meta": meta, "updated_at": func.now()})` via `sqlalchemy.dialects.postgresql.insert`. After executing the upsert statement, call `get_artifact_by_path(db_session, disk_id, path, filename)` to return a full ORM instance (do **not** use `returning()` — it returns a `Row`, not an ORM-mapped instance). Return `Result.resolve(artifact)`.  
  - Files: `src/server/core/acontext_core/service/data/artifact.py`

**Tests**

- [x] **Test: agent_skill data operators** — Create test file with all AgentSkill test cases (see Test cases section below). Follow existing pattern: `DatabaseClient()` → `create_tables()` → `get_session_context()` → test logic → cleanup.  
  - Files: `src/server/core/tests/service/test_agent_skill_data.py`

- [x] **Test: disk data operators** — Create test file with all Disk test cases.  
  - Files: `src/server/core/tests/service/test_disk_data.py`

- [x] **Test: artifact data operators** — Create test file with all Artifact test cases including integration test.  
  - Files: `src/server/core/tests/service/test_artifact_data.py`

---

## New deps

None. Uses existing SQLAlchemy, `Result`, `asUUID`, `AsyncSession`, `JSONB`, `CommonMixin`, `ORM_BASE`, `pyyaml`, `hashlib` (stdlib).

---

## Test cases

All tests follow the existing pattern: `DatabaseClient()` → `create_tables()` → `get_session_context()` → test logic → **cleanup** (`session.delete(project)` before exiting, per `.cursorrules`). Cleanup relies on DB-level `ON DELETE CASCADE` (set by API's GORM migrations) since Core's relationships use `passive_deletes=True` — SQLAlchemy delegates cascading to PostgreSQL.

**AgentSkill**

- [x] **get_agent_skill — found**: Create a Project, a Disk, and an AgentSkill row. Call `get_agent_skill(project_id, skill_id)` → assert `result.ok()` and returned skill matches. Clean up: `session.delete(project)`.
- [x] **get_agent_skill — not found (wrong project)**: Create a Project and skill. Call with a different `project_id` → assert `not result.ok()`.
- [x] **get_agent_skill — not found (missing id)**: Call with a non-existent `skill_id` → assert `not result.ok()`.
- [x] **Relationship — Project.agent_skills**: Load a Project with `selectinload(Project.agent_skills)` → assert the skill appears in the list. Clean up: `session.delete(project)`.
- [x] **_parse_skill_md — with front matter**: Input `"---\nname: my-skill\ndescription: A test skill\n---\n# Body"` → returns `("my-skill", "A test skill")`.
- [x] **_parse_skill_md — without delimiters**: Input `"name: my-skill\ndescription: A test skill"` (plain YAML) → returns `("my-skill", "A test skill")`.
- [x] **_parse_skill_md — missing name**: Input `"---\ndescription: only desc\n---"` → raises `ValueError`.
- [x] **_parse_skill_md — missing description**: Input `"---\nname: no-desc\n---"` → raises `ValueError`.
- [x] **_parse_skill_md — empty content**: Input `""` → raises `ValueError`.
- [x] **_parse_skill_md — invalid YAML syntax**: Input `"---\nname: [invalid: yaml\n---"` (malformed YAML) → raises `ValueError` (wraps `yaml.YAMLError`).
- [x] **_parse_skill_md — extra fields ignored**: Input `"---\nname: s\ndescription: d\nversion: 1.0\n---"` → returns `("s", "d")` without error (extra fields are silently ignored).
- [x] **create_skill — success**: Provide valid SKILL.md content with name and description. Assert `result.ok()`. Assert returned skill has correct `name` (sanitized), `description`, `project_id`. Assert a Disk was created (`skill.disk_id` is valid). Assert SKILL.md artifact exists on that disk via `get_artifact_by_path(disk_id, "/", "SKILL.md")`. Assert artifact's `asset_meta["content"]` equals the original content. Clean up: `session.delete(project)`.
- [x] **create_skill — with meta and user_id**: Pass `meta={"version": "1.0"}` and `user_id`. Assert skill has the correct `meta` and `user_id`.
- [x] **create_skill — name sanitization**: Provide content with name `"my skill/v2"`. Assert returned skill's name is `"my-skill-v2"`.
- [x] **create_skill — invalid SKILL.md (missing name)**: Provide content without `name`. Assert `not result.ok()` with error message about missing name.
- [x] **create_skill — invalid SKILL.md (empty content)**: Provide empty string. Assert `not result.ok()`.
- [x] **create_skill — sha256 and size_b correctness**: Create a skill with known content. Fetch the SKILL.md artifact and verify `asset_meta["sha256"]` matches `hashlib.sha256(content.encode()).hexdigest()` and `asset_meta["size_b"]` matches `len(content.encode())`.

**Disk**

- [x] **get_disk — found**: Create a Project and Disk. Call `get_disk(project_id, disk_id)` → assert `result.ok()`. Clean up: `session.delete(project)`.
- [x] **get_disk — not found**: Call with wrong project or missing id → assert `not result.ok()`.
- [x] **create_disk — success**: Call `create_disk(project_id)`. Assert `result.ok()`, returned Disk has `project_id` set, `id` is a valid UUID, `created_at` is populated. Clean up: `session.delete(project)`.
- [x] **create_disk — with user_id**: Call `create_disk(project_id, user_id=some_uuid)`. Assert `user_id` is set on the returned Disk.

**Artifact**

- [x] **get_artifact_by_path — found**: Create a Project, Disk, and Artifact with known `path`/`filename`/`asset_meta`. Call `get_artifact_by_path(disk_id, path, filename)` → assert match. Verify `asset_meta` dict has expected keys (`s3_key`, `mime`, `size_b`). Clean up: `session.delete(project)`.
- [x] **get_artifact_by_path — not found**: Call with wrong path/filename → assert `not result.ok()`.
- [x] **list_artifacts_by_path — all**: Create multiple artifacts on one disk with different paths. Call with `path=""` → assert all returned.
- [x] **list_artifacts_by_path — filtered**: Call with a specific `path` → assert only matching artifacts returned.
- [x] **list_artifacts_by_path — empty disk**: Call on a disk with no artifacts → assert `result.ok()` with empty list.
- [x] **glob_artifacts — wildcard extension**: Create artifacts `main.py`, `utils.py`, `README.md` on a disk. Call `glob_artifacts(disk_id, "*.py")` → assert returns only `main.py` and `utils.py`.
- [x] **glob_artifacts — path prefix**: Create artifacts under paths `/` and `/scripts/`. Call `glob_artifacts(disk_id, "/scripts/*")` → assert returns only artifacts under `/scripts/`.
- [x] **glob_artifacts — single char wildcard**: Call `glob_artifacts(disk_id, "?.py")` → assert matches single-char filenames only (e.g. `a.py` but not `main.py`).
- [x] **glob_artifacts — recursive `**` pattern**: Create artifacts at paths `/SKILL.md`, `/scripts/run.sh`, `/scripts/lib/utils.py`. Call `glob_artifacts(disk_id, "**/*.py")` → assert returns only `utils.py`. Call `glob_artifacts(disk_id, "/scripts/**")` → assert returns both `run.sh` and `utils.py`.
- [x] **glob_artifacts — literal `%` and `_` in filenames**: Create an artifact with filename `100%_done.txt`. Call `glob_artifacts(disk_id, "*100%*")` → assert it matches (the `%` in the pattern is escaped as a literal before glob-to-LIKE conversion).
- [x] **glob_artifacts — no matches**: Call `glob_artifacts(disk_id, "*.rs")` on a disk with no `.rs` files → assert `result.ok()` with empty list.
- [x] **grep_artifacts — substring match**: Create artifacts with `asset_meta.content` containing `"def hello_world():"`. Call `grep_artifacts(disk_id, "hello_world")` → assert the artifact is returned.
- [x] **grep_artifacts — case insensitive (default)**: Create artifact with content `"Hello World"`. Call `grep_artifacts(disk_id, "hello world")` → assert match (case_sensitive=False by default).
- [x] **grep_artifacts — case sensitive**: Same setup. Call `grep_artifacts(disk_id, "hello world", case_sensitive=True)` → assert no match. Call with `"Hello World"` → assert match.
- [x] **grep_artifacts — skips binary (no content)**: Create an artifact with `asset_meta` that has no `content` key (binary file). Call `grep_artifacts(disk_id, "anything")` → assert that artifact is excluded from results.
- [x] **grep_artifacts — no matches**: Call with a query that doesn't appear in any artifact content → assert `result.ok()` with empty list.
- [x] **upsert_artifact — insert new**: Upsert an artifact on an empty disk. Assert `result.ok()`, returned artifact has correct `disk_id`, `path`, `filename`, `asset_meta`. Verify row exists via `get_artifact_by_path`. Clean up: `session.delete(project)`.
- [x] **upsert_artifact — update existing**: Insert an artifact, then upsert the same `(disk_id, path, filename)` with different `asset_meta` (e.g. new `s3_key`). Assert the returned artifact has the updated `asset_meta`. Assert only one row exists for that path (no duplicate). Assert `id` and `created_at` are preserved from the original insert.
- [x] **upsert_artifact — updates updated_at**: Insert, record `updated_at`. Upsert same path with new data. Assert `updated_at` has changed (is later than the original).
- [x] **upsert_artifact — meta handling**: Upsert with `meta={"key": "value"}`. Assert `meta` is stored. Upsert again with `meta=None`. Assert `meta` is now `None` (overwritten, not merged).

**Integration: Skill + Disk + Artifact**

- [x] **Skill file list**: Create a skill with a disk and artifacts. Call `get_agent_skill` → get `disk_id` → call `list_artifacts_by_path(disk_id, "")` → assert the artifact list matches the expected file set (paths + mime from `asset_meta`). Clean up: `session.delete(project)`.

---

## Sync with API (reminder)

- **AgentSkill**: `src/server/api/go/internal/modules/model/agent_skills.go`
- **Disk**: `src/server/api/go/internal/modules/model/artifact.go` (Disk struct)
- **Artifact**: `src/server/api/go/internal/modules/model/artifact.go` (Artifact struct)
- **Asset**: `src/server/api/go/internal/modules/model/asset_reference.go` (Asset struct for `asset_meta` shape)

Any future change to these tables or the Asset shape must be reflected in both API (GORM) and Core (SQLAlchemy) and in this plan.
