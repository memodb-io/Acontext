# SkillsBench × Acontext Evaluation
github repo: https://github.com/benchflow-ai/skillsbench
paper: https://arxiv.org/pdf/2602.12670
trajectories: https://huggingface.co/datasets/xdotli/skillsbench-trajectories

## Features / Showcase
Evaluate Acontext's self-learning skill feature using the SkillsBench benchmark, demonstrating that experience-based skill learning can improve upon human-curated skills.

### Hypothesis

SkillsBench (Li et al., 2026) showed:
- Curated skills improve agent pass rate by **+16.2 pp** on average
- Self-generated skills (agent writes skills before solving, with no prior experience) provide **-1.3 pp** (no benefit)

Acontext's skill learner is structurally different from SkillsBench's self-generated condition — it learns from **actual task outcomes** (distilling success/failure trajectories), not from imagination. We hypothesize that Acontext-learned skills will:
1. Improve upon curated skills by adding failure-derived anti-patterns and success-derived SOPs
2. Reduce the 16/84 tasks where curated skills hurt performance (by learning what to avoid)

### Key Metric: Pass@2-Adaptive

This is not standard pass@k (k independent attempts). Round 2 is **informed by Round 1** via Acontext's learning pipeline. We call this **pass@2-adaptive** — a sequential, experience-augmented retry.

### Scope: Condition B Only (Curated Skills)

We use pre-existing trajectories from the SkillsBench HuggingFace dataset (`xdotli/skillsbench-trajectories`). The `skillsbench-with-skills/` folder contains Condition B (Curated Skills) trajectories run with **Claude Code + Opus 4.5** (`claude-opus-4-5@20251101`). This lets us skip Round 1 entirely and focus on:
- Can Acontext learn from curated-skills trajectories and produce **even better** skills?

Condition A (No Skills) trajectories are not available in the dataset. We can add them in a future iteration if needed.

## Design Overview

