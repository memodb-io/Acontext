# Plan: Fix `editing_trigger` token reuse and error status mapping

## features / show case
- Return `this_time_tokens` that always matches the final edited/unedited response payload.
- Prevent stale token metadata when edit strategies mutate message content in place.
- Classify tokenizer failures during trigger evaluation as internal server errors (500 path).

## designs overview
- In `sessionService.GetMessages`, track whether edit strategies were actually applied in this request.
- Reuse cached trigger token count only when no strategies were applied and message identity/order is unchanged.
- When strategies are applied, recompute token count from final `out.Items`.
- Wrap trigger token-counting failures with `ErrGetMessagesTokenCount` so handler error mapping is consistent.

## TODOS
- [x] Patch service token-count flow and trigger error wrapping (`src/server/api/go/internal/modules/service/session.go`).
- [x] Add service tests for post-edit token correctness and trigger-token error wrapping (`src/server/api/go/internal/modules/service/session_test.go`).
- [x] Run targeted Go tests for touched packages and ensure passing behavior (`src/server/api/go/internal/modules/service`, `src/server/api/go/internal/modules/handler`).
- [x] Mark this plan complete with all checkboxes checked (`plans/fix-editing-trigger-token-cache-and-error-status.md`).

## new deps
- None

## test cases
- [x] `GetMessages` with `editing_trigger` + in-place edit strategy returns `this_time_tokens` for final edited payload.
- [x] Trigger evaluation token-count failure is wrapped as `ErrGetMessagesTokenCount`.
- [x] Handler continues mapping `ErrGetMessagesTokenCount` to HTTP 500.
