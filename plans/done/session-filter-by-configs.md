# Session Filter by Configs

## Features

Add the ability to filter sessions by their `configs` JSONB field when listing sessions. This enables users to:
- Create sessions with specific config metadata (e.g., `{"agent_1": "xxxx"}`)
- Query and retrieve only sessions matching specific config key-value pairs

### Proposed API

**Python SDK:**
```python
# Create session with configs (already supported)
client.sessions.create(configs={"agent_1": "xxxx"})

# List sessions filtered by configs (NEW)
sessions = client.sessions.list(
    limit=20,
    filter_by_configs={"agent_1": "xxxx"}
)

# Filter with nested objects
sessions = client.sessions.list(
    filter_by_configs={"agent": {"name": "bot1", "version": "2.0"}}
)
```

**TypeScript SDK:**
```typescript
// Create session with configs (already supported)
await client.sessions.create({ configs: { agent_1: "xxxx" } });

// List sessions filtered by configs (NEW)
const sessions = await client.sessions.list({
    limit: 20,
    filterByConfigs: { agent_1: "xxxx" }
});

// Filter with nested objects
const sessions = await client.sessions.list({
    filterByConfigs: { agent: { name: "bot1", version: "2.0" } }
});
```

**REST API (raw):**
```bash
# URL encoding required for raw API calls
curl -X GET "https://api.acontext.io/session?limit=20&filter_by_configs=%7B%22agent_1%22%3A%22xxxx%22%7D" \
  -H "Authorization: Bearer sk_project_token"
```

---

## Overall Design

### API Design

**Endpoint:** `GET /session`

**New Query Parameter:**
| Parameter           | Type   | Required | Description                                             |
| ------------------- | ------ | -------- | ------------------------------------------------------- |
| `filter_by_configs` | string | No       | URL-encoded JSON object for JSONB containment filtering |

**Example Request (decoded for readability):**
```
GET /session?limit=20&filter_by_configs={"agent_1":"xxxx"}
```

**Note:** In practice, the JSON must be URL-encoded. SDKs handle this automatically.

### Database Query

Use PostgreSQL JSONB containment operator `@>` for efficient filtering:

```sql
SELECT * FROM sessions 
WHERE project_id = $1 
  AND configs @> '{"agent_1": "xxxx"}'::jsonb
ORDER BY created_at DESC
LIMIT 20;
```

**Benefits of `@>` operator:**
- Supports partial matching (filter is subset of configs)
- Supports nested objects: `{"a": {"b": 1}}` matches `{"a": {"b": 1, "c": 2}}`
- Can be indexed with GIN index for performance

### Data Flow

```
SDK (dict) → JSON.stringify → HTTP Client (URL encode) → API Handler (parse JSON) 
→ Service Layer → Repo Layer (GORM parameterized) → PostgreSQL JSONB Query
```

---

## Implementation TODOs

### 1. API Layer (Go) - `handler/session.go`

- [x] **1.1** Update `GetSessionsReq` struct
  ```go
  type GetSessionsReq struct {
      User            string `form:"user" json:"user" example:"alice@acontext.io"`
      Limit           int    `form:"limit,default=20" json:"limit" binding:"required,min=1,max=200" example:"20"`
      Cursor          string `form:"cursor" json:"cursor"`
      TimeDesc        bool   `form:"time_desc,default=false" json:"time_desc" example:"false"`
      FilterByConfigs string `form:"filter_by_configs" json:"filter_by_configs"` // NEW: JSON-encoded string
  }
  ```

- [x] **1.2** Update `GetSessions` handler with validation
  ```go
  // After binding request...
  
  // Parse filter_by_configs JSON string
  var filterByConfigs map[string]interface{}
  if req.FilterByConfigs != "" {
      if err := json.Unmarshal([]byte(req.FilterByConfigs), &filterByConfigs); err != nil {
          c.JSON(http.StatusBadRequest, serializer.ParamErr("invalid filter_by_configs JSON", err))
          return
      }
      // Skip empty object - treat as no filter
      if len(filterByConfigs) == 0 {
          filterByConfigs = nil
      }
  }
  
  out, err := h.svc.List(c.Request.Context(), service.ListSessionsInput{
      ProjectID:       project.ID,
      User:            req.User,
      FilterByConfigs: filterByConfigs,  // NEW
      Limit:           req.Limit,
      Cursor:          req.Cursor,
      TimeDesc:        req.TimeDesc,
  })
  ```

