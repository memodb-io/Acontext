# Session Title Core Helper Milestone 3

## features/show case
- Add a dedicated Core data-layer helper to update `Session.display_title` by `session_id`.

## designs overview
- Keep scope to one focused helper in Core data layer.
- Reuse existing AsyncSession + Result pattern.
- Persist by assigning field and calling `flush`.

## TODOS
- [x] Add helper near `fetch_session` to set `display_title` by `session_id` and flush.
  - Files to modify:
    - `src/server/core/acontext_core/service/data/session.py`

## new deps
- None.

## test cases
- [ ] Helper returns not-found error when `session_id` does not exist.
- [ ] Helper updates `display_title` and flushes without exceptions.
