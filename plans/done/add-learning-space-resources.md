# Add Learning Spaces Resource

## Features / Showcase

Learning Spaces is a new first-class resource in Acontext that groups knowledge from sessions and skills into a cohesive "space" for agents to learn from. A learning space can **include skills** (immediately tracked) and **learn from sessions** (async extraction via CORE).

```python
# Python SDK (sync)
space = client.learning_spaces.create(user="alice", meta={"version": "1.0"})
spaces = client.learning_spaces.list(user="alice", limit=10)
spaces = client.learning_spaces.list(filter_by_meta={"version": "1.0"})  # meta tag filter
space = client.learning_spaces.get(space_id="...")
space = client.learning_spaces.update(space_id="...", meta={"version": "2.0"})  # patch meta
client.learning_spaces.delete(space_id="...")

# Learn from a session (async — creates a pending record, CORE processes it)
result = client.learning_spaces.learn(space_id="...", session_id="...")
sessions = client.learning_spaces.list_sessions(space_id="...")  # check learning status

# Manage skills in a space
client.learning_spaces.include_skill(space_id="...", skill_id="...")
skills = client.learning_spaces.list_skills(space_id="...")
client.learning_spaces.exclude_skill(space_id="...", skill_id="...")
```

```typescript
// TypeScript SDK
const space = await client.learningSpaces.create({ user: "alice", meta: { version: "1.0" } });
const spaceList = await client.learningSpaces.list({ user: "alice", limit: 10 });
const filtered = await client.learningSpaces.list({ filterByMeta: { version: "1.0" } });
const fetched = await client.learningSpaces.get("...");
const updated = await client.learningSpaces.update("...", { meta: { version: "2.0" } });
await client.learningSpaces.delete("...");

await client.learningSpaces.learn({ spaceId: "...", sessionId: "..." });
const sessions = await client.learningSpaces.listSessions("...");  // check learning status
await client.learningSpaces.includeSkill({ spaceId: "...", skillId: "..." });
const skills = await client.learningSpaces.listSkills("...");
await client.learningSpaces.excludeSkill({ spaceId: "...", skillId: "..." });
```

---

## Designs Overview

### Data Model

#### `learning_spaces` table

| Column      | Type      | Go Type              | Constraints                                   | Description                  |
|-------------|-----------|----------------------|------------------------------------------------|------------------------------|
| id          | uuid      | `uuid.UUID`          | PK, default gen_random_uuid()                  | Learning space ID            |
| project_id  | uuid      | `uuid.UUID`          | NOT NULL, FK projects(CASCADE), INDEX           | Owning project               |
| user_id     | uuid      | `*uuid.UUID`         | FK users(CASCADE), INDEX, NULLABLE              | Optional user association    |
| meta        | jsonb     | `datatypes.JSONMap`  | GIN index (`idx_ls_meta`)                       | Custom metadata              |
| created_at  | timestamp | `time.Time`          | NOT NULL, auto                                  | Creation time                |
| updated_at  | timestamp | `time.Time`          | NOT NULL, auto                                  | Last update time             |

#### `learning_space_skills` junction table

| Column            | Type      | Go Type      | Constraints                                          | Description              |
|-------------------|-----------|--------------|----------------------------------------------------- |--------------------------|
| id                | uuid      | `uuid.UUID`  | PK, default gen_random_uuid()                        | Junction record ID       |
| learning_space_id | uuid      | `uuid.UUID`  | NOT NULL, FK learning_spaces(CASCADE), INDEX          | Learning space reference |
| skill_id          | uuid      | `uuid.UUID`  | NOT NULL, FK agent_skills(CASCADE), INDEX             | Skill reference          |
| created_at        | timestamp | `time.Time`  | NOT NULL, auto                                        | When skill was added     |

**Unique constraint**: (`learning_space_id`, `skill_id`) — prevent duplicate skill-space associations.

**Cascade behavior**: `OnDelete:CASCADE` on `learning_space_id` FK — deleting a learning space automatically removes its skill associations. `OnDelete:CASCADE` on `skill_id` FK — deleting a skill automatically removes it from all spaces.

#### `learning_space_sessions` junction table

| Column            | Type      | Go Type      | Constraints                                          | Description              |
|-------------------|-----------|--------------|----------------------------------------------------- |--------------------------|
| id                | uuid      | `uuid.UUID`  | PK, default gen_random_uuid()                        | Junction record ID       |
| learning_space_id | uuid      | `uuid.UUID`  | NOT NULL, FK learning_spaces(CASCADE), INDEX          | Learning space reference |
| session_id        | uuid      | `uuid.UUID`  | NOT NULL, FK sessions(CASCADE), UNIQUE                | Session reference        |
| status            | text      | `string`     | NOT NULL, default "pending"                           | pending/completed/failed |
| created_at        | timestamp | `time.Time`  | NOT NULL, auto                                        | When learn was triggered |
| updated_at        | timestamp | `time.Time`  | NOT NULL, auto                                        | When status last changed |

