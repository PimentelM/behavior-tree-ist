# Behavior Tree Studio

Code-first, dependency-free Behavior Tree library for TypeScript focused on user experience, with a graphical interface for tracing, profiling and debugging.

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
npm install @bt-studio/core
```

```typescript
import { BehaviourTree, NodeResult } from '@bt-studio/core';
import { fallback, sequence, condition, action } from '@bt-studio/core/builder';

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
import { Fallback, Sequence, ConditionNode, Action, NodeResult } from '@bt-studio/core';

const flee = Sequence.from('Flee', [
  ConditionNode.from('In danger?', () => entity.inDanger),
  Action.from('Run away', () => NodeResult.Succeeded),
]);
const patrol = Action.from('Patrol', () => NodeResult.Running);
const root = Fallback.from([flee, patrol]);
```

**Builder functions:**

```typescript
import { fallback, sequence, condition, action } from '@bt-studio/core/builder';

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
import { BT } from '@bt-studio/core/tsx';

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
| `@bt-studio/core` | Core library: all node classes, `BehaviourTree`, types |
| `@bt-studio/core/builder` | Builder functions with `NodeProps`-based decorator application |
| `@bt-studio/core/tsx` | JSX factory (`BT.createElement`, `BT.Fragment`) and type declarations |
| `@bt-studio/core/inspector` | `TreeInspector`, `TreeIndex`, `TickStore`, `Profiler`, and related types |
| `@bt-studio/core/activity` | Standalone activity projection from `SerializableNode` + `TickRecord` |
| `@bt-studio/react` | React debugger component with tree visualization and time-travel |

## Documentation

1. [Getting Started](docs/getting-started.md) - Installation, first tree, tick loop
2. [Core Concepts](docs/core-concepts.md) - NodeResult, lifecycle hooks, TickContext, BTNode
3. [Leaf Nodes](docs/leaf-nodes.md) - Action, ConditionNode, built-in leaves
4. [Composite Nodes](docs/composite-nodes.md) - Sequence, Fallback, Parallel, IfThenElse, and more
5. [Decorators](docs/decorators.md) - All 30+ decorators grouped by category
6. [Construction APIs](docs/construction-apis.md) - Direct instantiation, builder, TSX comparison
7. [TSX](docs/tsx.md) - Full JSX/TSX reference
8. [Inspector](docs/inspector.md) - TreeInspector, profiling, serialization
9. [BehaviourTree Class](docs/behaviour-tree-class.md) - Wrapper class, state tracing, tick loop
10. [Custom Nodes](docs/custom-nodes.md) - Extending the library
11. [Node Flags](docs/node-flags.md) - NodeFlags bitfield reference
12. [React Debugger](docs/react-debugger.md) - `<BehaviourTreeDebugger>` component
13. [Roadmap](docs/roadmap.md) - Planned features

## React Debugger

The `@bt-studio/react` package provides a drop-in React component for debugging behaviour trees with real-time visualization and time-travel.

The debugger supports frozen paused mode (live ingestion continues in background), strict per-tick results, compact decorator visualization, node-local ref mutation traces, and a ref details explorer with latest-state plus full timeline filtering. Timeline and toolbar indicators also surface each tick's `time` value, auto-format Unix timestamps as `hh:mm:ss`, and provide a toolbar toggle to switch between timestamp and numeric display.

```bash
npm install @bt-studio/react
```

```tsx
import { BehaviourTreeDebugger } from '@bt-studio/react';

// In your app — you handle transport (WebSocket, polling, etc.)
<BehaviourTreeDebugger
  tree={tree.serialize()}
  ticks={collectedTickRecords}
  panels={{ nodeDetails: true, timeline: true, refTraces: true, activityNow: true }}
  activityDisplayMode="running_or_success"
  defaultThemeMode="dark"
  showToolbar={true}
  showThemeToggle={true}
  layoutDirection="TB"
  width="100%"
  height="600px"
  isolateStyles={true}
  onNodeSelect={(nodeId) => console.log('Selected:', nodeId)}
  onTickChange={(tickId) => console.log('Viewing tick:', tickId)}
/>
```

`BehaviourTreeDebugger` uses Shadow DOM style isolation by default, so host-page CSS does not leak into the debugger internals.

See [docs/react-debugger.md](docs/react-debugger.md) for the full API reference.

## Roadmap

- **Studio App** (`@bt-studio/studio`) - Standalone debugging UI with recording and playback

See [docs/roadmap.md](docs/roadmap.md) for details.

## License

MIT
