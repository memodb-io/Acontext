# Init Learning Space with Default Skills

## Features / Showcase

When a learning space is created via `POST /api/v1/learning_spaces`, the system should **automatically create two default skills** and **associate them** to the new space:

1. **daily-logs** — A skill for tracking daily activity logs
2. **user-general-facts** — A skill for capturing general user facts

This happens transparently: the caller creates a learning space and gets it back as usual, but behind the scenes the two skills now exist under that project and are linked to the space. The skills are created from **template `SKILL.md` files** stored as embedded Go resources (not hard-coded strings in business logic).

**SDK / Docs Impact:** This change modifies *internal behavior* of an existing endpoint — no new API endpoints, no request/response schema changes. SDKs and docs do **not** need updating.

**CORE ORM Sync:** No new database models are introduced. The existing `agent_skills`, `disks`, `artifacts`, and `learning_space_skills` tables are reused. No CORE-side ORM changes needed.

## Design Overview

### Template Resources (Go `embed` in `configs/`)

Template SKILL.md files live alongside `config.yaml` in the existing `configs/` directory:

```
configs/
├── config.yaml
├── skill_templates.go          ← new Go file with //go:embed directive
└── skill_templates/
    ├── daily-logs/
    │   └── SKILL.md
    └── user-general-facts/
        └── SKILL.md
```

Each `SKILL.md` has the same YAML front-matter format the existing skill parser expects:

```yaml
---
name: "daily-logs"
description: "Track daily activity logs for the user"
---
# Daily Logs

You are a daily activity logging skill. Your purpose is to record and organize
the user's daily activities, progress, and notes in a structured format.

## Guidelines
- Capture key activities, decisions, and observations from each day
- Organize entries chronologically
- Include relevant context and outcomes
```

```yaml
---
name: "user-general-facts"
description: "Capture and recall general facts about the user"
---
# User General Facts

You are a user knowledge skill. Your purpose is to learn and recall general
facts about the user — preferences, background, goals, and other persistent
information that helps personalize interactions.

## Guidelines
- Record factual, objective information about the user
- Update facts when the user provides corrections
- Organize facts by category (preferences, background, goals, etc.)
```

The new `skill_templates.go` file uses Go's `//go:embed` directive:

```go
package configs

import "embed"

//go:embed skill_templates
var SkillTemplatesFS embed.FS
```

> **Embed pattern note:** Using `//go:embed skill_templates` (directory name without glob) recursively embeds the entire subtree. This is cleaner than `//go:embed skill_templates/*` which relies on implicit directory-expansion behavior.

Files are read at runtime via `SkillTemplatesFS.ReadFile("skill_templates/daily-logs/SKILL.md")`. Since `embed.FS` is baked into the compiled binary, no filesystem reads are needed at runtime.

**Import path:** The new package is imported as `"github.com/memodb-io/Acontext/configs"`.

### Docker / Build Compatibility

Since `//go:embed` bakes the template files into the **compiled binary** at build time, **no Dockerfile or goreleaser changes are needed**:

- **Dockerfile**: The `--mount=target=.` build mount already exposes the full source tree (including `configs/skill_templates/`) to `go build`. The final Alpine stage only ships the binary, which already contains the templates.
- **Dockerfile.goreleaser**: Same — `go build` runs before goreleaser packages the binary.
- **.goreleaser.yaml**: `extra_files` only needs runtime files like `config.yaml`. The templates are compile-time resources, not runtime files.

### New Service Method: `CreateFromTemplate`

Instead of duplicating or bending the existing `Create` (which expects a multipart ZIP upload), we add a **new method** on `AgentSkillsService`:

```go
CreateFromTemplate(ctx context.Context, in CreateFromTemplateInput) (*model.AgentSkills, error)
```

**`CreateFromTemplateInput`**:

```go
type CreateFromTemplateInput struct {
    ProjectID uuid.UUID
    UserID    *uuid.UUID
    Content   []byte              // raw SKILL.md content read from embedded FS
    Meta      map[string]interface{}   // nil for default skills
}
```

