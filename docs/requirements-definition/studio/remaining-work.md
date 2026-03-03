  Remaining Work for Feature-Complete Studio                                                                                                                
                                                                                                                                       
  1. Server — Transport Support Gaps                                                                                                                        
                                                                                                                                                          
  TCP listener — The server currently only accepts WebSocket connections. The transport package provides 4 transport types: WS string, WS binary, TCP       
  string, TCP binary. The server needs:                                                                                                                     
  - A TCP socket listener (using net.createServer) that accepts raw TCP connections with length-framing                                                     
  - The FrameDecoder from @behavior-tree-ist/studio-transport to handle TCP's length-framed messages                                                        
  - A TCPSocketClient wrapper (analogous to WSWebSocketClient) that parses length-framed messages into OutboundMessage                                      
                                                                                                                                                            
  Binary message support — The WS server currently parses all messages as JSON strings. Binary transports send Uint8Array, so the server needs to handle
  binaryType: arraybuffer WebSocket messages and deserialize them (likely MessagePack or raw JSON-from-binary depending on the serialization the agent
  uses).

  2. Server — Missing Features from Requirements

  ┌──────────────────────┬───────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │       Feature        │  Status   │                                                      Notes                                                       │
  ├──────────────────────┼───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Reverse connections  │ Not       │ Req: "eventually support clients listening on a specific ip/port and server connecting to them" — needs saved    │
  │ (server connects to  │ started   │ connection targets + outbound WS/TCP                                                                             │
  │ client)              │           │                                                                                                                  │
  ├──────────────────────┼───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │                      │ Not       │ The UI needs either a WS channel or SSE to receive live tick updates. Current tRPC is request-only (polling).    │
  │ Real-time push to UI │ started   │ Per requirements, polling may be preferred for stability — needs the ticks.query endpoint to support             │
  │                      │           │ cursor-based polling efficiently (this exists) but also a configurable poll-interval mechanism                   │
  ├──────────────────────┼───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Domain events /      │ Skeleton  │ DomainEventType exists but nothing emits or subscribes. Needed for notifying UI of agent connect/disconnect,     │
  │ pub-sub              │ only      │ catalog changes                                                                                                  │
  ├──────────────────────┼───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tick record          │           │ Server receives TickBatch but doesn't track per-tree streaming state. When UI sends EnableStreaming command,     │
  │ streaming toggle     │ Missing   │ server should know that tree is now streaming (for UI indicators)                                                │
  │ awareness            │           │                                                                                                                  │
  ├──────────────────────┼───────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ online connections   │ Partial   │ agentConnectionRegistry.getAllConnections() exists but there's no dedicated tRPC subscription or endpoint        │
  │ endpoint             │           │ returning live connection list with change notification                                                          │
  └──────────────────────┴───────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  3. Studio UI (packages/studio) — Not Started

  The current App.tsx is a self-contained demo that uses a Web Worker to tick a local tree. The entire studio integration is missing:

  ┌─────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │             Feature             │                                                   Description                                                   │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ tRPC client setup               │ Connect to studio-server/trpc — needs @trpc/client dep and typed client from AppRouter                          │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Attach drawer                   │ Side drawer to list clients, their sessions, and trees — click to select                                        │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tree selector                   │ Once a client+session is selected, pick a tree from the list                                                    │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Online/offline indicator        │ Visual badge showing if the attached client is currently connected                                              │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Live vs historical indicator    │ Show whether ticks are live-streamed or replayed from persistence                                               │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Toolbar: streaming toggle       │ Button to enable/disable tick streaming on the remote agent (sends Command via tRPC → server → WS)              │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Toolbar: state trace toggle     │ Button to enable/disable state trace on remote agent                                                            │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Toolbar: profiling toggle       │ Button to enable/disable profiling on remote agent                                                              │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Settings panel                  │ Drawer/dialog for server settings (maxTicksPerTree, commandTimeoutMs, poll interval)                            │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tick polling                    │ Periodically call ticks.query with cursor to fetch new ticks (configurable rate, default 200ms)                 │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Tick processing rate            │ Throttle how fast ticks are fed to BehaviourTreeDebugger to avoid render thrashing                              │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ LocalStorage persistence        │ Remember last selected clientId + sessionId + treeId across refreshes                                           │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Graceful disconnection handling │ Detect server gone, show status, auto-recover                                                                   │
  ├─────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Empty state                     │ Render when no tree/ticks are available (requirements: "allow rendering even when there is no serialized tree") │
  └─────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  4. React Component (packages/react) — Needs Studio Props

  The BehaviourTreeDebuggerProps currently requires tree and ticks as mandatory props. Per requirements:
  - tree should become optional (render empty state)
  - New optional props for studio mode: studioController or similar interface providing { clients, sessions, trees, sendCommand, onAttach, ... }
  - toolbarActions slot exists — studio toolbar buttons could inject through this, but the requirements want tighter integration with the component
  - No studio-specific protocol details should leak into the component

  5. Studio CLI (packages/studio as npm CLI)

  Per requirements, packages/studio should be publishable as a CLI tool:
  - npx @behavior-tree-ist/studio serves both studio-server and the built UI
  - --demo flag spawns a mock agent running heavy-profiler-demo-tree
  - Ctrl+C gracefully shuts down all processes
  - Configurable --port and --host
  - Uses concurrently or custom process management for dev mode (yarn dev)

  6. Integration Testing

  No integration tests exist yet for:
  - Agent → Server WS handshake (Hello → persist → register)
  - tRPC queries returning correct data after WS messages
  - Command flow: tRPC mutation → WS to agent → response → tRPC resolution
  - TCP transport end-to-end
  - Reconnection scenarios

  Priority Order (suggested)

  1. TCP listener in server (complete transport support)
  2. Integration tests for the WS path that already works
  3. React component adaptations (optional tree, studio props interface)
  4. Studio UI wiring (tRPC client, polling, attach drawer, toolbar controls)
  5. Studio CLI (serve built UI + server + optional demo agent)
  6. Reverse connections (future)