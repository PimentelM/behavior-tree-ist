# Behavior Tree Studio V1 - Requirements Specification

## 1) Purpose and Scope

Behavior Tree Studio is the official runtime debugging solution for remote `behavior-tree-ist` trees.

The V1 goal is a professional-grade first release with a minimal but complete scope:

- Connect remote clients (agents) to a Studio server.
- Persist and query client/tree/tick runtime data.
- Render and control remote trees from a Studio UI built on `@behavior-tree-ist/react`.
- Provide a practical CLI that can start Studio processes in different combinations.

V1 is not a prototype. It must be stable, typed, and operationally predictable.

## 2) Current Baseline and Package Boundaries

Current baseline:

- `@behavior-tree-ist/core`: behavior tree runtime and inspector primitives.
- `@behavior-tree-ist/react`: debugger component that renders serialized tree + tick records.
- `@behavior-tree-ist/studio`: current local demo app (not full server/client architecture yet).

Required package boundaries for V1:

- `@behavior-tree-ist/core`: remains engine/runtime only.
- `@behavior-tree-ist/studio-transport`: new package for client-side studio integration primitives.
- `@behavior-tree-ist/react`: gains optional Studio controls and empty-state support.
- `@behavior-tree-ist/studio` (or equivalent Studio package): hosts Studio UI wiring, server app, and CLI entrypoint(s).

## 3) Domain Terms and Identifiers

### 3.1 Client Identity

- `clientId` is user-supplied.
- `clientId` must remain stable across client restarts.
- The system assumes users keep `clientId` globally unique.

### 3.2 Tree Identity

- `treeId` is explicitly provided at tree registration time (not derived from runtime numeric IDs).
- `treeId` format is restricted to: `^[A-Za-z0-9_-]+$`.
- `treeId` must remain stable even if tree display name changes.

### 3.3 Tick Identity

V1 tick uniqueness key is:

- `(clientId, treeId, tickId)`.

`tickId` policy:

- `tickId` is sourced from `now` when `BehaviourTree.useNowAsTickId()` is enabled.
- Integrators must provide strictly increasing unique `now` per tree tick when this mode is enabled.
- If duplicate or older `now` is received for the same tree instance, the tick must be rejected and an error must be emitted to caller.

## 4) Architecture Overview

High-level flow:

1. Agent runtime registers trees in `TreeRegistry` (`@behavior-tree-ist/studio-transport`).
2. `StudioAgent` consumes registry events and forwards tree/tick messages to Studio server.
3. Studio server persists in-memory state and exposes HTTP endpoints for UI polling and control commands.
4. Studio UI polls server every configured interval (default `200ms`) and renders via `BehaviourTreeDebugger`.
5. UI control actions become command requests to server, then forwarded to target agent/tree.

Data ownership:

- Agent owns runtime toggle state (`stateTrace`, `profiling`, stream on/off) during process lifetime.
- Server owns persisted snapshots and cached history for UI retrieval.
- UI owns local view state (selected client/tree, poll interval, theme).

## 5) Protocol and Message Versioning

### 5.1 Versioning

- Every agent-server message envelope must include protocol version field: `v: number`.
- V1 starts with `v: 1`.

### 5.2 Serialization Format (V1)

- V1 payloads are JSON-only.
- Binary payloads and compression are explicitly out of scope for V1.

### 5.3 Command/Ack Contract

- Commands are request/response style with explicit ack.
- Ack payload must include:
  - success/failure status
  - typed error code (on failure)
  - human-readable error message (on failure)
  - request correlation id

This is required so UI can show errors and revert optimistic button states.

### 5.4 Message Catalog

Message types are defined as numeric constants (`as const` enum object) to minimize serialization overhead.

Every message uses a common envelope:

```
{ v: number, type: MessageType, ... }
```

#### Agent → Server Messages

| Type | Name | Description |
|------|------|-------------|
| 1 | `ClientHello` | Initial handshake after connection. Payload: `clientId`. |
| 2 | `RegisterTree` | Registers a tree. Payload: `treeId`, `serializedTree`. |
| 3 | `RemoveTree` | Unregisters a tree. Payload: `treeId`. |
| 4 | `TickBatch` | Batch of tick records for a tree. Payload: `treeId`, `ticks: TickRecord[]`. |
| 5 | `TreeUpdate` | Updated serialized tree (e.g. after structural change). Payload: `treeId`, `serializedTree`. |
| 6 | `CommandAck` | Ack for a server-forwarded command. Payload: `correlationId`, `success`, `errorCode?`, `errorMessage?`. |

#### Server → Agent Messages

| Type | Name | Description |
|------|------|-------------|
| 50 | `ServerHello` | Server ack of client connection. |
| 51 | `Command` | Forwarded command from UI. Payload: `correlationId`, `command`, `treeId`, `args?`. |

#### Command Types (within `Command` message)

| Command | Description | Args |
|---------|-------------|------|
| `enable-streaming` | Start tick emission for target tree. | — |
| `disable-streaming` | Stop tick emission for target tree. | — |
| `enable-state-trace` | Enable state tracing on target tree. | — |
| `disable-state-trace` | Disable state tracing on target tree. | — |
| `enable-profiling` | Enable profiling on target tree. | — |
| `disable-profiling` | Disable profiling on target tree. | — |

