# Claude Agent Storage integration in Acontext TypeScript SDK

## Summary

Add a **ClaudeAgentStorage** integration in `acontext-ts` that consumes messages from the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`'s `query()` async iterable), discovers the session id from the stream, and persists **only user and assistant messages** to Acontext in **Anthropic format** via the existing `client.sessions.storeMessage(...)` API. All other message types are used only for session-id resolution. This is the TypeScript counterpart of the Python `ClaudeAgentStorage` (see `plans/claude-agent-storage-py-sdk.md`).

**Behavioral parity**: The TS integration **must** produce identical outputs (Anthropic blobs, meta, error handling, session creation) as the Python integration. This plan documents every behavioral rule from the Python implementation and maps it to the TS equivalent.

---

## Features

1. **ClaudeAgentStorage class**: holds an `AcontextClient` instance and optional `sessionId`, accepts Claude SDK messages (typed as `SDKMessage` or plain `Record<string, unknown>`), and calls `client.sessions.storeMessage(...)` **only for user and assistant messages**. All other message types are ignored for storage (session id may be resolved from them).
2. **Session id resolution**: if not provided at construction, resolve from non-storable messages only (system init, result, stream, etc.) — never from user/assistant messages. This matches the Python behavior exactly.
3. **Message conversion**: map Claude Agent SDK TS message shapes to the Anthropic blob expected by the Store Message API (`role` + `content` array of typed blocks). Conversion logic produces **identical blobs** to the Python implementation.
4. **Configurable behavior**: optional `includeThinking` flag to include or omit `ThinkingBlock` in stored assistant messages (default: **false** — omit). When included, thinking is stored as a text block and annotated via message `meta`.
5. **Error resilience**: API errors in `saveMessage` are caught and either forwarded to an `onError` callback or logged via `console.warn`, never breaking the caller's message loop.

---

## Structural Differences from Python SDK (same behavior, different access patterns)

The TS Claude Agent SDK structures messages differently from Python, but the **output behavior** (blobs, meta, session handling) must be identical.

| Aspect | Python | TypeScript | Impact on implementation |
|--------|--------|------------|--------------------------|
| Message discriminator | Structural (key presence: `content`, `model`, `subtype`, etc.) | Explicit `type` field (`"user"`, `"assistant"`, `"system"`, etc.) | TS uses `switch(msg.type)` instead of key-presence checks. |
| Content access | `msg.content` (top-level after `asdict()`) | `msg.message.content` (nested under `message` API object) | Public conversion helpers navigate to `msg.message.content`. |
| Model access | `msg.model` (top-level after `asdict()`) | `msg.message.model` (nested under `message` API object) | `_storeAssistant` reads `msg.message?.model`. |
| Error access | `msg.error` (top-level) | `msg.error` (top-level, same) | No change. |
| Session id in init | `msg.data["session_id"]` (nested in `data` dict) | `msg.session_id` (flat on the message) | Simpler access in TS. |
| Content block `type` | No `type` field; identify by key presence (`thinking`+`signature`, `id`+`name`+`input`, etc.) | Already has `type` field (`"text"`, `"thinking"`, `"tool_use"`, `"tool_result"`) | TS uses `block.type` instead of key checks. |
| Replay messages | Not present in Python SDK | `SDKUserMessageReplay` with `isReplay: true` | TS skips these (no Python equivalent — cannot create duplicates). |
| Extra message types | 5 types | 11 types (`tool_progress`, `auth_status`, etc.) | All non-user/non-assistant types → session id resolution only. |

---

## Behavioral Rules (matched 1:1 with Python)

### Rule 1: Message routing (`saveMessage`)
**Python behavior**: `save_message(msg)` routes based on structural checks:
1. System/Result/Stream → `_try_update_session_id(msg)`, return. **Never stored.**
2. AssistantMessage (has `content` + `model`) → `_store_assistant(msg)`.
3. UserMessage (has `content`, no `model`) → `_store_user(msg)`.
4. Unknown → debug log, ignore.

**TS equivalent**:
1. Any message where `type` is NOT `"user"` and NOT `"assistant"` → `_tryUpdateSessionId(msg)`, return. **Never stored.** This covers system, result, stream_event, tool_progress, auth_status, compact_boundary, status, hook_response.
2. `type === "user"` with `isReplay === true` → skip (TS-only; no Python equivalent). This prevents duplicate storage.
3. `type === "assistant"` → `_storeAssistant(msg)`.
4. `type === "user"` (non-replay) → `_storeUser(msg)`.
5. Anything else → ignore.

### Rule 2: Session id resolution (only from non-storable messages)
**Python behavior**: `_try_update_session_id(msg)` is called **only** for system/result/stream messages. It is **never** called for user/assistant messages, even though TS user/assistant messages happen to have `session_id`.

**TS equivalent**: `_tryUpdateSessionId(msg)` is called only when `msg.type` is NOT `"user"` and NOT `"assistant"`. Extract `session_id` from `msg.session_id` (flat field, type-safe access). Only set if not already set.

### Rule 3: Session id extraction
**Python behavior** (`get_session_id_from_message`):
- SystemMessage with `subtype === "init"` → `data.get("session_id")` (safe access via `.get()`)
- ResultMessage → `msg.get("session_id")`
- StreamEvent → `msg.get("session_id")`
- Anything else → `None`

**TS equivalent** (`getSessionIdFromMessage`):
- Any non-storable message → `msg.session_id` if it's a string, else `null`.
- TS init message has `session_id` as a flat field (not nested in `data`), so simpler access.
- User/assistant → `null` (should not be called for these, but safe).

### Rule 4: Content block conversion (produces identical Anthropic blocks)
**Python behavior** (`_convert_block`): checks blocks in order ThinkingBlock → ToolUseBlock → ToolResultBlock → TextBlock. Each block produces one Anthropic block or `null` (skip).

**TS equivalent** (`convertBlock`): uses `switch(block.type)` to dispatch. Same output for each type:

| Block type | Python | TS | Output |
|---|---|---|---|
| **ThinkingBlock** | `"thinking" in block and "signature" in block` | `block.type === "thinking"` | If `!includeThinking` → `null`. If `includeThinking` and `thinking` is non-empty → `{ type: "text", text: block.thinking }`. If `thinking` is empty → `null`. |
| **ToolUseBlock** | `"id" in block and "name" in block and "input" in block` | `block.type === "tool_use"` | If `role !== "assistant"` → `null`. **If `input` is a string: JSON-parse it; on failure wrap as `{ raw: input }`** (matches Python). Otherwise `{ type: "tool_use", id, name, input }`. |
| **ToolResultBlock** | `"tool_use_id" in block` | `block.type === "tool_result"` | If `role !== "user"` → `null`. Normalize `content`: `null`/`undefined` → `""`, string → as-is, array → `[{type: "text", text: item.text ?? ""}]`. Add `is_error: true` only if truthy. |
| **TextBlock** | `"text" in block` (and not ThinkingBlock) | `block.type === "text"` | If `text` is empty → `null`. Otherwise `{ type: "text", text }`. |
| **Unknown** | Falls through all checks | `default` | `null` (skip silently). |

### Rule 5: Content array conversion
**Python behavior** (`_convert_content_blocks`):
- String content: if empty → `([], false)`. Otherwise `([{ type: "text", text: content }], false)`.
- Array content: iterate, skip non-dict items, convert each block, collect non-null results. Track `has_thinking`: true when a block was a ThinkingBlock AND `include_thinking` is true AND the converted block is non-null (i.e. the original block's thinking text was non-empty).
- Returns `(blocks, has_thinking)`.

**TS equivalent** (`convertContentBlocks`): identical logic. `has_thinking` tracks whether a `type === "thinking"` block was successfully included (not just present — must have non-empty thinking text and `includeThinking === true`).

### Rule 6: Public conversion helpers

**`claudeUserMessageToAnthropicBlob(msg)`**:
- Python reads `msg.get("content", "")`.
- TS reads `msg.message?.content ?? ""` (nested under API message object).
- Calls `convertContentBlocks(content, "user", false)`.
- Returns `{ role: "user", content: blocks }` or `null` if blocks is empty.
- **User messages always have `meta = null`** (no model, no thinking tracked).

**`claudeAssistantMessageToAnthropicBlob(msg, includeThinking)`**:
- Python reads `msg.get("content", [])`.
- TS reads `msg.message?.content ?? []` (nested under API message object).
- Calls `convertContentBlocks(content, "assistant", includeThinking)`.
- Returns `{ blob: { role: "assistant", content: blocks } | null, hasThinking }`.

### Rule 7: `_storeUser` — no meta
**Python behavior**: `_store_user` always calls `_call_store(blob, meta=None)`. No metadata for user messages.

**TS equivalent**: `_storeUser` calls `_callStore(blob, null)`. Identical.

### Rule 8: `_storeAssistant` — meta construction
**Python behavior**:
```python
meta: dict = {}
model = msg.get("model")       # top-level on Python's AssistantMessage
if model:
    meta["model"] = model
