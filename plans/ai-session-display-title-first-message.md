# Plan: AI Session Display Title From First Message

## features / show case
- Generate session display titles with AI, similar to ChatGPT-style conversation titles.
- Use only the first user message as title source context.
- Keep SDK usage unchanged:
  - Python: `client.sessions.get_display_title(session_id="...")`
  - Async Python: `await client.sessions.get_display_title(session_id="...")`
  - TypeScript: `await client.sessions.getDisplayTitle(sessionId)`

## designs overview
- Public API contract remains:
  - `GET /api/v1/session/{session_id}/display_title`
  - Response: `{ "display_title": "<string>" }`
- New internal API (API -> CORE) for AI generation:
  - `POST /api/v1/project/{project_id}/session/{session_id}/display_title`
  - Request body: none
  - Response: `{ "display_title": "<string>" }`
- Generation flow:
  1. API checks session ownership.
  2. API checks cached title in `session.configs.__display_title__`.
  3. If missing, API calls CORE internal endpoint.
  4. CORE fetches first user message only and calls `llm_complete` to generate a concise title.
  5. API stores generated title back to `session.configs.__display_title__` (cache) and returns it.
- Fallback:
  - If AI generation fails or no first user message text exists, return deterministic fallback (`"New Session"`).

## TODOS
- [x] Milestone 1: Baseline endpoint + SDK snapshot commit (current deterministic implementation).
  - Files: `src/server/api/go/internal/modules/service/session.go`, `src/server/api/go/internal/modules/handler/session.go`, `src/server/api/go/internal/router/router.go`, `src/client/acontext-py/src/acontext/resources/sessions.py`, `src/client/acontext-py/src/acontext/resources/async_sessions.py`, `src/client/acontext-ts/src/resources/sessions.ts`
- [x] Milestone 2: Add CORE AI title generation endpoint (first user message only).
  - Files: `src/server/core/routers/session.py`, `src/server/core/acontext_core/schema/api/response.py`, `src/server/core/acontext_core/service/data/message.py` (or dedicated new service module)
- [x] Milestone 3: Add API CORE client method for title generation.
  - Files: `src/server/api/go/internal/infra/httpclient/core.go`
- [x] Milestone 4: Switch API display-title flow to AI+cache (with fallback), keep same public API.
  - Files: `src/server/api/go/internal/modules/service/session.go`, `src/server/api/go/internal/bootstrap/container.go`
- [x] Milestone 5: Keep SDK surface stable and docs sync check.
  - Files: `src/client/acontext-py/src/acontext/resources/sessions.py`, `src/client/acontext-py/src/acontext/resources/async_sessions.py`, `src/client/acontext-ts/src/resources/sessions.ts`, `docs/store/messages/multi-provider.mdx`
- [x] Milestone 6: Run compile checks and finalize.
  - Files: none

## new deps
- None planned. Reuse existing CORE `llm_complete` stack.

## test cases
- [ ] CORE endpoint returns AI title from first user message only.
- [ ] CORE endpoint returns fallback title when first user message text is unavailable.
- [ ] API display_title endpoint returns cached `__display_title__` when present.
- [ ] API display_title endpoint calls CORE once and caches title when absent.
- [ ] Python sync/async and TypeScript SDK methods continue to call same public endpoint.

## status
- Milestones 1-6 completed.
- Public API shape remains unchanged (`GET /session/{session_id}/display_title`).
- Internal API->CORE endpoint added for AI title generation from first user message only.

## PR feedback follow-up (2026-02-17)

### features / show case
- Address review feedback for session title branch hygiene and compatibility.
- Keep title generation non-blocking and align execution order clarity.

### designs overview
- Remove local IDE config artifact from tracked files.
- Add idempotent startup schema patch for `sessions.display_title` on existing DBs.
- Add `display_title` to both SDK session types, plus parser tests.
- Rename DB context variables to `db_session` to avoid shadowing confusion.
- Run title generation after `task_agent_curd` and after message status update.

### TODOS
- [x] Remove `.vscode/settings.json` from branch changes.
  - Files: `.vscode/settings.json`
- [x] Add DB migration path for existing CORE deployments.
  - Files: `src/server/core/acontext_core/infra/db.py`
- [x] Sync Python SDK session type and tests with `display_title`.
  - Files: `src/client/acontext-py/src/acontext/types/session.py`, `src/client/acontext-py/tests/test_client.py`, `src/client/acontext-py/tests/test_async_client.py`
- [x] Sync TypeScript SDK session type and tests with `display_title`.
  - Files: `src/client/acontext-ts/src/types/session.ts`, `src/client/acontext-ts/tests/mocks.ts`, `src/client/acontext-ts/tests/client.test.ts`
- [x] Remove variable shadowing in CORE session title path.
  - Files: `src/server/core/acontext_core/service/controller/message.py`, `src/server/core/acontext_core/service/data/session.py`
- [x] Align code order with feedback by running title generation after task processing.
  - Files: `src/server/core/acontext_core/service/controller/message.py`

### new deps
- None.

### test cases
- [x] Net branch diff from merge-base no longer contains `.vscode/settings.json`.
- [x] Python syntax compilation passes for modified CORE and SDK files.
- [x] Title flow reviewed for edge case where reordered code could return wrong `Result` type; fixed with dedicated `agent_result`/`title_result` variables.
- [ ] Python/TypeScript unit test execution in this environment (blocked: missing local test deps `httpx` and `jest`).