## 6) Client and Agent Requirements (`@behavior-tree-ist/studio-transport`)

### 6.0 Core Runtime Prerequisites (`@behavior-tree-ist/core`)

The following core runtime APIs are required by this Studio V1 design:

- `BehaviourTree.useNowAsTickId()`:
  - enables `now` as tick identifier
  - duplicate/older `now` for the same tree instance must be rejected with error
- `BehaviourTree.enableProfiling(getTime?)`:
  - first enable call requires `getTime`
  - subsequent enable calls may omit `getTime` and reuse cached provider
  - `disableProfiling()` disables profiling but keeps cached provider for later re-enable

### 6.1 TreeRegistry

`TreeRegistry` requirements:

- Explicit registration API.
- Enforce treeId format and uniqueness within a client runtime.
- Expose registration/removal event subscriptions.
- Expose tick-record event subscription for registered trees.
- Call `tree.useNowAsTickId()` as part of Studio registration flow.
- Support per-tree streaming configuration at registration time.
- Default per-tree streaming state is `disabled`.

### 6.2 StudioAgent

`StudioAgent` requirements:

- No internal timer loops (`setInterval`, `setTimeout`) for periodic operations.
- User drives periodic work via `StudioAgent.tick({ now })`.
- Connected message handling can still be event-driven and immediate.
- Handles:
  - connection setup/retry
  - outbound buffering
  - batching/flushing ticks
  - command handling
  - command ack responses
- Must not send tick records over the wire for a tree unless streaming is enabled for that tree.
- Tick records produced while streaming is disabled are dropped — not buffered for later delivery.
- Opening the Studio UI must not implicitly enable streaming.
- Streaming can be enabled/disabled in exactly two ways:
  - code-level opt-in per tree during registration
  - remote tree-scoped command from UI (play/pause control)
- Agent runtime is the source of truth for toggle state; after agent restart, toggle state returns to agent defaults unless code re-applies overrides.

Backpressure policy:

- outbound queue capacity is configurable
- when full, drop oldest unsent records

Performance constraints:

- minimal CPU and memory overhead
- no external runtime dependencies in agent-side transport package

### 6.3 Transport Abstraction

V1 canonical transport:

- WebSocket client-to-server transport.

Design constraint:

- API must be transport-agnostic so custom socket adapters can be implemented in constrained runtimes.

## 7) Server Requirements

### 7.1 Functional Role

Studio server is a persistent gateway between agents and UI.

### 7.2 Storage Model (V1)

In-memory persistence only for V1:

- clients
- trees (latest serialized version per `(clientId, treeId)`, plus stable serialized hash)
- tick records (ring buffer per tree)
- server settings

Tree lifecycle semantics:

- `RegisterTree` is an upsert operation by `(clientId, treeId)`.
- On upsert, server computes a stable hash of the serialized tree payload.
- If incoming hash is unchanged, existing tick history is kept.
- If incoming hash changed, existing tick history for that tree is cleared before storing the new tree snapshot/hash.
- `RemoveTree` clears tree metadata and all retained tick records for that tree immediately.

### 7.3 Offline Detection and Retention Behavior

- clients remain listed forever unless explicitly deleted by UI.
- offline detection is connection-based: a client is online if and only if it has an active WebSocket connection to the server. Disconnect = offline.

Delete behavior:

- deleting a client from UI is hard delete:
  - client record
  - all tree metadata
  - all tick records
  - all client-scoped persisted settings

### 7.4 UI Query Surface

V1 UI-server API is tRPC over HTTP. All procedures are standard HTTP endpoints (queries use GET, mutations use POST) and are fully curl-able.

V1 does not use WebSocket between UI and server. UI syncs via HTTP polling only.

Query procedures (GET):

- list clients (with online/offline status)
- list trees by client
- fetch serialized tree by `(clientId, treeId)`
- fetch tick records by `(clientId, treeId, afterTickId?, limit?)`
- fetch server settings

`fetchTickRecords` semantics:

- `afterTickId` is exclusive: only ticks with `tickId > afterTickId` are returned.
- returned ticks are always sorted ascending by `tickId`.
- when requested `afterTickId` is older than retained history, server still returns any currently available ticks that satisfy `tickId > afterTickId`, up to `limit`.
- no additional gap/retention metadata fields are returned in the V1 response.

Mutation procedures (POST):

- update server settings
- send tree-scoped command (forwarded to agent via WebSocket)
- delete client (hard delete)

### 7.5 Server Settings (V1)

V1 server settings are minimal:

- `maxTickRecordsPerTree`: maximum number of tick records the server retains per tree (ring buffer capacity). Default `10000`.

### 7.6 Server Architecture

The server must follow a layered onion architecture with three layers:

**App Layer**
- Handles integration with the external world: tRPC route handlers, WebSocket connection handlers, periodic jobs if needed.
- Calls into the Domain layer for all business logic.