- [x] **1.3** Update Swagger annotations
  ```go
  // GetSessions godoc
  //
  //  @Summary      Get sessions
  //  @Description  Get all sessions under a project, optionally filtered by user or configs
  //  @Tags         session
  //  @Accept       json
  //  @Produce      json
  //  @Param        user              query  string  false  "User identifier to filter sessions"
  //  @Param        filter_by_configs query  string  false  "JSON-encoded object for JSONB containment filter. Example: {\"agent\":\"bot1\"}"
  //  @Param        limit             query  integer false  "Limit of sessions to return, default 20. Max 200."
  //  @Param        cursor            query  string  false  "Cursor for pagination"
  //  @Param        time_desc         query  string  false  "Order by created_at descending"
  //  ...
  ```

- [x] **1.4** Update code samples in Swagger `@x-code-samples`
  ```go
  //  @x-code-samples [{"lang":"python","source":"from acontext import AcontextClient\n\nclient = AcontextClient(api_key='sk_project_token')\n\n# List sessions filtered by configs\nsessions = client.sessions.list(\n    limit=20,\n    filter_by_configs={\"agent\": \"bot1\"}\n)\n","label":"Python"}]
  ```

### 2. Service Layer (Go) - `service/session.go`

- [x] **2.1** Update `ListSessionsInput` struct
  ```go
  type ListSessionsInput struct {
      ProjectID       uuid.UUID              `json:"project_id"`
      User            string                 `json:"user"`
      FilterByConfigs map[string]interface{} `json:"filter_by_configs"` // NEW
      Limit           int                    `json:"limit"`
      Cursor          string                 `json:"cursor"`
      TimeDesc        bool                   `json:"time_desc"`
  }
  ```

- [x] **2.2** Update `List()` method to pass filter to repo
  ```go
  func (s *sessionService) List(ctx context.Context, in ListSessionsInput) (*ListSessionsOutput, error) {
      // ... cursor parsing ...
      
      sessions, err := s.sessionRepo.ListWithCursor(
          ctx,
          in.ProjectID,
          in.User,
          in.FilterByConfigs,  // NEW parameter
          afterT,
          afterID,
          in.Limit+1,
          in.TimeDesc,
      )
      // ... rest unchanged ...
  }
  ```

### 3. Repository Layer (Go) - `repo/session.go`

- [x] **3.1** Update `SessionRepo` interface
  ```go
  type SessionRepo interface {
      // ... other methods ...
      ListWithCursor(
          ctx context.Context,
          projectID uuid.UUID,
          userIdentifier string,
          filterByConfigs map[string]interface{}, // NEW parameter
          afterCreatedAt time.Time,
          afterID uuid.UUID,
          limit int,
          timeDesc bool,
      ) ([]model.Session, error)
  }
  ```

- [x] **3.2** Update `ListWithCursor` implementation
  ```go
  func (r *sessionRepo) ListWithCursor(
      ctx context.Context,
      projectID uuid.UUID,
      userIdentifier string,
      filterByConfigs map[string]interface{}, // NEW
      afterCreatedAt time.Time,
      afterID uuid.UUID,
      limit int,
      timeDesc bool,
  ) ([]model.Session, error) {
      q := r.db.WithContext(ctx).Where("sessions.project_id = ?", projectID)
  
      // Filter by user identifier if provided
      if userIdentifier != "" {
          q = q.Joins("JOIN users ON users.id = sessions.user_id").
              Where("users.identifier = ?", userIdentifier)
      }
  
      // NEW: Apply configs filter if provided (non-nil and non-empty)
      if filterByConfigs != nil && len(filterByConfigs) > 0 {
          // CRITICAL: Use parameterized query to prevent SQL injection
          jsonBytes, err := json.Marshal(filterByConfigs)
          if err != nil {
              return nil, fmt.Errorf("marshal filter_by_configs: %w", err)
          }
          q = q.Where("sessions.configs @> ?", string(jsonBytes))
      }
  
      // ... cursor pagination and ordering unchanged ...
  }
  ```

### 4. Python SDK

- [x] **4.1** Update `SessionsAPI.list()` in `resources/sessions.py`
  ```python
  def list(
      self,
      *,
      user: str | None = None,
      limit: int | None = None,
      cursor: str | None = None,
      time_desc: bool | None = None,
      filter_by_configs: Mapping[str, Any] | None = None,  # NEW
  ) -> ListSessionsOutput:
      """List all sessions in the project.

      Args:
          user: Filter by user identifier. Defaults to None.
          limit: Maximum number of sessions to return. Defaults to None.
          cursor: Cursor for pagination. Defaults to None.
          time_desc: Order by created_at descending if True. Defaults to None.
          filter_by_configs: Filter by session configs using JSONB containment.
              Only sessions where configs contains all key-value pairs in this
              dict will be returned. Supports nested objects. Defaults to None.

      Returns:
          ListSessionsOutput containing the list of sessions and pagination info.
      
      Example:
          >>> sessions = client.sessions.list(filter_by_configs={"agent": "bot1"})
      """
      params: dict[str, Any] = {}
      if user:
          params["user"] = user
      # Handle filter_by_configs - JSON encode, skip empty dict
      if filter_by_configs is not None and len(filter_by_configs) > 0:
          params["filter_by_configs"] = json.dumps(filter_by_configs)
      params.update(
          build_params(
              limit=limit,
              cursor=cursor,
              time_desc=time_desc,
          )
      )
      data = self._requester.request("GET", "/session", params=params or None)
      return ListSessionsOutput.model_validate(data)
  ```