> Note: `TemplateName` is not needed in the input — the name is parsed from the YAML front-matter inside `Content`, consistent with how the existing `Create` method works.

> **`UserID` can be nil:** `CreateLearningSpaceInput.UserID` is `*uuid.UUID` (nullable). When nil, the default skills and their disks will also have `nil` UserID. This is safe — the existing `diskSvc.Create(ctx, projectID, userID)` and `AgentSkills` model both accept `*uuid.UUID`, and the S3 path is keyed by `DiskID` (not `UserID`).

This method:
1. Parses the YAML front-matter via `extractYAMLFrontMatter` + `yaml.Unmarshal` into `SkillMetadata`
2. Validates `name` and `description` are non-empty — this is the **sole validation gate**. Do not add a separate `bytes.Contains(content, []byte("---"))` check; when front-matter markers are missing, `extractYAMLFrontMatter` returns the full content, `yaml.Unmarshal` produces empty fields, and the emptiness checks catch it. This avoids duplicating parsing logic and handles edge cases (e.g., single `---` with no closing marker). Note: the `yamlContent == ""` check in the existing `Create` is effectively dead code for non-empty input — do not copy it.
3. Sanitizes the name via `sanitizeS3Key()` (same as existing `Create`)
4. Creates a `Disk` via `s.diskSvc.Create()`
5. Defers disk cleanup on failure (same `success` flag pattern as `Create`)
6. Creates a single `Artifact` via `s.artifactSvc.CreateFromBytes()` with `Path: "/"`, `Filename: "SKILL.md"` (matching what `splitSkillPath("SKILL.md")` would produce)
7. Creates the `AgentSkills` DB record via `s.r.Create()`
8. Populates `FileIndex` from the artifact (via `artifactsToFileIndex`)
9. Sets `success = true` and returns the skill

This is a lighter-weight version of `Create` — no ZIP handling, no multi-file concurrency, no root-prefix detection, just a single embedded file.

### Learning Space Service Changes

The `learningSpaceService` currently depends only on repos:

```go
// Current struct (5 repos, 0 services)
type learningSpaceService struct {
    lsRepo      repo.LearningSpaceRepo
    lsSkillRepo repo.LearningSpaceSkillRepo
    lsSessRepo  repo.LearningSpaceSessionRepo
    skillsRepo  repo.AgentSkillsRepo
    sessionRepo repo.SessionRepo
}
```

We add two new dependencies — `AgentSkillsService` and an `fs.ReadFileFS` for template access:

```go
// Updated struct (5 repos, 1 service, 1 FS)
type learningSpaceService struct {
    lsRepo         repo.LearningSpaceRepo
    lsSkillRepo    repo.LearningSpaceSkillRepo
    lsSessRepo     repo.LearningSpaceSessionRepo
    skillsRepo     repo.AgentSkillsRepo
    sessionRepo    repo.SessionRepo
    agentSkillsSvc AgentSkillsService  // ← NEW
    templateFS     fs.ReadFileFS       // ← NEW: injected, not package-level access
}
```

> **Why inject `fs.ReadFileFS`?** While `configs.SkillTemplatesFS` is a compile-time constant, injecting the FS via the constructor provides two benefits:
> 1. **Testability:** Tests can substitute `fstest.MapFS` with custom template content to verify error paths (e.g., malformed front-matter, missing files) without changing the real embedded templates.
> 2. **Decoupling:** The service doesn't import the `configs` package directly — the DI container wires the dependency.
>
> `embed.FS` implements `fs.ReadFileFS`, so `configs.SkillTemplatesFS` can be passed directly. In tests, use `fstest.MapFS{"skill_templates/daily-logs/SKILL.md": &fstest.MapFile{Data: []byte(...)}}`.

> Note: No `*zap.Logger` is added — the existing codebase convention is to propagate errors up rather than log within services. The handler/middleware layer handles logging.

In `learningSpaceService.Create()`, **after** the learning space is persisted, we:

