# Session Title Non-Blocking Milestone 11

## features/show case
- Keep session title generation/persistence best-effort and non-blocking.

## designs overview
- Scope is limited to `controller/message.py`.
- Add try/except boundaries around title gate/extract and title generate/persist paths.
- Log failures and continue with normal message/task status flow.

## TODOS
- [x] Make title gate/extraction non-blocking.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`
- [x] Make title generation/persistence non-blocking.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] Title generation failure does not fail `process_session_pending_message`.
- [ ] Title persistence failure does not fail message/task processing status updates.
