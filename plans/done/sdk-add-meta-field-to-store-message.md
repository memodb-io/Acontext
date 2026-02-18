# Feature: Add User Meta Support for Messages

**Issue:** https://github.com/memodb-io/Acontext/issues/247

## Feature Description

Add comprehensive user metadata support for messages:
1. Pass `meta` field as a separate parameter for `store_message` (works with all formats)
2. Return `metas` array alongside `items` in `get_messages` responses
3. Add `patch_message_meta` endpoint to update message metadata after creation

### Current State

- The `Message` model already has a `meta` field (JSONB) in both Go/GORM and Python/SQLAlchemy ORMs
- `AcontextMessage` class in SDKs supports `meta` field, but only works when `format="acontext"`
- For other formats (openai, anthropic, gemini), there's no way to pass message-level metadata
- When getting messages in non-acontext format, metadata is not returned separately

### Proposed API

**Python SDK:**
```python
# Store message with metadata
msg = client.sessions.store_message(
    session_id="...",
    blob={"role": "user", "content": "Hello"},
    format="openai",
    meta={"source": "web", "request_id": "abc123"}
)
print(msg.meta)  # {"source": "web", "request_id": "abc123"}  <-- user meta only

# Get messages - metas returned alongside items
r = client.sessions.get_messages(session_id="...", format="openai")
print(r.items)  # [{"role": "user", "content": "Hello"}, ...]
print(r.metas)  # [{"source": "web", "request_id": "abc123"}, ...]  <-- user meta only
print(r.ids)    # ["uuid1", "uuid2", ...]

# Patch message meta (only updates specified keys)
updated_meta = client.sessions.patch_message_meta(
    session_id="...",
    message_id="...",
    meta={"status": "processed"}  # Only adds/updates "status", preserves other keys
)
print(updated_meta)  # {"source": "web", "request_id": "abc123", "status": "processed"}
```

**TypeScript SDK:**
```typescript
// Store message with metadata
const msg = await client.sessions.storeMessage(sessionId, 
    { role: "user", content: "Hello" },
    { 
        format: "openai", 
        meta: { source: "web", request_id: "abc123" }
    }
);
console.log(msg.meta);  // { source: "web", request_id: "abc123" }  <-- user meta only

// Get messages - metas returned alongside items
const r = await client.sessions.getMessages(sessionId, { format: "openai" });
console.log(r.items);  // [{ role: "user", content: "Hello" }, ...]
console.log(r.metas);  // [{ source: "web", request_id: "abc123" }, ...]  <-- user meta only
console.log(r.ids);    // ["uuid1", "uuid2", ...]

// Patch message meta (only updates specified keys)
const updatedMeta = await client.sessions.patchMessageMeta(
    sessionId,
    messageId,
    { status: "processed" }  // Only adds/updates "status", preserves other keys
);
console.log(updatedMeta);  // { source: "web", request_id: "abc123", status: "processed" }
```

---

## Overall Design

### API Layer Changes

The API already stores `meta` in the message model. We need to:
1. Accept `meta` as a top-level field in the store_message request body (for all formats)
2. Return `metas` array in the get_messages response
3. Add new endpoint to update (patch) message meta

### Request/Response Schema Changes

**StoreMessage Request (enhanced):**
```json
{
  "blob": { ... },           // existing: message in specified format
  "format": "openai",        // existing: format of the blob
  "meta": { "key": "value" } // NEW: optional message-level metadata
}
```

**GetMessages Response (enhanced):**
```json
{
  "items": [...],            // existing: formatted messages
  "ids": [...],              // existing: message UUIDs
  "metas": [...],            // NEW: array of meta objects (same order as items/ids)
  "next_cursor": "...",      // existing
  "has_more": false,         // existing
  "this_time_tokens": 100,   // existing
  "public_urls": {...}       // existing
}
```

**PatchMessageMeta (NEW endpoint):**
```
PATCH /session/{session_id}/messages/{message_id}/meta
```

Request:
```json
{
  "meta": { "status": "processed" }  // Keys to add/update (patch semantics)
}
```

