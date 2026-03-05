# Studio UI Improvements

Evaluated on 2026-03-04 against the `demo-cpu-heavy` tree (~95 nodes).

## What works well

- Tree canvas visualization with React Flow + Dagre, real-time color-coded node statuses
- Performance view: flame graph + hot nodes table with sortable columns, percentile selectors
- Time travel: timeline scrubber, step controls, live/paused modes
- Current Activity panel shows active branches with breadcrumb paths
- Node detail sidebar: good information density (result distribution, profiling, metadata, tick history)

## Issues & Suggestions

### 1. Empty state is confusing (addressed)

The "No tree selected" screen shows a huge blue-bordered placeholder node, a sidebar repeating "No tree selected" twice, and all controls disabled. Unclear what to do next.

**Fix**: Centered onboarding prompt — "Click Attach to connect to a running agent" with icon pointing to button. Hide sidebar and timeline when no tree is attached.

### 2. Attach drawer is too minimal

Three drill-down clicks (client -> session -> tree) before anything renders. Session IDs like `demo-1772650556090` are meaningless. No search, sorting, or status filtering.

**Fix**: Auto-expand when only 1 client/session exists. Show tree names in a flatter list. Add search filter for multi-agent setups.

### 3. Toolbar icon discoverability (addressed)

Icon-only buttons for stream, profiling, state trace, center, perf view, activity toggle. Users must hover every icon to learn what it does.

**Fix**: Add text labels to the 3 toggle buttons (Stream, Profile, Trace) since they're important state toggles. Or use a segmented control / toggle group.

### 4. Settings panel is barebones

Floats as a small card over the canvas. Only 4 settings, no descriptions. "Ring Buffer Size" and "Poll Rate" need context.

**Fix**: Add brief help text under each field (e.g., "Number of ticks kept in memory"). Consider a proper modal or sidebar section.

### 5. Node detail sidebar is always visible

Takes 320px even when no node is selected, showing stale root-node info. "Select a node to inspect" empty state only shows on explicit deselect.

**Fix**: Default to collapsed when no node is selected. Or auto-select root on attach (current behavior) but make sidebar collapsible.

### 6. Tree canvas readability at default zoom

With a large tree (95+ nodes), default zoom makes all nodes tiny and unreadable. Users must zoom in manually. Node labels are truncated.

**Fix**: "Fit to view" on attach with reasonable max zoom. Add "focus on active branch" to zoom to the currently running path.

### 7. Timeline bar is underutilized

76px tall but mostly thin slider and tiny text. Step/LIVE buttons are small. No visual tick density or heatmap.

**Fix**: Show a mini sparkline of CPU time per tick in timeline background. Make time travel controls more prominent. Consider denser mini-timeline visualization.

### 8. Light mode needs polish

Flame graph text uses white-on-colored-bars which is hard to read. Light theme overall less refined than dark.

**Fix**: Adjust flame graph text color per-theme. Review all themed components in light mode.

### 9. Current Activity panel defaults to floating

Overlays top-left of tree canvas, obscuring nodes. Drag handle and collapse controls are tiny.

**Fix**: Make it an inline panel above the canvas or collapsible top panel, not floating. Or remember collapsed state.

### 10. Tick history is a flat list

Hundreds of identical "#35701 Running" entries with no visual differentiation. Hard to spot state changes.

**Fix**: Highlight ticks where node result changed. Group consecutive same-result ticks. Show mini sparkline or color bar instead of listing every tick.

### 11. No keyboard shortcuts

No way to step through ticks, toggle streaming, or navigate nodes via keyboard. Essential for a debugging tool.

**Fix**: Arrow keys for tick stepping (when timeline focused), space for play/pause, `n`/`p` for next/prev node.

### 12. Node state data overflow (addressed)

Nodes with large state (e.g., `threat-points` JSON array) render massive unreadable strings inline on canvas nodes.

**Fix**: Truncate state display on canvas to 1-2 lines max. Show full state in sidebar only. Add copy-to-clipboard button.

## Priority

| # | Issue | Impact |
|---|-------|--------|
| 1 | Empty state onboarding | First impression, new user confusion |
| 2 | Node state overflow on canvas | Visual noise, unreadable nodes |
| 3 | Toolbar discoverability | Feature discovery |
| 4 | Tick history differentiation | Debugging efficiency |
| 5 | Keyboard shortcuts | Power user productivity |
| 6 | Attach drawer UX | Onboarding friction |
| 7 | Timeline enrichment | Debugging context |
| 8 | Light mode polish | Visual consistency |
| 9 | Settings help text | Configurability |
| 10 | Activity panel positioning | Canvas visibility |
| 11 | Sidebar collapse | Screen real estate |
| 12 | Tree fit-to-view | Large tree readability |
