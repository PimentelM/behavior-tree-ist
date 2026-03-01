# Inspector

The inspector system provides runtime tree inspection, tick recording, state reconstruction, and performance profiling. Import from `@behavior-tree-ist/core/inspector`.

For a visual debugger that wraps the inspector APIs, see the [`@behavior-tree-ist/react` debugger component](react-debugger.md).

## Overview

```typescript
import { BehaviourTree } from '@behavior-tree-ist/core';
import { TreeInspector } from '@behavior-tree-ist/core/inspector';

// 1. Create tree with state tracing enabled (optional for display/ref state)
const tree = new BehaviourTree(root).enableStateTrace();

// 2. Create inspector
const inspector = new TreeInspector({ maxTicks: 2000 });

// 3. Index tree structure (once)
inspector.indexTree(tree.serialize());

// 4. Feed tick data during execution
const record = tree.tick({ now: Date.now() });
inspector.ingestTick(record);

// 5. Query state
const snapshot = inspector.getLatestSnapshot();
const hotNodes = inspector.getHotNodes();
```

## TreeInspector

The main entry point. Combines tree indexing, tick storage, and profiling.

```typescript
class TreeInspector {
  constructor(options?: { maxTicks?: number }) // Default: 1000

  // Tree structure
  indexTree(root: SerializableNode): void;
  get tree(): TreeIndex | undefined;

  // Tick ingestion
  ingestTick(record: TickRecord): void;

  // State reconstruction
  getSnapshotAtTick(tickId: number): TreeTickSnapshot | undefined;
  getLatestSnapshot(): TreeTickSnapshot | undefined;
  getNodeAtTick(nodeId: number, tickId: number): NodeTickSnapshot | undefined;

  // History
  getNodeHistory(nodeId: number): TickTraceEvent[];
  getLastDisplayState(nodeId: number, atOrBeforeTickId?: number): SerializableState | undefined;
  getNodeResultSummary(nodeId: number): Map<NodeResult, number>;
  getStoredTickIds(): number[];
  getTickRange(from: number, to: number): TickRecord[];

  // Activity projection
  getActivitySnapshotAtTick(tickId: number, mode?: ActivityDisplayMode): ActivitySnapshot | undefined;
  getLatestActivitySnapshot(mode?: ActivityDisplayMode): ActivitySnapshot | undefined;

  // Profiling
  getNodeProfilingData(nodeId: number): NodeProfilingData | undefined;
  getHotNodes(): NodeProfilingData[]; // Sorted by totalCpuTime descending
  getPercentileMode(): 'sampled' | 'exact';
  getFlameGraphFrames(tickId: number): FlameGraphFrame[];

  // Statistics
  getStats(): TreeStats;

  // Cleanup
  clearTicks(): void; // Clear ticks and profiling, keep tree index
  reset(): void;      // Clear everything
}
```

## TreeIndex

Fast lookup structure for nodes. Created automatically when you call `inspector.indexTree()`.

```typescript
const index = inspector.tree!;

// Find nodes
index.getById(5);                    // IndexedNode | undefined
index.getByName('Attack');           // readonly IndexedNode[]
index.getByTag('combat');            // readonly IndexedNode[]
index.getByFlag(NodeFlags.Stateful); // readonly IndexedNode[]
index.getByFlag(NodeFlags.SubTree);  // subtree boundaries

// Convenience filters
index.getLeaves();     // All leaf nodes
index.getComposites(); // All composite nodes
index.getDecorators(); // All decorator nodes
index.getSubTrees();   // All subtree boundary nodes

// Navigation
index.getChildren(nodeId);   // Direct children
index.getParent(nodeId);     // Parent node
index.getAncestors(nodeId);  // All ancestors (parent to root)
index.getDescendants(nodeId); // All descendants (pre-order)

// Metadata
index.size;                  // Total node count
index.preOrder;              // Pre-order traversal of node IDs
index.getAllTags();           // All unique tags in the tree
index.getPathString(nodeId); // "Root > Parent > Node"
```

### IndexedNode

```typescript
interface IndexedNode {
  id: number;
  nodeFlags: NodeFlags;
  defaultName: string;
  name: string;
  tags: readonly string[];
  activity: string | true | undefined;
  parentId: number | undefined;
  childrenIds: number[];
  depth: number;
}
```

## Activity Projection

Inspector can derive compact activity branches from tick events and serialized tree metadata:

```typescript
const activity = inspector.getLatestActivitySnapshot('running_or_success');

for (const branch of activity?.branches ?? []) {
  console.log(branch.labels.join(' > '));
}
```

`ActivityBranch` entries are keyed by the last node in the path that defines `activity`:

```typescript
interface ActivityBranch {
  labels: readonly string[];      // e.g. ["Guarding", "Diagnostics", "Diagnostics Loop"]
  nodeIds: readonly number[];     // activity-labeled node ids for labels[]
  pathNodeIds: readonly number[]; // full root -> tail path (for UI highlighting)
  tailNodeId: number;             // click/select target for this activity entry
  tailResult: NodeResult;         // result of tailNodeId in this tick
  lastEventIndex: number;         // ordering hint (latest first)
}
```

When a node has `activity: true`, the projector uses `name || defaultName` for that label segment.

## Tick Snapshots

Reconstruct the full tree state at any recorded tick:

```typescript
const snapshot = inspector.getSnapshotAtTick(42);
// TreeTickSnapshot { tickId, timestamp, nodes: Map<nodeId, NodeTickSnapshot> }

const nodeState = snapshot?.nodes.get(5);
// NodeTickSnapshot { nodeId, result, state?, startedAt?, finishedAt? }
```