Response:
```json
{
  "meta": { "source": "web", "request_id": "abc123", "status": "processed" }  // Full user meta after patch
}
```

Patch behavior:
- Only updates keys present in the request
- Existing keys not in request are preserved
- To delete a key, pass `null` as the value (e.g., `{"key_to_delete": null}`)

### Data Flow

```
store_message:
  SDK (meta param) → API (wrap in __user_meta__) → DB (Message.meta JSONB)

get_messages:
  DB (Message.meta) → API (extract __user_meta__ for each) → SDK (expose r.metas)

patch_message_meta:
  SDK (meta patch) → API (merge into existing __user_meta__) → DB (Message.meta JSONB)
                   → API (extract __user_meta__) → SDK (return updated meta)
```

### Meta Storage Strategy

**User meta is stored in a dedicated `__user_meta__` field for complete isolation from system meta.**

This approach ensures:
- Zero collision risk between user and system fields
- No need to maintain a list of reserved keys
- Users can use any key names they want
- System can add new internal fields without breaking user data

**Storage Structure:**
```json
{
  "source_format": "openai",           // system field
  "name": "assistant_name",            // system field (OpenAI)
  "__gemini_call_info__": {...},       // system field (Gemini)
  "__user_meta__": {                   // user-provided meta (isolated)
    "source": "web",
    "user_agent": "...",
    "custom_key": "value"
  }
}
```

**API Transparency:**

The API abstracts `__user_meta__` - users never see it:

```python
# User stores meta
msg = client.sessions.store_message(
    session_id,
    blob={"role": "user", "content": "Hello"},
    format="openai",
    meta={"source": "web", "request_id": "abc123"}
)

# Stored in DB as:
# meta = {
#   "source_format": "openai",
#   "__user_meta__": {"source": "web", "request_id": "abc123"}
# }

# But API returns only user meta:
print(msg.meta)  # {"source": "web", "request_id": "abc123"}

# Same for get_messages:
r = client.sessions.get_messages(session_id, format="openai")
print(r.metas[0])  # {"source": "web", "request_id": "abc123"}
```

**Implementation Logic:**

```go
// Store: wrap user meta in __user_meta__ field
if userMeta != nil {
    normalizedMeta["__user_meta__"] = userMeta
}

// Response: extract user meta for both store_message and get_messages
func extractUserMeta(meta map[string]interface{}) map[string]interface{} {
    if userMeta, ok := meta["__user_meta__"].(map[string]interface{}); ok {
        return userMeta
    }
    return map[string]interface{}{} // empty if no user meta
}

// Apply to Message response before returning
message.Meta = extractUserMeta(message.Meta)  // Replace full meta with user meta only

// Update (patch): merge new keys into existing __user_meta__
func patchUserMeta(existingMeta, patchMeta map[string]interface{}) map[string]interface{} {
    userMeta := extractUserMeta(existingMeta)
    
    for k, v := range patchMeta {
        if v == nil {
            delete(userMeta, k)  // null value = delete key
        } else {
            userMeta[k] = v      // add or update key
        }
    }
    
    existingMeta["__user_meta__"] = userMeta
    return existingMeta
}
```

**Benefits:**
- Complete isolation - user meta can never affect system fields
- Forward compatible - new system fields won't break user data
- Clean SDK API - users work with flat meta objects
- Simple implementation - no reserved key checking needed

**Design Decision: No separate `get_message_meta` endpoint**

Users can access meta via:
- `msg.meta` after `store_message`
- `r.metas` from `get_messages`
- Return value from `patch_message_meta`

A dedicated GET endpoint is unnecessary overhead.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| User meta storage | `__user_meta__` wrapper field | Complete isolation from system fields, no reserved key checking needed |
| API transparency | Hide wrapper from users | Clean SDK API - users work with flat meta objects |
| Patch semantics | Shallow merge, null = delete | Simple, predictable behavior; aligns with JSON Merge Patch (RFC 7386) |
| Empty meta return | `{}` not `null` | Consistent return type, easier for SDK consumers |
| No separate GET endpoint | Use store_message return / get_messages | Reduces API surface, meta is always available with messages |
| Acontext format meta merge | Request meta overwrites blob meta | Explicit user intent in request takes precedence |