### Evaluation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ DATA SOURCE: Pre-existing SkillsBench Trajectories          │
│                                                             │
│  Downloaded from HuggingFace:                               │
│    xdotli/skillsbench-trajectories/skillsbench-with-skills/ │
│                                                             │
│  Condition B: Curated Skills, Claude Code + Opus 4.5        │
│  Per trial: result.json (pass/fail), agent/claude-code.txt  │
│             (full trajectory), config.json                  │
│                                                             │
│  No Round 1 execution needed — trajectories are reused.     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ LEARNING PHASE: Acontext Skill Learning                     │
│                                                             │
│  Per task, per trial (learn from all available trials):     │
│                                                             │
│  For each task:                                             │
│    For each trial:                                          │
│      1. Create Acontext session                             │
│         (disable_task_status_change=True)                   │
│      2. Store trajectory as messages                        │
│      3. Flush → task extracted                              │
│      4. Set task status = success/failed                    │
│         (uses update_task_status SDK)                       │
│      5. Acontext distills → skill agent runs                │
│      6. Skills accumulate in learning space                 │
│                                                             │
│  One learning space:                                        │
│    LS-B: learns from Condition B trajectories (curated)     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SKILL EXPORT: Download Learned Skills                       │
│                                                             │
│  From LS-B:                                                 │
│    1. List skills: client.learning_spaces.list_skills()     │
│    2. Download each: client.skills.download(skill_id, path) │
│    3. Package into SkillsBench-compatible skills/ directory  │
│                                                             │
│  Output:                                                    │
│    skills-B/  (curated + Acontext-learned from trajectories)│
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ ROUND 2: Re-run SkillsBench with Learned Skills             │
│                                                             │
│  Condition B': Curated + Acontext-learned  → 5 trials × 84 │
│                                                             │
│  Skills injected via SkillsBench standard mechanism:        │
│    COPY skills /root/.claude/skills                         │
│    COPY skills /root/.codex/skills                          │
│    COPY skills /root/.gemini/skills                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ ANALYSIS                                                    │
│                                                             │
│  Primary comparison:                                        │
│    B' vs B  — Can Acontext improve curated skills?          │
│                                                             │
│  Secondary analysis:                                        │
│    - Per-domain breakdown (which domains learn best?)       │
│    - Skill content comparison (learned vs curated)          │
│    - Failure mode shift analysis (Round 1 → Round 2)        │
│    - Learning efficiency by difficulty tier                  │
│    - Tasks where curated skills hurt (16/84): does          │
│      Acontext learning fix them?                            │
└─────────────────────────────────────────────────────────────┘
```

### SkillsBench Summary

| Item            | Detail                                                                  |
| --------------- | ----------------------------------------------------------------------- |
| Paper           | SkillsBench (Li et al., Feb 2026, arXiv:2602.12670)                     |
| Tasks           | 84 evaluated tasks across 11 domains                                    |
| Difficulty      | Core (17, <60min), Extended (43, 1-4h), Extreme (26, >4h)               |
| Conditions      | No Skills, Curated Skills, Self-Generated Skills                        |
| Harnesses       | Claude Code, Gemini CLI, Codex CLI                                      |
| Models          | Claude Opus 4.5/4.6, Sonnet 4.5, Haiku 4.5, GPT-5.2, Gemini 3 Pro/Flash |
| Trials          | 5 per task per condition (3 for self-generated)                         |
| Verification    | Deterministic pytest assertions, binary pass/fail                       |
| Key result      | Curated: +16.2pp, Self-generated: -1.3pp                                |
| Infrastructure  | Docker containers (ubuntu:24.04), Harbor framework                      |
| Task structure  | instruction.md, task.toml, environment/, solution/, tests/              |
| Skill injection | Copy to /root/.claude/skills, /root/.codex/skills, etc.                 |
| Metrics         | Pass rate, normalized gain g, absolute Δ                                |

### Key SkillsBench Findings Relevant to This Evaluation

1. **Self-generated skills are useless (-1.3pp)** — but they are generated with zero experience. Acontext learns from real outcomes.
2. **2-3 skills optimal (+18.6pp), 4+ skills diminish (+5.9pp)** — Acontext's domain-level skill organization naturally produces fewer, broader skills.
3. **Detailed skills > comprehensive skills** — Acontext's entry format (SOP/Warning with specific fields) produces focused, actionable content.
4. **Healthcare (+51.9pp) and Manufacturing (+41.9pp) benefit most** — domains with specialized procedural knowledge underrepresented in pretraining. These are the best domains to test Acontext learning.
5. **16/84 tasks show negative skill delta** — skills can hurt. Does Acontext avoid this by learning from failures?

### HuggingFace Trajectory Format

Each trial in `skillsbench-with-skills/{task_name}__{trial_id}/` contains:
- `result.json` — `verifier_result.rewards.reward` (0.0 = fail, 1.0 = pass), timestamps, agent config
- `config.json` — agent name (`claude-code`), model (`claude-opus-4-5@20251101`), env config
- `agent/claude-code.txt` — full Claude Code agent transcript (~100-300KB)
- `agent/sessions/` — Claude Code internal session data
- `agent/command-*/` — individual command I/O
- `verifier/` — verifier output

### Trajectory → Acontext Session Adaptation

The `agent/claude-code.txt` transcripts need to be adapted into Acontext's expected format:

```python
# For each SkillsBench trajectory:
# disable_task_status_change=True prevents auto status resolution,
# so we control when learning is triggered
session = client.sessions.create(disable_task_status_change=True)

# Store the task instruction as user message
client.sessions.store_message(
    session_id=session.id,
    blob={"role": "user", "content": instruction_md_content},
    format="openai",
)

# Store the agent's approach/trajectory as assistant message
client.sessions.store_message(
    session_id=session.id,
    blob={"role": "assistant", "content": trajectory_summary},
    format="openai",
)

# Wait for task extraction (tasks created with descriptions/progress, but status stays "running")
client.sessions.flush(session.id)

