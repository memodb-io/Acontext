# Session Title LLM Generation Milestone 8

## features/show case
- Generate a candidate session title from first-user text via existing `llm_complete`.

## designs overview
- Keep scope to `controller/message.py`.
- Add a focused async helper that calls `llm_complete` for title generation.
- Call helper only when one-time gate and quality checks already passed.

## TODOS
- [x] Add title-generation helper via `llm_complete`.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`
- [x] Call helper in session processing flow using validated first-user text.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] When first-user text is valid, Core issues title-generation `llm_complete` call.
- [ ] When first-user text is missing/invalid, no title-generation call is attempted.