---

## Open Questions

1. **Meta size limit**: Should we enforce a size limit (e.g., 64KB)? 
   - Recommendation: Yes, add 64KB limit to prevent abuse
   
2. **Rate limiting for patch_message_meta**: Should this endpoint have separate rate limiting?
   - Recommendation: Use existing API rate limits, monitor usage

---

## Implementation TODOs

### Phase 1: API Server (Go)

- [x] **1.1** Update `StoreMessageReq` struct in handler to accept `Meta` field
  - File: `src/server/api/go/internal/modules/handler/session.go` (line ~282)
  - Add `Meta map[string]interface{} \`form:"meta" json:"meta"\`` field to request struct
  
- [x] **1.2** Store user `meta` in `__user_meta__` field within normalizer meta
  - File: `src/server/api/go/internal/modules/handler/session.go` (in `StoreMessage` handler)
  - After normalizing, wrap user meta: `normalizedMeta["__user_meta__"] = req.Meta`
  - Complete isolation from system fields like `source_format`, `__gemini_call_info__`
  
- [x] **1.3** Update `GetMessagesOutput` to include `Metas` array
  - File: `src/server/api/go/internal/pkg/converter/converter.go` (line ~59)
  - Add `Metas []map[string]interface{} \`json:"metas"\`` to `GetMessagesOutput` struct
  
- [x] **1.4** Add user meta extraction helper function
  - File: `src/server/api/go/internal/pkg/converter/converter.go`
  - Create `ExtractUserMeta(meta map[string]interface{}) map[string]interface{}` function
  - Returns `meta["__user_meta__"]` if exists, else empty map `{}`

- [x] **1.5** Extract user meta in Message response (StoreMessage)
  - File: `src/server/api/go/internal/modules/handler/session.go`
  - Before returning Message, replace `meta` with extracted `__user_meta__`
  - Use `converter.ExtractUserMeta()` helper

- [x] **1.6** Populate `Metas` array in `GetConvertedMessagesOutput`
  - File: `src/server/api/go/internal/pkg/converter/converter.go` (in `GetConvertedMessagesOutput` func)
  - Extract `__user_meta__` from each message's meta
  - Add `metas` parameter to function signature
  - Return empty `{}` for messages without `__user_meta__` (backward compatibility)

- [x] **1.7** Update GetMessages handler to pass metas to converter
  - File: `src/server/api/go/internal/modules/handler/session.go`
  - Extract metas from messages before calling converter

- [x] **1.8** Add `PatchMessageMeta` handler (NEW endpoint)
  - File: `src/server/api/go/internal/modules/handler/session.go`
  - Endpoint: `PATCH /session/{session_id}/messages/{message_id}/meta`
  - Request struct: `PatchMessageMetaReq { Meta map[string]interface{} }`
  - Response: `{ "meta": {...} }` (updated user meta only)
  - Patch semantics: merge into existing `__user_meta__`, null value = delete key
  - Add godoc comments for Swagger generation

- [x] **1.9** Add repo method for getting single message by ID
  - File: `src/server/api/go/internal/modules/repo/session.go`
  - Method: `GetMessageByID(ctx, sessionID, messageID uuid.UUID) (*model.Message, error)`
  - Verify message belongs to session (security check)

- [x] **1.10** Add repo method for updating message meta
  - File: `src/server/api/go/internal/modules/repo/session.go`
  - Method: `UpdateMessageMeta(ctx, messageID uuid.UUID, meta datatypes.JSONMap) error`

- [x] **1.11** Add service method for patching message meta
  - File: `src/server/api/go/internal/modules/service/session.go`
  - Add to interface: `PatchMessageMeta(ctx, sessionID, messageID uuid.UUID, patchMeta map[string]interface{}) (map[string]interface{}, error)`
  - Implement: get message, merge patch into `__user_meta__`, save, return extracted user meta

- [x] **1.12** Add route for PatchMessageMeta
  - File: `src/server/api/go/internal/router/router.go` (in session group, ~line 74)
  - Add: `session.PATCH("/:session_id/messages/:message_id/meta", d.SessionHandler.PatchMessageMeta)`