1. Define a list of template paths: `["skill_templates/daily-logs/SKILL.md", "skill_templates/user-general-facts/SKILL.md"]`
2. For each template:
   a. Read content from `s.templateFS.ReadFile(path)` (injected via constructor)
   b. Call `s.agentSkillsSvc.CreateFromTemplate()` passing `ProjectID`, `UserID` (from the learning space input), and the template content
   c. Call `s.lsSkillRepo.Create()` to create the `LearningSpaceSkill` junction record linking the new skill to the space
3. If any step fails, execute best-effort cleanup and return an error

### Failure & Cleanup Strategy

The init-skill creation involves both DB records and S3 uploads, so a single DB transaction cannot cover everything. We use a **best-effort cleanup** pattern with **error collection**:

```go
// Pseudocode for Create()
ls := createLearningSpace(...)

createdSkills := []*model.AgentSkills{}
var initErr error
defer func() {
    if initErr != nil {
        // Use context.Background() — the original ctx may be cancelled
        cleanupCtx := context.Background()
        var cleanupErrs []error
        // Best-effort cleanup: delete skills (cascades to disks/artifacts via AgentSkillsService.Delete)
        // Continue on individual failure — don't stop at first error
        for _, skill := range createdSkills {
            if err := s.agentSkillsSvc.Delete(cleanupCtx, ls.ProjectID, skill.ID); err != nil {
                cleanupErrs = append(cleanupErrs, fmt.Errorf("delete skill %s: %w", skill.ID, err))
            }
        }
        // Delete the learning space itself
        if err := s.lsRepo.Delete(cleanupCtx, ls.ProjectID, ls.ID); err != nil {
            cleanupErrs = append(cleanupErrs, fmt.Errorf("delete learning space %s: %w", ls.ID, err))
        }
        // Wrap cleanup errors into the returned error so they surface in handler logs
        if len(cleanupErrs) > 0 {
            initErr = fmt.Errorf("%w (cleanup errors: %v)", initErr, errors.Join(cleanupErrs...))
        }
    }
}()

for each template:
    skill, err := s.agentSkillsSvc.CreateFromTemplate(...)
    if err != nil {
        initErr = fmt.Errorf(...)
        return nil, initErr
    }
    createdSkills = append(createdSkills, skill)
    if err := s.lsSkillRepo.Create(...junction record...); err != nil {
        initErr = fmt.Errorf(...)
        return nil, initErr
    }

return ls, nil
```

**Key details:**

1. The cleanup defer uses `context.Background()` instead of the request `ctx` — if the failure was caused by context cancellation, the cleanup operations would also fail with the cancelled context. This matches the pattern used in `agentSkillsService.Create` for its disk cleanup defer.

2. **Error collection, not silent swallowing:** The cleanup collects all errors and wraps them into the returned `initErr`. Since the handler/middleware layer logs returned errors, cleanup failures will be visible in logs — making orphaned resource diagnosis possible.

3. **Continue on individual failure:** If `agentSkillsSvc.Delete()` fails for skill 1 (e.g., `GetByID` fails because the DB is down), the loop continues to attempt skill 2's cleanup and the learning space deletion. This maximizes the cleanup coverage. Note that `AgentSkillsService.Delete()` internally calls `GetByID` first — if the DB is unreachable (the likely root cause), all deletes will fail, but each is attempted independently.

4. The `AgentSkillsService.Delete()` method handles cascade deletion: it first deletes the DB record, then deletes the skill's disk (which cascades to artifacts in S3). The learning space repo `Delete` runs in a transaction that finds-then-deletes. Junction records (`learning_space_skills`) are auto-deleted by the DB via `ON DELETE CASCADE` foreign keys on both `LearningSpaceID` and `SkillID`.

> Note: `IncludeSkill` is **not** reused here — it performs validation checks (skill exists, not already linked) that are unnecessary for freshly-created skills. Calling `lsSkillRepo.Create()` directly is simpler and avoids redundant DB queries.

### Return Value

