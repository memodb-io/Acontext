# Session Title First User Normalize Milestone 5

## features/show case
- Normalize extracted first user message text into clean plain text for title generation input.

## designs overview
- Scope is limited to controller text normalization block.
- Normalize by trimming, collapsing whitespace, and capping max length.
- Keep extraction flow in `process_session_pending_message`.

## TODOS
- [x] Add normalization helper and apply it to extracted user text.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] Whitespace is normalized to single spaces.
- [ ] Empty/whitespace-only input returns `None`.
- [ ] Long input is capped to configured max characters.
