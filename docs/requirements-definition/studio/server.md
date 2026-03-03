## Studio Server v1 Plan (Vertical Slice Sessions)

### Summary

Build a new package `@behavior-tree-ist/studio-server` as a Node.js server using onion architecture, with:

- Agent ingress over WebSocket + raw TCP (JSON protocol compatible with current `core/studio` messages).
- UI-facing REST API + OpenAPI for query/control.
- UI-facing WebSocket metadata events (not tick stream).
- Persistence in SQLite (file path or `:memory:`), using `better-sqlite3` and repository interfaces.
- Command request/response (server -> agent -> server) with fail-fast offline behavior and 5s configurable timeout.

Out of scope for this plan: `studio-ui`, `studio-common` extraction, and CLI orchestration in `packages/studio`.

### Public APIs / Interfaces / Types (to introduce)

1. Package exports from `studio-server`:
   - `createStudioServer(options: StudioServerOptions): StudioServerHandle`
   - `StudioServerHandle.start(): Promise<void>`
   - `StudioServerHandle.stop(): Promise<void>`
   - `StudioServerHandle.getRuntimeState(): StudioRuntimeState`
2. `StudioServerOptions` (configurable):
   - `httpHost`, `httpPort`, `tcpHost`, `tcpPort`, `sqlitePath`, `commandTimeoutMs`, `maxTicksPerTree`, `logLevel`
3. Domain interfaces:
   - `ClientRepository`, `SessionRepository`, `TreeRepository`, `TickRepository`, `SettingsRepository`, `AgentConnectionRegistry`, `CommandBroker`
4. UI WS metadata event contract:
   - `agent.online`, `agent.offline`, `catalog.changed`, `settings.updated`
5. REST contract (v1):
   - `GET /v1/health`
   - `GET /v1/settings`
   - `PUT /v1/settings`
   - `GET /v1/clients`
   - `GET /v1/clients/:clientId/sessions`
   - `GET /v1/clients/:clientId/sessions/:sessionId/trees`
   - `GET /v1/clients/:clientId/sessions/:sessionId/trees/:treeId`
   - `GET /v1/clients/:clientId/sessions/:sessionId/trees/:treeId/ticks?afterTickId&limit`
   - `POST /v1/commands`

### Session Plan (medium chunks, one session at a time)

1. Session 1: Package bootstrap + onion skeleton
   - Create `packages/studio-server`, scripts, tsconfig/tsup/vitest setup, and three-layer folder layout (`domain`, `app`, `infra`).
   - Implement composition root and lifecycle (`start/stop`) with Fastify startup and graceful shutdown.
   - Define central config schema with defaults and env override support.
   - Acceptance: package builds, typechecks, and starts/stops with no adapters fully implemented yet.

2. Session 2: Agent connection slice (hello + catalog)
   - Implement WS agent adapter and TCP agent adapter (JSON messages).
   - Implement runtime connection registry keyed by (`clientId`, `sessionId`) with policy: new connection replaces old.
   - Handle protocol messages: `Hello`, `TreeRegistered`, `TreeRemoved`.
   - Persist clients/sessions/trees in SQLite and maintain online/offline runtime state.
   - Acceptance: simulated agents connect over both transports, catalog persists, duplicate identity replacement works.

3. Session 3: Tick ingestion + retention slice
   - Implement `TickBatch` handling and persistence as one row per tick with JSON payload plus indexed keys.
   - Enforce retention by (`clientId`, `sessionId`, `treeId`) with global `maxTicksPerTree`.
   - Ignore duplicate/out-of-order tick IDs for same tree/session.
   - Acceptance: high-volume inserts retained to configured N, pruning verified, and queryable by cursor.

4. Session 4: Command request/response slice
   - Implement command broker with correlation map and timeout handling.
   - `POST /v1/commands` path in app layer calls domain service, sends command to active agent, awaits `CommandResponse`.
   - Behavior: offline = immediate error; no response within timeout = timeout error.
   - Acceptance: happy path, timeout, disconnect-mid-flight, and unknown-correlation cases all covered.

5. Session 5: Query REST API + OpenAPI slice
   - Implement all read/query/settings endpoints with cursor-based pagination and bounded `limit`.
   - Add schema validation and OpenAPI generation endpoints/docs.
   - Return stable DTOs for UI consumption including online status and last activity timestamps.
   - Acceptance: endpoint contract tests + OpenAPI snapshot test.

6. Session 6: UI metadata WebSocket slice
   - Implement UI WS channel for server metadata events (`agent.online/offline`, `catalog.changed`, `settings.updated`).
   - Wire domain/app events to broadcaster.
   - Keep tick delivery out of WS (ticks remain polling-only).
   - Acceptance: UI WS clients receive ordered metadata updates during agent lifecycle and settings changes.

7. Session 7: Hardening + e2e + developer ergonomics
   - Add structured logging, error mapping, and startup diagnostics.
   - Finalize migration bootstrap (idempotent schema creation for SQLite file/`:memory:`).
   - Add end-to-end tests for TCP agent, WS agent, REST polling, and command roundtrip.
   - Acceptance: `yarn test`, lint, typecheck pass; e2e scenario verifies full v1 flow.

### Data Model (SQLite v1)

- `clients(client_id PK, first_seen_at, last_seen_at)`
- `sessions(client_id, session_id, started_at, last_seen_at, PRIMARY KEY(client_id, session_id))`
- `trees(client_id, session_id, tree_id, serialized_tree_json, removed_at NULL, updated_at, PRIMARY KEY(client_id, session_id, tree_id))`
- `ticks(client_id, session_id, tree_id, tick_id, timestamp, payload_json, PRIMARY KEY(client_id, session_id, tree_id, tick_id))`
- `server_settings(id=1 PK, max_ticks_per_tree, command_timeout_ms, updated_at)`

### Test Cases and Scenarios

1. Agent connects via WS, sends hello/tree/ticks, disconnects; persisted data remains queryable while offline.
2. Agent connects via TCP with same identity as existing WS agent; old connection is superseded.
3. Tick polling with `afterTickId` returns ordered incremental batches and respects `limit`.
4. Retention pruning keeps last N ticks per tree/session exactly.
5. Command success path returns correlated response.
6. Command timeout returns timeout error at configured threshold.
7. Command to offline session returns fail-fast error.
8. Settings update changes retention/timeout behavior for subsequent operations.
9. OpenAPI contract reflects actual handlers and validation constraints.
10. Graceful stop closes HTTP, WS, and TCP listeners without hanging.

### Assumptions and Defaults (locked in this session)

- API style: REST + OpenAPI.
- UI live sync: HTTP polling for ticks + WS metadata events.
- Runtime stack: Fastify.
- Agent transports in v1: WS and TCP both enabled.
- Persistence: SQLite first, `sqlitePath` supports `:memory:`.
- DB access: `better-sqlite3` + SQL (no ORM in v1).
- Command semantics: fail fast offline, 5s default timeout configurable.
- Pagination: cursor-based (no offset pagination).
- Payload format from agents: JSON only in v1.
- Settings scope: global settings only in v1.
- Session chunking: vertical slices.
- Deferred: `studio-ui`, `studio-common`, CLI (`packages/studio`) integration.
