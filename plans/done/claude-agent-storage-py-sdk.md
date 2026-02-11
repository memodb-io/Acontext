# Claude Agent Storage integration in Acontext Python SDK

## Summary

Add a **ClaudeAgentStorage** integration (async-only) in `acontext-py` that consumes messages from the Claude Agent SDK (`client.receive_response()`), discovers the session id from the stream, and persists **only user and assistant messages** to Acontext in **Anthropic format** via the existing Store Message API. SystemMessage, ResultMessage, and StreamEvent are **not** stored—they are used only for session id resolution when needed. Only async storage is needed since the Claude Agent SDK is async. All code changes are confined to the **acontext-py** SDK (no API or other repo changes).

---

## Features

1. **ClaudeAgentStorage** (async-only): holds an Acontext session id (optional upfront or discovered from stream), accepts Claude SDK messages (dataclass or dict), and calls `async_client.sessions.store_message(...)` **only for UserMessage and AssistantMessage** (excluding errored AssistantMessages). All other message types are ignored for storage (session id may be updated from them).
2. **Session id resolution**: if not provided at construction, resolve from the first **SystemMessage** with `subtype == "init"` → `data.get("session_id")` (safe access).
3. **Message conversion**: map Claude Agent SDK message shapes to the Anthropic blob shape expected by the Store Message API (`role` + `content` array of blocks).
4. **Configurable behavior**: optional flag to include or omit **ThinkingBlock** in stored assistant messages (default: **omit**, `include_thinking=False`). When included, thinking is stored as a text block and annotated via message `meta`.
5. **Error resilience**: API failures in `save_message` are caught, logged, and do not break the caller's message loop. Configurable via `on_error` callback.

---

## Store Message API (reference)

- **Endpoint**: `POST /session/{session_id}/messages`
- **Body**: `{ "blob": {...}, "format": "anthropic", "meta": {...}? }`
- **Anthropic blob** (validated by API via Anthropic SDK `MessageParam`): only `role` and `content`. **Content blocks** (each with `"type"` and required fields):
    - **text**: `{ "type": "text", "text": "..." }` (optional `cache_control`). **Text must be non-empty** — API rejects empty text parts.
    - **image**: `{ "type": "image", "source": { "type": "base64"|"url", ... } }`
    - **tool_use**: `{"type": "tool_use", "id", "name", "input"}` — **`input` must be a JSON object (dict), not a string.** Only valid in **assistant** role messages.
    - **tool_result**: `{"type": "tool_result", "tool_use_id", "content"}` — **`content`**: string or array of `{"type": "text", "text": "..."}` (both accepted; see session_test.go "anthropic format - tool_result message" with string, "tool_result with text content" with array; normalizer in `internal/pkg/normalizer/anthropic.go` iterates `OfToolResult.Content`). **Empty text is allowed** for tool-result parts. Optional: `"is_error": true`.
    - **document**: base64/url document block
  - Message must have **at least one content block** (empty content rejected). No dedicated "thinking" block; thinking can be stored as a text block or skipped.

---

## Claude Agent SDK message format (reference)

From `plans/appendix/claude_agent_sdk_test/message_types.md` and `basic.py`:

| Message type | Discriminator | Storage / session id |
|---|---|---|
| **SystemMessage** | `subtype`, `data` | **Do not store.** Use `subtype == "init"` → `data.get("session_id")` for session id (safe access). |
| **UserMessage** | `content` (no `model`) | **Store** as `role: "user"`. Has optional `tool_use_result` field — **ignored** for storage (not part of Anthropic `MessageParam`; see Notes). |
| **AssistantMessage** | `content`, `model` | **Store** as `role: "assistant"`. If `error` field is set, include it in message `meta` for observability; message is still stored if content is valid (empty content is naturally skipped by the empty-content guard). Store `model` in message `meta`. |
| **ResultMessage** | `subtype`, `session_id`, … | **Do not store.** May use `session_id` as fallback for session id. |
| **StreamEvent** | `uuid`, `session_id`, `event` | **Do not store.** May use `session_id` for session id. |

**Content blocks (Claude SDK):**

