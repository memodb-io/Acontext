# Plan: Refactor `editing_trigger` flow in Go `session.go`

## features / show case
- Make the `editing_trigger` code paths in Go API/service `session.go` files simple and direct to read.
- Keep behavior identical: same schema, validation rules, pin behavior, edit_at_message_id behavior, and error messages.

## designs overview
- In API handler `SessionHandler.GetMessages`, extract `editing_trigger` JSON parsing + validation into a small helper that returns `*service.EditingTrigger`.
- In service `sessionService.GetMessages`, extract trigger evaluation into a single helper that decides whether to apply edit strategies and (when skipped) which `edit_at_message_id` to return.
- Keep existing semantics:
  - `editing_trigger` only matters when `edit_strategies` is provided.
  - Trigger evaluation uses the same editable prefix as `pin_editing_strategies_at_message`.
  - Trigger checks are OR’d (v0 only uses `token_gte`).

## TODOS
- [x] Refactor trigger evaluation to helpers (`src/server/api/go/internal/modules/service/session.go`)
- [x] Refactor `editing_trigger` parsing/validation (`src/server/api/go/internal/modules/handler/session.go`)
- [x] Run `gofmt` on touched files (`src/server/api/go/internal/modules/service/session.go`, `src/server/api/go/internal/modules/handler/session.go`)
- [x] Run unit/compile checks (`src/server/api/go`)
- [x] Mark this plan complete (`plans/refactor-editing-trigger-session-go.md`)

## new deps
- None

## test cases
- [x] `cd src/server/api/go && GOCACHE=/tmp/go-build-cache go test ./...` (or `make test-unit` if available)
