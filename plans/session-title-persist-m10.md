# Session Title Persist Milestone 10

## features/show case
- Persist generated/sanitized session title through the central session data helper.

## designs overview
- Keep scope in Core controller flow.
- Reuse existing helper:
  - `update_session_display_title(db_session, session_id, display_title)`
- Persist only when a usable `title_candidate` exists.

## TODOS
- [x] Call central session helper to persist title candidate.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] When a valid title candidate exists, `display_title` is written via central helper.
- [ ] No persistence call occurs when title candidate is `None`.
