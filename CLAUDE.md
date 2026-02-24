# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

behavior-tree-ist is a TypeScript behaviour tree library for game AI / agent systems. It's published as an npm package with dual ESM/CJS output.

## Commands

- `yarn build` — Build with tsup (outputs to `dist/`)
- `yarn test` — Run tests with vitest
- `yarn test:watch` — Run tests in watch mode
- `vitest run src/path/to/file.test.ts` — Run a single test file
- `yarn lint` — Lint with ESLint
- `yarn typecheck` — Type-check with `tsc --noEmit`

## Architecture

The library is a classic behaviour tree implementation with these core abstractions in `src/base/`:

- **`BTNode`** — Abstract base for all nodes. Has a static `Tick(node, ctx)` method that drives execution and lifecycle hooks (`onTick`, `onSuccess`, `onFailed`, `onFinished`, `onAbort`). Nodes have auto-incrementing IDs and support a `.decorate()` fluent API for wrapping with decorators.
- **`TickContext`** — Passed through every tick; carries `tickId`, `tickNumber`, `now` timestamp, and a `trace` function for optional event recording.
- **`Composite`** — Base for nodes with multiple children (`_nodes` array). Provides child abort helpers.
- **`Decorator`** — Base for single-child wrapper nodes.
- **`Action`** — Leaf node base. Has a static `Action.from(name, fn)` factory for inline lambdas.
- **`Condition`** — Leaf node that evaluates a boolean predicate.

Built-in node implementations live in `src/nodes/`:
- **Composites**: `Selector` (OR), `Sequence` (AND), `Parallel`
- **Decorators**: `Inverter`, `AlwaysSucceed`, `AlwaysFail`, `Timeout`, `Throttle`, `ConditionDecorator`
- **Actions**: `Idle`, `Wait`

**`BehaviourTree`** (`src/tree.ts`) is the top-level runner — wraps a root node, manages tick IDs, and optionally records trace events.

Node results are the enum-like const `NodeResult`: `Succeeded`, `Failed`, `Running`.

## Conventions

- `no-explicit-any` is enforced by ESLint — never use `any`
- Tests go alongside source files as `*.test.ts` or `*.spec.ts` inside `src/`
- Package manager is **yarn**
