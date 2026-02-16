# Session Title Core ORM Milestone 1

## features/show case
- Add a nullable `display_title` field to Core `Session` ORM so session title can be stored in the shared `sessions` table.

## designs overview
- Scope is intentionally limited to Core ORM model only.
- Add `display_title` as an optional string column on `Session`.
- Keep all existing session behavior unchanged.

## TODOS
- [x] Add `display_title` to Core Session ORM model.
  - Files to modify:
    - `src/server/core/acontext_core/schema/orm/session.py`

## new deps
- None.

## test cases
- [ ] Import/path sanity: Core module still imports `Session` model without errors.
- [x] ORM mapping sanity: `Session` includes nullable `display_title` field.
