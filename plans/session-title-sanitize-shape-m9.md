# Session Title Sanitize Output Milestone 9

## features/show case
- Sanitize LLM title output and enforce a stable title shape before persistence.

## designs overview
- Keep scope to `controller/message.py`.
- Add compact post-processing:
  - strip quotes/newlines
  - normalize spaces
  - enforce max title length
  - fallback to first-user text if model output is unusable

## TODOS
- [x] Add title-output sanitizer helper with fallback behavior.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`
- [x] Apply sanitizer in generation flow before downstream usage.
  - Files to modify:
    - `src/server/core/acontext_core/service/controller/message.py`

## new deps
- None.

## test cases
- [ ] Quoted/newline model output is normalized to plain single-line text.
- [ ] Overlong model output is truncated to max length.
- [ ] Empty or non-informative model output falls back to first-user text.