**Unique constraint**: (`session_id`) — a session can only be learned by **one** learning space. Enforced at the DB level.

**Cascade behavior**: `OnDelete:CASCADE` on `learning_space_id` FK — deleting a learning space automatically removes its learn records. `OnDelete:CASCADE` on `session_id` FK — deleting a session automatically removes the learn record.

### API Endpoints

All endpoints are under `/api/v1/learning_spaces` with `ProjectAuth` middleware (Bearer token).

#### 1. Create Learning Space
```
POST /api/v1/learning_spaces
Content-Type: application/json

Request:
{
  "user": "alice@example.com",         // optional - resolve/create user
  "meta": {"version": "1.0"}          // optional
}

Response (201):
{
  "code": 0,
  "data": {
    "id": "uuid",
    "user_id": "uuid|null",
    "meta": {...},
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

#### 2. List Learning Spaces (with optional meta filter)
```
GET /api/v1/learning_spaces?user=alice&limit=20&cursor=...&time_desc=true&filter_by_meta={"version":"1.0"}

Query params:
  user             - optional, filter by user identifier
  limit            - optional, default 20, max 200
  cursor           - optional, pagination cursor (base64 of created_at|id)
  time_desc        - optional, order by created_at descending
  filter_by_meta   - optional, URL-encoded JSON for JSONB containment (@>) filter

Response (200):
{
  "code": 0,
  "data": {
    "items": [ { ...LearningSpace } ],
    "next_cursor": "string|null",
    "has_more": bool
  }
}
```

#### 3. Get Learning Space
```
GET /api/v1/learning_spaces/:id

Response (200):
{
  "code": 0,
  "data": { ...LearningSpace }
}

Error (404):
{
  "code": 404,
  "msg": "learning space not found"
}
```

#### 4. Delete Learning Space

Deletes the learning space row. Junction records (`learning_space_skills`, `learning_space_sessions`) are automatically removed via `ON DELETE CASCADE` on their FKs. Does **not** delete the actual skills or sessions themselves — they remain intact.

```
DELETE /api/v1/learning_spaces/:id

Response (200):
{
  "code": 0,
  "msg": "ok"
}

Error (404):
{
  "code": 404,
  "msg": "learning space not found"
}
```

#### 5. Update Learning Space (patch meta)

Merges the provided meta into the existing meta JSONB. Existing keys not in the request are preserved.

```
PATCH /api/v1/learning_spaces/:id
Content-Type: application/json

Request:
{
  "meta": {"version": "2.0", "new_key": "value"}   // required - merged into existing meta
}

