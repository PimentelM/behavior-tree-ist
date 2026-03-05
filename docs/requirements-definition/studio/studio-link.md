# Plan: Refactor StudioLink — Interface + Concrete Class + Transport

## Context

The current `StudioLink` is a pure interface in `studio-link.ts`. We're splitting it into:
- `StudioLinkInterface` in `interfaces.ts` — for users who want fully custom implementations
- `StudioLink` concrete class in `studio-link.ts` — default JSON-based implementation with pluggable serialization
- `Transport` interface in `transport.ts` — abstracts raw WebSocket/TCP connections

**Key design decisions:**
- Factory pattern: `() => Transport` creates fresh instances per connection attempt
- Sync void `send()` on Transport (fire-and-forget, matches WebSocket.send())
- All lifecycle methods sync externally; promises stored internally, results checked on `tick()`
- At most one pending promise per operation (tick spamming is safe, no cooldown needed for correctness)
- Transport must deliver complete messages (TCP implementations handle framing internally)
- Numeric enum for protocol message types (no string discriminators on the wire)
- Pluggable serialization via constructor injection (default: JSON)

---

## Step 1: Create `packages/core/src/studio/transport.ts`

```typescript
export type TransportData = string | Uint8Array;

export interface Transport {
    open(): Promise<void>;
    close(): void;
    send(data: TransportData): void;
    onMessage(handler: (data: TransportData) => void): OffFunction;
    onError(handler: (error: Error) => void): OffFunction;
    onClose(handler: () => void): OffFunction;
}

export type TransportFactory = () => Transport;
```

- `open()` → `Promise<void>`: resolves on connect, rejects on failure
- `close()` → sync void: initiates close, `onClose` fires when done
- `send()` → sync void: throws if not open
- Each Transport instance = single connection lifecycle
- Contract: `onMessage` delivers exactly one complete message per callback

## Step 2: Create `packages/core/src/studio/protocol.ts`

Numeric message type enum + discriminated unions:

```typescript
export const MessageType = {
    Hello: 1,
    TreeRegistered: 2,
    TreeRemoved: 3,
    TickBatch: 4,
    CommandResponse: 5,
    Command: 6,
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const PROTOCOL_VERSION = 1;

// Outbound (client → server)
export type OutboundMessage =
    | { t: 1; version: number; clientId: string; sessionId: string }
    | { t: 2; treeId: string; serializedTree: SerializableNode }
    | { t: 3; treeId: string }
    | { t: 4; treeId: string; ticks: TickRecord[] }
    | { t: 5; correlationId: CorrelationId; response: CommandResponse };

// Inbound (server → client)
export type InboundMessage =
    | { t: 6; command: StudioCommand };
```

Uses short `t` key for compactness. Hello includes `version` field for server compatibility checks.

## Step 3: Create `packages/core/src/studio/interfaces.ts`

Move the current StudioLink interface here, renamed and extended:

```typescript
export interface StudioLinkInterface {
    // Outbound
    sendHello(clientId: string, sessionId: string): void;
    sendTreeRegistered(treeId: string, serializedTree: SerializableNode): void;
    sendTreeRemoved(treeId: string): void;
    sendTickBatch(treeId: string, ticks: TickRecord[]): void;
    sendCommandResponse(correlationId: CorrelationId, response: CommandResponse): void;

    // Inbound
    onCommand(handler: (command: StudioCommand) => void): OffFunction;
    onConnected(handler: () => void): OffFunction;
    onDisconnected(handler: () => void): OffFunction;
    onError(handler: (error: Error) => void): OffFunction;

    // Lifecycle
    open(): void;
    close(): void;
    tick(): void;
    readonly isConnected: boolean;
}
```

Changes from current interface:
- Added `tick(): void`
- Added `onError()` for observability
- `open()`/`close()` remain sync void (promises managed internally)

## Step 4: Replace `packages/core/src/studio/studio-link.ts` — Concrete class

