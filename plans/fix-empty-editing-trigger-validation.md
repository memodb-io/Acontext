# Plan: Reject empty `editing_trigger` payloads

## features / show case
- `GET /session/{session_id}/messages` returns `400 Bad Request` when `editing_trigger` is provided as an empty JSON object (`{}`).
- Conditional editing remains explicit: trigger-based editing only proceeds when at least one supported trigger key is present.

## designs overview
- Keep validation in handler request parsing so invalid trigger payloads are rejected before reaching service logic.
- Treat an empty object as invalid trigger configuration (same class of client-input error as unsupported trigger keys).
- Add a focused regression test covering `edit_strategies` + empty `editing_trigger`.

## TODOS
- [x] Add handler validation for empty `editing_trigger` maps (`src/server/api/go/internal/modules/handler/session.go`).
- [x] Add a handler regression test for `editing_trigger={}` returning 400 and skipping service call (`src/server/api/go/internal/modules/handler/session_test.go`).
- [x] Run targeted Go tests for handler package (`src/server/api/go/internal/modules/handler`).
- [x] Mark this plan complete with all checkboxes checked (`plans/fix-empty-editing-trigger-validation.md`).

## new deps
- None

## test cases
- [x] `GET /session/{session_id}/messages` with valid `edit_strategies` and `editing_trigger={}` returns HTTP 400.
- [x] Service `GetMessages` is not invoked when empty `editing_trigger` is rejected at handler layer.
