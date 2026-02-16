# Session Title Quality Guard Milestone 7

## features/show case
- Add minimum quality checks for first-user title input before title-generation path.

## designs overview
- Keep scope limited to `controller/message.py`.
- Add simple guard rules:
  - empty -> skip
  - too short -> skip
  - non-informative common utterances -> skip
- Apply guard immediately after extraction.

## TODOS
- [x] Add quality-check helper(s) for title input.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`
- [x] Apply guards in `process_session_pending_message` before title generation path.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] Empty or whitespace-only input is rejected.
- [ ] Very short input is rejected.
- [ ] Non-informative phrases (e.g. "hi", "ok", "test") are rejected.
