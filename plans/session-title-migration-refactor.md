# Session Title Migration Refactor

## features/show case
- Refactor runtime schema patch logic so migration queries live in a dedicated, organized module.
- Keep behavior unchanged: startup still ensures `sessions.display_title` exists.

## designs overview
- Introduce a small infra-level migration helper module that owns SQL clauses and execution order.
- Keep `DatabaseClient` focused on lifecycle orchestration (`create_tables` + invoke migration helper).
- Avoid touching unrelated title-generation/controller logic.

## TODOS
- [x] Add dedicated migration helper module for runtime schema patches.
  - Files to modify:
    - `src/server/core/acontext_core/infra/schema_migrations.py`
- [x] Refactor `db.py` to consume migration helper instead of embedding query clauses.
  - Files to modify:
    - `src/server/core/acontext_core/infra/db.py`
- [x] Validate no regression via Python syntax checks.
  - Files to modify:
    - `src/server/core/acontext_core/infra/schema_migrations.py`
    - `src/server/core/acontext_core/infra/db.py`

## new deps
- None.

## test cases
- [x] Startup path still calls schema migration step after `create_all`.
- [x] Runtime patch still executes `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS display_title TEXT`.
- [x] `python3 -m py_compile` passes for touched infra files.
