# Studio Platform Improvement Suggestions

Covers studio-server, studio-transport, studio-ui, and the React debugger component.

---

## Studio Server & Transport

### High Priority

#### 1. Security Hardening

**CORS is overly permissive** (`origin: true` allows any origin with credentials). Fix:
- Add `CORS_ORIGINS` env var, default to `localhost:*`
- Validate against whitelist before accepting

**No authentication layer.** Any client can send commands, view all data.
- Add optional API key auth (`X-API-Key` header)
- Session-based auth for UI WebSocket
- Scope tRPC queries to authenticated client/session

#### 2. TCP Transport Reconnection

**Problem:** `open()` doesn't retry on failure. Single network glitch = permanent disconnection.

**Suggestion:**
- Configurable retry: `{ maxRetries: 5, backoffMs: 100 }`
- TCP keepalive socket options
- Ping/pong heartbeat at transport layer

#### 3. Command Broker Race Conditions

**Problem:** If agent disconnects after command sent but before response, timeout fires against wrong state. Agent reconnect could deliver stale response.

**Fix:**
- Verify client exists before sending command
- Validate correlationId + client identity on response (not just correlationId)
- Clear pending commands on disconnect

#### 4. Request Rate Limiting

**Problem:** No throttling on tRPC endpoints. `ticks.findAfter()` returns up to 1000 items without pagination guard.

**Suggestion:**
- Per-client rate limiter: 10 commands/sec, 100 tick queries/sec
- Sliding window in memory
- `maxLength` constraints on all Zod string inputs

#### 5. Message Router Error Handling

**Problem:** Handler failures are silently logged, processing continues. If handler A fails, handler B runs on potentially corrupted state.

**Fix:** Add `continueOnHandlerError` flag (default false). Allow marking handlers as "critical" vs "best-effort".

### Medium Priority

#### 6. Tick Pruning Notifications

Pruning silently deletes oldest ticks. Emit a domain event so UI can notify the user. Add global tick limit across all trees.

#### 7. WebSocket Backpressure

Message queue (`Promise.resolve().then(...)`) grows unbounded if handlers are slow. Add backpressure handling, queue depth monitoring, and handler execution timeouts.

#### 8. Session Cleanup

Sessions are created but never marked ended. Add `endedAt` timestamp, mark on disconnect, background job to purge sessions > 30 days.

#### 9. Tree Structure Validation

`TreeRegisteredHandler` stores any JSON without validating against `SerializableNodeSchema`. Validate + reject oversized trees (> 10MB).

#### 10. Observability

No metrics, no structured logging, no request correlation. Add OpenTelemetry for: message processing latency, active connections, tick insertion rate, command response time.

### Low Priority

#### 11. Graceful Shutdown

On server shutdown, pending commands are rejected immediately. Add configurable grace period (default 5s) to drain in-flight commands.

#### 12. Command Response Discriminated Union

Current `{ success: true }` vs `{ success: true, data }` is ambiguous. Use proper discriminated union for TypeScript exhaustiveness.

#### 13. Environment Validation

Invalid config values throw late errors. Add startup validation with clear messages and a `--validate-config` CLI flag.

---

## Studio UI & React Debugger

### High Priority

#### 14. Accessibility

Only 31 `aria-label` attributes across 5233 lines of TSX. Critical gaps:
- SVG elements in FlameGraph lack roles/labels
- Node buttons missing labels
- Timeline slider needs `aria-valuetext`
- No focus management for drawers/modals
- Color-only indicators without text alternatives

Quick wins:
- Add `aria-label` to all interactive buttons
- Add `role="presentation"` to decorative elements
- Implement focus trap for AttachDrawer and SettingsPanel
- Add `aria-valuetext` for timeline scrubber (e.g., "Tick 42 of 150")

#### 15. Mobile Responsive Layout

Below 900px the layout breaks. Below 600px it's unusable:
- Activity window overflows viewport
- Node cards can't resize smaller than 196px
- Toolbar buttons too cramped, no touch-friendly targets (need >= 44px)
- FlameGraph uses fixed `totalWidth: 800`

Add `@media (max-width: 768px)` and `@media (max-width: 480px)` breakpoints with responsive overrides.

#### 16. State Management Refactor

`BehaviourTreeDebugger` has 31 independent `useState` calls at root level (7 just for activity window). This creates state desync risk and makes serialization/restore impossible.

Extract into custom hooks:
```typescript
const { position, collapsed, visible, options } = useActivityWindow();
const { mode, viewedTickId, controls } = useTimeTravelState(inspector);
const { drawer, settings } = useStudioUIState();
```

Or use `useReducer` for complex state groups.

#### 17. Error Boundaries

No error boundaries anywhere. If TreeCanvas, FlameGraph, or inspector crashes, entire UI fails.

Add per-panel error boundaries with fallback UI.

### Medium Priority

#### 18. Timeline Scrubber Drag Handling

While scrubbing, new ticks arriving update the `value` attribute and break drag interaction.

Fix: Track `isDragging` state, don't update input value from props while dragging.

#### 19. Keyboard Navigation

Existing shortcuts (Space, Arrow keys, Escape) are good. Missing:
- Jump to node by ID
- Open attach drawer / settings shortcuts
- Keyboard navigation within activity window
- Visible focus indicators on nodes
- Shortcut help modal (`?` key)

#### 20. Large Tree Performance

No virtualization for large node counts. `useSnapshotOverlay` creates new objects every render per node. Timeline scrubber fires `onChange` per pixel drag with no debounce.

Fixes:
- Debounce timeline scrubber (50ms)
- Memoize snapshot overlay calculations
- Lazy-load detail panel content
- Consider node virtualization for 500+ node trees

#### 21. Theme Robustness

Light mode is new. Needs:
- WCAG contrast validation for all color pairs
- `prefers-reduced-motion` support
- `prefers-contrast: more` high-contrast mode
- System preference sync for initial theme

### Low Priority

#### 22. CSS Organization

`debugger.css` is 2700+ lines. Split into: `layout.css`, `nodes.css`, `panels.css`, `performance.css`, `animations.css`.

#### 23. Node Search/Filter

Add `Ctrl+F` to search nodes by name/type/tag with highlight glow effect. Quick filter by node type (Action, Composite, Decorator).

#### 24. Debugging Annotations

Allow marking ticks with bookmarks/notes. Compare two ticks side-by-side. Export tick data as JSON.

#### 25. Settings Form Validation

`NumberField` silently reverts invalid input. Show inline error messages instead.
