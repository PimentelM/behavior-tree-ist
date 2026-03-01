# Roadmap

Planned features and their current status.

| Feature | Status |
|---|---|
| React Visualization Component | Done |
| Studio Application | Planned |
| AI-Ready Integrations | Planned |

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

## AI-Ready Integrations ( Draft )

Make `behavior-tree-ist` first-class for AI agents implementing and debugging behavior trees.

### Phase 1 - MCP foundation

- Build a **studio-server MCP** for runtime interaction (tree list, tree snapshots, tick playback, profiling, node/ref inspection).
- Build a **web MCP for Studio UI** so agents can drive UI workflows (open tree, select node, inspect timeline, export traces).
- Expose MCP **tools + resources + prompts** (not only tools), so different clients can choose the best interaction mode.
- Support both MCP transports:
  - `stdio` for local/dev workflows.
  - Streamable HTTP for hosted/remote workflows.

### Phase 2 - Compatibility + security

- Add a ChatGPT apps/deep-research compatibility mode with read-only `search`/`fetch` tools.
- Implement OAuth 2.1 for remote MCP usage, including PKCE and auth metadata discovery.
- Add transport hardening for remote/local servers:
  - Origin validation for HTTP transport.
  - Localhost-first defaults for local runs.
  - Explicit auth for non-local access.
- Keep human confirmation for sensitive/mutating tool calls.

### Phase 3 - Documentation for agents

- Ship a **documentation MCP** (read-only) with searchable docs + examples.
- Publish `/llms.txt` and keep docs consumable as clean markdown where possible.
- Provide importable agent guidance assets:
  - `AGENTS.md` snippets for preferred MCP usage patterns.
  - Optional `SKILL.md` package for “implement/debug behavior trees with this library”.

### Phase 4 - Discoverability + quality

- Publish official MCP servers in the **Official MCP Registry**.
- Add an AI compatibility test matrix (Codex, OpenAI API/Apps, Claude clients).
- Add AI evals for common tasks:
  - Build a tree from plain-language requirements.
  - Diagnose failing/stuck nodes.
  - Explain lifecycle/ref changes with citations to docs/resources.
