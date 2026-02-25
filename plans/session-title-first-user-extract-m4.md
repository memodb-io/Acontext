# Session Title First User Extract Milestone 4

## features/show case
- Extract the first user message text inside Core message processing flow.

## designs overview
- Scope is limited to controller flow extraction only.
- Add a helper in `controller/message.py` to scan `MessageBlob` list and return first user text.
- Capture extracted value in `process_session_pending_message` for follow-up milestones.

## TODOS
- [x] Add first-user-message extraction helper and wire it in controller flow.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] Extractor returns first non-empty user text when present.
- [ ] Extractor returns `None` when no user text parts are present.
