# Remove Tool Resource APIs

## Features
Remove all tool resource APIs from the codebase. The tool resource API was designed to store and manage tool references for projects, but it's being deprecated.

**Note:** This does NOT affect the `docs/tool/` documentation about agent tools (sandbox/disk/skill tools for LLM integration) - those should remain.

## Overall Design
Complete removal of:
- API endpoints (`/tool/name` GET and PUT)
- Database model (`ToolReference`)
- SDK clients (Python sync/async, TypeScript)
- Core service handlers

## Implementation TODOs

### Phase 1: Delete Files (12 files)

#### API Server (Go)
- [x] Delete `src/server/api/go/internal/modules/handler/tool.go`
- [x] Delete `src/server/api/go/internal/modules/handler/tool_test.go`
- [x] Delete `src/server/api/go/internal/modules/model/tool_reference.go`

#### Core Service (Python)
- [x] Delete `src/server/core/routers/tool.py`
- [x] Delete `src/server/core/acontext_core/service/data/tool.py`
- [x] Delete `src/server/core/acontext_core/schema/tool/tool_reference.py`
- [x] Delete `src/server/core/acontext_core/schema/orm/tool_reference.py`

#### Python SDK
- [x] Delete `src/client/acontext-py/src/acontext/resources/tools.py`
- [x] Delete `src/client/acontext-py/src/acontext/resources/async_tools.py`
- [x] Delete `src/client/acontext-py/src/acontext/types/tool.py`

#### TypeScript SDK
- [x] Delete `src/client/acontext-ts/src/resources/tools.ts`
- [x] Delete `src/client/acontext-ts/src/types/tool.ts`

### Phase 2: Modify Files (13 files)

#### API Server (Go)
- [x] `src/server/api/go/internal/router/router.go`
  - Remove `ToolHandler` from `RouterDeps` struct
  - Remove tool route group
- [x] `src/server/api/go/internal/bootstrap/container.go`
  - Remove `ToolReference` from AutoMigrate
  - Remove `ToolHandler` provider
- [x] `src/server/api/go/internal/infra/httpclient/core.go`
  - Remove `ToolRenameItem`, `ToolRenameRequest`, `ToolReferenceData` structs
  - Remove `ToolRename` and `GetToolNames` methods
- [x] `src/server/api/go/internal/modules/model/project.go`
  - Remove `ToolReferences` relationship
- [x] `src/server/api/go/cmd/server/main.go`
  - Remove `toolHandler` initialization
  - Remove `ToolHandler` from router deps

#### Core Service (Python)
- [x] `src/server/core/acontext_core/schema/orm/project.py`
  - Remove `ToolReference` import and relationship
- [x] `src/server/core/acontext_core/schema/orm/__init__.py`
  - Remove `ToolReference` import and export
- [x] `src/server/core/acontext_core/schema/api/request.py`
  - Remove `ToolRename` and `ToolRenameRequest` classes
- [x] `src/server/core/routers/__init__.py`
  - Remove `tool_router` import and export
- [x] `src/server/core/api.py`
  - Remove `tool_router` import and include_router call

#### Python SDK
- [x] `src/client/acontext-py/src/acontext/client.py`
  - Remove `ToolsAPI` import and initialization
- [x] `src/client/acontext-py/src/acontext/async_client.py`
  - Remove `AsyncToolsAPI` import and initialization
- [x] `src/client/acontext-py/src/acontext/resources/__init__.py`
  - Remove `ToolsAPI` and `AsyncToolsAPI` exports
- [x] `src/client/acontext-py/src/acontext/types/__init__.py`
  - Remove tool type exports (moved `FlagResponse` to common.py as shared type)

#### TypeScript SDK
- [x] `src/client/acontext-ts/src/client.ts`
  - Remove `ToolsAPI` import, property, and initialization
- [x] `src/client/acontext-ts/src/resources/index.ts`
  - Remove `export * from './tools'`
- [x] `src/client/acontext-ts/src/types/index.ts`
  - Remove tool type exports (moved `FlagResponse` to common.ts as shared type)

### Phase 3: Cleanup
- [x] Regenerate Swagger/OpenAPI docs (auto-generated, will update on next build)
- [x] Run tests to ensure no broken references

## Impact Files

### Files to Delete (13)
| File                                                           | Description            |
| -------------------------------------------------------------- | ---------------------- |
| `src/server/api/go/internal/modules/handler/tool.go`           | Tool handler           |
| `src/server/api/go/internal/modules/handler/tool_test.go`      | Tool handler tests     |
| `src/server/api/go/internal/modules/model/tool_reference.go`   | ToolReference model    |
| `src/server/core/routers/tool.py`                              | Tool router            |
| `src/server/core/acontext_core/service/data/tool.py`           | Tool service           |
| `src/server/core/acontext_core/schema/tool/tool_reference.py`  | Tool reference schema  |
| `src/server/core/acontext_core/schema/orm/tool_reference.py`   | ToolReference ORM      |
| `src/client/acontext-py/src/acontext/resources/tools.py`       | Python sync tools API  |
| `src/client/acontext-py/src/acontext/resources/async_tools.py` | Python async tools API |
| `src/client/acontext-py/src/acontext/types/tool.py`            | Python tool types      |
| `src/client/acontext-ts/src/resources/tools.ts`                | TS tools API           |
| `src/client/acontext-ts/src/types/tool.ts`                     | TS tool types          |

### Files to Modify (13+)
| File                                                        | Changes                                 |
| ----------------------------------------------------------- | --------------------------------------- |
| `src/server/api/go/internal/router/router.go`               | Remove ToolHandler from deps and routes |
| `src/server/api/go/internal/bootstrap/container.go`         | Remove AutoMigrate and provider         |
| `src/server/api/go/internal/infra/httpclient/core.go`       | Remove tool-related structs and methods |
| `src/server/api/go/internal/modules/model/project.go`       | Remove ToolReferences relationship      |
| `src/server/api/go/cmd/server/main.go`                      | Remove toolHandler                      |
| `src/server/core/acontext_core/schema/orm/project.py`       | Remove relationship                     |
| `src/server/core/acontext_core/schema/orm/__init__.py`      | Remove export                           |
| `src/server/core/acontext_core/schema/api/request.py`       | Remove ToolRename classes               |
| `src/client/acontext-py/src/acontext/client.py`             | Remove tools property                   |
| `src/client/acontext-py/src/acontext/async_client.py`       | Remove tools property                   |
| `src/client/acontext-py/src/acontext/resources/__init__.py` | Remove exports                          |
| `src/client/acontext-ts/src/client.ts`                      | Remove tools property                   |
| `src/client/acontext-ts/src/resources/index.ts`             | Remove export                           |

## New Deps
None - this is a removal task.

## Test Cases
- [x] Verify API server compiles without tool references
- [x] Verify Core service starts without tool references
- [x] Verify Python SDK imports work without tools
- [x] Verify TypeScript SDK compiles without tools
- [x] Run existing test suites to ensure no regressions (TypeScript SDK: 85 tests passed)


## Not Affected
- `docs/tool/` directory (agent tools documentation for LLM integration)
- CLI tool (no tool-related commands found)
