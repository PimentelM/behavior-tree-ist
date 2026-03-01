# BehaviourTree Class

`BehaviourTree` is the top-level wrapper that manages tick execution, state tracing, profiling, and serialization.

## Constructor

```typescript
import { BehaviourTree } from '@behavior-tree-ist/core';

const tree = new BehaviourTree(rootNode);
```

The constructor validates that no node instance appears more than once in the tree (via BFS traversal). Throws an error if duplicates are found:

```
Error: Duplicate appearance of node in the tree: Attack (id: 5)
```

This prevents subtle bugs where the same node object is shared across branches.

## Ticking

```typescript
const result = tree.tick({ now: Date.now() });
```

**Parameters:**
- `now` (optional): Numeric time value for this tick. Defaults to `Date.now()` (milliseconds) if omitted. Timing decorators compute durations as differences between `now` values, so the unit must match the values passed to timing decorator constructors.

**Returns** a `TickRecord`:

```typescript
interface TickRecord {
  tickId: number;             // Auto-incremented tick identifier
  timestamp: number;          // The `now` value used for this tick
  events: TickTraceEvent[];   // Lightweight per-node events (always present for ticked nodes)
  refEvents: RefChangeEvent[]; // Ref changes recorded during this tick (when state trace is enabled)
}
```

`refEvents` captures all writes to named `Ref` instances during the tick. See [Core Concepts — Ref System](core-concepts.md#ref-system) for details.

The `tickId` auto-increments starting from 1. Each call to `tick()` executes `BTNode.Tick()` on the root node, which recursively traverses the tree.

### Game Loop Example

```typescript
const tree = new BehaviourTree(root);

// Fixed timestep game loop
const TICK_RATE = 100; // ms
setInterval(() => {
  const record = tree.tick({ now: Date.now() }); // Real-time ms (one common pattern)

  if (record.events.length > 0) {
    // Process node events
  }
}, TICK_RATE);
```

## State Tracing

`TickTraceEvent` base fields (`tickId`, `timestamp`, `nodeId`, `result`) are always recorded for ticked nodes.  
State tracing controls heavier state-related capture used by inspector/debugger tooling.

```typescript
tree.enableStateTrace();   // Enable getDisplayState() + refEvents capture
tree.disableStateTrace();  // Disable getDisplayState() + refEvents capture
```

Both methods return `this` for chaining:

```typescript
const tree = new BehaviourTree(root).enableStateTrace();
```

Each tick's `TickRecord.events` array contains one entry per node ticked:

```typescript
type TickTraceEvent = {
  tickId: number;
  nodeId: number;
  timestamp: number;
  result: NodeResult;
  state?: SerializableState;  // Included when state tracing is enabled
  startedAt?: number;         // Profiling timing (if enabled)
  finishedAt?: number;        // Profiling timing (if enabled)
};
```

## Profiling

Profiling adds high-resolution timing to trace events. It requires a time provider function (e.g., `performance.now`):

```typescript
tree.enableProfiling(performance.now.bind(performance));
tree.disableProfiling();
```

Profiling is independent from state tracing. Each tick event includes `startedAt` and `finishedAt` when profiling is enabled.

## Serialization

Serialize the tree structure for inspection, debugging, or persistence:

```typescript
const snapshot = tree.serialize();                          // Structure only
const snapshotWithState = tree.serialize({ includeState: true }); // With node display states
const json = tree.toJSON();                                 // Shorthand for serialize({ includeState: true })
```

Returns a `SerializableNode`:

```typescript
interface SerializableNode {
  id: number;
  nodeFlags: NodeFlags;
  defaultName: string;
  name: string;
  children?: SerializableNode[];
  state?: SerializableState;   // Only with includeState
  tags?: readonly string[];
  activity?: string | true;
}
```

## Chaining

All configuration methods return `this`:

```typescript
const tree = new BehaviourTree(root)
  .enableStateTrace()
  .enableProfiling(performance.now.bind(performance));
```

## Integration with Inspector

The typical pattern for runtime debugging:

```typescript
import { BehaviourTree } from '@behavior-tree-ist/core';
import { TreeInspector } from '@behavior-tree-ist/core/inspector';

const tree = new BehaviourTree(root).enableStateTrace();
const inspector = new TreeInspector({ maxTicks: 2000 });

// Index tree structure once
inspector.indexTree(tree.serialize());

// In your tick loop
function gameLoop() {
  const record = tree.tick({ now: Date.now() });
  inspector.ingestTick(record);
}
```

See [inspector.md](inspector.md) for the full inspector API.
