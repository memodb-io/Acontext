# Session Title Ordering Revert

## features/show case
- Revert session title generation ordering change to minimize code churn.
- Keep behavior as title generation/persist before task agent processing.

## designs overview
- Touch only `message.py` control flow ordering.
- Preserve non-ordering improvements: variable naming clarity and error handling.

## TODOS
- [x] Move title generation/persist block back before `task_agent_curd`.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`
- [x] Keep return semantics and message status updates unchanged.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`
- [x] Run syntax validation for touched file.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [x] Title generation executes before `task_agent_curd`.
- [x] Function still returns task agent result.
- [x] `python3 -m py_compile` passes for `message.py`.