if has_thinking:
    meta["has_thinking"] = True
error = msg.get("error")       # top-level
if error:
    meta["error"] = error
await self._call_store(blob, meta=meta or None)  # {} → None (empty dict is falsy)
```

**TS equivalent**:
```typescript
const meta: Record<string, unknown> = {};
const model = (msg as any).message?.model;  // nested under API message
if (model) meta.model = model;
if (hasThinking) meta.has_thinking = true;
const error = (msg as any).error;           // top-level on TS SDKAssistantMessage
if (error) meta.error = error;
await this._callStore(blob, Object.keys(meta).length > 0 ? meta : null);  // empty → null
```

Key detail: **empty `meta` dict → `null`**. Python's `{} or None` evaluates to `None`. TS must check `Object.keys(meta).length > 0`.

### Rule 9: `_ensureSession` — session creation
**Python behavior**:
1. If `_session_ensured` → return immediately.
2. Call `sessions.create(use_uuid=self._session_id if self._session_id else None, user=self._user)`.
3. Store returned `session.id` into `_session_id`.
4. If `APIError` with `status_code === 409` → log debug, continue (session already exists).
5. If `APIError` with other status → re-raise (will be caught by `_callStore`'s outer catch).
6. Set `_session_ensured = True` (even after 409).

**TS equivalent**: identical logic. Use `APIError` from `acontext-ts/src/errors.ts` which has `statusCode` property.

### Rule 10: `_callStore` — error resilience
**Python behavior**:
```python
try:
    await self._ensure_session()
    await self._client.sessions.store_message(session_id, blob=blob, format="anthropic", meta=meta)