- **TextBlock**: `{ "text": "..." }` → Anthropic `{ "type": "text", "text": "..." }`. **Skip if `text` is empty** (API rejects empty text parts).
- **ThinkingBlock**: `{ "thinking": "...", "signature": "..." }` → skip by default (`include_thinking=False`). If `include_thinking=True`, store as `{"type":"text","text": block["thinking"]}` — **skip if `thinking` is empty**. Annotate via message `meta` (see Notes).
- **ToolUseBlock**: `{ "id", "name", "input" }` → Anthropic `{ "type": "tool_use", "id", "name", "input" }`. **Only valid in assistant messages.** If encountered in a UserMessage, **skip the block** (Anthropic format does not support `tool_use` in user role).
- **ToolResultBlock**: `{ "tool_use_id", "content", "is_error" }` → Anthropic `{ "type": "tool_result", "tool_use_id", "content", "is_error" }` (normalize `content` to string or array of `{type:"text", text}`, per API). **If `content` is `null`/`None`, normalize to `""` (empty string)** — API allows empty text for tool-result parts.

User message `content` can be a **string** or an **array** of blocks; assistant `content` is always an **array**.

**Block identification and conversion (implementation):**

Output must conform to the **Acontext store message anthropic blob** contract above (valid `MessageParam`: `role` + `content` array of typed blocks). Claude SDK blocks are plain dicts with no `type` field; identify by **key presence** (check in order to avoid ambiguity). Conversion helpers receive the `role` so they can enforce role-specific rules (e.g. skip `tool_use` in user messages):

| Claude SDK block | Identification | Anthropic content block (output) |
|---|---|---|
| **ThinkingBlock** | `"thinking" in block` (and `"signature" in block`) | If `include_thinking` **and** `block["thinking"]` is non-empty: `{"type": "text", "text": block["thinking"]}`. Else **skip** (empty thinking text is rejected by API). |
| **ToolUseBlock** | `"id" in block and "name" in block and "input" in block` | `{"type": "tool_use", "id": block["id"], "name": block["name"], "input": block["input"]}` — **ensure `input` is a dict**; Claude SDK gives object, pass as-is. **Only emit for assistant messages; skip if encountered in a user message** (Anthropic format disallows `tool_use` in user role). |
| **ToolResultBlock** | `"tool_use_id" in block` | `{"type": "tool_result", "tool_use_id": block["tool_use_id"], "content": ...}` — normalize `content`: if string, use as-is; if array, map to `[{"type": "text", "text": item["text"]}]`; **if `None`/`null`, normalize to `""`** (API allows empty text for tool-result parts). Optional: `"is_error": block.get("is_error")`. **Only emit for user messages; skip if encountered in an assistant message** (Anthropic format disallows `tool_result` in assistant role). |
| **TextBlock** | `"text" in block` (and not ThinkingBlock) | `{"type": "text", "text": block["text"]}` — **skip if `block["text"]` is empty** (API rejects empty text parts). |

- **Order for identification:** Check ThinkingBlock first, then ToolUseBlock, then ToolResultBlock, then TextBlock.
- **ToolResultBlock `content`:** API accepts string or array of `{"type": "text", "text": "..."}`. If Claude `block["content"]` is a string, use it. If it's an array, map items to `{"type": "text", "text": item["text"]}`. **If `content` is `None`, normalize to `""`**. Either form (string or array of dicts) is valid.
- **ToolUseBlock `input`:** Must be a JSON object. Claude SDK provides `input` as dict; use as-is. If ever a string, parse JSON or wrap.
- **ToolUseBlock in user messages:** Anthropic format only allows `tool_use` in assistant-role messages. If a UserMessage contains a ToolUseBlock, **skip that block** during conversion.
- **ToolResultBlock in assistant messages:** Anthropic format only allows `tool_result` in user-role messages. If an AssistantMessage contains a ToolResultBlock, **skip that block** during conversion.
- **User message string content:** If message `content` is a string, treat as one block: `[{ "type": "text", "text": content }]`. **Skip if the string is empty.**
- **Empty content after conversion:** If after conversion (including skipping empty text, thinking, or disallowed blocks) the message has **zero** content blocks, **do not call `store_message`** — log a debug message and return. The API rejects messages with zero parts.

---

## Overall design

1. **Module**: New module under `src/acontext/` (e.g. `claude_agent_storage.py` or `integrations/claude_agent.py`) containing:
   - Helpers to normalize Claude SDK messages to dict (support dataclass via `asdict` if present).
   - Helpers to convert a single UserMessage or AssistantMessage dict → Anthropic blob (role + content blocks). Conversion helpers accept `role` to enforce role-specific rules.
   - **ClaudeAgentStorage** (async-only): holds `AcontextAsyncClient` and optional `session_id`; single method `async save_message(msg)`. **Only UserMessage and AssistantMessage are stored** (excluding errored AssistantMessages); for SystemMessage, ResultMessage, and StreamEvent, only update session id when applicable and return without calling the API. The developer loops over `receive_response()` and calls `save_message` for each message.
