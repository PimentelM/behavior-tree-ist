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
  theme={{ colorSucceeded: '#22c55e' }}
  themeMode="dark"               // controlled: "dark" | "light"
  defaultThemeMode="dark"        // uncontrolled initial mode
  showToolbar={true}              // default true: top toolbar
  toolbarActions={<button type="button">Export</button>}
  showThemeToggle={true}          // default true: shows top-right moon/sun toggle
  onThemeModeChange={(mode) => {}}
  layoutDirection="TB"            // "TB" | "LR"
  width="100%" height="100%"
  isolateStyles={true}            // default true: render inside Shadow DOM
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
| `theme` | `ThemeOverrides` | — | Partial token overrides for the active theme mode |
| `themeMode` | `"light" \| "dark"` | — | Controlled color mode. When provided, parent controls mode state. |
| `defaultThemeMode` | `"light" \| "dark"` | `"dark"` | Initial mode for uncontrolled usage |
| `onThemeModeChange` | `(mode: "light" \| "dark") => void` | — | Called when user toggles theme mode |
| `showToolbar` | `boolean` | `true` | Shows the top toolbar area |
| `toolbarActions` | `ReactNode` | — | Custom action buttons/content rendered on the left side of the toolbar |
| `showThemeToggle` | `boolean` | `true` | Shows the top-right moon/sun mode toggle in the toolbar |
| `layoutDirection` | `"TB" \| "LR"` | `"TB"` | Tree layout direction: top-to-bottom or left-to-right |
| `width` | `string \| number` | `"100%"` | Container width |
| `height` | `string \| number` | `"100%"` | Container height |
| `isolateStyles` | `boolean` | `true` | Enables Shadow DOM style isolation so host-page CSS cannot bleed into the debugger |
| `onNodeSelect` | `(nodeId: number \| null) => void` | — | Callback when a node is clicked |
| `onTickChange` | `(tickId: number) => void` | — | Callback when the viewed tick changes (scrubber, step, etc.) |
| `className` | `string` | — | Additional CSS class on the root element |

## Style Isolation

By default, the debugger renders inside a Shadow DOM root (`isolateStyles={true}`), which keeps host-page CSS from affecting internal debugger UI styles.

- Host app styles do not cascade into the debugger internals.
- `className` applies to the outer host container (useful for sizing/layout).
- Set `isolateStyles={false}` if you need legacy, non-shadow rendering.

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

- **Top toolbar** (44px) — Action area (left), built-in center-tree button, and theme toggle (right)
- **Canvas** — Main area with the React Flow tree graph
- **Right sidebar** (300px, collapsible) — Node details and ref traces (tabbed)
- **Bottom bar** (80px) — Timeline scrubber and playback controls

The tree is laid out using `@dagrejs/dagre`. Layout is recomputed only when the `tree` prop changes, not on every tick.
The toolbar center-tree button recenters the viewport using `fitView()` without changing current tick selection.

## Time-Travel

Two modes: **Live** and **Paused**.

- **Live**: Automatically follows the latest tick. New ticks are displayed in real-time.
- **Paused**: Frozen at a specific tick. Entering paused mode captures a frozen inspector snapshot so the viewed timeline/state does not shift while live ticks continue to arrive.

Controls:
- **Toolbar Pause/Play**: Toggle between live mode and paused time-travel mode directly from the top toolbar
- **Scrubber**: Drag to jump to any stored tick (enters paused mode)
- **Step back/forward**: Navigate one tick at a time
- **Exit Time Travel / LIVE**: Jump back to live mode
- **Esc key**: Quick-exit paused mode and return to live

New ticks are always ingested by the live inspector even when paused, so no data is lost.

Result semantics are strict per tick:
- If a node has no trace event at the viewed tick, it is treated as not ticked for that tick.
- Display state may still show the latest known state at-or-before the viewed tick, and stale values are visually dimmed.

## Node Visualization

Each node shows:
- Display name with compact semantic badges
- Utility, memory, and async nodes with dedicated letter badges (`U`, `M`, `A`) and canonical badge-only rendering
- Memory composites surface active child index in the node name (for example `MemorySequence (0)`) and omit `runningChildIndex` from state rows
- Type glyphs inspired by common behavior-tree notation conventions:
  - Sequence: single arrow (`->`) for ordered progression
  - Fallback/Selector: question mark (`?`) for "try alternatives"
  - Parallel: stacked lanes for concurrent child ticks
  - Condition: decision diamond with check
  - Action: task card/checklist mark