# Get the extracted task and manually set status based on verifier result
tasks = client.sessions.get_tasks(session.id)
task = tasks.items[0]
client.sessions.update_task_status(
    session_id=session.id,
    task_id=task.id,
    status="success" if trial_passed else "failed",
)
# This triggers the full pipeline: distillation → skill agent → skill stored
```

**Trajectory summary format**: The raw `claude-code.txt` transcript can be 100-300KB. We should distill it into a concise summary:
- For success: what commands were run, what approach worked, what the output was
- For failure: what was attempted, where it failed, what error occurred
- Consider using an LLM to summarize long transcripts (or truncate to the last N lines)

### Agent Harness Selection

For practical scope, we recommend starting with **one harness-model configuration**:

| Option                 | Rationale                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Claude Code + Opus 4.6 | Highest normalized gain (29.9%), native skill integration, supports self-generated condition for comparison |
| Gemini CLI + Flash     | Highest absolute pass rate (48.7%), cheapest per trial ($0.57)                                              |

**Recommendation**: Start with **Claude Code + Opus 4.6** — it has the best skill utilization and Acontext's skill format aligns with Claude Code's native skill spec.

### Learning Space Setup

One learning space for this iteration:

- **LS-B** (Curated Skills path): Pre-loaded with SkillsBench curated skills. Learns from Condition B trajectories downloaded from HuggingFace.
  - Expected: Updates curated skills with SOPs from successes and warnings from failures
  - Tests: Can Acontext enhance already-good skills?

> **Future work**: Add LS-A (empty, learns from no-skills trajectories) once Condition A trajectory data is available.

### Per-Task Learning Order

Within each learning space, tasks are processed sequentially. All 5 trials for a task are processed before moving to the next task. Order within a domain matters (earlier task learnings accumulate for later tasks in the same domain).

**Task ordering strategy**: Process tasks within each domain in difficulty order (Core → Extended → Extreme), so simpler tasks establish foundational skills that harder tasks can build on.

## TODOs

### Prerequisites
- [x] **Disable task status change** — session-level `disable_task_status_change` flag (see `plans/disable-task-status-change.md`)
- [x] **Task status update SDK** — `update_task_status` / `updateTaskStatus` exists in both Python and TypeScript SDKs
- [ ] **SkillsBench access** — clone repo (`benchflow-ai/skillsbench`), obtain task definitions, environments, and verifiers

### Phase 1: Download Trajectories (No Round 1 Execution)
- [ ] **Download HuggingFace dataset** — `huggingface-cli download xdotli/skillsbench-trajectories` (694 MB)
- [ ] **Audit dataset coverage** — enumerate tasks in `skillsbench-with-skills/`, verify which of the 84 tasks have trials, count trials per task
- [ ] **Parse result.json files** — extract pass/fail (`verifier_result.rewards.reward`), task name, agent config per trial
- [ ] **Parse agent trajectories** — read `agent/claude-code.txt` per trial, determine trajectory format and length

### Phase 2: Acontext Learning
- [ ] **Build trajectory adapter script** — converts `claude-code.txt` + `result.json` into Acontext session format (messages + task status). Files: `eval/adapter.py`
  - Parse `claude-code.txt` into a trajectory summary (truncate/distill if too long)
  - Read `instruction.md` from the SkillsBench tasks repo for each task
  - Read `result.json` for pass/fail status
- [ ] **Create learning space LS-B** — pre-loaded with SkillsBench curated skills
- [ ] **Run learning pipeline for LS-B** — process all Condition B trajectories (ordered by domain then difficulty). Files: `eval/learn.py`
- [ ] **Audit learned skills** — list all skills in LS-B, review content quality

### Phase 3: Skill Export & Round 2
- [ ] **Export skills from LS-B** — `client.skills.download(skill_id, path="./skills-B/")` for each skill, package into SkillsBench `skills/` directory format. Files: `eval/export.py`
- [ ] **Run Round 2 Condition B'** — Curated + Acontext-learned skills (from LS-B), 5 trials × 84 tasks via Harbor

### Phase 4: Analysis
- [ ] **Compute pass rates** — Round 1 (from HF data) vs Round 2, using SkillsBench's Method D scoring (84-task fixed denominator, average over 5 trials). Files: `eval/analyze.py`
- [ ] **Primary comparison: B' vs B** — can Acontext improve curated skills?
- [ ] **Per-domain breakdown** — which domains does Acontext learning help most?
- [ ] **Failure mode analysis** — compare failure categories (timeout, execution, coherence, verification) between rounds
- [ ] **Skill content analysis** — qualitative comparison of Acontext-learned vs SkillsBench curated skills
- [ ] **Task-level analysis** — identify which specific tasks improved/degraded, focus on the 16/84 where curated skills hurt

## New Deps

- SkillsBench benchmark suite (Harbor framework, task definitions, verifiers) — for Round 2 only
- Docker environment for running SkillsBench containers — for Round 2 only
- `huggingface-cli` or `huggingface_hub` — for downloading trajectory dataset
- Agent harness (Claude Code) — for Round 2 only
- API keys for Claude Opus model — for Round 2 only

## Test Cases

- [ ] Trajectory adapter correctly parses `claude-code.txt` and `result.json` into Acontext session format
- [ ] `update_task_status` correctly triggers distillation for success and failure
- [ ] Skill learner correctly updates curated skills from Condition B trajectories
- [ ] Exported skills maintain valid SKILL.md format with YAML frontmatter
- [ ] Exported skills directory structure is SkillsBench-compatible (works when copied to container)
- [ ] Round 2 agents can discover and load the exported skills
- [ ] Pass rates are computed identically to SkillsBench methodology (Method D, 5-trial average, 84-task denominator)
- [ ] Results are reproducible with temperature 0