2. **Session id**:
   - If `session_id` is provided at construction, use it for all stores.
   - If not, set internal `_session_id` when seeing SystemMessage with `subtype == "init"` and `data.get("session_id")` (safe access with `.get()`, not `data["session_id"]`). Fallback: ResultMessage/StreamEvent `.get("session_id")`. Once set, use for subsequent user/assistant messages.
   - If a **user or assistant** message is seen before any session id is known, **skip storing that message and log a warning** (do not raise — this avoids breaking the caller's loop).
3. **Conversion rules**:
   - **UserMessage** → `role: "user"`, `content`: normalize to array (if string, `[{ type: "text", text: content }]`), then map each block to Anthropic (Text, ToolResult only — **skip ToolUseBlock in user messages**). Skip empty text blocks. If resulting content is empty, skip store.
   - **AssistantMessage** → `role: "assistant"`, `content`: map each block; for ThinkingBlock skip by default (`include_thinking=False`) or include as text block if opted in. **Skip if `error` field is set.** Skip empty text blocks. If resulting content is empty, skip store. Store `model` in message `meta`.
   - **ToolResultBlock** `content`: API accepts string or array of text blocks; normalize Claude's `content` (string, array of objects, or **`None`** → `""`) to that shape.
4. **Error handling** (`save_message`):
   - Wrap the `await client.sessions.store_message(...)` call in a try/except.
   - **Default behavior**: catch exceptions, log a warning with message details, and **continue** (do not re-raise). This ensures a failed store does not abort the caller's `async for` loop.
   - **Configurable**: accept an optional `on_error: Callable[[Exception, dict], None]` callback at construction. If provided, call it instead of the default log-and-continue. Callers who want to raise can pass `on_error=lambda e, msg: raise_(e)` or similar.
5. **Message `meta`**: When storing an AssistantMessage, include useful metadata:
   - `"model": msg.get("model")` — the model that generated the response.
   - If `include_thinking=True` and thinking blocks were included, add `"has_thinking": True` so consumers can distinguish thinking text from regular text on retrieval.
6. **Subagent / parent_tool_use_id**: Storage can ignore `parent_tool_use_id` for the first version (store all user/assistant messages in order); optional later: store in message `meta` for filtering or ordering.
7. **Dependencies**: No new runtime dependency on `claude_agent_sdk` in `acontext-py`; the integration accepts generic dict (or dataclass convertible to dict) so that callers who use the Claude Agent SDK can pass `asdict(msg)` or the SDK's native shape. Optional: document that the package is intended to be used with `claude_agent_sdk` and recommend installing it in app code.

---

## Python usage

**Session id from stream (discovered from Claude init message)** — dev loops and calls `save_message` per message:

```python
import asyncio
from acontext import AcontextAsyncClient
from acontext.claude_agent_storage import ClaudeAgentStorage  # or acontext.integrations.claude_agent
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

async def main():
    acontext_client = AcontextAsyncClient(api_key="sk_project_token")
    storage = ClaudeAgentStorage(client=acontext_client)  # session_id discovered from stream

    async with ClaudeSDKClient(options=ClaudeAgentOptions()) as claude_client:
        await claude_client.query("What is the capital of France?")
        async for message in claude_client.receive_response():
            await storage.save_message(message)  # dev controls the loop; can filter, log, or store elsewhere too

asyncio.run(main())
```

**Explicit Acontext session** (correlate Claude run with an Acontext session):

```python
session = await acontext_client.sessions.create()
storage = ClaudeAgentStorage(client=acontext_client, session_id=session.id)
# ... same loop: async for message in claude_client.receive_response(): await storage.save_message(message)
```

**Options: include thinking blocks and custom error handling**

```python
storage = ClaudeAgentStorage(
    client=acontext_client,
    include_thinking=True,   # store ThinkingBlock as text (default: False — omit)
    on_error=lambda e, msg: print(f"Failed to store: {e}"),  # custom error handler
)
```

---

## Implementation TODOs

1. **Add conversion helpers (Claude → Anthropic blob)**
   - [x] Implement `claude_user_message_to_anthropic_blob(msg: dict) -> dict | None` (role `"user"`, content array). **Skip ToolUseBlock** (invalid in user role). **Skip empty text blocks.** Return `None` if resulting content is empty.
   - [x] Implement `claude_assistant_message_to_anthropic_blob(msg: dict, include_thinking: bool = False) -> dict | None` (role `"assistant"`, content array; ThinkingBlock: skip by default, include as text if opted in — **skip if thinking text is empty**). **Skip empty text blocks.** Return `None` if resulting content is empty.
   - [x] Normalize ToolResultBlock `content` to string or `[{ "type": "text", "text": "..." }]` as required by API. **Handle `None` content → `""`**.
   - [x] Normalize user `content` when it is a string to `[{ "type": "text", "text": content }]`. **Skip if empty string.**
2. **Add message type detection**
   - [x] Implement `get_session_id_from_message(msg) -> str | None` (init → `data.get("session_id")` with safe `.get()`, result/stream → `.get("session_id")`).
   - [x] Implement `is_user_message(msg)`, `is_assistant_message(msg)` (structural: has `content`; assistant has `model`, user does not; handle dataclass via asdict).
   - [x] Helper to coerce message to dict (if dataclass with `asdict`, else assume dict).
3. **ClaudeAgentStorage (async-only)**
   - [x] Class with `__init__(self, client: AcontextAsyncClient, session_id: str | None = None, include_thinking: bool = False, on_error: Callable[[Exception, dict], None] | None = None)`.
   - [x] `async save_message(self, msg)`:
     - Coerce `msg` to dict. **Only UserMessage and AssistantMessage are stored.** For SystemMessage, ResultMessage, or StreamEvent: update internal `session_id` if not set (from init/result/stream via safe `.get()`) and **return without calling store_message**.
     - **AssistantMessage with `error` field set: skip storing, log debug, return.**
     - If **user or assistant** and we have `session_id`: convert to Anthropic blob. **If conversion returns `None` (empty content after filtering), log debug and return — do not call API.** Otherwise call `await client.sessions.store_message(session_id, blob=..., format="anthropic", meta=...)`.
     - For AssistantMessage, pass `meta={"model": msg.get("model"), ...}`. If `include_thinking=True` and thinking blocks were included, add `"has_thinking": True` to meta.
     - If user/assistant and no `session_id`: **skip and log warning** (do not raise).
     - **Wrap store_message call in try/except**: on exception, call `on_error(e, msg_dict)` if provided, else log warning and continue.
4. **Exports and package layout**
   - [x] Export `ClaudeAgentStorage` and conversion helpers from `acontext` (e.g. `acontext.integrations.claude_agent` or `acontext.claude_agent_storage`) and list in `__all__` / `__init__.py` if desired.
5. **Tests**
   - [x] Unit tests for conversion (UserMessage / AssistantMessage with text, tool_use, tool_result, thinking) → Anthropic blob.
   - [x] Unit tests for session id extraction (init, result, stream) — including missing `session_id` in data.
   - [x] Unit tests for ClaudeAgentStorage: mock `async_client.sessions.store_message`; feed UserMessage and AssistantMessage → assert store_message called with correct blobs; feed SystemMessage, ResultMessage, StreamEvent → assert store_message **not** called (only session_id may be updated).
   - [x] Unit test: AssistantMessage with `error` set → store_message **not** called.
   - [x] Unit test: empty text block skipped; all-thinking message with `include_thinking=False` → store_message **not** called (zero content blocks).
   - [x] Unit test: ToolUseBlock in UserMessage → block skipped in output.
   - [x] Unit test: ToolResultBlock with `content: null` → normalized to `""`.
   - [x] Unit test: API error in store_message → caught, `on_error` called, loop continues.
   - [x] Unit test: user/assistant message before session_id known → skipped with warning, no raise.
   - [ ] Optional: integration test with real API (create session, run a minimal Claude Agent flow, store messages, get_messages and assert); can live in examples or separate test script; follow workspace rule to delete created project/session after test.
6. **Docs**
   - [x] Add a short section in `/docs` for "Claude Agent SDK integration" → `docs/integrations/claude-agent.mdx`, added to `docs.json` navigation.

---

## Impact files

- **New**: `src/client/acontext-py/src/acontext/integrations/claude_agent.py`
- **Modified**: `src/client/acontext-py/src/acontext/__init__.py` (exports, if we expose the class at top level)
- **New**: `src/client/acontext-py/tests/test_claude_agent_storage.py` (or equivalent)
- **Optional**: `src/client/acontext-py/examples/claude_agent_acontext.py` (minimal example: create client, create storage, run query, loop over receive_response() and save_message)
- **Optional**: `docs/...` (e.g. `docs/integrations/claude-agent-sdk.mdx` or under store/messages)

No changes to API server, TS SDK, or CORE.

---

## New deps

- **None** for acontext-py. The integration uses only the existing Acontext client and standard library (and `dataclasses.asdict`). Callers who use the Claude Agent SDK will have it in their app environment; we do not add it as a dependency of the acontext package.

---

## Test cases

1. **Conversion**
   - UserMessage with string content → blob with one text block.
   - UserMessage with empty string content → conversion returns `None`, store_message not called.
   - UserMessage with content array (TextBlock, ToolResultBlock) → correct Anthropic blocks. **ToolUseBlock in user content is skipped.**
   - AssistantMessage with TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlock → correct Anthropic blocks; with `include_thinking=True` thinking becomes text block and `meta.has_thinking=True`; with `include_thinking=False` (default) thinking omitted.
   - AssistantMessage with only ThinkingBlock(s) and `include_thinking=False` → conversion returns `None`, store_message not called (zero content blocks).
   - AssistantMessage with `error` field set → skipped entirely, store_message not called.
   - TextBlock with empty `text` → block skipped in output.
   - ThinkingBlock with empty `thinking` → block skipped even when `include_thinking=True`.
   - ToolResultBlock with `content: null` → normalized to `""`.
   - ToolResultBlock with `content` string vs array → normalized to API-accepted shape.
   - AssistantMessage meta includes `model` from the message.
2. **Session id**
   - SystemMessage init with `data.session_id` → returns that session_id; storage uses it for subsequent stores.
   - SystemMessage init with missing `session_id` in `data` → returns `None`, no crash (safe `.get()`).
   - ResultMessage / StreamEvent with `session_id` → same when init not seen first.
   - User/assistant message before any session_id → **skipped with warning log, no exception raised**.
3. **ClaudeAgentStorage (async) — only user and assistant stored**
   - Given session_id at init: UserMessage and AssistantMessage each call `await store_message` once with correct blob, format anthropic, and meta.
   - Without session_id: first init (or result/stream) sets it; then user/assistant messages are stored.
   - SystemMessage (any subtype), ResultMessage, StreamEvent: **store_message is never called**; only session_id may be updated.
4. **Error handling**
   - store_message raises exception → caught, `on_error` callback invoked (or warning logged), caller's loop continues.
   - Default behavior (no `on_error`): exception logged, not re-raised.
5. **Edge**
   - Empty content array after filtering: store skipped, debug log emitted.
   - Dataclass message (e.g. from Claude SDK) is converted via asdict before processing.
   - `UserMessage.tool_use_result` field: ignored (see Notes).

---

## Notes

- **Scope**: Code changes only in **acontext-py**; no API or other repo changes.
- **ThinkingBlock default**: `include_thinking=False` by default. Thinking blocks are typically long internal reasoning that inflates storage and is not useful for most replay/retrieval. When included (`include_thinking=True`), stored as a text block with `meta.has_thinking=True` so consumers can distinguish them. API does not have a native "thinking" type.
- **AssistantMessage.error**: Messages with `error` set (e.g. `"rate_limit"`, `"server_error"`) are **stored** when they contain valid content. The `error` value is included in message `meta` for observability and debugging. If the errored message has empty content after conversion, the store is naturally skipped by the existing empty-content guard.
- **UserMessage.tool_use_result**: This optional field on `UserMessage` is **ignored** for storage. It is not part of the Anthropic `MessageParam` format and its data is typically redundant with the `ToolResultBlock` content blocks. If needed in the future, it can be stored in message `meta`.
- **ToolUseBlock in UserMessage**: The Claude Agent SDK schema allows `ToolUseBlock` in `UserMessage.content`, but the Anthropic API format only permits `tool_use` in assistant messages. These blocks are **silently skipped** during user message conversion.
- **ToolResultBlock in AssistantMessage**: Similarly, `tool_result` is only valid in user-role messages per the Anthropic API format. If an AssistantMessage contains a ToolResultBlock, it is **silently skipped** during conversion.
- **Error resilience**: `save_message` never raises by default — API errors are caught and logged to avoid breaking the caller's `async for` loop over `receive_response()`. Callers who want strict behavior can provide an `on_error` callback that re-raises.
- **Subagents**: First version can store all user/assistant messages in order; `parent_tool_use_id` can be stored in `meta` in a later iteration if needed.
- **Optional dependency**: We can add an extra like `acontext[claude]` that pulls in `claude-agent-sdk` later for type hints or convenience; not required for this plan.
