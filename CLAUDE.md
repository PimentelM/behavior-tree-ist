# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**behavior-tree-ist** — a code-first TypeScript behaviour tree library focused on developer experience. Provides composable, type-safe nodes with lifecycle hooks, decorators, builder functions, JSX support, and runtime inspection.

## Commands

```bash
yarn test              # Run all tests (vitest)
yarn test:watch        # Run tests in watch mode
yarn test src/nodes/decorators/repeat.test.ts  # Run a single test file
yarn build             # Build with tsup (ESM + CJS)
yarn lint              # ESLint
yarn typecheck         # TypeScript --noEmit
```

After making changes, validate with `yarn test && yarn lint`.

## Architecture

### Node Type Hierarchy

All nodes extend `BTNode` (src/base/node.ts):
- **Leaf nodes**: `Action` (performs work, returns NodeResult) and `ConditionNode` (pure check, returns boolean mapped to Succeeded/Failed)
- **Composite nodes** (src/nodes/composite/): Have multiple children — `Sequence` (AND), `Fallback` (OR), `Parallel`, memory variants, `IfThenElse`, utility-scored variants
- **Decorator nodes** (src/nodes/decorators/): Wrap a single child — timing guards, result transformers, control flow, lifecycle hooks

### Tick Lifecycle (BTNode.Tick)

1. Not running → `onEnter`; was running → `onResume`
2. `onTick()` (abstract — each node type implements this)
3. If transitioning out of Running → `onReset`
4. Post-tick hooks: `onTicked`, `onSuccess`/`onFailed`/`onRunning`/`onFinished`/etc.

`BTNode.Abort` is separate: calls `onAbort` then `onReset` (only if node was running). `onAbort` is the only hook not invoked during normal ticking.

### NodeResult

Three-valued: `Succeeded`, `Failed`, `Running`. Defined as a const object + type in src/base/types.ts.

### Three APIs for Tree Construction

1. **Direct instantiation + `.decorate()`** — type-safe decorator specs applied right-to-left: `node.decorate([Repeat, 3], [Timeout, 1000])`
2. **Builder functions** (behavior-tree-ist/builder) — `sequence()`, `action()`, `condition()`, etc. Accept props that auto-apply decorators
3. **JSX/TSX** (behavior-tree-ist/tsx) — `<sequence>`, `<action>` etc. with decorator props; uses custom factory `BT.createElement`

### Package Exports

Four entry points: main (`"."`), `"./builder"`, `"./tsx"`, `"./inspector"`.

## Conventions

- **NodeFlags**: bitfield classification system (Leaf, Composite, Decorator, Action, Condition, Sequence, Selector, Parallel, Memory, Stateful, Utility, Repeating, ResultTransformer, Guard, Lifecycle). Every concrete node calls `addFlags()` in its constructor. Flags have no impact on core BT functionality — they exist for external tooling, UI, and inspector integrations.
- **Sentinel timing fields** (`startedAt`, `lastTriggeredAt`, `lastFinishedAt`, `firstSuccessAt`, `startTime`, `lastNow`): always compare with `=== undefined`, never use falsy checks (ESLint enforces this — `0` is a valid timestamp).
- **`getDisplayState()`**: stateful decorators override this to expose debugging info for the inspector/serializer.
- **Test helpers** (src/test-helpers.ts): prefer `createNodeTicker()` over manually creating a TickContext — it handles tick ID incrementing and provides both `tick()` and `abort()` methods. Use `StubAction` for configurable result queues with lifecycle counters.
- Unused parameters are prefixed with `_`. No explicit `any` allowed.
- **Documentation**: After every code change (new nodes, renamed props, changed behavior, new exports, etc.), update the corresponding docs in `docs/` and `README.md` to stay in sync. See the doc-to-source mapping below.

## Documentation

Docs live in `docs/` with a root `README.md`. After any code change, update the relevant doc files:

| Source area | Doc files to update |
|---|---|
| `src/base/node.ts`, `src/base/types.ts` | `docs/core-concepts.md`, `docs/node-flags.md` |
| `src/base/action.ts`, `src/base/condition.ts`, `src/nodes/actions/` | `docs/leaf-nodes.md` |
| `src/nodes/composite/` | `docs/composite-nodes.md` |
| `src/nodes/decorators/` | `docs/decorators.md` |
| `src/builder/index.ts` (NodeProps, builder functions) | `docs/construction-apis.md` |
| `src/tsx/` | `docs/tsx.md` |
| `src/inspector/` | `docs/inspector.md` |
| `src/tree.ts` | `docs/behaviour-tree-class.md` |
| New node types or base class changes | `docs/custom-nodes.md` |
| Package exports, major features | `README.md` |
