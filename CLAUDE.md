# CLAUDE.md

TypeScript behaviour tree monorepo.

## Packages

- **core** — code-first behavior tree library focused on UX
- **react** — react implementation of studio-ui component
- **studio** — facade package published to npm (bundles cli + server + ui + demos)
- **studio-cli** — CLI to launch studio server + ui (TBD)
- **studio-ui** — React UI for real-time execution traces, time travel, cpu profiling. Binds the react component to the server (TBD)
- **studio-server** — WebSocket/HTTP/TCP server bridging agents ↔ UI
- **studio-transport** — library of TCP/WebSocket transports for Node + browser
- **studio-common** — shared Zod schemas and protocol definitions across studio packages

## Commands

```bash
yarn test                # all tests (vitest)
yarn test <file>         # single file
yarn build               # tsup (ESM + CJS)
yarn lint                # ESLint
yarn typecheck           # tsc --noEmit
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
