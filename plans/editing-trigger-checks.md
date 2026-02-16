# Plan: Make editing triggers extensible (list of checks)

## features
- Refactor `editing_trigger` evaluation to use a list of trigger checks (OR semantics).
- Keep current API shape (`editing_trigger` JSON object with `token_gte`) unchanged for now.

## overall designs
- In service `GetMessages`, build a slice of trigger check functions from `in.EditingTrigger`.
- Evaluate checks against the same *editable prefix* (respects `pin_editing_strategies_at_message`).
- Apply `edit_strategies` if any trigger check passes; otherwise skip edits and set `edit_at_message_id`.

## implementation TODOS
- Add a small trigger-eval helper with lazy token counting.
- Replace the hardcoded `token_gte` branch with `checks := []checkFn{...}` and OR evaluation.
- Keep existing error messages and pin behavior.

## impact files
- `src/server/api/go/internal/modules/service/session.go`

## new deps
- None

## test cases
- Go unit tests: `cd src/server/api && make test-unit`

## status
- Implemented trigger-check list (OR semantics) in service; API schema unchanged.
- Unit tests: `cd src/server/api && GOCACHE=/tmp/go-build-cache make test-unit`
