# @bt-studio/core

Code-first, dependency-free Behavior Tree library for TypeScript focused on user experience.

## Features

- **Type-safe**: Full TypeScript support with compile-time validation of decorator specs
- **Lifecycle hooks**: 12 hooks covering every phase of node execution and abort
- **Three construction APIs**: Direct instantiation, builder functions, and TSX/JSX
- **Rich node library**: 8 composite types, 30+ decorators, and built-in leaf nodes
- **Ref system**: `Ref<T>`, `ReadonlyRef<T>`, `DerivedRef<T>`, `multiRef()`, and `patchRef()` for type-safe, auto-traced state sharing between nodes
- **Runtime inspector**: Tick recording, time-travel snapshots, profiling, and flame graphs
- **Zero dependencies**: No runtime deps; ESM and CJS bundles via tsup

## Quick Start

```bash
npm install @bt-studio/core
```

```typescript
import { BehaviourTree, NodeResult, fallback, sequence, condition, action } from '@bt-studio/core';

const entity = { health: 100, inDanger: false };

const tree = new BehaviourTree(
  fallback({}, [
    sequence({ name: 'Flee' }, [
      condition({ name: 'In danger?', eval: () => entity.inDanger }),
      action({ name: 'Run away', execute: () => {
        entity.inDanger = false;
        return NodeResult.Succeeded;
      }}),
    ]),
    action({ name: 'Patrol', execute: () => NodeResult.Running }),
  ])
);

setInterval(() => tree.tick({ now: Date.now() }), 100);
```

## Package Exports

| Entry point | Description |
|---|---|
| `@bt-studio/core` | Core library: all node classes, builder functions, `BehaviourTree`, activity projection, and types |
| `@bt-studio/core/tsx` | JSX factory (`BT.createElement`, `BT.Fragment`) and type declarations |
| `@bt-studio/core/inspector` | `TreeInspector`, `TreeIndex`, `TickStore`, `Profiler`, and related types |

## Documentation

See the [project documentation](../../docs/getting-started.md) for the full guide, or the [root README](../../README.md) for an overview.

## License

MIT