- [x] **4.2** Update `AsyncSessionsAPI.list()` in `resources/async_sessions.py`
  - Same signature and logic as sync version, with `async def` and `await`

### 5. TypeScript SDK - `resources/sessions.ts`

- [x] **5.1** Update `SessionsAPI.list()`
  ```typescript
  async list(options?: {
    user?: string | null;
    limit?: number | null;
    cursor?: string | null;
    timeDesc?: boolean | null;
    filterByConfigs?: Record<string, unknown> | null;  // NEW
  }): Promise<ListSessionsOutput> {
    const params: Record<string, string | number> = {};
    if (options?.user) {
      params.user = options.user;
    }
    // NEW: Handle filterByConfigs - JSON encode, skip empty object
    if (options?.filterByConfigs && Object.keys(options.filterByConfigs).length > 0) {
      params.filter_by_configs = JSON.stringify(options.filterByConfigs);
    }
    Object.assign(
      params,
      buildParams({
        limit: options?.limit ?? null,
        cursor: options?.cursor ?? null,
        time_desc: options?.timeDesc ?? null,
      })
    );
    const data = await this.requester.request('GET', '/session', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return ListSessionsOutputSchema.parse(data);
  }
  ```

### 6. Documentation

- [x] **6.1** Check if session list docs exist and update if needed
  - Location: `docs/store/per-user.mdx`
  - Added `filter_by_configs` parameter description
  - Documented: case sensitivity, type sensitivity, partial matching, NULL exclusion

### 7. Testing

**Test file locations:**
- API tests: `src/server/api/go/internal/modules/handler/session_test.go`
- Python SDK tests: `src/client/acontext-py/tests/test_client.py`
- TypeScript SDK tests: `src/client/acontext-ts/tests/client.test.ts`

- [x] **7.1** Add API integration tests
  - Basic filter, multi-key filter, nested object filter
  - Combined user + filter_by_configs
  - **Remember: Delete test sessions after each test** (per workspace rules)
  
- [x] **7.2** Add edge case tests
  - Empty `{}` filter → returns all sessions (no filter applied)
  - Invalid JSON string → returns 400 Bad Request

- [x] **7.3** Add SDK tests
  - Verify empty dict `{}` is NOT sent to API
  - Verify filter is JSON-encoded in request params
  - Verify nested objects work correctly
  - Verify combination with user filter

---

## Impact Files