except Exception as exc:
    if self._on_error is not None:
        self._on_error(exc, blob)        # callback receives (exception, blob)
    else:
        logger.warning("Failed to store message (session=%s): %s", session_id, exc)
```

**TS equivalent**:
```typescript
try {
    await this._ensureSession();
    await this._client.sessions.storeMessage(this._sessionId!, blob, { format: 'anthropic', meta });
} catch (err) {
    if (this._onError) {
        this._onError(err as Error, blob);   // callback receives (Error, blob)
    } else {
        console.warn(`Failed to store message (session=${this._sessionId}):`, err);
    }
}
```

Key: `onError` receives `(Error, blob)` where `blob` is the **converted Anthropic blob**, not the raw message. Matches Python exactly.

### Rule 11: Errored assistant messages — stored with error in meta
**Python behavior**: AssistantMessage with `error` field set is NOT skipped. It goes through normal conversion. If content is valid (non-empty after filtering), it is stored with `meta.error` set. If content is empty, the empty-content guard naturally skips it.

**TS equivalent**: identical. No special early-return for errored messages.

---

## Overall design

1. **Module**: New file `src/integrations/claude-agent.ts` containing:
   - TypeScript types/interfaces for the integration options.
   - Helper functions to detect message types (via `type` field), extract session id, and convert content blocks.
   - **ClaudeAgentStorage** class: holds `AcontextClient` and optional `sessionId`; single method `async saveMessage(msg)`.
2. **Exports**: New `src/integrations/index.ts` barrel export. Add to `src/index.ts`.
3. **Session id**:
   - If `sessionId` is provided at construction, use it for all stores.
   - If not, set internal `_sessionId` from non-storable messages (system init, result, stream, etc.) — **never** from user/assistant messages.
   - If a storable message arrives before any session id: `_ensureSession()` creates a new Acontext session (same pattern as Python).
4. **Session creation (`_ensureSession`)**:
   - On first storable message, call `client.sessions.create({ useUuid: _sessionId || undefined, user: _user })`.
   - If `_sessionId` is set (from Claude stream), use it as `useUuid` so Acontext session matches.
   - If `_sessionId` is `null`, let Acontext generate one and store the result.
   - Handle 409 Conflict (session already exists) gracefully — continue.
   - Only create once (flag `_sessionEnsured`).
5. **Conversion rules**: identical to Python. See "Behavioral Rules" section above.
6. **Error handling**: Wrap `storeMessage` in try/catch; on error, call `onError(error, blob)` if provided, else `console.warn(...)`. Callback receives `(Error, blob)` — the converted Anthropic blob, NOT the raw message.
7. **No new runtime dependency** on `@anthropic-ai/claude-agent-sdk` — accept `Record<string, unknown>`. The integration is structurally typed.

---

## TypeScript usage

**Session id from stream (discovered from Claude init message):**

```typescript
import { AcontextClient, ClaudeAgentStorage } from '@acontext/acontext';
import { query } from '@anthropic-ai/claude-agent-sdk';

