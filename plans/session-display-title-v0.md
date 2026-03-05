# Plan: Auto-Generated Session Display Title (v0)

## features / show case
- Add a deterministic auto-generated title for each session based on existing session messages.
- Expose the title through API so all clients get consistent results.
- Expose SDK helpers:
  - Python sync: `client.sessions.get_display_title(session_id="...")`
  - Python async: `await client.sessions.get_display_title(session_id="...")`
  - TypeScript: `await client.sessions.getDisplayTitle(sessionId)`

## designs overview
- v0 scope will be **read-time generation** (no new DB column):
  - Validate the session exists and belongs to the authenticated project.
  - Read earliest messages in chronological order with a small bounded scan.
  - Load parts for candidate messages and pick the first non-empty text suitable for display.
  - Normalize whitespace, collapse newlines to spaces, and truncate to a fixed max length.
  - Fallback to `"New Session"` when no usable text exists.
- API schema proposal (for confirmation before implementation):
  - Method: `GET /api/v1/session/{session_id}/display_title`
  - Path param: `session_id` (UUID, required)
  - Success `200` response `data`:
    - `display_title` (string, always non-empty)
  - Error responses:
    - `400` for invalid UUID
    - `404` for session not found in this project
    - `500` for internal errors

## TODOS
- [x] Confirm API schema and fallback/title-length rules before coding.
  - Files: none
- [x] Add service-level display title generation flow and interface method.
  - Files: `src/server/api/go/internal/modules/service/session.go`
- [x] Add HTTP handler + swagger annotations + route wiring for display title endpoint.
  - Files: `src/server/api/go/internal/modules/handler/session.go`, `src/server/api/go/internal/router/router.go`
- [ ] Add/extend Go unit tests for service and handler.
  - Files: `src/server/api/go/internal/modules/service/session_test.go`, `src/server/api/go/internal/modules/handler/session_test.go`
- [x] Add Python SDK sync/async methods for `get_display_title`.
  - Files: `src/client/acontext-py/src/acontext/resources/sessions.py`, `src/client/acontext-py/src/acontext/resources/async_sessions.py`
- [ ] Add Python SDK tests for sync/async display-title calls.
  - Files: `src/client/acontext-py/tests/test_client.py`, `src/client/acontext-py/tests/test_async_client.py`
- [x] Keep TypeScript SDK parity with API endpoint.
  - Files: `src/client/acontext-ts/src/resources/sessions.ts`, `src/client/acontext-ts/tests/client.test.ts`
- [ ] Update one user-facing doc to include the new SDK call.
  - Files: `docs/store/messages/multi-provider.mdx`
- [ ] Run focused tests for API + SDK changes.
  - Files: none

## new deps
- None

## test cases
- [ ] API returns `display_title` from first usable message text.
- [ ] API returns fallback title when session has no usable text.
- [ ] API returns `400` for invalid `session_id`.
- [ ] API returns `404` when session exists outside the current project or does not exist.
- [ ] Python sync SDK calls `GET /session/{id}/display_title` and returns title string.
- [ ] Python async SDK calls `GET /session/{id}/display_title` and returns title string.
- [ ] TypeScript SDK calls `GET /session/{id}/display_title` and returns title string.

## status
- Core API + SDK implementation completed.
- Tests and doc updates intentionally deferred per request: "no tests yet".
