# Plan: Reduce token counting duplication between service and handler

## features / show case
- Compute `this_time_tokens` inside session service and return it to handler.
- Stop recounting tokens in `SessionHandler.GetMessages` when service already provides the value.
- Keep `editing_trigger` behavior unchanged while reducing extra tokenization work.

## designs overview
- Extend `service.GetMessagesOutput` with a `ThisTimeTokens` field.
- In `sessionService.GetMessages`, compute token count for final `out.Items` once before returning.
- In handler `GetMessages`, remove direct tokenizer call and forward `out.ThisTimeTokens` to converter.

## TODOS
- [x] Add `ThisTimeTokens` to service output and compute it in service (`src/server/api/go/internal/modules/service/session.go`).
- [x] Update handler to consume service-provided token count (`src/server/api/go/internal/modules/handler/session.go`).
- [x] Add/adjust focused tests for new output behavior (`src/server/api/go/internal/modules/service/session_test.go`).
- [x] Run targeted Go tests for service/handler packages (`src/server/api/go/internal/modules/service`, `src/server/api/go/internal/modules/handler`).
- [x] Mark this plan complete (`plans/fix-handler-service-token-count-duplication.md`).

## new deps
- None

## test cases
- [x] `GetMessages` returns non-zero `ThisTimeTokens` when returned messages contain text parts.
- [x] Handler `GetMessages` works without local token recount and returns success path responses.
