# Patch Session Configs API

## Overview

Add a new `PATCH /session/{session_id}/configs` endpoint that allows partial updates to session configs using patch semantics, similar to `PATCH /session/{session_id}/messages/{message_id}/meta`.

### Difference from Existing `PUT /session/{session_id}/configs`

| Aspect | PUT (existing) | PATCH (new) |
|--------|---------------|-------------|
| Semantics | Full replacement | Partial update |
| Missing keys | Removed | Preserved |
| Null values | Set to null | Delete the key |
| Return value | None (204-style) | Updated configs |

## Features

1. **Patch Semantics**: Only update keys present in the request payload
2. **Delete Keys**: Pass `null` as a value to delete a key from configs
3. **Preserve Existing**: Keys not in the request are preserved
4. **Return Updated Configs**: Returns the complete configs after patch operation
5. **Size Validation**: Validate configs size (same limit as current update)

## Overall Design

### API Schema

**Endpoint**: `PATCH /session/{session_id}/configs`

**Request Body**:
```json
{
  "configs": {
    "key1": "new_value",       // Add or update
    "key2": {"nested": "obj"}, // Supports nested objects
    "old_key": null            // Delete this key
  }
}
```

**Response** (200 OK):
```json
{
  "data": {
    "configs": {
      "key1": "new_value",
      "key2": {"nested": "obj"},
      "existing_key": "preserved_value"
    }
  }
}
```

**Error Responses**:
- 400: Invalid request (invalid session_id format, invalid JSON, configs size exceeds limit)
- 404: Session not found

### Service Layer Logic

```
1. Verify session exists and belongs to project
2. Get existing configs from session
3. Apply patch: for each key in request:
   - If value is null → delete key
   - Otherwise → add/update key
4. Save updated configs to database
5. Return updated configs
```

## Implementation TODOs

### 1. API Layer (Go - Handler)

- [x] Add `PatchSessionConfigsReq` struct with `Configs map[string]interface{}` field
- [x] Add `PatchSessionConfigsResp` struct with `Configs map[string]interface{}` field
- [x] Add `PatchConfigs` handler function:
  - Parse and validate request
  - Validate configs size (reuse MaxMetaSize or define MaxConfigsSize)
  - Get project from context
  - Parse session_id from path
  - Call service method
  - Return response with updated configs
- [x] Add swagger documentation with code samples

**File**: `src/server/api/go/internal/modules/handler/session.go`

### 2. API Layer (Go - Service Interface)

- [x] Add `PatchConfigs` method to `SessionService` interface:
  ```go
  PatchConfigs(ctx context.Context, projectID uuid.UUID, sessionID uuid.UUID, patchConfigs map[string]interface{}) (map[string]interface{}, error)
  ```

**File**: `src/server/api/go/internal/modules/service/session.go`

### 3. API Layer (Go - Service Implementation)

- [x] Implement `PatchConfigs` method in `sessionService`:
  - Verify session exists and belongs to project
  - Get existing configs
  - Apply patch semantics (add/update/delete)
  - Save to database
  - Return updated configs

**File**: `src/server/api/go/internal/modules/service/session.go`

### 4. API Layer (Go - Router)

- [x] Add route: `session.PATCH("/:session_id/configs", d.SessionHandler.PatchConfigs)`

**File**: `src/server/api/go/internal/router/router.go`

### 5. API Layer (Go - Tests)

- [x] Add mock method `PatchConfigs` to `MockSessionService`
- [x] Add handler tests:
  - `TestSessionHandler_PatchConfigs_Success`
  - `TestSessionHandler_PatchConfigs_InvalidSessionID`
  - `TestSessionHandler_PatchConfigs_SessionNotFound`
  - `TestSessionHandler_PatchConfigs_InvalidRequest`

**File**: `src/server/api/go/internal/modules/handler/session_test.go`

### 6. Python SDK (Sync)

- [x] Add `patch_configs` method to `SessionsAPI`:
  ```python
  def patch_configs(
      self,
      session_id: str,
      *,
      configs: dict[str, Any],
  ) -> dict[str, Any]:
  ```

**File**: `src/client/acontext-py/src/acontext/resources/sessions.py`

### 7. Python SDK (Async)

- [x] Add `patch_configs` method to `AsyncSessionsAPI`:
  ```python
  async def patch_configs(
      self,
      session_id: str,
      *,
      configs: dict[str, Any],
  ) -> dict[str, Any]:
  ```

**File**: `src/client/acontext-py/src/acontext/resources/async_sessions.py`

### 8. Python SDK Tests

- [x] Add sync tests:
  - `test_patch_configs_adds_new_keys`
  - `test_patch_configs_updates_existing_keys`
  - `test_patch_configs_deletes_keys_with_none`
