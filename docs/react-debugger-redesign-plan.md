# React Debugger Redesign Plan

## Goal

Implement a compact, clear, and tick-accurate debugger UX with:
- true frozen time-travel mode
- per-tick result semantics
- node-local ref mutation display
- NodeFlags-driven visuals
- decorator compaction model
- adaptive mixed-orientation layout (default ON, user-toggleable)

## Agreed Decisions

- Results are always per tick only.
- Display state may show last known state less than or equal to viewed tick.
- Stale state must have a small visual cue (`prev`).
- Do not show numeric node IDs in tree nodes.
- Do not show raw NodeFlags in tree nodes (only in node details panel).
- Decorators use hybrid rendering:
  - Lifecycle decorators => inline thunder badge(s) inside decorated node.
  - Most decorators => compact stacked mini-nodes above decorated node.
- Stacked decorator order:
  - top = outermost
  - closest to base node = innermost
- Adaptive layout default = ON:
  - Sequence children horizontal
  - Fallback/Selector children vertical
  - Toggle available in toolbar.
- Multiple lifecycle decorators can be collapsed as one badge with count (`⚡N`).

## Work Plan

### Phase 1 — Time Travel Freeze Architecture
- [ ] Introduce `liveInspector` + `pausedInspector` model.
- [ ] Capture frozen inspector snapshot when entering paused mode.
- [ ] Keep ingesting new ticks into live inspector while paused.
- [ ] Route render queries to active inspector (`live` vs `paused`).

### Phase 2 — Tick Semantics and Overlay Data
- [ ] Enforce result-from-current-tick only in overlay.
- [ ] Keep state fallback via `getLastDisplayState(nodeId, viewedTickId)`.
- [ ] Add `displayStateIsStale` marker when fallback is from earlier tick.

### Phase 3 — Node-Local Ref Events
- [ ] Group viewed-tick `refEvents` by `nodeId`.
- [ ] Render ref changes directly under owning node/decorator.
- [ ] Keep unattributed events in sidebar fallback list.

### Phase 4 — Canvas Simplification
- [ ] Remove numeric ID badge from tree node UI.
- [ ] Remove raw NodeFlags pills from tree nodes.
- [ ] Keep NodeFlags in node details panel only.

### Phase 5 — Decorator Compaction (Hybrid)
- [ ] Build visual grouping model:
  - base node
  - `stackedDecorators[]`
  - `lifecycleBadges[]`
- [ ] Render most decorators as compact stacked mini-nodes above base node.
- [ ] Render lifecycle decorators as inline thunder badge(s).
- [ ] Preserve individual selection mapping to real decorator `nodeId`.

### Phase 6 — NodeFlags-Driven Visual Identity
- [ ] Derive semantic node kind from flags (sequence/fallback/parallel/action/condition).
- [ ] Add compact semantic badges (async/memory/utility/stateful/etc).
- [ ] Keep visuals compact and clarity-first.

### Phase 7 — Adaptive Mixed Orientation Layout
- [ ] Add toolbar toggle for adaptive layout.
- [ ] Default adaptive layout to ON.
- [ ] Implement mixed-orientation subtree layout:
  - sequences horizontal
  - selectors/fallbacks vertical
- [ ] Preserve existing global layout mode when adaptive is OFF.

### Phase 8 — Documentation
- [ ] Update `docs/react-debugger.md` for all behavior/UI changes.
- [ ] Update README debugger section if needed.

### Phase 9 — Validation
- [ ] Run `yarn test && yarn lint`.
- [ ] Run Playwright checks for:
  - frozen paused view stability
  - decorator stack order and click selection
  - lifecycle badge behavior
  - per-tick result correctness
  - stale state cue rendering
  - node-local ref event display
  - adaptive layout toggle behavior

## Primary Files Expected to Change

- `packages/react/src/BehaviourTreeDebugger.tsx`
- `packages/react/src/hooks/useInspector.ts` (or new freeze helper hook)
- `packages/react/src/hooks/useTimeTravelControls.ts`
- `packages/react/src/hooks/useSnapshotOverlay.ts`
- `packages/react/src/hooks/useTreeLayout.ts`
- `packages/react/src/layout/tree-to-flow.ts` (or new visual-tree module)
- `packages/react/src/layout/*` (new adaptive layout module likely)
- `packages/react/src/components/nodes/BTNodeComponent.tsx`
- `packages/react/src/components/panels/ToolbarPanel.tsx`
- `packages/react/src/components/panels/NodeDetailPanel.tsx`
- `packages/react/src/components/panels/RefTracesPanel.tsx`
- `packages/react/src/types.ts`
- `packages/react/src/constants.ts`
- `packages/react/src/styles/debugger.css`
- `docs/react-debugger.md`
- `README.md` (if debugger docs section needs sync)

## Notes

- Selection must always resolve to real node IDs (including stacked decorators and lifecycle badges).
- No edge should be drawn between stacked decorators and base node.
- All status visuals (result/state/ref changes) remain tick-scoped and deterministic for viewed tick.
