# Session Title Go Model Milestone 2

## features/show case
- Add a nullable `display_title` field to Go `Session` model so API responses can include session title automatically.

## designs overview
- Scope is limited to API Go model field only.
- Add `display_title` to `Session` struct with nullable pointer type and JSON/GORM tags.
- No handler/service/repo behavior changes in this milestone.

## TODOS
- [x] Add `display_title` field to `Session` struct.
  - Files to modify:
    - `src/server/api/go/internal/modules/model/session.go`

## new deps
- None.

## test cases
- [x] Compile sanity: API module builds after struct change.
- [x] Model sanity: `Session` includes nullable `display_title` with JSON/GORM tags.
