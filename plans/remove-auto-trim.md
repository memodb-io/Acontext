# Plan: Remove auto-trim params; rely on edit trigger

## features
- Remove `auto_trim_token_threshold` and `auto_trim_strategy` from API, SDKs, and response types.
- Keep `edit_strategies` + `editing_trigger` as the single mechanism to apply edits.

## overall designs
- Delete auto-trim parsing in API handler and auto-trim logic in service.
- Remove auto-trim helper files and response fields.
- Update Python SDK types/resources and docs to align with new API surface.

## implementation TODOS
- Delete auto-trim parsing/response mapping in `SessionHandler.GetMessages`.
- Remove auto-trim structs and fields from service input/output.
- Delete auto-trim helper files (`auto_trim_*.go`) and references.
- Update Python SDK: remove params in sync/async `get_messages`, remove output fields.
- Update docs to only mention `editing_trigger` with `edit_strategies`.

## impact files
- `src/server/api/go/internal/modules/handler/session.go`
- `src/server/api/go/internal/modules/service/session.go`
- `src/server/api/go/internal/modules/service/auto_trim_checks.go`
- `src/server/api/go/internal/modules/service/auto_trim_registry.go`
- `src/server/api/go/internal/modules/service/auto_trim_tokens.go`
- `src/client/acontext-py/src/acontext/resources/sessions.py`
- `src/client/acontext-py/src/acontext/resources/async_sessions.py`
- `src/client/acontext-py/src/acontext/types/session.py`
- `docs/engineering/editing.mdx`

## new deps
- None

## test cases
- Go unit tests: `make test-unit` (optional).
- SDK tests: `pytest` in `src/client/acontext-py` (optional).

## status
- Completed code changes; docs unchanged (no auto-trim references found).
