# Plan: Fix `editing_trigger` semantics and token counting duplication

## features / show case
- Make `edit_at_message_id` unambiguous when `editing_trigger` is used: only include it when strategies actually ran.
- Remove duplicated token counting across service and handler by computing `this_time_tokens` in one place.
- Preserve existing API behavior for normal edit strategy flows, pagination, and formatting output.

## designs overview
- In `sessionService.GetMessages`, evaluate trigger conditions first and apply edit strategies only when conditions pass.
- When trigger conditions fail, skip strategy application and do not set `EditAtMessageID` for that request path.
- Compute `ThisTimeTokens` in service from final `out.Items` (post-edit or unchanged), and pass it through handler without recounting.
- Keep trigger evaluation on the same editable prefix used by `pin_editing_strategies_at_message`, but avoid accidental pin rotation on non-edit responses.

## TODOS
- [x] Update service output model and flow to return `ThisTimeTokens` and strict `EditAtMessageID` semantics (`src/server/api/go/internal/modules/service/session.go`).
- [x] Update handler to consume service-provided `ThisTimeTokens` and remove local recount (`src/server/api/go/internal/modules/handler/session.go`).
- [x] Add/adjust unit tests for trigger-not-fired semantics and token counting path (`src/server/api/go/internal/modules/service/session_test.go`, `src/server/api/go/internal/modules/handler/session_test.go`).
- [x] Run Go tests for touched packages and ensure formatting is clean (`src/server/api/go/internal/modules/service/`, `src/server/api/go/internal/modules/handler/`).
- [x] Mark this plan complete with all checkboxes checked (`plans/fix-editing-trigger-semantics-token-counting.md`).

## new deps
- None

## test cases
- [x] `GetMessages` with `edit_strategies` + `editing_trigger` not fired returns unchanged messages and empty `edit_at_message_id`.
- [x] `GetMessages` with `edit_strategies` + fired trigger still returns populated `edit_at_message_id`.
- [x] `this_time_tokens` equals tokens of final response items while handler does not recount.
- [x] Existing handler/service tests still pass for non-trigger flows.
