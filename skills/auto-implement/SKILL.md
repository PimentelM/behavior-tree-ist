---
name: auto-implement
description: >
  Autonomous multi-phase implementation agent orchestrated by a Behavior Tree.
  Use when the user wants to fully implement a feature, fix a bug from a ticket/issue,
  or complete a multi-step coding task autonomously. The BT guarantees deterministic
  sequencing: explore → plan → (implement → validate → review) loop → finalize.
  Invoke manually via /auto-implement.
---

# Auto-Implement

Autonomous implementation skill powered by a Behavior Tree orchestrator. The BT script
spawns independent `claude -p` agents for each phase, keeping this main agent's context
clean.

## Invocation

```
/auto-implement [--auto] <task description or issue URL>
```

- `--auto`: skip the initial clarification phase, go straight to autonomous execution.

## Workflow

### Phase 0 — Setup & Clarification (main agent)

1. Parse the user's request. Extract `--auto` flag if present.
2. Create workspace at `.claude/auto-implement-<timestamp>/`.
3. **If NOT `--auto`:**
   - Spawn an exploration subagent (using Agent tool) to do a quick scan of the codebase
     and identify ambiguities or questions about the task.
   - Present questions to the user and wait for answers.
   - Combine the original request + answers into an enriched request.
4. Write the request (enriched or original) to `<workspace>/request.md`.

### Phase 1 — Launch Orchestrator (main agent)

Run the BT orchestrator script. It handles everything autonomously from here:

```bash
npx tsx <SKILL_DIR>/scripts/src/orchestrator.tsx \
  --workspace <workspace> \
  --request <workspace>/request.md
```

Where `<SKILL_DIR>` is this skill's root directory (parent of this SKILL.md file).

This command blocks until all tasks are complete or the tree fails. The orchestrator
spawns its own `claude -p` instances — no further context accumulates here.

Optional: pass `--studio-url ws://host:port/ws` to connect to BT Studio for
real-time visualization (defaults to `ws://localhost:4100/ws`, silently skips if
unavailable).

### Phase 2 — Report (main agent)

After the orchestrator exits:
1. Read `<workspace>/status.json` for the final state.
2. Read `<workspace>/summary.md` for the completion report.
3. Present results to the user.
4. If the orchestrator failed, read logs from `<workspace>/logs/` to diagnose.

## Architecture

```
Main Agent (this)          BT Orchestrator (scripts/src/orchestrator.tsx)
  │                            │
  ├─ clarify with user         ├─ claude -p → Explorer agent
  ├─ write request.md          ├─ claude -p → Planner agent
  ├─ launch orchestrator ────► ├─ for each task:
  ├─ wait...                   │   ├─ claude -p → Worker agent
  │                            │   ├─ yarn lint/test/typecheck (subprocess)
  │                            │   └─ claude -p → Reviewer agent
  └─ report results ◄──────── └─ write summary.md
```

Each spawned `claude -p` agent has its own fresh context and can use the Agent tool
to spawn further subagents as needed. The BT enforces the sequence with Retry(5)
around the implement→validate→review loop.

## Important Notes

- The orchestrator uses `--dangerously-skip-permissions` for spawned agents so they
  can work autonomously. This is intentional for this autonomous workflow.
- All agent outputs are logged to `<workspace>/logs/` for debugging.
- Validation commands are auto-detected from `package.json` scripts (lint, typecheck, test).
- The orchestrator connects to BT Studio on the default port for visualization.
  This is optional and silently skipped if the server is not running.