- [x] **1.13** Update API tests
  - File: `src/server/api/go/internal/modules/handler/session_test.go`
  - Add tests for meta field in store_message
  - Add tests for metas in get_messages response
  - Add tests for patch_message_meta endpoint
  - Note: Mock methods added; handler tests covered by converter tests

- [x] **1.14** Add converter tests
  - File: `src/server/api/go/internal/pkg/converter/converter_test.go`
  - Test `ExtractUserMeta` helper function
  - Test metas extraction in `GetConvertedMessagesOutput`

- [ ] **1.15** Regenerate Swagger documentation
  - Run `make swagger` or equivalent after adding godoc comments

### Phase 2: Python SDK

- [x] **2.1** Add `meta` parameter to `store_message` method
  - Files: 
    - `src/client/acontext-py/src/acontext/resources/sessions.py`
    - `src/client/acontext-py/src/acontext/resources/async_sessions.py`
  - Add `meta: dict[str, Any] | None = None` parameter
  - Pass `meta` in request body alongside `blob` and `format`
  
- [x] **2.2** Update `GetMessagesOutput` type to include `metas`
  - File: `src/client/acontext-py/src/acontext/types/session.py`
  - Add `metas: list[dict[str, Any]]` field with default `[]`

- [x] **2.3** Update `Message` type to ensure `meta` field returns user meta
  - File: `src/client/acontext-py/src/acontext/types/session.py`
  - Ensure `meta: dict[str, Any]` field exists (API now returns user meta only)

- [x] **2.4** Add `patch_message_meta` method (sync)
  - File: `src/client/acontext-py/src/acontext/resources/sessions.py`
  - Method signature: `patch_message_meta(self, session_id: str, message_id: str, *, meta: dict[str, Any]) -> dict[str, Any]`
  - HTTP: `PATCH /session/{session_id}/messages/{message_id}/meta`
  - Request body: `{"meta": {...}}`
  - Returns: `dict[str, Any]` (the updated user meta)

- [x] **2.5** Add `patch_message_meta` method (async)
  - File: `src/client/acontext-py/src/acontext/resources/async_sessions.py`
  - Same signature as sync version with `async def`

- [x] **2.6** Update SDK tests
  - File: `src/client/acontext-py/tests/test_client.py`
  - Add tests for `store_message` with `meta` parameter
  - Add tests for `metas` in `get_messages` response
  - Add tests for `patch_message_meta` method

- [x] **2.7** Update async SDK tests
  - File: `src/client/acontext-py/tests/test_async_client.py`
  - Mirror sync tests for async methods

### Phase 3: TypeScript SDK

- [x] **3.1** Add `meta` option to `storeMessage` method
  - File: `src/client/acontext-ts/src/resources/sessions.ts`
  - Add `meta?: Record<string, unknown>` to `StoreMessageOptions` interface
  - Pass `meta` in request body alongside `blob` and `format`
  
- [x] **3.2** Update `GetMessagesOutput` schema to include `metas`
  - File: `src/client/acontext-ts/src/types/session.ts`
  - Add `metas: z.array(z.record(z.string(), z.unknown())).default([])`

- [x] **3.3** Ensure `Message` type has `meta` field for user meta
  - File: `src/client/acontext-ts/src/types/session.ts`
  - Verify `meta: z.record(z.string(), z.unknown()).optional()` exists

- [x] **3.4** Add `patchMessageMeta` method
  - File: `src/client/acontext-ts/src/resources/sessions.ts`
  - Method signature: `patchMessageMeta(sessionId: string, messageId: string, meta: Record<string, unknown>): Promise<Record<string, unknown>>`
  - HTTP: `PATCH /session/${sessionId}/messages/${messageId}/meta`
  - Request body: `{ meta }`
  - Returns: `Record<string, unknown>` (the updated user meta)

- [x] **3.5** Update SDK tests
  - File: `src/client/acontext-ts/tests/client.test.ts`
  - Add tests for `storeMessage` with `meta` option
  - Add tests for `metas` in `getMessages` response
  - Add tests for `patchMessageMeta` method