```typescript
export interface StudioLinkOptions {
    createTransport: TransportFactory;
    serialize?: (message: OutboundMessage) => TransportData;
    deserialize?: (data: TransportData) => InboundMessage;
    reconnectDelayMs?: number;  // default: 3000
}

export class StudioLink implements StudioLinkInterface { ... }
```

**Internal state machine:**
- `idle` → `open()` called → `connecting` (promise stored) → `tick()` checks promise → `connected` or back to `idle`
- While `connecting`: `tick()` checks if promise settled; no new promises created
- While `connected`: `tick()` is no-op for connection
- On `transport.onClose` → `idle` (transport reference discarded)
- `close()` from any state → tears down transport, emits disconnected if was connected, goes to `closed`

**Reconnect delay:** Track `lastConnectionAttemptAt`. On `tick()`, only attempt reconnection if `now - lastConnectionAttemptAt >= reconnectDelayMs`. The `now` comes from `Date.now()` (StudioLink is internal infrastructure, not on the hot path like tree ticking).

**Pluggable serialization:** Default serialize = `JSON.stringify`, default deserialize = `JSON.parse` with text decoding for Uint8Array. Users can pass MessagePack/protobuf serializers.

**onError:** Fires on transport errors and failed connection attempts. Allows user logging/debugging.

**Protocol version:** `sendHello()` includes `PROTOCOL_VERSION` in the serialized message.

## Step 5: Update `packages/core/src/studio/studio-agent.ts`

- Change import: `StudioLinkInterface` from `./interfaces` instead of `StudioLink` from `./studio-link`
- Type the `link` field as `StudioLinkInterface`
- Add `tick(): void` method that delegates to `this.link.tick()`
- Everything else unchanged

## Step 6: Update `packages/core/src/studio/studio-agent.test.ts`

Minimal changes to `MockStudioLink`:
- Implement `StudioLinkInterface` instead of `StudioLink`
- Add `tick: vi.fn()` to the mock
- Add `onError` subscription method to the mock
- All existing test logic unchanged

## Step 7: Update `packages/core/src/studio/index.ts`

```typescript
export * from "./types";
export * from "./interfaces";    // NEW
export * from "./transport";     // NEW
export * from "./protocol";      // NEW
export * from "./studio-link";   // concrete class
export * from "./studio-agent";
```

## Step 8: Create `packages/core/src/studio/studio-link.test.ts`

`MockTransport` implementing `Transport`:
- `send: vi.fn()`, `close: vi.fn()`
- `_resolveOpen()` / `_rejectOpen()` to control the pending open promise
- `_simulateMessage(data)`, `_simulateClose()`, `_simulateError(err)`

**Test cases:**
- **Serialization**: each `send*()` calls `transport.send()` with correct JSON containing numeric `t` field
- **Hello includes version**: `sendHello` serializes `PROTOCOL_VERSION`
- **Deserialization**: transport message with `t: MessageType.Command` dispatches to `onCommand`
- **Custom serialization**: pass custom serialize/deserialize, verify they're used
- **Connection lifecycle**: `open()` → factory called → transport created; `tick()` → promise resolved → connected event
- **Failed connection**: `tick()` → promise rejected → transport discarded, onError fired, ready for retry
- **Disconnection**: transport.onClose → disconnected event, transport discarded
- **Reconnection**: after disconnect, next `tick()` (after delay) creates new Transport via factory
- **Reconnect delay**: `tick()` within `reconnectDelayMs` of last attempt doesn't create new transport
- **Single promise guarantee**: multiple `tick()` calls while connecting don't create multiple promises
- **Guards**: sends are no-ops when disconnected
- **Close**: tears down transport, emits disconnected if was connected
- **onError**: transport errors and connection failures surfaced to listeners

## Verification

```bash
yarn test && yarn lint && yarn typecheck
```

All existing StudioAgent tests pass with minimal mock changes. New StudioLink tests cover the concrete class thoroughly.
