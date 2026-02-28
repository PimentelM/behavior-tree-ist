# behavior-tree-ist

A code-first TypeScript behaviour tree library focused on developer experience.

## Features

- **Type-safe**: Full TypeScript support with compile-time validation of decorator specs
- **Lifecycle hooks**: 12 hooks covering every phase of node execution and abort
- **Three construction APIs**: Direct instantiation, builder functions, and TSX/JSX
- **Rich node library**: 8 composite types, 30+ decorators, and built-in leaf nodes
- **Ref system**: `Ref<T>`, `ReadonlyRef<T>`, and `DerivedRef<T>` for type-safe, auto-traced state sharing between nodes
- **Runtime inspector**: Tick recording, time-travel snapshots, profiling, and flame graphs
- **Zero dependencies**: No runtime deps; ESM and CJS bundles via tsup

## Quick Start

```bash
npm install @behavior-tree-ist/core
```

```typescript
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { fallback, sequence, condition, action } from '@behavior-tree-ist/core/builder';

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

// Game loop
setInterval(() => {
  tree.tick({ now: Date.now() });
}, 100);
```

## Three Ways to Build Trees

The same tree can be expressed in three equivalent styles:

**Direct instantiation:**

```typescript
import { Fallback, Sequence, ConditionNode, Action, NodeResult } from '@behavior-tree-ist/core';

const flee = Sequence.from('Flee', [
  ConditionNode.from('In danger?', () => entity.inDanger),
  Action.from('Run away', () => NodeResult.Succeeded),
]);
const patrol = Action.from('Patrol', () => NodeResult.Running);
const root = Fallback.from([flee, patrol]);
```

**Builder functions:**

```typescript
import { fallback, sequence, condition, action } from '@behavior-tree-ist/core/builder';

const root = fallback({}, [
  sequence({ name: 'Flee' }, [
    condition({ name: 'In danger?', eval: () => entity.inDanger }),
    action({ name: 'Run away', execute: () => NodeResult.Succeeded }),
  ]),
  action({ name: 'Patrol', execute: () => NodeResult.Running }),
]);
```

**TSX:**

```tsx
import { BT } from '@behavior-tree-ist/core/tsx';

const root = (
  <fallback>
    <sequence name="Flee">
      <condition name="In danger?" eval={() => entity.inDanger} />
      <action name="Run away" execute={() => NodeResult.Succeeded} />
    </sequence>
    <action name="Patrol" execute={() => NodeResult.Running} />
  </fallback>
);
```

## Package Exports

| Entry point | Description |
|---|---|
| `@behavior-tree-ist/core` | Core library: all node classes, `BehaviourTree`, types |
| `@behavior-tree-ist/core/builder` | Builder functions with `NodeProps`-based decorator application |
| `@behavior-tree-ist/core/tsx` | JSX factory (`BT.createElement`, `BT.Fragment`) and type declarations |
| `@behavior-tree-ist/core/inspector` | `TreeInspector`, `TreeIndex`, `TickStore`, `Profiler`, and related types |

## Documentation

1. [Getting Started](docs/getting-started.md) - Installation, first tree, tick loop
2. [Core Concepts](docs/core-concepts.md) - NodeResult, lifecycle hooks, TickContext, BTNode
3. [Leaf Nodes](docs/leaf-nodes.md) - Action, ConditionNode, built-in leaves
4. [Composite Nodes](docs/composite-nodes.md) - Sequence, Fallback, Parallel, IfThenElse, and more
5. [Decorators](docs/decorators.md) - All 30+ decorators grouped by category
6. [Construction APIs](docs/construction-apis.md) - Direct instantiation, builder, TSX comparison
7. [TSX](docs/tsx.md) - Full JSX/TSX reference
8. [Inspector](docs/inspector.md) - TreeInspector, profiling, serialization
9. [BehaviourTree Class](docs/behaviour-tree-class.md) - Wrapper class, tracing, tick loop
10. [Custom Nodes](docs/custom-nodes.md) - Extending the library
11. [Node Flags](docs/node-flags.md) - NodeFlags bitfield reference
12. [Roadmap](docs/roadmap.md) - Planned features

## Roadmap

- **React Visualization** (`@behavior-tree-ist/react`) - Real-time tree visualization and time-travel debugging
- **Studio App** (`@behavior-tree-ist/studio`) - Standalone debugging UI with recording and playback

See [docs/roadmap.md](docs/roadmap.md) for details.

## License

MIT