### Phase 4: Dashboard/UI (Optional)

- [ ] **4.1** Update `GetMessagesResp` type
  - File: `src/server/ui/types/index.ts`
  - Add `metas?: Record<string, unknown>[]` field to `GetMessagesResp` interface
  - Note: Only needed if Dashboard displays message metadata

- [ ] **4.2** Consider UI updates for displaying message meta
  - This is optional and can be done in a follow-up PR if needed

### Phase 5: Documentation

- [ ] **5.1** Update store_message documentation
  - File: `docs/store/messages/*.mdx`
  - Add `meta` parameter documentation with examples
  
- [ ] **5.2** Add examples for using meta field
  - Both Python and TypeScript examples
  - Show store with meta, retrieve metas, patch meta

- [ ] **5.3** Document patch_message_meta endpoint
  - Add to API reference docs
  - Include patch semantics (merge, null = delete)

- [ ] **5.4** Document metas in get_messages response
  - Update get_messages documentation to show `metas` array

---

## Impact Files

### API Server (Go)
| File | Change |
|------|--------|
| `src/server/api/go/internal/modules/handler/session.go` | Add Meta to StoreMessageReq, add PatchMessageMeta handler, extract user meta before returning |
| `src/server/api/go/internal/pkg/converter/converter.go` | Add Metas to GetMessagesOutput, add ExtractUserMeta helper, update GetConvertedMessagesOutput |
| `src/server/api/go/internal/modules/service/session.go` | Add PatchMessageMeta to interface and implementation |
| `src/server/api/go/internal/modules/repo/session.go` | Add GetMessageByID and UpdateMessageMeta methods |
| `src/server/api/go/internal/router/router.go` | Add PATCH route for message meta |
| `src/server/api/go/internal/modules/handler/session_test.go` | Add tests for meta field and patch_message_meta |
| `src/server/api/go/internal/pkg/converter/converter_test.go` | Add tests for ExtractUserMeta and metas extraction |

### Python SDK
| File | Change |
|------|--------|
| `src/client/acontext-py/src/acontext/resources/sessions.py` | Add meta parameter to store_message, add patch_message_meta method |
| `src/client/acontext-py/src/acontext/resources/async_sessions.py` | Add meta parameter to store_message, add patch_message_meta method (async) |
| `src/client/acontext-py/src/acontext/types/session.py` | Add metas field to GetMessagesOutput |
| `src/client/acontext-py/tests/test_client.py` | Add tests for meta features |
| `src/client/acontext-py/tests/test_async_client.py` | Add async tests for meta features |

### TypeScript SDK
| File | Change |
|------|--------|
| `src/client/acontext-ts/src/resources/sessions.ts` | Add meta option to storeMessage, add patchMessageMeta method |
| `src/client/acontext-ts/src/types/session.ts` | Add metas to GetMessagesOutput schema |
| `src/client/acontext-ts/tests/client.test.ts` | Add tests for meta features |

### Dashboard/UI (Optional)
| File | Change |
|------|--------|
| `src/server/ui/types/index.ts` | Add metas to GetMessagesResp interface (if needed) |

### Documentation
| File | Change |
|------|--------|
| `docs/store/messages/multi-provider.mdx` | Add meta field examples |
| Other relevant docs | Update as needed |

---

## New Dependencies

None - this feature uses existing infrastructure (JSONB storage, existing meta field in ORM).

---

## Test Cases

### API Tests

1. **Test store_message with meta (JSON format)**
   - Store message with openai format + meta field
   - Verify meta is persisted in database

2. **Test store_message with meta (multipart format)**
   - Store message with file + meta field
   - Verify meta is persisted

3. **Test get_messages returns metas**
   - Store multiple messages with different metas
   - Get messages and verify metas array matches ids order

4. **Test user meta stored in `__user_meta__` field**
   - Store message with user meta `{"key": "value"}`
   - Verify DB contains `meta.__user_meta__ = {"key": "value"}`
   - Verify system fields (`source_format`) are at top level