The `Create()` method's return signature stays `(*model.LearningSpace, error)` — unchanged. The caller is unaware that skills were created behind the scenes. The skills can be discovered later via `ListSkills`.

### Design Decision: Skill Lifecycle

> **Default skills belong to the project, not the learning space.** Deleting a space removes only the junction records (`learning_space_skills`) via `ON DELETE CASCADE`; the skills themselves persist and can be re-associated with other spaces or deleted independently. This is intentional — skills are project-level resources that happen to be auto-created alongside a space for convenience.

### Idempotency Note

If the API caller retries `POST /learning_spaces` (e.g., due to a timeout), a new learning space with new default skills will be created — there is no deduplication. This is acceptable because:
- Learning spaces have no uniqueness constraint (they're identified by UUID)
- Skill names are not unique in the model (`Name` has no unique index)
- The caller can clean up duplicates via `DELETE /learning_spaces/:id`

### Dependency Injection (container.go)

Update the `NewLearningSpaceService` call in `container.go` to also pass `AgentSkillsService`:

```go
// Current (line 244)
do.Provide(inj, func(i *do.Injector) (service.LearningSpaceService, error) {
    return service.NewLearningSpaceService(
        do.MustInvoke[repo.LearningSpaceRepo](i),
        do.MustInvoke[repo.LearningSpaceSkillRepo](i),
        do.MustInvoke[repo.LearningSpaceSessionRepo](i),
        do.MustInvoke[repo.AgentSkillsRepo](i),
        do.MustInvoke[repo.SessionRepo](i),
    ), nil
})

// Updated — add AgentSkillsService + template FS
do.Provide(inj, func(i *do.Injector) (service.LearningSpaceService, error) {
    return service.NewLearningSpaceService(
        do.MustInvoke[repo.LearningSpaceRepo](i),
        do.MustInvoke[repo.LearningSpaceSkillRepo](i),
        do.MustInvoke[repo.LearningSpaceSessionRepo](i),
        do.MustInvoke[repo.AgentSkillsRepo](i),
        do.MustInvoke[repo.SessionRepo](i),
        do.MustInvoke[service.AgentSkillsService](i),  // ← NEW
        configs.SkillTemplatesFS,                        // ← NEW (embed.FS implements fs.ReadFileFS)
    ), nil
})
```

> Ordering: `AgentSkillsService` is registered at line 231, before `LearningSpaceService` at line 244, so it will be available when `LearningSpaceService` is constructed. `configs.SkillTemplatesFS` is a package-level `embed.FS` — no DI registration needed.

> Import: `container.go` will need to import `"github.com/memodb-io/Acontext/configs"` for `configs.SkillTemplatesFS`.

## TODOs

- [x] **1. Create template resource files**
  - Create `src/server/api/go/configs/skill_templates/daily-logs/SKILL.md` — YAML front-matter with `name: "daily-logs"`, description, and markdown body describing the skill's purpose and guidelines
  - Create `src/server/api/go/configs/skill_templates/user-general-facts/SKILL.md` — YAML front-matter with `name: "user-general-facts"`, description, and markdown body describing the skill's purpose and guidelines
  - Create `src/server/api/go/configs/skill_templates.go` — `package configs` with `//go:embed skill_templates` exposing `var SkillTemplatesFS embed.FS`
  - Files created:
    - `src/server/api/go/configs/skill_templates.go`
    - `src/server/api/go/configs/skill_templates/daily-logs/SKILL.md`
    - `src/server/api/go/configs/skill_templates/user-general-facts/SKILL.md`

- [x] **2. Add `CreateFromTemplate` method to `AgentSkillsService`**
  - Add `CreateFromTemplateInput` struct (fields: `ProjectID`, `UserID`, `Content`, `Meta`)
  - Add `CreateFromTemplate` to the `AgentSkillsService` interface
  - Implement `CreateFromTemplate` on `agentSkillsService`:
    - Parse front-matter via `extractYAMLFrontMatter` + `yaml.Unmarshal` into `SkillMetadata`
    - Validate `name` and `description` are non-empty — this is the **sole validation gate**. Do **not** add a separate `bytes.Contains(content, []byte("---"))` check; when front-matter markers are missing, `extractYAMLFrontMatter` returns the full content, `yaml.Unmarshal` produces empty fields, and the `name == ""` / `description == ""` checks catch it. This avoids duplicating parsing logic and is robust against edge cases (e.g., a single `---` marker with no closing marker).
    - Sanitize name via `sanitizeS3Key()`
    - Create Disk via `s.diskSvc.Create()`
    - Defer disk cleanup on failure (`success` flag pattern, using `context.Background()`)
    - Create single Artifact via `s.artifactSvc.CreateFromBytes()` with `Path: "/"`, `Filename: "SKILL.md"`
    - Create DB record via `s.r.Create()`
    - Populate `FileIndex` via `artifactsToFileIndex()`
  - Files modified:
    - `src/server/api/go/internal/modules/service/agent_skills.go`

- [x] **3. Update `LearningSpaceService` to init skills on creation**
  - Add `agentSkillsSvc AgentSkillsService` field to `learningSpaceService` struct
  - Add `templateFS fs.ReadFileFS` field to `learningSpaceService` struct (import `"io/fs"`)
  - Update `NewLearningSpaceService` constructor signature to accept `AgentSkillsService` and `fs.ReadFileFS` as new parameters
  - Update `Create()` to:
    - After persisting the learning space, iterate over template paths
    - Read each template from `s.templateFS.ReadFile(path)` (injected, not package-level)
    - Call `s.agentSkillsSvc.CreateFromTemplate()` for each
    - Call `s.lsSkillRepo.Create()` to link each skill to the space
    - On failure, collect cleanup errors and wrap into returned error using `context.Background()` (delete created skills via `agentSkillsSvc.Delete`, delete the space via `lsRepo.Delete`, continue on individual failure)
  - Files modified:
    - `src/server/api/go/internal/modules/service/learning_space.go`

- [x] **4. Update DI container**
  - Add `do.MustInvoke[service.AgentSkillsService](i)` and `configs.SkillTemplatesFS` to the `NewLearningSpaceService` provider
  - Add import `"github.com/memodb-io/Acontext/configs"` to `container.go`
  - Files modified:
    - `src/server/api/go/internal/bootstrap/container.go`

- [x] **5. Update handler mock for `AgentSkillsService`**
  - Add `CreateFromTemplate` method to `MockAgentSkillsService` in the handler test file (so it satisfies the updated interface)
  - Files modified:
    - `src/server/api/go/internal/modules/handler/agent_skills_test.go`

- [x] **6. Update unit tests for `LearningSpaceService`**
  - Add `MockAgentSkillsService` to `lsMocks` struct and `newLSMocks()` helper (create a new mock in this file)
  - Add a `templateFS` field (`fstest.MapFS`) to `lsMocks` — pre-populated with valid daily-logs and user-general-facts SKILL.md content so tests are independent of the real embedded templates
  - Update `lsMocks.service()` to pass the new mock and `templateFS` into `NewLearningSpaceService`
  - Update all existing test cases (`success`, `with user_id`, `repo error`) to set up `CreateFromTemplate` and `lsSkillRepo.Create` expectations (since `Create` now always calls them after persisting the space)
  - Add new test cases (see Test Cases section)
  - Files modified:
    - `src/server/api/go/internal/modules/service/learning_space_test.go`

- [x] **7. Add unit tests for `CreateFromTemplate`**
  - Add `TestCreateFromTemplate_Success` — verifies parsing, disk/artifact/DB creation, FileIndex population
  - Add `TestCreateFromTemplate_NilUserID` — passes `nil` UserID, verifies skill and disk are created with `nil` UserID
  - Add `TestCreateFromTemplate_MissingFrontMatterMarkers` — no `---` markers returns error, no Disk/Artifact/DB calls
  - Add `TestCreateFromTemplate_MissingNameOrDescription` — empty name or description returns error
  - Add `TestCreateFromTemplate_DiskFailure` — disk creation error propagates, no DB record or artifact
  - Add `TestCreateFromTemplate_ArtifactFailure` — artifact error propagates, disk is cleaned up
  - Add `TestCreateFromTemplate_DBRecordFailure` — DB insert fails after disk+artifact created, disk is cleaned up via deferred `diskSvc.Delete`
  - Files modified:
    - `src/server/api/go/internal/modules/service/agent_skills_test.go`

- [x] **8. Validate embedded templates at container startup**
  - In `container.go`, after constructing `LearningSpaceService`, add a validation step that reads and parses each embedded template from `configs.SkillTemplatesFS` (same paths used by `Create()`), unmarshals the YAML front-matter, and verifies `name` and `description` are non-empty
  - If any template is invalid, return an error from the provider function so the DI container fails startup immediately (fail-fast)
  - This catches malformed templates at deploy time rather than at first `POST /learning_spaces` call
  - Files modified:
    - `src/server/api/go/internal/bootstrap/container.go`

## New Dependencies

None — uses Go's built-in `embed` package and existing service/repo interfaces.

## Test Cases

### `AgentSkillsService` tests (in `agent_skills_test.go`)

- [x] `TestCreateFromTemplate_Success` — parses SKILL.md front-matter, creates Disk + single Artifact (path=`"/"`, filename=`"SKILL.md"`) + DB record, populates FileIndex with one entry
- [x] `TestCreateFromTemplate_NilUserID` — passes `nil` UserID, verifies skill and disk are created with `nil` UserID (no panic, fields propagated correctly)
- [x] `TestCreateFromTemplate_MissingFrontMatterMarkers` — returns error if content has no `---` markers; no Disk/Artifact/DB calls made (caught by `name == ""` check after parse)
- [x] `TestCreateFromTemplate_MissingNameOrDescription` — returns error if SKILL.md front-matter has empty `name` or `description`; no Disk/Artifact/DB calls made
- [x] `TestCreateFromTemplate_DiskFailure` — returns error if `diskSvc.Create()` fails; no DB record or artifact created
- [x] `TestCreateFromTemplate_ArtifactFailure` — returns error if `artifactSvc.CreateFromBytes()` fails; disk is cleaned up via deferred `diskSvc.Delete`
- [x] `TestCreateFromTemplate_DBRecordFailure` — returns error if `s.r.Create()` fails after disk and artifact are successfully created; disk is cleaned up via deferred `diskSvc.Delete`; no `success = true` is reached

### `LearningSpaceService` tests (in `learning_space_test.go`)

- [x] `TestCreateLearningSpace_InitSkills_Success` — creating a space triggers 2x `CreateFromTemplate` calls (with correct project/user IDs and template content) and 2x `lsSkillRepo.Create` calls (with correct space-skill junction); returns the learning space
- [x] `TestCreateLearningSpace_InitSkills_SkillCreationFails` — if `CreateFromTemplate` fails on the first skill, the learning space is cleaned up via `lsRepo.Delete` (no skills to delete since none were created); returned error wraps the original failure
- [x] `TestCreateLearningSpace_InitSkills_JunctionCreationFails` — if `lsSkillRepo.Create` fails after skill is created, the created skill is deleted via `agentSkillsSvc.Delete`, the space is deleted via `lsRepo.Delete`; returned error wraps the original failure
- [x] `TestCreateLearningSpace_InitSkills_SecondSkillFails` — if the second `CreateFromTemplate` fails, cleanup deletes the first skill via `agentSkillsSvc.Delete` (expected **once**, only for skill 1 — skill 2 was never created), junction record for skill 1 is cascade-deleted by the DB, and the space is deleted via `lsRepo.Delete`; error includes cleanup context
- [x] `TestCreateLearningSpace_InitSkills_CleanupFailureWrapsErrors` — if `CreateFromTemplate` fails for the second skill **and** `agentSkillsSvc.Delete` also fails during cleanup of the first skill, the returned error wraps both the original failure and the cleanup error (verifies the error collection pattern works end-to-end)
