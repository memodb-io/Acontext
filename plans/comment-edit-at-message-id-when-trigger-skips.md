# Plan: Comment trigger-false `EditAtMessageID` assignment and add maintainer TODO

## features / show case
- Stop assigning `EditAtMessageID` in the `editing_trigger` false path by commenting the current block.
- Leave a clear TODO for maintainers to decide final API semantics for `edit_at_message_id` when no strategy is applied.

## designs overview
- In `sessionService.GetMessages`, keep trigger evaluation as-is.
- Comment out the trigger-false assignment block for `out.EditAtMessageID`.
- Add an inline TODO explaining the semantic ambiguity and the maintainer decision needed.
- Keep all other behavior intact.

## TODOS
- [x] Comment out trigger-false `EditAtMessageID` assignment and add TODO note (`src/server/api/go/internal/modules/service/session.go`).
- [x] Run focused Go tests for touched package(s) (`src/server/api/go/internal/modules/service`, `src/server/api/go/internal/modules/handler`).
- [x] Mark this plan complete (`plans/comment-edit-at-message-id-when-trigger-skips.md`).

## new deps
- None

## test cases
- [x] Build/test passes after commenting trigger-false assignment path.
- [x] Verify no compile errors from the `effectivePin` code path.
