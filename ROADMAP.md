# Acontext Roadmap

current version: v0.0

## Integrations

We're always welcome to integrations PRs:

- If your integrations involve SDK or cli changes, pull requests in this repo.
- If your integrations are combining Acontext SDK and other frameworks, pull requests to https://github.com/memodb-io/Acontext-Examples where your templates can be downloaded through `acontext-cli`: `acontext create my-proj --template-path "LANGUAGE/YOUR-TEMPLATE"`



## Long-term effort

- Lower LLM cost
- Increase robustness; Reduce latency
- Safer storage
- Self-learning in more scenarios



## v0.0

Algorithms

- [x] Optimize task agent prompt to better reserve conditions of tasks 
  - [x] Task progress should contain more states(which website, database table, city...)
  - [x]  `use_when` should reserve the states
- [x] Experience agent on replace/update the existing experience.

Text Matching

- [ ] support `grep` and `glob` in Disks

Session - Context Engineering

- [x] Count tokens
- [x] Context editing ([doc](https://platform.claude.com/docs/en/build-with-claude/context-editing))

Dashboard

- [x] Add task viewer to show description, progress and preferences

SDK: Design `agent` interface: `tool_pool`

- [x] Offer tool_schema for openai/anthropic can directly operate artifacts

Chore

- [x] Telemetry：log detailed callings and latency

## v0.1

Disk - more agentic interface

- [ ] Disk: file/dir sharing UI Component.
- [ ] Disk: support get artifact with line number and offset

Space

- [ ] Space: export use_when as system prompt

Session - Context Engineering

- [ ] Message version control
- [ ] Session - Context Offloading based on Disks
- [ ] Session Message labeling (e.g., like, dislike, feedback)

Session - Metadata

- [ ] Session metadata: add metadata field (JSONB) to session table for user binding information (e.g., user_id)
  - [ ] Database: add metadata column with GIN index for query/filter support
  - [ ] API: support metadata in session creation and query/filter by metadata
  - [ ] SDK: support metadata parameter in session creation (convenience methods can be added later based on needs)

Observability

- [ ] User telemetry observation, service chain observation
- [ ] Improve internal service observation content

Dashboard

- [ ] Observability dashboard: display user telemetry metrics and service chain traces
- [ ] Internal service observation UI: visualize service health, latency, and error rates
- [ ] Session Message labeling UI: interface for like/dislike/feedback actions
- [ ] Disk operation observability: track file/dir sharing and artifact access metrics
- [ ] Sandbox resource monitoring UI: display sandbox usage and performance metrics

Sandbox

- [ ] Add sandbox resource in Acontext
- [ ] Integrate Claude Skill 

Sercurity&Privacy

- [ ] Use project api key to encrypt context data in S3

Integration

- [ ] Smolagent for e2e benchmark

LLM Integrations

- [ ] Add litellm as the proxy