Response (200):
{
  "code": 0,
  "data": {
    "id": "uuid",
    "user_id": "uuid|null",
    "meta": {...},           // full merged meta
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}

Error (404):
{
  "code": 404,
  "msg": "learning space not found"
}
```

#### 6. Learn from session

Creates an async learning record. The API inserts a `learning_space_sessions` row with `status: "pending"`. Actual knowledge extraction is deferred (future CORE integration via RabbitMQ).

> **Note**: In this initial implementation, the record stays in `pending` status. The async processing pipeline (CORE consuming from a queue, extracting knowledge, updating status to `completed`/`failed`) will be implemented in a follow-up plan.

```
POST /api/v1/learning_spaces/:id/learn
Content-Type: application/json

Request:
{
  "session_id": "uuid"   // required
}

Response (201):
{
  "code": 0,
  "data": {
    "id": "uuid",
    "learning_space_id": "uuid",
    "session_id": "uuid",
    "status": "pending",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}

Error (404) — space or session not found:
{
  "code": 404,
  "msg": "learning space not found" | "session not found"
}

Error (409) — session already belongs to a space:
{
  "code": 409,
  "msg": "session already learned by another space"
}
```

#### 7. Include Skill in Space
```
POST /api/v1/learning_spaces/:id/skills
Content-Type: application/json

Request:
{
  "skill_id": "uuid"   // required
}

Response (201):
{
  "code": 0,
  "data": {
    "id": "uuid",
    "learning_space_id": "uuid",
    "skill_id": "uuid",
    "created_at": "ISO8601"
  }
}

Error (404) — space or skill not found:
{
  "code": 404,
  "msg": "learning space not found" | "skill not found"
}

Error (409) — duplicate:
{
  "code": 409,
  "msg": "skill already included in this space"
}
```

#### 8. List Skills in Space
```
GET /api/v1/learning_spaces/:id/skills

Response (200):
{
  "code": 0,
  "data": [
    {
      "id": "skill-uuid",
      "name": "skill-name",
      "description": "...",
      "disk_id": "uuid",
      "file_index": [...],
      "meta": {...},
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}
```

> **Note**: Returns full `AgentSkills` data via JOIN. No pagination for now — expected skill count per space is small. Add pagination if needed later.

#### 9. Exclude Skill from Space

Removes the skill from this learning space's tracking list. Does **not** delete the skill itself. Silently succeeds if the skill was not associated (idempotent).

```
DELETE /api/v1/learning_spaces/:id/skills/:skill_id

Response (200):
{
  "code": 0,
  "msg": "ok"
}

Error (404) — space not found:
{
  "code": 404,
  "msg": "learning space not found"
}
```

#### 10. List Sessions in Space

Lists all sessions that this learning space has learned from, including their processing status.

```
GET /api/v1/learning_spaces/:id/sessions

Response (200):
{
  "code": 0,
  "data": [
    {
      "id": "junction-uuid",
      "learning_space_id": "uuid",
      "session_id": "uuid",
      "status": "pending|completed|failed",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ]
}

Error (404) — space not found:
{
  "code": 404,
  "msg": "learning space not found"
}
```

> **Note**: Returns `LearningSpaceSession` junction data (not full session objects). No pagination for now — expected count per space is small.

### Architecture (layered, following existing patterns)

```
HTTP → Handler → Service → Repo → DB (GORM/PostgreSQL)
```

- **Model**: GORM structs for `LearningSpace`, `LearningSpaceSkill`, `LearningSpaceSession`
- **Repo**: Interface + implementation with cursor-based pagination (same pattern as `session.go`)
- **Service**: Business logic, validation (existence checks via existing repos)
- **Handler**: Gin HTTP handlers, request binding, user resolution (same pattern as `agent_skills.go`), response serialization
- **Router**: Route group registration under `/learning_spaces`
- **DI Container**: Register repo → service → handler in `container.go`

### Key Design Decisions

1. **User resolution in Handler (Create only)** — Follows existing `agent_skills` pattern: handler resolves `user` string to `user_id` via `UserService.GetOrCreate()`, then passes `user_id` to service. For **List**, the raw `user` identifier string is passed to the repo, which does a `JOIN users` to filter (same pattern as `SessionRepo.ListWithCursor`).
2. **Meta JSONB filter** — Uses PostgreSQL `@>` containment operator, same pattern as session `filter_by_configs`. Requires GIN index on `meta` column for efficient queries.
3. **Cursor pagination** — Uses `created_at` + `id` composite cursor, same as sessions and skills. Service queries `limit+1` to determine `has_more`.
4. **Learn status lifecycle** — Initially always `pending`. The async CORE processing pipeline (status → `completed`/`failed`) is a **future follow-up**. `updated_at` on the junction table tracks status transitions.
5. **Delete via CASCADE** — Junction table FKs use `OnDelete:CASCADE`. Deleting a learning space row automatically removes its `learning_space_skills` and `learning_space_sessions` records via DB-level cascade. The underlying skills and sessions themselves are **never** deleted.
6. **One session, one space** — A session can only be learned by one learning space (enforced by `UNIQUE(session_id)` on the junction table). This is an intentional design constraint for this version.
7. **Idempotent ExcludeSkill** — Removing a skill that isn't associated with the space silently succeeds (no error). The space existence is still validated (404 if space not found).

---

## TODOs

### API (Go) — `src/server/api/go/`

- [x] **Define Models** — `internal/modules/model/learning_space.go`
  - `LearningSpace` struct with GORM tags matching existing patterns:
    - `ID uuid.UUID` — `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
    - `ProjectID uuid.UUID` — `gorm:"type:uuid;not null;index" json:"-"`
    - `UserID *uuid.UUID` — `gorm:"type:uuid;index" json:"user_id"`
    - `Meta datatypes.JSONMap` — `gorm:"type:jsonb;index:idx_ls_meta,type:gin" json:"meta"` (GIN index for `@>` queries)
    - `CreatedAt`, `UpdatedAt` time.Time — auto timestamps
    - GORM relationships (all `json:"-"`):
      - `Project *Project` — `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
      - `User *User` — `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;"`
  - `LearningSpaceSkill` struct:
    - `ID uuid.UUID` — PK, gen_random_uuid
    - `LearningSpaceID uuid.UUID` — NOT NULL, index
    - `SkillID uuid.UUID` — NOT NULL, index
    - `CreatedAt` time.Time — auto
    - Unique index on (`learning_space_id`, `skill_id`) via `gorm:"uniqueIndex:idx_ls_skill_unique"`
    - GORM relationships (all `json:"-"`):
      - `LearningSpace *LearningSpace` — `constraint:OnDelete:CASCADE`
      - `Skill *AgentSkills` — `constraint:OnDelete:CASCADE`
  - `LearningSpaceSession` struct:
    - `ID uuid.UUID` — PK, gen_random_uuid
    - `LearningSpaceID uuid.UUID` — NOT NULL, index
    - `SessionID uuid.UUID` — NOT NULL, uniqueIndex
    - `Status string` — NOT NULL, default "pending"
    - `CreatedAt`, `UpdatedAt` time.Time — auto timestamps (tracks status changes)
    - GORM relationships (all `json:"-"`):
      - `LearningSpace *LearningSpace` — `constraint:OnDelete:CASCADE`
      - `Session *Session` — `constraint:OnDelete:CASCADE`
  - `TableName()` methods for all three: `"learning_spaces"`, `"learning_space_skills"`, `"learning_space_sessions"`

- [x] **Register AutoMigrate** — `internal/bootstrap/container.go`
  - Add `&model.LearningSpace{}`, `&model.LearningSpaceSkill{}`, `&model.LearningSpaceSession{}` to the AutoMigrate list

- [x] **Implement Repo** — `internal/modules/repo/learning_space.go`
  - `LearningSpaceRepo` interface:
    - `Create(ctx, *model.LearningSpace) error`
    - `GetByID(ctx, projectID, id uuid.UUID) (*model.LearningSpace, error)` — returns `gorm.ErrRecordNotFound` if not found
    - `Update(ctx, *model.LearningSpace) error`
    - `Delete(ctx, projectID, id uuid.UUID) error` — deletes the space row; junction records cascade-deleted by DB. Verify space exists first (return `gorm.ErrRecordNotFound` if not).
    - `ListWithCursor(ctx, projectID, userIdentifier string, filterByMeta map[string]interface{}, afterCreatedAt time.Time, afterID uuid.UUID, limit int, timeDesc bool) ([]*model.LearningSpace, error)`
  - `LearningSpaceSkillRepo` interface:
    - `Create(ctx, *model.LearningSpaceSkill) error`
    - `Delete(ctx, learningSpaceID, skillID uuid.UUID) error` — deletes junction record (no error if not found — idempotent)
    - `ListBySpaceID(ctx, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error)` — **JOIN** with `agent_skills` table to return full skill data
    - `Exists(ctx, learningSpaceID, skillID uuid.UUID) (bool, error)`
  - `LearningSpaceSessionRepo` interface:
    - `Create(ctx, *model.LearningSpaceSession) error`
    - `ExistsBySessionID(ctx, sessionID uuid.UUID) (bool, error)` — check if session is already learned by **any** space
    - `ListBySpaceID(ctx, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error)` — list all learn records for a space
  - Implementations with GORM, all using `db.WithContext(ctx)`
  - `filterByMeta`: `WHERE learning_spaces.meta @> ?` with `json.Marshal(filterByMeta)` (same pattern as session `filter_by_configs`)
  - `userIdentifier` filter: `JOIN users ON users.id = learning_spaces.user_id WHERE users.identifier = ?` (same pattern as `SessionRepo`)

- [x] **Implement Service** — `internal/modules/service/learning_space.go`
  - `LearningSpaceService` interface:
    - `Create(ctx, in CreateLearningSpaceInput) (*model.LearningSpace, error)`
    - `GetByID(ctx, projectID, id uuid.UUID) (*model.LearningSpace, error)`
    - `Update(ctx, in UpdateLearningSpaceInput) (*model.LearningSpace, error)` — fetch existing via `GetByID`, merge meta maps, save
    - `Delete(ctx, projectID, id uuid.UUID) error` — verify exists, then delete (cascade handles junctions)
    - `List(ctx, in ListLearningSpacesInput) (*ListLearningSpacesOutput, error)` — decode cursor, query `limit+1`, determine `has_more`, encode next cursor
    - `Learn(ctx, in LearnInput) (*model.LearningSpaceSession, error)` — validate space exists, validate session exists (via `SessionRepo.Get`), check session not already learned by **any** space (via `LearningSpaceSessionRepo.ExistsBySessionID`), create record with status "pending"
    - `IncludeSkill(ctx, in IncludeSkillInput) (*model.LearningSpaceSkill, error)` — validate space exists, validate skill exists (via `AgentSkillsRepo.GetByID`), check no duplicate (via `LearningSpaceSkillRepo.Exists`), create
    - `ListSkills(ctx, projectID, learningSpaceID uuid.UUID) ([]*model.AgentSkills, error)` — validate space exists, delegate to repo JOIN
    - `ListSessions(ctx, projectID, learningSpaceID uuid.UUID) ([]*model.LearningSpaceSession, error)` — validate space exists, delegate to repo
    - `ExcludeSkill(ctx, projectID, learningSpaceID, skillID uuid.UUID) error` — validate space exists, delete junction (idempotent)
  - Input structs:
    - `CreateLearningSpaceInput` — `ProjectID uuid.UUID`, `UserID *uuid.UUID`, `Meta map[string]interface{}`
    - `UpdateLearningSpaceInput` — `ProjectID uuid.UUID`, `ID uuid.UUID`, `Meta map[string]interface{}`
    - `ListLearningSpacesInput` — `ProjectID uuid.UUID`, `User string`, `FilterByMeta map[string]interface{}`, `Limit int`, `Cursor string`, `TimeDesc bool`
    - `LearnInput` — `ProjectID uuid.UUID`, `LearningSpaceID uuid.UUID`, `SessionID uuid.UUID`
    - `IncludeSkillInput` — `ProjectID uuid.UUID`, `LearningSpaceID uuid.UUID`, `SkillID uuid.UUID`
  - Output struct:
    - `ListLearningSpacesOutput` — `Items []*model.LearningSpace`, `NextCursor string`, `HasMore bool`
  - Dependencies: `LearningSpaceRepo`, `LearningSpaceSkillRepo`, `LearningSpaceSessionRepo`, `AgentSkillsRepo`, `SessionRepo` (for existence validation)
  - Error conventions: return descriptive error strings (e.g., `"learning space not found"`, `"session not found"`, `"session already learned by another space"`, `"skill already included in this space"`) — handler maps these to HTTP status codes via string matching

- [x] **Implement Handler** — `internal/modules/handler/learning_space.go`
  - `LearningSpaceHandler` struct with all 10 endpoint methods
  - Constructor: `NewLearningSpaceHandler(svc LearningSpaceService, userSvc UserService) *LearningSpaceHandler`
  - Request structs with `form`/`json` binding tags:
    - `CreateLearningSpaceReq` — `User string`, `Meta map[string]interface{}`
    - `ListLearningSpacesReq` — `User string`, `Limit int`, `Cursor string`, `TimeDesc bool`, `FilterByMeta string` (raw JSON string from query param)
    - `UpdateLearningSpaceReq` — `Meta map[string]interface{}`
    - `LearnReq` — `SessionID string`
    - `IncludeSkillReq` — `SkillID string`
  - Common patterns for all handlers:
    - Extract project from middleware context: `c.MustGet("project").(*model.Project)`
    - Parse UUID path params: `uuid.Parse(c.Param("id"))` — return 400 if invalid
    - **User resolution (Create only)**: call `UserService.GetOrCreate()` when `req.User` is non-empty
    - **`filter_by_meta` parsing (List)**: `json.Unmarshal([]byte(req.FilterByMeta), &filterMap)` — return 400 if invalid JSON
  - Error mapping (via `strings.Contains` on error message, matching existing patterns):
    - `"not found"` → `serializer.Err(404, err.Error(), nil)`
    - `"already"` (duplicate/conflict) → `serializer.Err(409, err.Error(), nil)`
    - everything else → `serializer.DBErr("", err)`
  - Swagger annotations on each handler method: `@Summary`, `@Description`, `@Tags LearningSpaces`, `@Param`, `@Success`, `@Failure`, `@Router`
  - Dependencies: `LearningSpaceService`, `UserService`

- [x] **Register DI** — `internal/bootstrap/container.go`
  - Provide `LearningSpaceRepo`, `LearningSpaceSkillRepo`, `LearningSpaceSessionRepo`
  - Provide `LearningSpaceService` (inject all three repos + `AgentSkillsRepo` + `SessionRepo`)
  - Provide `LearningSpaceHandler` (inject `LearningSpaceService` + `UserService`)

- [x] **Register Routes** — `internal/router/router.go`
  - Add `LearningSpaceHandler *handler.LearningSpaceHandler` to `RouterDeps`
  - Add route group under v1 (use `d.LearningSpaceHandler` as receiver):
    ```
    learningSpaces := v1.Group("/learning_spaces")
    {
        learningSpaces.POST("", d.LearningSpaceHandler.Create)
        learningSpaces.GET("", d.LearningSpaceHandler.List)
        learningSpaces.GET("/:id", d.LearningSpaceHandler.Get)
        learningSpaces.PATCH("/:id", d.LearningSpaceHandler.Update)
        learningSpaces.DELETE("/:id", d.LearningSpaceHandler.Delete)
        learningSpaces.POST("/:id/learn", d.LearningSpaceHandler.Learn)
        learningSpaces.POST("/:id/skills", d.LearningSpaceHandler.IncludeSkill)
        learningSpaces.GET("/:id/skills", d.LearningSpaceHandler.ListSkills)
        learningSpaces.DELETE("/:id/skills/:skill_id", d.LearningSpaceHandler.ExcludeSkill)
        learningSpaces.GET("/:id/sessions", d.LearningSpaceHandler.ListSessions)
    }
    ```

- [x] **Wire in main** — `cmd/server/main.go`
  - `do.MustInvoke[*handler.LearningSpaceHandler](inj)`
  - Add to `RouterDeps`

### CORE (Python) — `src/server/core/` (ORM sync per AGENTS.md)

- [x] **Add LearningSpace ORM** — `acontext_core/schema/orm/learning_space.py`
  - `LearningSpace` class using `@ORM_BASE.mapped` + `@dataclass` pattern (same as `Session`)
  - Use `CommonMixin` for `id`, `created_at`, `updated_at`
  - Fields: `project_id` (FK `projects.id`, ondelete="CASCADE"), `user_id` (nullable, FK `users.id`, ondelete="CASCADE"), `meta` (JSONB, nullable)
  - Relationship to `Project` with `back_populates="learning_spaces"`
  - `__tablename__ = "learning_spaces"`

- [x] **Add LearningSpaceSkill ORM** — `acontext_core/schema/orm/learning_space_skill.py`
  - **Do NOT use `CommonMixin`** — this table has no `updated_at`. Define `id` and `created_at` manually.
  - Fields: `id` (UUID PK), `learning_space_id` (FK `learning_spaces.id`, ondelete="CASCADE"), `skill_id` (FK `agent_skills.id`, ondelete="CASCADE"), `created_at`
  - `__table_args__` with `UniqueConstraint("learning_space_id", "skill_id")`
  - `__tablename__ = "learning_space_skills"`

- [x] **Add LearningSpaceSession ORM** — `acontext_core/schema/orm/learning_space_session.py`
  - Use `CommonMixin` for `id`, `created_at`, `updated_at` (tracks status transitions)
  - Fields: `learning_space_id` (FK `learning_spaces.id`, ondelete="CASCADE"), `session_id` (FK `sessions.id`, ondelete="CASCADE"), `status` (Text, NOT NULL, default "pending")
  - `__table_args__` with `UniqueConstraint("session_id")`
  - `__tablename__ = "learning_space_sessions"`

- [x] **Export ORMs** — `acontext_core/schema/orm/__init__.py`
  - Import and export all three new models

- [x] **Update Project relationships** — `acontext_core/schema/orm/project.py`
  - Add `learning_spaces` relationship to `Project` with `back_populates`, `passive_deletes=True`

### Python SDK — `src/client/acontext-py/`

- [x] **Define Types** — `src/acontext/types/learning_space.py`
  - `LearningSpace` (Pydantic model: id, user_id, meta, created_at, updated_at)
  - `LearningSpaceSkill` (Pydantic model: id, learning_space_id, skill_id, created_at)
  - `LearningSpaceSession` (Pydantic model: id, learning_space_id, session_id, status, created_at, updated_at)
  - `ListLearningSpacesOutput` (items: list[LearningSpace], next_cursor: str | None, has_more: bool)

- [x] **Export Types** — `src/acontext/types/__init__.py`
  - Add all new types to imports and `__all__`

- [x] **Sync Resource** — `src/acontext/resources/learning_spaces.py`
  - `LearningSpacesAPI` class with `RequesterProtocol`
  - Methods (all using keyword-only args via `*`):
    - `create(*, user, meta)` → `LearningSpace`
    - `list(*, user, limit, cursor, time_desc, filter_by_meta)` → `ListLearningSpacesOutput`
    - `get(space_id)` → `LearningSpace`
    - `update(space_id, *, meta)` → `LearningSpace`
    - `delete(space_id)` → None
    - `learn(space_id, *, session_id)` → `LearningSpaceSession`
    - `include_skill(space_id, *, skill_id)` → `LearningSpaceSkill`
    - `list_skills(space_id)` → `list[Skill]` (returns full skill objects)
    - `exclude_skill(space_id, *, skill_id)` → None
    - `list_sessions(space_id)` → `list[LearningSpaceSession]`
  - `filter_by_meta`: `json.dumps(filter_by_meta)` passed as `filter_by_meta` query param
  - All methods use `build_params()` helper for query string construction

- [x] **Async Resource** — `src/acontext/resources/async_learning_spaces.py`
  - `AsyncLearningSpacesAPI` class — same 11 methods as sync, `async def`, `await self._requester.request(...)`

- [x] **Export Resources** — `src/acontext/resources/__init__.py`
  - Add `LearningSpacesAPI`, `AsyncLearningSpacesAPI`

- [x] **Register on Clients**
  - `src/acontext/client.py` — add `self.learning_spaces = LearningSpacesAPI(self)`
  - `src/acontext/async_client.py` — add `self.learning_spaces = AsyncLearningSpacesAPI(self)`

- [x] **Export from package** — `src/acontext/__init__.py`
  - Add `LearningSpacesAPI`, `AsyncLearningSpacesAPI` to imports and `__all__`

### TypeScript SDK — `src/client/acontext-ts/`

- [x] **Define Types** — `src/types/learning-space.ts`
  - Zod schemas: `LearningSpaceSchema`, `LearningSpaceSkillSchema`, `LearningSpaceSessionSchema` (includes `updated_at`), `ListLearningSpacesOutputSchema`
  - Inferred TypeScript types via `z.infer<>`

- [x] **Export Types** — `src/types/index.ts`
  - Add `export * from './learning-space'`

- [x] **Resource Class** — `src/resources/learning-spaces.ts`
  - `LearningSpacesAPI` class with `RequesterProtocol`
  - All 11 methods async, validate responses with `.parse()`:
    - `create`, `list`, `get`, `update`, `delete`, `learn`, `includeSkill`, `listSkills`, `excludeSkill`, `listSessions`
  - `filterByMeta`: `JSON.stringify(filterByMeta)` passed as query param
  - Use `buildParams()` helper for query string construction

- [x] **Export Resource** — `src/resources/index.ts`
  - Add `export * from './learning-spaces'`

- [x] **Register on Client** — `src/client.ts`
  - Add `public learningSpaces: LearningSpacesAPI` property
  - Initialize in constructor: `this.learningSpaces = new LearningSpacesAPI(this)`

### Documentation — `docs/`

- [x] **Create Learning Spaces doc** — `docs/store/learning-space.mdx`
  - Overview of learning spaces concept
  - Python and TypeScript SDK usage examples (create, list, learn, skill management)
  - API endpoint reference

- [x] **Update docs nav** — `docs/docs.json`
  - Add `store/learning-space` to the Context Storage navigation group

---

## New Deps

**None** — All existing dependencies (GORM, Gin, Pydantic, Zod, httpx, SQLAlchemy) cover what's needed.

---

## Test Cases

### API Unit Tests (Go)

**Handler tests:** (`internal/modules/handler/learning_space_test.go`)
- [x] Handler: CreateLearningSpace — valid request returns 201 with space data
- [x] Handler: CreateLearningSpace — with user resolves/creates user, sets user_id
- [x] Handler: CreateLearningSpace — service error returns 500
- [x] Handler: ListLearningSpaces — returns paginated list with cursor
- [x] Handler: ListLearningSpaces — filters by user identifier
- [x] Handler: ListLearningSpaces — filters by meta (JSONB containment `@>`)
- [x] Handler: ListLearningSpaces — filter_by_meta with invalid JSON returns 400
- [x] Handler: ListLearningSpaces — empty result returns `items: [], has_more: false`
- [x] Handler: ListLearningSpaces — service error returns 500
- [x] Handler: GetLearningSpace — valid ID returns space
- [x] Handler: GetLearningSpace — non-existent ID returns 404
- [x] Handler: GetLearningSpace — invalid UUID returns 400
- [x] Handler: UpdateLearningSpace — patch meta merges into existing meta, preserves existing keys
- [x] Handler: UpdateLearningSpace — non-existent ID returns 404
- [x] Handler: UpdateLearningSpace — invalid UUID returns 400
- [x] Handler: UpdateLearningSpace — missing meta (binding required) returns 400
- [x] Handler: DeleteLearningSpace — valid ID returns 200
- [x] Handler: DeleteLearningSpace — non-existent ID returns 404
- [x] Handler: DeleteLearningSpace — invalid UUID returns 400
- [x] Handler: Learn — valid session returns 201 with pending status
- [x] Handler: Learn — session already learned by another space returns 409 conflict
- [x] Handler: Learn — non-existent session returns 404
- [x] Handler: Learn — non-existent space returns 404
- [x] Handler: Learn — invalid space UUID returns 400
- [x] Handler: Learn — invalid session_id UUID returns 400
- [x] Handler: IncludeSkill — valid skill returns 201
- [x] Handler: IncludeSkill — duplicate skill returns 409 conflict
- [x] Handler: IncludeSkill — non-existent skill returns 404
- [x] Handler: IncludeSkill — non-existent space returns 404
- [x] Handler: IncludeSkill — invalid space UUID returns 400
- [x] Handler: IncludeSkill — invalid skill_id UUID returns 400
- [x] Handler: ListSkills — returns full skill data via JOIN
- [x] Handler: ListSkills — non-existent space returns 404
- [x] Handler: ListSkills — invalid UUID returns 400
- [x] Handler: ExcludeSkill — valid skill returns 200
- [x] Handler: ExcludeSkill — non-existent space returns 404
- [x] Handler: ExcludeSkill — invalid space UUID returns 400
- [x] Handler: ExcludeSkill — invalid skill UUID returns 400
- [x] Handler: ListSessions — returns learn records with status
- [x] Handler: ListSessions — non-existent space returns 404
- [x] Handler: ListSessions — invalid UUID returns 400

**Service tests:** (`internal/modules/service/learning_space_test.go`)
- [x] Service: Create — creates space successfully
- [x] Service: Create — creates space with user_id
- [x] Service: Create — repo error returns error
- [x] Service: Update — fetches existing space, merges meta, saves; existing keys preserved
- [x] Service: Update — non-existent space returns error
- [x] Service: Delete — deletes space successfully
- [x] Service: Delete — non-existent space returns error
- [x] Service: Learn — validates space & session exist, creates record with pending status
- [x] Service: Learn — rejects if session already learned by any space (conflict error)
- [x] Service: Learn — space not found returns error
- [x] Service: Learn — session not found returns error
- [x] Service: IncludeSkill — validates space & skill exist, creates junction
- [x] Service: IncludeSkill — prevents duplicate (conflict error)
- [x] Service: IncludeSkill — skill not found returns error
- [x] Service: ExcludeSkill — validates space exists, removes junction
- [x] Service: ExcludeSkill — space not found returns error
- [x] Service: List — returns items with has_more=false
- [x] Service: List — returns has_more=true when limit+1 items returned
- [x] Service: List — empty result
- [x] Service: ListSkills — returns skills for space
- [x] Service: ListSkills — space not found returns error
- [x] Service: ListSessions — returns sessions for space
- [x] Service: ListSessions — space not found returns error

### Python SDK Tests (sync + async mirror)

> Sync tests in `tests/test_learning_spaces.py`, async tests in `tests/test_async_learning_spaces.py`.

- [x] test_create_learning_space — creates space, verifies POST request payload and path
- [x] test_create_learning_space_without_user — creates space without user, verifies no user in payload
- [x] test_list_learning_spaces — lists spaces with pagination params
- [x] test_list_learning_spaces_filter_by_meta — verifies meta is JSON-encoded as query param
- [x] test_get_learning_space — verifies GET to `/learning_spaces/{id}`
- [x] test_update_learning_space — verifies PATCH with meta payload
- [x] test_delete_learning_space — verifies DELETE to `/learning_spaces/{id}`
- [x] test_learn — verifies POST to `/learning_spaces/{id}/learn` with session_id
- [x] test_list_sessions — verifies GET to `/learning_spaces/{id}/sessions`, returns list of LearningSpaceSession
- [x] test_include_skill — verifies POST to `/learning_spaces/{id}/skills` with skill_id
- [x] test_list_skills — verifies GET to `/learning_spaces/{id}/skills`, returns list of Skill objects
- [x] test_exclude_skill — verifies DELETE to `/learning_spaces/{id}/skills/{skill_id}`

### TypeScript SDK Tests (`tests/learning-spaces.test.ts`)

- [x] test create learning space — verifies POST request and response parsing
- [x] test create learning space without user — verifies POST without user
- [x] test list learning spaces — verifies GET with query params
- [x] test list learning spaces with user filter — verifies user param
- [x] test list learning spaces with meta filter — verifies filterByMeta JSON encoding
- [x] test get learning space — verifies GET by ID
- [x] test update learning space (patch meta) — verifies PATCH request
- [x] test delete learning space — verifies DELETE request
- [x] test learn from session — verifies POST /learn endpoint
- [x] test list sessions — verifies GET /sessions returns LearningSpaceSession with status
- [x] test include skill — verifies POST /skills endpoint
- [x] test list skills — verifies GET /skills returns full skill data
- [x] test exclude skill — verifies DELETE /skills/:skill_id
