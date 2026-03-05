# Session Title One-Time Gate Milestone 6

## features/show case
- Gate title generation path to run only once per session.

## designs overview
- Add a small Core data helper to decide whether title generation should run.
- In controller flow, check the helper before preparing title input.
- If `display_title` already exists, skip title-input extraction path.

## TODOS
- [x] Add one-time gate helper in session data layer.
  - Files to modify:
    - `src/server/core/acontext_core/service/data/session.py`
- [x] Apply gate condition in message controller before title-input extraction.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] Gate returns false when `display_title` exists and is non-empty.
- [ ] Controller skips title-input preparation when gate is false.
