# Behavior Tree Studio

Real-time debugging tool for behavior trees: execution trace visualization, time-travel debugging, and CPU profiling.

## Architecture

```
Agent ──────> Server ──────> UI
(your app)    (bridge)       (browser)
```

**Agent**: instruments your behavior trees and streams tick data to the server. Auto-reconnects on disconnect.

**Server**: accepts connections from multiple agents, persists session data, and exposes an API for the UI. Relays commands from UI to agents.

**UI**: browser app showing a live tree canvas with time-travel controls, node detail panel, and performance views.

## Packages

| Package | Role |
|---------|------|
| `studio-server` | Bridge between agents and UI -- persistence, API, message routing |
| `studio-ui` | Browser app binding the debugger component to the server |
| `react` | Standalone `BehaviourTreeDebugger` React component |
| `studio-transport` | Transport implementations for agent-to-server connections |
| `studio-common` | Shared schemas and protocol definitions |
| `cli` | CLI (`bt-studio`) to launch the studio server + UI |
| `studio-plugins` | First-party plugins; ships `ReplPlugin` (NaCl E2E encrypted JS eval) |
| `studio-mcp` | MCP server (`bt-studio-mcp`) for AI agent access to connected trees |

## Transports

Agents connect to the server using transports from the `studio-transport` package:

- **TCP** (Node.js only) and **WebSocket** (Node.js + browser)
- Both binary and string encoding options available

## Roadmap

- **Server-initiated TCP transport**: support connecting to agents that listen on a TCP port (server-side transports that dial out instead of agents connecting in)
- **Screeps integration**: transport mechanism compatible with the game Screeps, leveraging existing Grafana integration patterns used by other players
- **UI configuration**: UI support for defining TCP+IP ports of server-side agents and configuring Screeps integration parameters
