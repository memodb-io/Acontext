# SkillsBench × Acontext Evaluation

## Features / Showcase

Evaluate Acontext's self-learning skill feature using the SkillsBench benchmark, demonstrating that experience-based skill learning outperforms zero-shot self-generation and can improve upon human-curated skills.

### Hypothesis

SkillsBench (Li et al., 2026) showed:
- Curated skills improve agent pass rate by **+16.2 pp** on average
- Self-generated skills (agent writes skills before solving, with no prior experience) provide **-1.3 pp** (no benefit)

Acontext's skill learner is structurally different from SkillsBench's self-generated condition — it learns from **actual task outcomes** (distilling success/failure trajectories), not from imagination. We hypothesize that Acontext-learned skills will:
1. Provide positive improvement over baseline (unlike self-generated's -1.3pp)
2. Close part of the gap between "no skills" and "curated skills"
3. Potentially improve upon curated skills by adding failure-derived anti-patterns

### Key Metric: Pass@2-Adaptive

This is not standard pass@k (k independent attempts). Round 2 is **informed by Round 1** via Acontext's learning pipeline. We call this **pass@2-adaptive** — a sequential, experience-augmented retry.

## Design Overview

### Evaluation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ ROUND 1: Standard SkillsBench Evaluation                    │
│                                                             │
│  Condition A: No Skills         → 5 trials × 84 tasks      │
│  Condition B: Curated Skills    → 5 trials × 84 tasks      │
│                                                             │
│  Output: trajectories with pass/fail per trial              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ LEARNING PHASE: Acontext Skill Learning                     │
│                                                             │
│  Per task, per trial (per-task learning, learn from all 5): │
│                                                             │
│  For each task:                                             │
│    For each of the 5 trials:                                │
│      1. Create Acontext session                             │
│      2. Store trajectory as messages                        │
│      3. Create task, set status = success/failed            │
│         (uses new update_task_status SDK)                   │
│      4. Acontext distills → skill agent runs                │
│      5. Skills accumulate in learning space                 │
│                                                             │
│  Two learning spaces:                                       │
│    LS-A: learns from Condition A trajectories (no skills)   │
│    LS-B: learns from Condition B trajectories (curated)     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SKILL EXPORT: Download Learned Skills                       │
│                                                             │
│  For each learning space:                                   │
│    1. List skills via SDK: client.skills.list_catalog()     │
│    2. Download each skill's files via client.skills.get_file│
│       or client.skills.download_to_sandbox()                │
│    3. Package into SkillsBench-compatible skills/ directory  │
│                                                             │
│  Output:                                                    │
│    skills-A/  (learned from no-skills trajectories)         │
│    skills-B/  (curated + learned from curated trajectories) │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ ROUND 2: Re-run SkillsBench with Learned Skills             │
│                                                             │
│  Condition A': Acontext-learned skills     → 5 trials × 84 │
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
│  Primary comparisons:                                       │
│    A' vs A  — Does learning from failure help?              │
│    B' vs B  — Can Acontext improve curated skills?          │
│    A' vs B  — Can learned-from-scratch match human-curated? │
│    B' vs A' — Does starting point (curated vs nothing)      │
│               affect learned skill quality?                  │
│                                                             │
│  Secondary analysis:                                        │
│    - Per-domain breakdown (which domains learn best?)       │
│    - Skill content comparison (learned vs curated)          │
│    - Failure mode shift analysis (Round 1 → Round 2)        │
│    - Learning efficiency by difficulty tier                  │
└─────────────────────────────────────────────────────────────┘
```

### SkillsBench Summary

| Item | Detail |
|------|--------|
| Paper | SkillsBench (Li et al., Feb 2026, arXiv:2602.12670) |
| Tasks | 84 evaluated tasks across 11 domains |
| Difficulty | Core (17, <60min), Extended (43, 1-4h), Extreme (26, >4h) |
| Conditions | No Skills, Curated Skills, Self-Generated Skills |
| Harnesses | Claude Code, Gemini CLI, Codex CLI |
| Models | Claude Opus 4.5/4.6, Sonnet 4.5, Haiku 4.5, GPT-5.2, Gemini 3 Pro/Flash |
| Trials | 5 per task per condition (3 for self-generated) |
| Verification | Deterministic pytest assertions, binary pass/fail |
| Key result | Curated: +16.2pp, Self-generated: -1.3pp |
| Infrastructure | Docker containers (ubuntu:24.04), Harbor framework |
| Task structure | instruction.md, task.toml, environment/, solution/, tests/ |
| Skill injection | Copy to /root/.claude/skills, /root/.codex/skills, etc. |
| Metrics | Pass rate, normalized gain g, absolute Δ |

### Key SkillsBench Findings Relevant to This Evaluation

1. **Self-generated skills are useless (-1.3pp)** — but they are generated with zero experience. Acontext learns from real outcomes.
2. **2-3 skills optimal (+18.6pp), 4+ skills diminish (+5.9pp)** — Acontext's domain-level skill organization naturally produces fewer, broader skills.
3. **Detailed skills > comprehensive skills** — Acontext's entry format (SOP/Warning with specific fields) produces focused, actionable content.
4. **Healthcare (+51.9pp) and Manufacturing (+41.9pp) benefit most** — domains with specialized procedural knowledge underrepresented in pretraining. These are the best domains to test Acontext learning.
5. **16/84 tasks show negative skill delta** — skills can hurt. Does Acontext avoid this by learning from failures?

### Trajectory → Acontext Session Adaptation

SkillsBench trajectories are terminal interaction logs (agent sends shell commands, gets output). These need to be adapted into Acontext's expected format:

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

**Trajectory summary format**: The raw terminal log may be too long. We should distill it into a concise summary:
- For success: what commands were run, what approach worked, what the output was
- For failure: what was attempted, where it failed, what error occurred

### Agent Harness Selection

For practical scope, we recommend starting with **one harness-model configuration**:

| Option | Rationale |
|--------|-----------|
| Claude Code + Opus 4.6 | Highest normalized gain (29.9%), native skill integration, supports self-generated condition for comparison |
| Gemini CLI + Flash | Highest absolute pass rate (48.7%), cheapest per trial ($0.57) |

**Recommendation**: Start with **Claude Code + Opus 4.6** — it has the best skill utilization and Acontext's skill format aligns with Claude Code's native skill spec.

### Learning Space Setup

Two independent learning spaces per harness-model configuration:

- **LS-A** (No Skills path): Empty at start. Learns from Round 1 Condition A trajectories.
  - Expected: Creates new skills from scratch based on failure/success analysis
  - Tests: Can Acontext build useful procedural knowledge from zero?

- **LS-B** (Curated Skills path): Pre-loaded with SkillsBench curated skills. Learns from Round 1 Condition B trajectories.
  - Expected: Updates curated skills with SOPs from successes and warnings from failures
  - Tests: Can Acontext enhance already-good skills?

### Per-Task Learning Order

Within each learning space, tasks are processed sequentially. All 5 trials for a task are processed before moving to the next task. Order within a domain matters (earlier task learnings accumulate for later tasks in the same domain).

**Task ordering strategy**: Process tasks within each domain in difficulty order (Core → Extended → Extreme), so simpler tasks establish foundational skills that harder tasks can build on.

## TODOs

### Prerequisites
- [ ] **Disable task status change** — implement session-level `disable_task_status_change` flag (see `plans/disable-task-status-change.md`)
- [ ] **Task status update SDK** — implement the `update_task_status` feature (see `plans/task-status-update-sdk.md`)
- [ ] **SkillsBench access** — obtain the benchmark tasks, environments, and verifiers from the SkillsBench repository

### Phase 1: Trajectory Collection (Round 1)
- [ ] **Set up SkillsBench infrastructure** — Docker, Harbor framework, agent harness configuration
- [ ] **Run Round 1 Condition A** — No Skills, 5 trials × 84 tasks on chosen harness-model
- [ ] **Run Round 1 Condition B** — Curated Skills, 5 trials × 84 tasks on chosen harness-model
- [ ] **Collect and store trajectories** — save terminal logs, pass/fail results, verifier output per trial

### Phase 2: Acontext Learning
- [ ] **Build trajectory adapter script** — converts SkillsBench terminal logs into Acontext session format (messages + task status)
- [ ] **Create learning spaces** — LS-A (empty), LS-B (pre-loaded with curated skills)
- [ ] **Run learning pipeline for LS-A** — process all Condition A trajectories (84 tasks × 5 trials, ordered by domain then difficulty)
- [ ] **Run learning pipeline for LS-B** — process all Condition B trajectories (same ordering)
- [ ] **Audit learned skills** — list all skills in each learning space, review content quality

### Phase 3: Skill Export & Round 2
- [ ] **Export skills from LS-A** — download all skill files, package into SkillsBench `skills/` directory format
- [ ] **Export skills from LS-B** — download curated + learned skills, package into `skills/` directory format
- [ ] **Run Round 2 Condition A'** — Acontext-learned skills (from LS-A), 5 trials × 84 tasks
- [ ] **Run Round 2 Condition B'** — Curated + Acontext-learned skills (from LS-B), 5 trials × 84 tasks

### Phase 4: Analysis
- [ ] **Compute pass rates** — Round 1 vs Round 2, all conditions, using SkillsBench's Method D scoring (84-task fixed denominator, average over 5 trials)
- [ ] **Primary comparisons** — A' vs A, B' vs B, A' vs B, B' vs A'
- [ ] **Per-domain breakdown** — which domains does Acontext learning help most?
- [ ] **Failure mode analysis** — compare failure categories (timeout, execution, coherence, verification) between rounds
- [ ] **Skill content analysis** — qualitative comparison of Acontext-learned vs SkillsBench curated skills
- [ ] **Task-level analysis** — identify which specific tasks improved/degraded

## New Deps

- SkillsBench benchmark suite (Harbor framework, task definitions, verifiers)
- Docker environment for running SkillsBench containers
- Agent harness (Claude Code / Gemini CLI / Codex CLI)
- API keys for chosen model

## Test Cases

- [ ] Trajectory adapter correctly converts SkillsBench terminal logs to Acontext session format
- [ ] `update_task_status` correctly triggers distillation for success and failure
- [ ] Skill learner produces non-empty skills from Condition A (no skills) trajectories
- [ ] Skill learner correctly updates curated skills from Condition B trajectories
- [ ] Exported skills maintain valid SKILL.md format with YAML frontmatter
- [ ] Exported skills directory structure is SkillsBench-compatible (works when copied to container)
- [ ] Round 2 agents can discover and load the exported skills
- [ ] Pass rates are computed identically to SkillsBench methodology (Method D, 5-trial average, 84-task denominator)
- [ ] Results are reproducible with temperature 0
