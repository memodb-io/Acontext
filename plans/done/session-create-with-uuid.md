# Session Create with Pre-filled UUID

## Issue Reference
GitHub Issue: [#246 - Create session with pre-filled uuid](https://github.com/memodb-io/Acontext/issues/246)

## Features
- Allow users to create a session with a specific UUID instead of auto-generating one
- Return error if a session with the specified UUID already exists (conflict error)
- Maintain backward compatibility (auto-generate UUID if not specified)

## Proposed API/Interface

### API Request Schema
```json
POST /api/v1/session
{
    "user": "alice@acontext.io",        // optional
    "disable_task_tracking": false,      // optional
    "configs": {},                        // optional
    "use_uuid": "123e4567-e89b-12d3-a456-426614174000"  // NEW: optional UUID
}
```

### API Response
- Success (201 Created): Returns the created session with the specified or generated UUID
- Conflict (409 Conflict): Returns error if use_uuid already exists

### Python SDK
```python
# Create session with auto-generated UUID (existing behavior)
session = client.sessions.create()

# Create session with specific UUID (new feature)
session = client.sessions.create(use_uuid='123e4567-e89b-12d3-a456-426614174000')
```

### TypeScript SDK
```typescript
// Create session with auto-generated UUID (existing behavior)
const session = await client.sessions.create();

// Create session with specific UUID (new feature)
const session = await client.sessions.create({ useUuid: '123e4567-e89b-12d3-a456-426614174000' });
```

## Overall Design

### Flow
1. User calls `sessions.create(use_uuid='xxx')` via SDK
2. SDK sends POST request with `use_uuid` in payload
3. API handler receives request, validates UUID format if provided
4. API checks if session with given UUID already exists in the project
5. If exists → return 409 Conflict error
6. If not exists → create session with the specified UUID
7. Return created session

### Error Handling
- Invalid UUID format → 400 Bad Request
- Session ID already exists → 409 Conflict
- Other DB errors → 500 Internal Server Error

## Implementation TODOs

### API Server (Go)
- [x] Update `CreateSessionReq` struct to add `UseUUID` field
- [x] Update `CreateSession` handler to:
  - Parse and validate the use_uuid if provided
  - Check if session with this ID already exists
  - Set the session ID before creation
- [x] Update swagger documentation

### Python SDK
- [x] Update `sessions.create()` to accept `use_uuid` parameter (sync)
- [x] Update `sessions.create()` to accept `use_uuid` parameter (async)

### TypeScript SDK
- [x] Update `sessions.create()` to accept `useUuid` parameter

## Impact Files

### API Server
- `src/server/api/go/internal/modules/handler/session.go` - Add use_uuid to request, update handler logic

### Python SDK
- `src/client/acontext-py/src/acontext/resources/sessions.py` - Update create method
- `src/client/acontext-py/src/acontext/resources/async_sessions.py` - Update async create method

### TypeScript SDK
- `src/client/acontext-ts/src/resources/sessions.ts` - Update create method

## New Dependencies
None - uses existing UUID parsing from `github.com/google/uuid`

## Test Cases

### API Level
1. Create session without use_uuid - should auto-generate UUID
2. Create session with valid use_uuid - should use the provided UUID
3. Create session with existing use_uuid - should return 409 Conflict
4. Create session with invalid UUID format - should return 400 Bad Request

### SDK Level (Python)
1. `client.sessions.create()` - should work as before
2. `client.sessions.create(use_uuid='valid-uuid')` - should create with specified ID
3. `client.sessions.create(use_uuid='existing-uuid')` - should raise error

### SDK Level (TypeScript)
1. `client.sessions.create()` - should work as before
2. `client.sessions.create({ useUuid: 'valid-uuid' })` - should create with specified ID
3. `client.sessions.create({ useUuid: 'existing-uuid' })` - should raise error