- [x] Add async tests:
  - `test_async_patch_configs_adds_new_keys`
  - `test_async_patch_configs_updates_existing_keys`
  - `test_async_patch_configs_deletes_keys_with_none`

**Files**: 
- `src/client/acontext-py/tests/test_client.py`
- `src/client/acontext-py/tests/test_async_client.py`

### 9. TypeScript SDK

- [x] Add `patchConfigs` method to `SessionsAPI`:
  ```typescript
  async patchConfigs(
    sessionId: string,
    configs: Record<string, unknown>
  ): Promise<Record<string, unknown>>
  ```

**File**: `src/client/acontext-ts/src/resources/sessions.ts`

### 10. TypeScript SDK Tests

- [x] Add tests:
  - `should patch configs - add new keys`
  - `should patch configs - update existing keys`
  - `should patch configs - delete keys with null`

**File**: `src/client/acontext-ts/tests/client.test.ts`

### 11. Documentation

- [x] Create new doc page for session configs operations (or update existing)
- [x] Add examples showing patch vs update semantics
- [x] Update docs.json navigation if needed

**File**: `docs/store/session-configs.mdx` (new or update existing)

### 12. Generate Swagger Docs

- [x] Run `swag init` to regenerate swagger docs after handler changes

## Impact Files

| File | Change |
|------|--------|
| `src/server/api/go/internal/modules/handler/session.go` | Add handler + structs |
| `src/server/api/go/internal/modules/service/session.go` | Add interface + impl |
| `src/server/api/go/internal/router/router.go` | Add route |
| `src/server/api/go/internal/modules/handler/session_test.go` | Add tests |
| `src/client/acontext-py/src/acontext/resources/sessions.py` | Add method |
| `src/client/acontext-py/src/acontext/resources/async_sessions.py` | Add method |
| `src/client/acontext-py/tests/test_client.py` | Add tests |
| `src/client/acontext-py/tests/test_async_client.py` | Add tests |
| `src/client/acontext-ts/src/resources/sessions.ts` | Add method |
| `src/client/acontext-ts/tests/client.test.ts` | Add tests |
| `docs/store/session-configs.mdx` | New/update doc |
| `docs/docs.json` | Update navigation |

## New Dependencies

None required. Uses existing patterns and libraries.

## Test Cases

### API Tests

1. **Add new keys**: PATCH with `{"key1": "value1"}` on empty configs → returns `{"key1": "value1"}`
2. **Update existing keys**: PATCH with `{"key1": "updated"}` on `{"key1": "old"}` → returns `{"key1": "updated"}`
3. **Delete keys with null**: PATCH with `{"key1": null}` on `{"key1": "value", "key2": "value2"}` → returns `{"key2": "value2"}`
4. **Preserve unmentioned keys**: PATCH with `{"new": "value"}` on `{"existing": "value"}` → returns `{"existing": "value", "new": "value"}`
5. **Invalid session_id format**: Returns 400
6. **Session not found**: Returns 404
7. **Configs size exceeds limit**: Returns 400

### SDK Tests

1. **Sync/Async patch_configs adds new keys**: Verify correct API call and response parsing
2. **Sync/Async patch_configs updates existing keys**: Verify merge semantics
3. **Sync/Async patch_configs deletes keys with None/null**: Verify deletion semantics

## SDK Usage Examples

### Python

```python
from acontext import AcontextClient

client = AcontextClient(api_key='sk_project_token')

# Add or update keys
updated = client.sessions.patch_configs(
    session_id='session-uuid',
    configs={'agent': 'bot2', 'temperature': 0.8}
)
print(updated)  # {'existing_key': 'value', 'agent': 'bot2', 'temperature': 0.8}

# Delete a key
updated = client.sessions.patch_configs(
    session_id='session-uuid',
    configs={'old_key': None}  # Deletes "old_key"
)
```

### TypeScript

```typescript
import { AcontextClient } from '@acontext/acontext';

const client = new AcontextClient({ apiKey: 'sk_project_token' });

// Add or update keys
const updated = await client.sessions.patchConfigs(
  'session-uuid',
  { agent: 'bot2', temperature: 0.8 }
);
console.log(updated);  // { existing_key: 'value', agent: 'bot2', temperature: 0.8 }

// Delete a key
await client.sessions.patchConfigs(
  'session-uuid',
  { old_key: null }  // Deletes "old_key"
);
```

## Implementation Order

1. Service interface + implementation (Go)
2. Handler + structs (Go)
3. Router (Go)
4. Handler tests (Go)
5. Generate swagger docs
6. Python SDK (sync + async)
7. Python SDK tests
8. TypeScript SDK
9. TypeScript SDK tests
10. Documentation
