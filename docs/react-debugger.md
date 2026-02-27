# React Debugger

`@behavior-tree-ist/react` provides `<BehaviourTreeDebugger>`, a React component for visualizing and debugging behaviour trees. It uses [React Flow](https://reactflow.dev/) for the tree graph, wraps `TreeInspector` from `@behavior-tree-ist/core/inspector` internally, and provides real-time plus time-travel debugging.

## Installation

```bash
npm install @behavior-tree-ist/react @behavior-tree-ist/core react react-dom
```

Peer dependencies: `react >= 18`, `react-dom >= 18`, `@behavior-tree-ist/core`.

## Quick Start

```tsx
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { sequence, action, condition } from '@behavior-tree-ist/core/builder';
import { BehaviourTreeDebugger } from '@behavior-tree-ist/react';
import type { TickRecord } from '@behavior-tree-ist/core';

// Build and configure tree
const root = sequence({ name: 'Main' }, [
  condition({ name: 'Ready?', eval: () => true }),
  action({ name: 'Work', execute: () => NodeResult.Running }),
]);
const tree = new BehaviourTree(root).enableTrace();

// Collect tick records
const ticks: TickRecord[] = [];
for (let i = 0; i < 50; i++) {
  ticks.push(tree.tick({ now: i * 100 }));
}

// Render debugger
function App() {
  return (
    <BehaviourTreeDebugger
      tree={tree.serialize()}
      ticks={ticks}
      width="100%"
      height="600px"
    />
  );
}
```

## Component API

```tsx
<BehaviourTreeDebugger
  tree={serializedTree}           // SerializableNode from tree.serialize()
  ticks={tickRecords}             // TickRecord[] — append-only, component diffs internally
  inspectorOptions={{ maxTicks: 500 }}  // optional TreeInspector config
  inspectorRef={inspectorRef}     // optional escape-hatch to internal TreeInspector
  panels={{ nodeDetails: true, timeline: true, refTraces: true }}
  theme={{ colorSucceeded: '#4ade80' }}
  layoutDirection="TB"            // "TB" | "LR"
  width="100%" height="100%"
  onNodeSelect={(nodeId) => {}}
  onTickChange={(tickId) => {}}
  className="my-debugger"
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tree` | `SerializableNode` | **required** | Serialized tree structure from `tree.serialize()` |
| `ticks` | `TickRecord[]` | **required** | Append-only array of tick records. The component diffs internally to ingest only new ticks. |
| `inspectorOptions` | `TreeInspectorOptions` | `{}` | Options passed to the internal `TreeInspector` (e.g., `{ maxTicks: 500 }`) |
| `inspectorRef` | `MutableRefObject<TreeInspector \| null>` | — | Escape-hatch ref to access the internal `TreeInspector` for advanced queries |
| `panels` | `PanelConfig` | `{ nodeDetails: true, timeline: true, refTraces: true }` | Toggle which panels are visible |
| `theme` | `ThemeOverrides` | — | Partial theme overrides (merged with dark defaults) |
| `layoutDirection` | `"TB" \| "LR"` | `"TB"` | Tree layout direction: top-to-bottom or left-to-right |
| `width` | `string \| number` | `"100%"` | Container width |
| `height` | `string \| number` | `"100%"` | Container height |
| `onNodeSelect` | `(nodeId: number \| null) => void` | — | Callback when a node is clicked |
| `onTickChange` | `(tickId: number) => void` | — | Callback when the viewed tick changes (scrubber, step, etc.) |
| `className` | `string` | — | Additional CSS class on the root element |

## Transport

The component is transport-agnostic. You are responsible for collecting `TickRecord` objects and appending them to the `ticks` array. Examples:

**Direct (same process):**
```tsx
const [ticks, setTicks] = useState<TickRecord[]>([]);

function gameLoop() {
  const record = tree.tick({ now: performance.now() });
  setTicks(prev => [...prev, record]);
  requestAnimationFrame(gameLoop);
}
```

**WebSocket:**
```tsx
useEffect(() => {
  const ws = new WebSocket('ws://localhost:3001/ticks');
  ws.onmessage = (e) => {
    const record: TickRecord = JSON.parse(e.data);
    setTicks(prev => [...prev, record]);
  };
  return () => ws.close();
}, []);
```

## Layout

The component uses a CSS grid layout:

- **Canvas** — Main area with the React Flow tree graph
- **Right sidebar** (300px, collapsible) — Node details and ref traces (tabbed)
- **Bottom bar** (80px) — Timeline scrubber and playback controls

The tree is laid out using `@dagrejs/dagre`. Layout is recomputed only when the `tree` prop changes, not on every tick.

## Time-Travel

Two modes: **Live** and **Paused**.

- **Live**: Automatically follows the latest tick. New ticks are displayed in real-time.
- **Paused**: Frozen at a specific tick. Use the scrubber or step buttons to navigate.

Controls:
- **Scrubber**: Drag to jump to any stored tick (enters paused mode)
- **Step back/forward**: Navigate one tick at a time
- **LIVE button**: Jump back to live mode

New ticks are always ingested even when paused, so no data is lost.

## Node Visualization

Each node shows:
- Display name and numeric ID badge
- Flag category pill (Leaf/Composite/Decorator and secondary flags)
- Left accent stripe colored by result: green (Succeeded), red (Failed), blue (Running), gray (Idle)
- Display state key-value pairs when present (from `getDisplayState()`)

Edges are smooth-step curves colored by child result when active, with animated dashes for Running children.

## Node Details Panel

When a node is selected, the right sidebar shows:
- **Node header**: Name, path, flags, tags, current result
- **Result distribution**: Bar chart showing Succeeded/Failed/Running counts
- **Display state**: Current key-value pairs from the node's display state
- **Tick history**: Scrollable list of recent tick events with result dots (click to time-travel)

## Ref Traces Panel

The "Ref Traces" tab shows all `RefChangeEvent` mutations recorded across ticks:
- Ref name, tick number, async badge
- New value (JSON-formatted)
- Click to jump to that tick

## Theming

The component uses CSS variables for theming. Pass a `theme` prop to override defaults:

```tsx
<BehaviourTreeDebugger
  theme={{
    colorSucceeded: '#22c55e',
    colorFailed: '#ef4444',
    colorRunning: '#3b82f6',
    bgPrimary: '#0a0a1a',
    bgSecondary: '#111128',
    accentColor: '#a78bfa',
  }}
  // ...
/>
```

All CSS variables are prefixed with `--bt-` and can be overridden via CSS as well.

### Available Theme Variables

| Variable | Default | Description |
|---|---|---|
| `--bt-color-succeeded` | `#4ade80` | Succeeded result color |
| `--bt-color-failed` | `#f87171` | Failed result color |
| `--bt-color-running` | `#60a5fa` | Running result color |
| `--bt-color-idle` | `#6b7280` | Idle/no-result color |
| `--bt-bg-primary` | `#1a1a2e` | Primary background |
| `--bt-bg-secondary` | `#16213e` | Panel/sidebar background |
| `--bt-bg-tertiary` | `#0f3460` | Inset/card background |
| `--bt-text-primary` | `#e2e8f0` | Primary text color |
| `--bt-text-secondary` | `#94a3b8` | Secondary text color |
| `--bt-text-muted` | `#64748b` | Muted/label text color |
| `--bt-border-color` | `#334155` | Border color |
| `--bt-accent-color` | `#818cf8` | Accent/selection color |

## Exports

```typescript
// Component
export { BehaviourTreeDebugger } from '@behavior-tree-ist/react';

// Types
export type {
  BehaviourTreeDebuggerProps,
  PanelConfig,
  ThemeOverrides,
  LayoutDirection,
  BTNodeData,
  BTEdgeData,
  TimeTravelState,
  TimeTravelControls,
  NodeDetailsData,
} from '@behavior-tree-ist/react';

// Utilities
export {
  DEFAULT_THEME,
  RESULT_COLORS,
  getResultColor,
  getFlagLabels,
} from '@behavior-tree-ist/react';
```