const client = new AcontextClient({ apiKey: 'sk-ac-your-api-key' });
const storage = new ClaudeAgentStorage({ client });

const q = query({ prompt: 'What is the capital of France?' });
for await (const message of q) {
  await storage.saveMessage(message);
}
```

**Explicit Acontext session:**

```typescript
const session = await client.sessions.create();
const storage = new ClaudeAgentStorage({ client, sessionId: session.id });

for await (const message of q) {
  await storage.saveMessage(message);
}
```

**Options: include thinking and custom error handling:**

```typescript
const storage = new ClaudeAgentStorage({
  client,
  includeThinking: true,
  onError: (err, msg) => console.error('Storage failed:', err),
});
```

---

## Implementation TODOs

1. **Add TypeScript types and interfaces**
   - [x] Define a minimal `AcontextClientLike` interface: `{ sessions: { create(options?: { useUuid?: string | null, user?: string | null }): Promise<{ id: string }>, storeMessage(sessionId: string, blob: Record<string, unknown>, options?: { format?: string, meta?: Record<string, unknown> | null }): Promise<unknown> } }`. This allows both `AcontextClient` and `MockAcontextClient` (from tests) to be passed without type casting.
   - [x] Define `ClaudeAgentStorageOptions` interface: `{ client: AcontextClientLike, sessionId?: string, user?: string, includeThinking?: boolean, onError?: (error: Error, blob: Record<string, unknown>) => void }`.

2. **Add message type detection helpers**
   - [x] `isUserMessage(msg)`: `msg.type === "user"` and `!msg.isReplay` (skip `SDKUserMessageReplay`).
   - [x] `isAssistantMessage(msg)`: `msg.type === "assistant"`.
   - [x] `getSessionIdFromMessage(msg)`: extract `msg.session_id` if it's a string. Only called for non-storable messages (matching Python behavior).

3. **Add content block conversion helpers** (must produce identical output to Python)
   - [x] `normalizeToolResultContent(content)`: `null`/`undefined` → `""`, string → as-is, array → `[{type: "text", text: item.text ?? ""}]`, other → `String(content)`.
   - [x] `convertBlock(block, role, includeThinking)`: `switch(block.type)` dispatching. **For `tool_use`: if `input` is a string, JSON-parse it; on failure wrap as `{ raw: input }`** (matching Python). Returns `null` to skip.
   - [x] `convertContentBlocks(content, role, includeThinking)`: string or array → `[blocks, hasThinking]`. `hasThinking` is `true` only when a `type === "thinking"` block was successfully included (non-empty thinking + includeThinking). Non-object items in array are skipped (matching Python's `if not isinstance(block, dict): continue`).

4. **Add public conversion functions (exported)**
   - [x] `claudeUserMessageToAnthropicBlob(msg)`: reads `msg.message?.content ?? ""`, converts with `role="user"`, returns `{ role: "user", content: blocks } | null`.
   - [x] `claudeAssistantMessageToAnthropicBlob(msg, includeThinking)`: reads `msg.message?.content ?? []`, converts with `role="assistant"`, returns `{ blob: ... | null, hasThinking: boolean }`.

5. **Implement ClaudeAgentStorage class**
   - [x] Constructor accepting `ClaudeAgentStorageOptions`.
   - [x] `get sessionId(): string | null` property.
   - [x] `async saveMessage(msg: Record<string, unknown>)`:
     - Non-storable types (NOT `"user"` and NOT `"assistant"`) → `_tryUpdateSessionId(msg)`, return.
     - `type === "user"` with `isReplay === true` → return (skip replay).
     - `type === "assistant"` → `_storeAssistant(msg)`.
     - `type === "user"` → `_storeUser(msg)`.
     - Unknown → ignore.
   - [x] `private _tryUpdateSessionId(msg)`: only set `_sessionId` if currently `null`. Read `msg.session_id`.
   - [x] `private async _storeUser(msg)`: convert → blob. If null → debug log, return. Call `_callStore(blob, null)`. **meta is always `null`.**
   - [x] `private async _storeAssistant(msg)`: convert → blob + hasThinking. If null → debug log, return. Build meta: `model` from `msg.message?.model` (only if truthy), `has_thinking` if true, `error` from `msg.error` (only if truthy). **Empty meta `{}` → `null`** (matching Python's `meta or None`). Call `_callStore(blob, meta)`.
   - [x] `private async _ensureSession()`: create session with `useUuid`, handle 409, set `_sessionEnsured`.
   - [x] `private async _callStore(blob, meta)`: ensure session, call `storeMessage(sessionId, blob, { format: "anthropic", meta })`, catch errors → `onError(err, blob)` or `console.warn`.

6. **Exports and package layout**
   - [x] Create `src/integrations/claude-agent.ts` with all helpers and `ClaudeAgentStorage`.
   - [x] Create `src/integrations/index.ts` barrel export.
   - [x] Add `export * from './integrations'` to `src/index.ts`.

7. **Tests** (use existing `MockAcontextClient` from `tests/mocks.ts` — it satisfies `AcontextClientLike` natively, no type casting needed. Mock `storeMessage` and `create` via `client.mock().onPost(...)` route handlers, using `mockSession()` and `mockMessage()` factories for return values.)
   - [x] **Conversion helpers — user message**: 11 test cases covering string/array/empty/tool blocks.
   - [x] **Conversion helpers — assistant message**: 12 test cases covering text/thinking/tool_use/tool_result/full.
   - [x] **Session id extraction**: 7 test cases covering all message types.
   - [x] **ClaudeAgentStorage — basic**: 6 test cases (user, assistant, system, result, stream).
   - [x] **ClaudeAgentStorage — session discovery**: 5 test cases.
   - [x] **ClaudeAgentStorage — errored messages**: 2 test cases.
   - [x] **ClaudeAgentStorage — empty content**: 4 test cases.
   - [x] **ClaudeAgentStorage — error handling**: 2 test cases.
   - [x] **ClaudeAgentStorage — session creation**: 7 test cases.
   - [x] **ClaudeAgentStorage — replay messages**: 1 test case.
   - [x] **ClaudeAgentStorage — session id not overwritten**: 2 test cases.
   - [x] **ClaudeAgentStorage — assistant meta edge cases**: 2 test cases.
   - [x] **ClaudeAgentStorage — full flow**: 2 test cases.
   - **Total: 63 tests, all passing.**

8. **Docs**
   - [x] Update `docs/integrations/claude-agent.mdx` to add a TypeScript tab/section alongside the existing Python content.

---

## Impact files

- **New**: `src/client/acontext-ts/src/integrations/claude-agent.ts`
- **New**: `src/client/acontext-ts/src/integrations/index.ts`
- **Modified**: `src/client/acontext-ts/src/index.ts` (add integrations export)
- **New**: `src/client/acontext-ts/tests/claude-agent-storage.test.ts`
- **Modified**: `docs/integrations/claude-agent.mdx` (add TS usage section)

No changes to API server, Python SDK, or CORE.

---

## New deps

- **None** for `@acontext/acontext`. The integration uses only the existing `AcontextClient` and standard TypeScript. No runtime dependency on `@anthropic-ai/claude-agent-sdk`. The integration accepts `Record<string, unknown>` (structurally typed) so callers who use the Claude Agent SDK can pass messages directly.

---

## Test cases

(See Implementation TODOs → Tests section above for the full test matrix. Each test maps 1:1 to a Python test or covers a TS-only case.)

---

## Notes

- **Scope**: Code changes only in **acontext-ts**; no API or other repo changes. Doc update in `/docs`.
- **Behavioral parity goal**: Every Python behavior rule is documented in the "Behavioral Rules" section and must be implemented identically in TS. The only additions are for TS-only message types (replay, tool_progress, auth_status, etc.) which are all non-storable.
- **`meta or None` pattern**: Python's `{} or None` evaluates to `None` because empty dict is falsy. TS must explicitly check `Object.keys(meta).length > 0 ? meta : null`.
- **ToolUseBlock `input` string handling**: Python JSON-parses string `input` or wraps as `{ raw: input }`. TS must do the same (even though the Claude Agent SDK typically sends objects).
- **Content access path**: Python reads `msg.content` (top-level after `asdict()`). TS reads `msg.message.content` (nested under API message). Output is identical.
- **`has_thinking` tracking**: Tracks whether a ThinkingBlock was *successfully included* (non-empty thinking + `includeThinking === true` + converted block non-null), not just whether a ThinkingBlock was present.
- **Replay messages**: TS-only (`SDKUserMessageReplay` with `isReplay: true`). Skipped to prevent duplicate storage. No Python equivalent.
- **Error callback signature**: `onError(error: Error, blob: Record<string, unknown>)` — receives the **converted Anthropic blob**, not the raw SDK message. Matches Python's `on_error(exc, blob)`.
- **No async client distinction**: TS SDK's `AcontextClient` is already async. No separate sync/async variants.
- **Debug logging**: TS SDK has no logging infrastructure. Use `console.warn` for error-level messages (failed stores) and `console.debug` for informational messages (empty content skipped, session resolved, etc.). In production, `console.debug` is typically suppressed.
- **`AcontextClientLike` interface**: The constructor accepts a duck-typed interface rather than the concrete `AcontextClient` class. This allows `MockAcontextClient` to be passed directly in tests without type casting, while still being fully compatible with the real `AcontextClient`.