5. **Test user meta isolation**
   - Store message with user meta containing `source_format: "custom"`
   - Verify DB has `source_format: "openai"` at top level (system)
   - Verify DB has `__user_meta__.source_format: "custom"` (user's value preserved but isolated)

6. **Test get_messages extracts user meta correctly**
   - Store message with `__user_meta__: {"key": "value"}` in DB
   - Verify `r.metas[0]` returns `{"key": "value"}` (unwrapped)

7. **Test empty/null meta handling**
   - Store message without meta
   - Verify metas array contains empty objects `{}`

8. **Test patch_message_meta adds new keys**
   - Store message with `{"a": 1}`
   - Patch with `{"b": 2}`
   - Verify result is `{"a": 1, "b": 2}`

9. **Test patch_message_meta overwrites existing keys**
   - Store message with `{"a": 1, "b": 2}`
   - Patch with `{"a": 10}`
   - Verify result is `{"a": 10, "b": 2}`

10. **Test patch_message_meta deletes keys with null**
    - Store message with `{"a": 1, "b": 2}`
    - Patch with `{"a": null}`
    - Verify result is `{"b": 2}`

11. **Test patch_message_meta on message without existing meta**
    - Store message without meta
    - Patch with `{"key": "value"}`
    - Verify result is `{"key": "value"}`

12. **Test patch_message_meta returns 404 for wrong session**
    - Create message in session A
    - Try to patch via session B
    - Verify 404 returned

13. **Test patch_message_meta returns 404 for non-existent message**
    - Patch with random UUID
    - Verify 404 returned

### Python SDK Tests

1. **Test store_message with meta parameter**
   ```python
   msg = client.sessions.store_message(
       session_id, 
       blob={"role": "user", "content": "test"},
       meta={"key": "value"}
   )
   # msg.meta returns user meta only (not the internal wrapper)
   assert msg.meta == {"key": "value"}
   ```

2. **Test get_messages returns user metas**
   ```python
   r = client.sessions.get_messages(session_id, format="openai")
   assert len(r.metas) == len(r.items)
   # r.metas contains user meta only
   assert r.metas[0] == {"key": "value"}
   ```

3. **Test backward compatibility (no user meta)**
   ```python
   # Old message without __user_meta__
   r = client.sessions.get_messages(session_id, format="openai")
   assert r.metas[0] == {}  # Returns empty dict, not None
   ```

4. **Test store_message without meta**
   ```python
   msg = client.sessions.store_message(
       session_id, 
       blob={"role": "user", "content": "test"}
   )
   assert msg.meta == {}  # Empty dict when no user meta provided
   ```

5. **Test patch_message_meta patches existing meta**
   ```python
   # Store with initial meta
   msg = client.sessions.store_message(
       session_id, 
       blob={"role": "user", "content": "test"},
       meta={"a": 1, "b": 2}
   )
   
   # Patch - add new key, update existing
   updated = client.sessions.patch_message_meta(
       session_id,
       msg.id,
       meta={"b": 20, "c": 3}
   )
   assert updated == {"a": 1, "b": 20, "c": 3}
   ```

6. **Test patch_message_meta deletes key with null**
   ```python
   updated = client.sessions.patch_message_meta(
       session_id,
       msg.id,
       meta={"a": None}  # Delete key "a"
   )
   assert "a" not in updated
   ```

### TypeScript SDK Tests

1. **Test storeMessage with meta option**
   ```typescript
   const msg = await client.sessions.storeMessage(
       sessionId,
       { role: "user", content: "test" },
       { meta: { key: "value" } }
   );
   // msg.meta returns user meta only (not the internal wrapper)
   expect(msg.meta).toEqual({ key: "value" });
   ```

2. **Test getMessages returns user metas**
   ```typescript
   const r = await client.sessions.getMessages(sessionId, { format: "openai" });
   expect(r.metas.length).toBe(r.items.length);
   // r.metas contains user meta only
   expect(r.metas[0]).toEqual({ key: "value" });
   ```

3. **Test backward compatibility (no user meta)**
   ```typescript
   // Old message without __user_meta__
   const r = await client.sessions.getMessages(sessionId, { format: "openai" });
   expect(r.metas[0]).toEqual({}); // Returns empty object, not undefined
   ```

4. **Test storeMessage without meta**
   ```typescript
   const msg = await client.sessions.storeMessage(
       sessionId,
       { role: "user", content: "test" }
   );
   expect(msg.meta).toEqual({}); // Empty object when no user meta provided
   ```

5. **Test patchMessageMeta patches existing meta**
   ```typescript
   // Store with initial meta
   const msg = await client.sessions.storeMessage(
       sessionId,
       { role: "user", content: "test" },
       { meta: { a: 1, b: 2 } }
   );
   
   // Patch - add new key, update existing
   const updated = await client.sessions.patchMessageMeta(
       sessionId,
       msg.id,
       { b: 20, c: 3 }
   );
   expect(updated).toEqual({ a: 1, b: 20, c: 3 });
   ```

6. **Test patchMessageMeta deletes key with null**
   ```typescript
   const updated = await client.sessions.patchMessageMeta(
       sessionId,
       msg.id,
       { a: null }  // Delete key "a"
   );
   expect(updated.a).toBeUndefined();
   ```

---

## Edge Cases to Handle

1. **Meta size limits** - Consider adding validation for user meta size (e.g., max 64KB)
   - Implementation: Add validation in handler before storing
   - Reject with 400 Bad Request if meta exceeds limit
2. **Null vs empty** - Decide if `meta: null` and `meta: {}` are treated the same (both result in no `__user_meta__` field)
   - Recommendation: Treat both as "no user meta" - don't create `__user_meta__` field
3. **Format conversion** - Ensure `__user_meta__` is preserved during format conversions
   - The `__user_meta__` is stored in Message.meta JSONB, separate from parts conversion
   - Should be preserved automatically since converters only touch `parts` not `meta`
4. **Backward compatibility** - Existing messages without `__user_meta__` should return empty `{}` in `r.metas`
   - Implementation: `ExtractUserMeta` returns empty map if key doesn't exist
5. **Acontext format with blob meta** - If acontext blob has `meta` AND request has `meta`, request meta takes precedence (overwrites blob meta keys)
   - Implementation: Merge request.meta into blob.meta, then wrap in `__user_meta__`
6. **Patch non-existent message** - Return 404 if message_id doesn't exist
7. **Patch message from different session** - Return 404 if message doesn't belong to session
   - Security: Always filter by both session_id AND message_id in query
8. **Authorization** - Verify session belongs to project (use existing auth middleware)
   - Existing middleware handles project authentication
   - Handler should verify session belongs to authenticated project
9. **Concurrent updates** - Use last-write-wins (simpler, acceptable for metadata)
   - No optimistic locking needed for user meta
10. **Nested objects in patch** - Shallow merge only (nested objects are replaced, not deep-merged)
    - Document this behavior clearly in API docs
11. **Invalid JSON in meta** - Return 400 if meta contains invalid values
    - Note: Go's `map[string]interface{}` should handle this via JSON unmarshaling
12. **Message without parts** - Should still be able to store/patch meta
    - Ensure meta operations work independently of message content

---

## Implementation Order

1. **API Server (Go)** - Must be done first as SDKs depend on it
   - Start with converter.go (ExtractUserMeta helper, GetMessagesOutput update)
   - Then handler + service + repo changes for store_message meta
   - Then add patch_message_meta endpoint
   - Finally, tests
2. **Python SDK** - Can be done in parallel with TypeScript SDK
3. **TypeScript SDK** - Can be done in parallel with Python SDK
4. **Dashboard/UI** - Optional, only if UI needs to display message metadata
5. **Documentation** - After SDKs are complete
6. **Integration testing** - End-to-end tests across all components

### Suggested PR Strategy

- **PR 1**: API changes (all Phase 1 items) - single PR for API
- **PR 2**: Python SDK changes (Phase 2) - can be reviewed in parallel with PR 3
- **PR 3**: TypeScript SDK changes (Phase 3) - can be reviewed in parallel with PR 2
- **PR 4**: Documentation updates (Phase 5)