- Optional compact decorator stack (non-lifecycle decorators) rendered above the decorated node (no connecting edge)
- Lifecycle decorators collapsed to an inline thunder badge (`⚡N`) with hover names and click-to-cycle selection
- Left accent stripe colored by result: green (Succeeded), red (Failed), amber (Running), gray (Idle)
- Display state key-value pairs when present (from `getDisplayState()`), with dimmed stale rendering and auto-sizing content
- Ref changes for the viewed tick directly under the node/decorator that emitted them

Raw `NodeFlags` and numeric IDs are not shown in the tree canvas. Full flags remain visible in the node details panel.

Edges are smooth-step curves colored by child result when active, with animated dashes for Running children.
The built-in minimap mirrors node positions and result colors, and supports pan/zoom interactions.

## Node Details Panel

When a node is selected, the right sidebar shows:
- **Node header**: Name, path, flags, tags, current result
- **Result distribution**: Bar chart showing Succeeded/Failed/Running counts
- **Display state**: Current key-value pairs from the node's display state
- **Tick history**: Scrollable list of recent tick events with result dots (click to time-travel)

Tick history navigation supports keyboard and incremental loading:
- Focus the history list and use **ArrowUp/ArrowDown** to move between ticks.
- As you scroll down, older entries are loaded progressively (infinite-feed style).

## Ref Traces Panel

The "Ref Traces" tab shows unattributed/system `RefChangeEvent` mutations for the viewed tick (events without `nodeId`):
- Ref name, tick number, async badge
- New value (JSON-formatted)
- Click to jump to that tick

Node-attributed ref changes are shown directly below each node/decorator in the graph.

## Theming

The debugger now ships with minimalist, shadcn-style light and dark themes, with a built-in moon/sun toggle in the top toolbar.

- Dark mode defaults to a VSCode-like charcoal palette.
- Light mode uses subtle grays, clean borders, and low-contrast surfaces.
- Pass `theme` to override any token while keeping the base mode.

Use controlled mode when you want to sync theme with your app:

```tsx
const [mode, setMode] = useState<'light' | 'dark'>('dark');

<BehaviourTreeDebugger
  themeMode={mode}
  onThemeModeChange={setMode}
  // ...
/>
```

Use token overrides to customize either mode:

```tsx
<BehaviourTreeDebugger
  theme={{
    colorSucceeded: '#22c55e',
    colorFailed: '#f14c4c',
    colorRunning: '#cca700',
    bgPrimary: '#1e1e1e',
    bgSecondary: '#252526',
    accentColor: '#3794ff',
  }}
  // ...
/>
```

All CSS variables are prefixed with `--bt-` and can be overridden via CSS as well.

### Available Theme Variables

| Variable | Default | Description |
|---|---|---|
| `--bt-color-succeeded` | dark: `#22c55e` | Succeeded result color |
| `--bt-color-failed` | dark: `#f14c4c` | Failed result color |
| `--bt-color-running` | dark: `#cca700` | Running result color |
| `--bt-color-idle` | dark: `#8b8b8b` | Idle/no-result color |
| `--bt-bg-primary` | dark: `#1e1e1e` | Primary background |
| `--bt-bg-secondary` | dark: `#252526` | Panel/sidebar background |
| `--bt-bg-tertiary` | dark: `#2d2d30` | Inset/card background |
| `--bt-text-primary` | dark: `#cccccc` | Primary text color |
| `--bt-text-secondary` | dark: `#b3b3b3` | Secondary text color |
| `--bt-text-muted` | dark: `#8b8b8b` | Muted/label text color |
| `--bt-border-color` | dark: `#3c3c3c` | Border color |
| `--bt-accent-color` | dark: `#3794ff` | Accent/selection color |
| `--bt-grid-color` | derived | Canvas grid color |
| `--bt-minimap-mask` | derived | Minimap viewport mask |

## Exports

```typescript
// Component
export { BehaviourTreeDebugger } from '@behavior-tree-ist/react';

// Types
export type {
  BehaviourTreeDebuggerProps,
  PanelConfig,
  ThemeOverrides,
  ThemeMode,
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
  LIGHT_THEME,
  DARK_THEME,
  RESULT_COLORS,
  getResultColor,
  getFlagLabels,
} from '@behavior-tree-ist/react';
```