**Domain Layer**
- All transport-agnostic business logic lives here.
- Owns interfaces that are implemented by both the App and Infrastructure layers.
- Defines domain events and domain errors as needed, keeping the layer fully independent from external concerns.

**Infrastructure Layer**
- Implements domain-defined interfaces for external integrations.
- In V1: in-memory repository implementations.
- Future: SQLite repository implementations would be added here without touching Domain.

### 7.7 Binding and Security Defaults

- default bind host: `127.0.0.1`
- default auth: none
- non-local exposure requires explicit host override

## 8) UI and Component Requirements

### 8.1 Studio UI Sync Mode

- polling is required by default in V1.
- default polling interval: `200ms`.
- polling interval is user-configurable.
- tick fetch limit (`limit` passed to `fetchTickRecords`) is configurable in UI settings.
- default tick fetch limit is `200`.

### 8.2 Debugger Component Contract (`@behavior-tree-ist/react`)

`BehaviourTreeDebugger` requirements:

- supports rendering with no tree/ticks provided.
- empty plain fallback state text: `No tree selected`.
- supports optional Studio mode prop object (single `studio` prop).
- Studio controls are rendered only when `studio` prop is provided.
- Outside Studio mode, Studio-only controls must not render.

### 8.3 Studio Controls

Studio-integrated controls include:

- attach/select client/tree interaction entrypoint
- remote toggle buttons for:
  - streaming play/pause (tree-scoped tick emission to server)
  - state trace
  - profiling
- settings entrypoint for server-side settings
- online/offline indicator for attached client
- live vs persisted-data indicator

Toolbar behavior:

- tree-specific controls stay in toolbar
- server/client management controls can be grouped in drawer/panel entrypoint

### 8.4 Local UI Persistence

Persist minimal local state:

- selected `clientId`
- selected `treeId`
- polling interval
- tick fetch limit
- theme
- local TickStore capacity

Local persistence requirements:

- robust to stale/invalid stored values
- robust to settings schema/version evolution
- on refresh, restore valid selections if still present in server data

## 9) CLI and Operational Requirements

V1 CLI requirements:

- single command entrypoint with flags
- process flags:
  - `--server`
  - `--ui`
  - `--mock-client`
  - `--demo`

Behavior:

- if no process flags are provided, default to server + UI.
- `--demo` starts server + UI + mock client for heavy demo tree.
- user can run any supported process combination.

Operational quality:

- Ctrl+C (`SIGINT`) must quickly and gracefully terminate all started child processes.
- host/port related configuration must be configurable via flags.

## 10) Non-Functional Requirements and Acceptance Criteria

### 10.1 Reliability

- no timeline corruption from duplicated/old now-based tick IDs
- stable handling of disconnects and reconnects
- deterministic command ack behavior

### 10.2 Performance

- client-side Studio integration overhead kept as low as possible
- CPU minimization is prioritized over additional non-essential runtime checks in hot paths.
- memory limits are configured in number of records (not bytes) where applicable.
- server and agent memory limits are configurable where applicable (for example ring buffer size and outbound queue capacity).
- V1 defines no hard latency SLOs for API p95, command-ack time, reconnect time, or end-to-end UI freshness.

### 10.3 Test and Validation Scenarios

The implementation must satisfy at least:

1. Identity/restart:
   - same `(clientId, treeId)` works across restarts
   - duplicate/older now-based `tickId` is rejected
2. Polling:
   - UI polling with `afterTickId` returns ticks where `tickId > afterTickId` (exclusive cursor), ordered ascending
   - if `afterTickId` is older than retained history, server still returns any available ticks matching the query up to `limit` (no gap error/flag)
   - tick fetch `limit` is configurable in UI settings and defaults to `200`
   - polling interval persists and restores
3. Offline retention:
   - client disconnection marks client as offline; last known data remains visible
   - hard delete fully removes client-scoped data
   - `RemoveTree` clears removed tree metadata and tick history immediately
4. Tree upsert invalidation:
   - `RegisterTree` behaves as upsert by `(clientId, treeId)`
   - unchanged serialized-tree hash keeps existing tick history
   - changed serialized-tree hash clears existing tick history before accepting new snapshots/ticks
5. Remote toggles:
   - successful ack updates UI state
   - error ack reverts button state and surfaces error feedback
   - streaming is off by default for each tree until explicitly enabled by code opt-in or play command
   - pausing streaming stops new tick uploads for the selected tree without disconnecting the client
   - ticks produced while streaming is disabled are dropped, not retroactively delivered on re-enable
6. Debugger empty state:
   - renders without tree/ticks and shows `No tree selected`
   - Studio controls hidden when `studio` prop is absent
7. Backpressure:
   - full outbound queue drops oldest unsent records deterministically
8. CLI:
   - each flag combination starts expected processes
   - Ctrl+C cleanly terminates all started processes

## 11) Non-Goals and Future Extensions

Explicitly out of scope for V1:

- raw TCP transport support
- SQLite persistence
- binary payload support
- payload compression
- server-initiated connection to client listener sockets
- non-local auth model beyond localhost-first default

Future protocol extensions (post-V1):

- binary encoding options
- optional compression negotiation
- additional transport profiles
