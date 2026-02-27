# Roadmap

Planned features and their current status.

| Feature | Status |
|---|---|
| React Visualization Component | Done |
| Studio Application | Planned |

---

## React Visualization Component

`@behavior-tree-ist/react` - A React component for real-time tree execution visualization. See [React Debugger docs](react-debugger.md).

- Live tree rendering with node status coloring
- Time-travel debugging: navigate previous ticks and inspect full tree state at any point
- Node detail sidebar with result distribution, display state, and tick history
- Ref mutation tracing panel
- Display of stateful decorator/composite internal state (via `getDisplayState()`)
- Powered by the existing [Inspector](inspector.md) system

## Studio Application

`@behavior-tree-ist/studio` - A standalone debugging app built on the React visualization component.

- Connect to running behavior trees via WebSocket or other transports
- Tick recording and playback
- Node search and filtering by name, tag, or flag
- **Depends on**: React Visualization Component
