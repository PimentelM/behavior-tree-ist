# CLAUDE.md

Behavior Tree Studio — code-first, dependency-free Behavior Tree library for TypeScript focused on user experience, with a graphical interface for tracing, profiling and debugging.

## Packages

- **core** — code-first behavior tree library focused on UX
- **react** — react implementation of studio-ui component
- **studio** — facade package published to npm (bundles cli + server + ui + demos) (TBD)
- **cli** — CLI (`bt-studio`) to launch studio server + ui
- **studio-ui** — React UI for real-time execution traces, time travel, cpu profiling. Binds the react component to the server
- **studio-server** — WebSocket/HTTP/TCP server bridging agents ↔ UI
- **studio-transport** — library of TCP/WebSocket transports for Node + browser
- **studio-common** — shared Zod schemas and protocol definitions across studio packages
- **studio-plugins** — first-party plugins; ships ReplPlugin (NaCl E2E encrypted JS eval)
- **studio-mcp** — MCP server exposing eval/completions to AI agents via E2E-encrypted REPL

## Commands

```bash
yarn test                # all tests (vitest)
yarn test <file>         # single file
yarn build               # tsup (ESM + CJS)
yarn lint                # ESLint
yarn typecheck           # tsc --noEmit
yarn check               # run after changes for lint + tests
```

Validate: `yarn typecheck && yarn lint && yarn test`

## Core Architecture

All nodes extend `BTNode` (`packages/core/src/base/node.ts`):
- **Leaf**: `Action` (returns NodeResult), `ConditionNode` (bool → Succeeded/Failed)
- **Composite** (`nodes/composite/`): `Sequence`, `Fallback`, `Parallel`, memory variants, `IfThenElse`, utility variants
- **Decorator** (`nodes/decorators/`): wraps single child — timing, result transforms, control flow, lifecycle

**Tick lifecycle**: onEnter/onResume → onTick() → onReset (if leaving Running) → post-tick hooks.
**Abort**: onAbort → onReset (only if was running).

**Construction APIs**: direct instantiation + `.decorate()`, builder functions (`./builder`), JSX (`./tsx`).
**Exports**: `"."`, `"./builder"`, `"./tsx"`, `"./inspector"`.

## Conventions

- **Timing fields**: compare with `=== undefined`, never falsy checks (`0` is valid)
- **NodeFlags**: bitfield for tooling/UI, no core impact. Every node calls `addFlags()` in constructor
- **Test helpers** (`packages/core/src/test-helpers.ts`): use `createNodeTicker()` and `StubAction`
- Unused params: `_` prefix. No explicit `any`
- Update `docs/` and `README.md` after code changes

## Testing

- No mocks — use real dependencies
- AAA sections separated by empty lines; comments only in bigger tests

<!-- mulch:start -->
## Project Expertise (Mulch)
<!-- mulch-onboard-v:1 -->

This project uses [Mulch](https://github.com/jayminwest/mulch) for structured expertise management.

**At the start of every session**, run:
```bash
mulch prime
```

This injects project-specific conventions, patterns, decisions, and other learnings into your context.
Use `mulch prime --files src/foo.ts` to load only records relevant to specific files.

**Before completing your task**, review your work for insights worth preserving — conventions discovered,
patterns applied, failures encountered, or decisions made — and record them:
```bash
mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
```

Link evidence when available: `--evidence-commit <sha>`, `--evidence-bead <id>`

Run `mulch status` to check domain health and entry counts.
Run `mulch --help` for full usage.
Mulch write commands use file locking and atomic writes — multiple agents can safely record to the same domain concurrently.

### Before You Finish

1. Discover what to record:
   ```bash
   mulch learn
   ```
2. Store insights from this work session:
   ```bash
   mulch record <domain> --type <convention|pattern|failure|decision|reference|guide> --description "..."
   ```
3. Validate and commit:
   ```bash
   mulch sync
   ```
<!-- mulch:end -->

<!-- seeds:start -->
## Issue Tracking (Seeds)
<!-- seeds-onboard-v:1 -->

This project uses [Seeds](https://github.com/jayminwest/seeds) for git-native issue tracking.

**At the start of every session**, run:
```
sd prime
```

This injects session context: rules, command reference, and workflows.

**Quick reference:**
- `sd ready` — Find unblocked work
- `sd create --title "..." --type task --priority 2` — Create issue
- `sd update <id> --status in_progress` — Claim work
- `sd close <id>` — Complete work
- `sd dep add <id> <depends-on>` — Add dependency between issues
- `sd sync` — Sync with git (run before pushing)

### Before You Finish
1. Close completed issues: `sd close <id>`
2. File issues for remaining work: `sd create --title "..."`
3. Sync and push: `sd sync && git push`
<!-- seeds:end -->

<!-- canopy:start -->
## Prompt Management (Canopy)
<!-- canopy-onboard-v:1 -->

This project uses [Canopy](https://github.com/jayminwest/canopy) for git-native prompt management.

**At the start of every session**, run:
```
cn prime
```

This injects prompt workflow context: commands, conventions, and common workflows.

**Quick reference:**
- `cn list` — List all prompts
- `cn render <name>` — View rendered prompt (resolves inheritance)
- `cn emit --all` — Render prompts to files
- `cn update <name>` — Update a prompt (creates new version)
- `cn sync` — Stage and commit .canopy/ changes

**Do not manually edit emitted files.** Use `cn update` to modify prompts, then `cn emit` to regenerate.
<!-- canopy:end -->