### API (Go)
| File                                                    | Change                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/server/api/go/internal/modules/handler/session.go` | Add `FilterByConfigs` to request struct, parse JSON, update swagger |
| `src/server/api/go/internal/modules/service/session.go` | Add field to `ListSessionsInput`, pass to repo                      |
| `src/server/api/go/internal/modules/repo/session.go`    | Add param to interface and impl, add JSONB WHERE clause             |

### Python SDK
| File                                                              | Change                                       |
| ----------------------------------------------------------------- | -------------------------------------------- |
| `src/client/acontext-py/src/acontext/resources/sessions.py`       | Add `filter_by_configs` param with docstring |
| `src/client/acontext-py/src/acontext/resources/async_sessions.py` | Add `filter_by_configs` param with docstring |

### TypeScript SDK
| File                                               | Change                       |
| -------------------------------------------------- | ---------------------------- |
| `src/client/acontext-ts/src/resources/sessions.ts` | Add `filterByConfigs` option |

---

## New Dependencies

**None required.** All functionality uses existing:
- Go: `encoding/json` (already imported), `gorm.io/gorm` (JSONB support built-in)
- Python: `json` (standard library, already imported)
- TypeScript: `JSON` (built-in)

---

## Test Cases

### API Integration Tests

| #   | Test Name              | Setup                                                                              | Action                                        | Expected                               |
| --- | ---------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- |
| 1   | Filter single key      | Create sessions: A(`{"agent":"bot1"}`), B(`{"agent":"bot2"}`), C(`{"env":"prod"}`) | Filter `{"agent":"bot1"}`                     | Returns only A                         |
| 2   | Filter multiple keys   | Create: A(`{"agent":"bot1","env":"prod"}`), B(`{"agent":"bot1","env":"dev"}`)      | Filter `{"agent":"bot1","env":"prod"}`        | Returns only A                         |
| 3   | Filter nested object   | Create: A(`{"agent":{"name":"bot1","v":"2"}}`), B(`{"agent":{"name":"bot2"}}`)     | Filter `{"agent":{"name":"bot1"}}`            | Returns only A                         |
| 4   | Filter with pagination | Create 15 sessions with `{"agent":"bot1"}`                                         | Filter with limit=5                           | Returns 5, has_more=true, cursor works |
| 5   | Filter no matches      | Create: A(`{"agent":"bot1"}`)                                                      | Filter `{"agent":"bot2"}`                     | Returns empty list, no error           |
| 6   | Filter + user combined | Create: A(user1, `{"agent":"bot1"}`), B(user2, `{"agent":"bot1"}`)                 | Filter user=user1, configs=`{"agent":"bot1"}` | Returns only A                         |
| 7   | NULL configs excluded  | Create: A(`{"agent":"bot1"}`), B(configs=NULL)                                     | Filter `{"agent":"bot1"}`                     | Returns only A                         |
| 8   | Empty filter `{}`      | Create: A, B, C                                                                    | Filter `{}`                                   | Returns all (no filter applied)        |
| 9   | Invalid JSON           | -                                                                                  | Filter `{invalid}`                            | Returns 400 Bad Request                |
| 10  | Case sensitivity       | Create: A(`{"Agent":"x"}`)                                                         | Filter `{"agent":"x"}`                        | Returns empty (no match)               |
| 11  | Type sensitivity       | Create: A(`{"count":1}`)                                                           | Filter `{"count":"1"}`                        | Returns empty (no match)               |

**Cleanup:** Each test must delete created sessions.

### SDK Unit Tests

| #   | Test Name                                   | Expected                                           |
| --- | ------------------------------------------- | -------------------------------------------------- |
| 1   | Python: filter_by_configs is JSON-encoded   | `params["filter_by_configs"]` is a JSON string     |
| 2   | Python: empty dict not sent                 | `{}` filter does not add `filter_by_configs` param |
| 3   | TypeScript: filterByConfigs is JSON-encoded | `params.filter_by_configs` is a JSON string        |
| 4   | TypeScript: empty object not sent           | `{}` filter does not add param                     |

---

## Risks & Mitigations

| Risk                       | Severity | Mitigation                                                       | Verification                          |
| -------------------------- | -------- | ---------------------------------------------------------------- | ------------------------------------- |
| **SQL Injection**          | 🔴 High   | Use GORM parameterized query: `Where("configs @> ?", jsonBytes)` | Code review: no `fmt.Sprintf` in repo |
| **URL Encoding**           | 🟡 Medium | SDKs use JSON.stringify, HTTP clients auto-encode                | Test with special chars in values     |
| **Empty `{}` Matches All** | 🟡 Medium | Check `len(filter) > 0` in handler AND repo                      | Test case #8                          |
| **NULL Configs Excluded**  | 🟢 Low    | Document in SDK docstrings                                       | Test case #7                          |
| **Case/Type Sensitivity**  | 🟢 Low    | Document in SDK docstrings                                       | Test cases #10, #11                   |

---

## Notes

### Naming Conventions

| Layer           | Parameter Name      | Style      |
| --------------- | ------------------- | ---------- |
| REST API        | `filter_by_configs` | snake_case |
| Go Handler      | `FilterByConfigs`   | PascalCase |
| Go Service/Repo | `filterByConfigs`   | camelCase  |
| Python SDK      | `filter_by_configs` | snake_case |
| TypeScript SDK  | `filterByConfigs`   | camelCase  |

### Performance Considerations

- The `@>` operator performs sequential scan without an index
- For large datasets (>100k sessions), add GIN index:
  ```sql
  CREATE INDEX idx_sessions_configs ON sessions USING GIN (configs);
  ```
- This is optional - add when performance becomes an issue

### Edge Case Handling Summary

| Input                         | Handler                | SDK               | Repo             | Result         |
| ----------------------------- | ---------------------- | ----------------- | ---------------- | -------------- |
| `filter_by_configs={"a":"b"}` | Parse, pass to service | JSON encode, send | Add WHERE clause | Filter applied |
| `filter_by_configs={}`        | Parse, set to nil      | Don't send param  | Skip WHERE       | No filter      |
| `filter_by_configs` missing   | nil                    | Don't send param  | Skip WHERE       | No filter      |
| `filter_by_configs={invalid}` | Return 400             | N/A (dict type)   | N/A              | Error          |
| Session with `configs=NULL`   | N/A                    | N/A               | Excluded by `@>` | Not returned   |

### Code Review Checklist

Before merging, verify:
- [x] No string interpolation in SQL queries (check repo layer)
- [x] Empty filter `{}` does NOT apply containment query
- [x] Handler returns 400 for malformed JSON with clear error message
- [x] SDK docstrings document case/type sensitivity
- [x] Swagger docs include `filter_by_configs` with examples
- [x] All tests pass and clean up created sessions
- [x] Both sync and async Python SDK updated identically
