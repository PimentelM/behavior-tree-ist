# Node Flags

`NodeFlags` is a bitfield classification system for categorizing nodes. Flags have **no impact on core behaviour tree functionality** -- they exist for external tooling, UI, inspector integrations, and filtering.

Every concrete node calls `addFlags()` in its constructor to register its categories.

## Flag Values

| Flag | Value | Description |
|---|---|---|
| `Leaf` | `0x001` | No children |
| `Composite` | `0x002` | Has multiple children |
| `Decorator` | `0x004` | Wraps a single child |
| `Action` | `0x008` | Leaf that performs work |
| `Condition` | `0x010` | Leaf that performs a pure boolean check |
| `Sequence` | `0x020` | AND-like flow (ticks children in order, fails on first failure) |
| `Selector` / `Fallback` | `0x040` | OR-like flow (ticks children in order, succeeds on first success) |
| `Parallel` | `0x080` | Ticks all children concurrently |
| `Memory` | `0x100` | Remembers last running child index across ticks |
| `Stateful` | `0x200` | Has internal time/counter state exposed via `getDisplayState()` |
| `Utility` | `0x400` | Uses utility scoring for child prioritization |
| `Repeating` | `0x800` | Loops child execution (Repeat, Retry, KeepRunningUntilFailure) |
| `ResultTransformer` | `0x1000` | Remaps child result (Inverter, ForceSuccess, etc.) |
| `Guard` | `0x2000` | Conditionally gates child execution |
| `Lifecycle` | `0x4000` | Lifecycle hook side-effect decorator |

## Checking Flags

Use the `hasFlag()` utility:

```typescript
import { hasFlag, NodeFlags } from 'behavior-tree-ist';

if (hasFlag(node.nodeFlags, NodeFlags.Stateful)) {
  const state = node.getDisplayState?.();
}

// Combine flags with bitwise OR
const isStatefulGuard = hasFlag(node.nodeFlags, NodeFlags.Stateful | NodeFlags.Guard);
```

## TreeIndex Filtering

The [inspector](inspector.md)'s `TreeIndex` provides convenience methods that use flags:

```typescript
import { TreeInspector } from 'behavior-tree-ist/inspector';

const inspector = new TreeInspector();
inspector.indexTree(tree.serialize());

const leaves = inspector.tree!.getLeaves();       // NodeFlags.Leaf
const composites = inspector.tree!.getComposites(); // NodeFlags.Composite
const decorators = inspector.tree!.getDecorators(); // NodeFlags.Decorator

// Custom flag queries
const guards = inspector.tree!.getByFlag(NodeFlags.Guard);
const statefulNodes = inspector.tree!.getByFlag(NodeFlags.Stateful);
```

## Adding Flags to Custom Nodes

When creating custom nodes, call `addFlags()` in the constructor:

```typescript
import { Action, NodeFlags } from 'behavior-tree-ist';

class MyCustomAction extends Action {
  readonly defaultName = 'MyCustomAction';

  constructor() {
    super();
    this.addFlags(NodeFlags.Stateful); // Mark as stateful if it has internal state
  }

  // ...
}
```

Multiple flags can be combined: `this.addFlags(NodeFlags.Stateful | NodeFlags.Guard)`.
