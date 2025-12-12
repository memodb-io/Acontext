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

Core

- [ ] Fix bugs for long-handing MQ disconnection.

SDK: Design `agent` interface: `tool_pool`

- [x] Offer tool_schema for openai/anthropic can directly operate artifacts

Chore

- [x] Telemetry：log detailed callings and latency

Integration

- [ ] Smolagent for e2e benchmark

## v0.1

Disk - more agentic interface

- [ ] Disk: file/dir sharing UI Component.
- [ ] Disk:  support get artifact with line number and offset

Space

- [ ] Space: export use_when as system prompt

Session - Context Engineering

- [ ] Message version control
- [ ] Session - Context Offloading based on Disks

Sandbox

- [ ] Add sandbox resource in Acontext
- [ ] Integrate Claude Skill 

Sercurity&Privacy

- [ ] Use project api key to encrypt context data in S3