Or query a specific node at a specific tick:

```typescript
const node = inspector.getNodeAtTick(5, 42);
```

## Node History

Get the trace history for a specific node across all stored ticks:

```typescript
const events = inspector.getNodeHistory(nodeId);
// TickTraceEvent[] — one entry per tick where this node was ticked

const summary = inspector.getNodeResultSummary(nodeId);
// Map<NodeResult, number> — count of each result type

const displayState = inspector.getLastDisplayState(nodeId, 42);
// SerializableState | undefined — latest state event at/before tick 42
```

## Profiling

Enable profiling on the tree for per-node timing data:

```typescript
const tree = new BehaviourTree(root)
  .enableProfiling(performance.now.bind(performance));

const inspector = new TreeInspector();
inspector.indexTree(tree.serialize());

// After ticking...
inspector.ingestTick(tree.tick());

// Per-node timing
const data = inspector.getNodeProfilingData(nodeId);
// { nodeId, totalCpuTime, tickCount, minCpuTime, maxCpuTime, cpuP50/cpuP95/cpuP99, ... }

// Hottest nodes (sorted by CPU time)
const hot = inspector.getHotNodes();

// Percentile calculation mode
// 'sampled' = fast rolling samples
// 'exact' = exact values from currently stored tick window
const percentileMode = inspector.getPercentileMode();
```

### NodeProfilingData

```typescript
interface NodeProfilingData {
  nodeId: number;
  
  // Instantaneous tick CPU execution times (ms)
  totalCpuTime: number;
  tickCount: number;
  minCpuTime: number;
  maxCpuTime: number;
  lastCpuTime: number;
  totalSelfCpuTime: number;
  minSelfCpuTime: number;
  maxSelfCpuTime: number;
  lastSelfCpuTime: number;
  selfCpuP50: number;
  selfCpuP95: number;
  selfCpuP99: number;
  cpuP50: number;
  cpuP95: number;
  cpuP99: number;

  // Duration spans (profiling-timer time from first returning Running to Succeeded/Failed)
  totalRunningTime: number;
  runningTimeCount: number;
  minRunningTime: number;
  maxRunningTime: number;
  lastRunningTime: number;
}
```

### Percentile Modes

- Live mode should usually use **sampled** percentiles for responsiveness.
- Paused/time-travel snapshots can use **exact** percentiles over the currently stored tick window.
- `inspector.getPercentileMode()` exposes which mode a given inspector instance is using.

## Flame Graphs

Generate hierarchical timing frames for visualization:

```typescript
const frames = inspector.getFlameGraphFrames(tickId);

for (const frame of frames) {
  console.log(`${' '.repeat(frame.depth)}${frame.name}: ${frame.selfTime.toFixed(2)}ms`);
}
```

### FlameGraphFrame

```typescript
interface FlameGraphFrame {
  nodeId: number;
  name: string;
  depth: number;
  inclusiveTime: number;  // Total time including children (ms)
  selfTime: number;       // Time excluding children (ms)
  startedAt: number;
  finishedAt: number;
  children: FlameGraphFrame[];
}
```

## TickStore

The underlying ring-buffer storage for tick records. Used internally by `TreeInspector` but also available standalone:

```typescript
import { TickStore } from '@behavior-tree-ist/core/inspector';

const store = new TickStore(1000); // Sliding window of 1000 ticks
store.push(record);                // Returns evicted record if at capacity

store.getByTickId(42);
store.hasTick(42);
store.getStoredTickIds();
store.getTickRange(10, 20);

store.oldestTickId;
store.newestTickId;
store.size;
```

## Statistics

```typescript
const stats = inspector.getStats();
// TreeStats {
//   nodeCount: number,
//   storedTickCount: number,
//   totalTickCount: number,        // Total ever ingested
//   totalProfilingCpuTime: number,
//   totalProfilingRunningTime: number,
//   oldestTickId: number | undefined,
//   newestTickId: number | undefined,
// }
```

## End-to-End Example

```typescript
import { BehaviourTree, NodeResult, NodeFlags } from '@behavior-tree-ist/core';
import { sequence, action, condition } from '@behavior-tree-ist/core/builder';
import { TreeInspector } from '@behavior-tree-ist/core/inspector';

// Build tree
const root = sequence({ name: 'Main' }, [
  condition({ name: 'Ready?', eval: () => true }),
  action({ name: 'Work', execute: () => NodeResult.Running }),
]);

// Setup
const tree = new BehaviourTree(root)
  .enableProfiling(performance.now.bind(performance));
const inspector = new TreeInspector({ maxTicks: 500 });
inspector.indexTree(tree.serialize());

// Run 100 ticks
for (let i = 0; i < 100; i++) {
  inspector.ingestTick(tree.tick({ now: i * 100 }));
}

// Analyze
const stats = inspector.getStats();
console.log(`Nodes: ${stats.nodeCount}, Ticks: ${stats.storedTickCount}`);

const hot = inspector.getHotNodes();
for (const node of hot.slice(0, 5)) {
  const indexed = inspector.tree!.getById(node.nodeId)!;
  console.log(`${indexed.name}: avg ${(node.totalCpuTime / node.tickCount).toFixed(2)}ms`);
}

// Time-travel: inspect tick 50
const snapshot = inspector.getSnapshotAtTick(50);
snapshot?.nodes.forEach((nodeSnap, nodeId) => {
  console.log(`Node ${nodeId}: ${nodeSnap.result}`);
});
```
