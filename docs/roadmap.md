# Roadmap

Planned features and their current status.

| Feature | Status |
|---|---|
| Blackboard System | Planned |
| React Visualization Component | Planned |
| Studio Application | Planned |
| Monorepo Transformation | Planned |

---

## Blackboard System

Subtree-scoped key-value store for sharing data between nodes.

- Input/output ports on nodes (inspired by BehaviorTree.CPP)
- Type-safe port definitions with TypeScript generics
- Parent blackboard access for hierarchical data flow
- Scoped visibility: subtrees can read parent data without leaking their own

## React Visualization Component

`@behavior-tree-ist/react` - A React component for real-time tree execution visualization.

- Live tree rendering with node status coloring
- Time-travel debugging: navigate previous ticks and inspect full tree state at any point
- Flame graph visualization for performance profiling
- Display of stateful decorator/composite internal state (via `getDisplayState()`)
- Powered by the existing [Inspector](inspector.md) system

## Studio Application

`@behavior-tree-ist/studio` - A standalone debugging app built on the React visualization component.

- Connect to running behavior trees via WebSocket or other transports
- Tick recording and playback
- Node search and filtering by name, tag, or flag
- **Depends on**: React Visualization Component

## Monorepo Transformation

Restructure the project into scoped packages for independent versioning and dependency management.

- `@behavior-tree-ist/core` - Zero-dependency core library (current main package)
- `@behavior-tree-ist/react` - React visualization component
- `@behavior-tree-ist/studio` - Standalone debugging UI
- Workspace tooling (Turborepo or similar)
