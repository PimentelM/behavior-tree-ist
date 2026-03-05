# DX, Testing & AI Integration Suggestions

Covers developer experience, documentation, test coverage, and the AI/MCP roadmap.

---

## Developer Experience & Documentation

### High Priority

#### 1. Package READMEs

6 of 7 packages have NO README. Users installing studio packages get zero guidance.

Create READMEs for: `react`, `studio-cli`, `studio-server`, `studio-common`, `studio-transport`, `studio-ui`. Each needs: installation, quick start, basic example.

#### 2. Complete Incomplete Docs

Several docs are truncated mid-section:
- `tsx.md` -- cut off at "Utility Elements"
- `inspector.md` -- cut off at "TreeIndex"
- `decorators.md` -- cut off mid-section
- `react-debugger.md` -- omits CSS/styling details

#### 3. Studio Setup Guide

No practical guide for connecting agents to the studio. Create `docs/studio-setup.md` covering: agent instrumentation, server startup, UI connection, transport selection (TCP vs WebSocket), port config, multi-agent setup.

#### 4. Examples Directory

Only 1 demo file (`cpu-heavy-tree.ts`, 39KB, complex). Need beginner-friendly examples:
- Basic action + sequence
- Decorators showcase (timeout, retry, cooldown)
- Ref system usage
- Custom node creation
- Game AI pattern (patrol/chase/flee)
- Studio integration (agent + server)

#### 5. Developer Setup Guide

No instructions for monorepo bootstrap. Create `docs/development-setup.md` covering:
- `yarn install`, `yarn build`, `yarn test`, `yarn dev`
- Workspace workflow
- How demo connects to server
- Troubleshooting common issues

### Medium Priority

#### 6. Contribution Guide

No CONTRIBUTING.md. Document: code style (from CLAUDE.md), PR process, test requirements, documentation expectations.

#### 7. TypeScript/Build Documentation

- tsconfig inheritance strategy unexplained
- ESM/CJS split approach undocumented
- JSX factory config needs dedicated guide
- Entry points (`./builder`, `./tsx`, `./inspector`) not clearly explained

#### 8. Troubleshooting Guide

No FAQ. Common issues not documented:
- TSX compilation failures
- Inspector performance tuning
- Timing decorator edge cases (0 as valid value)

#### 9. Learning Path

No suggested reading order. Add `docs/learning-path.md` with progression by use case (game AI, robotics, agent simulation).

---

## Testing

### Current State

| Package | Src Files | Tests | Coverage | Grade |
|---------|-----------|-------|----------|-------|
| core | 93 | 60 | ~64% | B+ |
| react | 15 | 1 | ~7% | F |
| studio-server | 78 | 7 | ~9% | F |
| studio-transport | 13 | 5 | ~38% | C- |
| studio-common | 5 | 0 | 0% | F |
| studio-ui | 11 | 0 | 0% | F |
| studio-cli | 2 | 0 | 0% | F |
| **Total** | **239** | **73** | **~30%** | **D+** |

### High Priority Test Gaps

#### 1. Studio-Server Message Handlers (0 tests)

8 handler modules (`hello`, `tick-batch`, `tree-registered`, `tree-removed`, `command-response`) with zero unit tests. Risk: malformed messages, race conditions, incomplete traces. Need ~40 test cases.

#### 2. Studio-Server tRPC Routes (0 tests)

6 route files (`clients`, `commands`, `health`, `sessions`, `settings`, `ticks`, `trees`) untested. Risk: API contract violations. Need ~30 test cases.

#### 3. React Hooks (0 tests except tree-to-flow)

6 custom hooks (`useInspector`, `useNodeDetails`, `usePerformanceData`, `useSnapshotOverlay`, `useTimeTravelControls`, `useTreeLayout`) untested. Risk: stale subscriptions, infinite loops.

#### 4. Studio-UI State Management (0 tests)

WebSocket management, tick polling, settings, tree status hooks -- all untested. Risk: connection hangs, memory leaks, stale state.

#### 5. FallbackWithMemory (0 tests in core)

Complex stateful logic maintaining running child index. Missing tests for: running state persistence, reset on terminal, abort propagation.

### Medium Priority Test Gaps

#### 6. AsyncAction Edge Cases

Existing tests lack: rejection during abort, race between resolve and parent cancellation, error categorization.

#### 7. Browser Transport Tests

Browser WebSocket transports (`ws-binary.ts`, `ws-string.ts`) untested. Framing edge cases: oversized packets, corrupted length headers.

#### 8. Studio-Common Schema Validation

All Zod schemas untested. Risk: schema changes undetected, data model bugs.

### Test Infrastructure Suggestions

- **Performance regression tests:** Benchmark suite with CI integration for tick throughput and memory
- **Cross-package integration tests:** Core -> React -> Studio-UI -> Server full pipeline
- **Property-based tests:** Random tree generation + execution for invariant checking
- **E2E tests:** Playwright for time-travel, activity window dragging, node selection

---

## AI Integration & MCP Roadmap

### Phase 1: Runtime Inspection MCP (4-6 weeks)

Build `studio-server-mcp` package with these tools:

| Tool | Description |
|------|-------------|
| `list_trees` | All registered trees with metadata |
| `get_tree_structure` | Serialized tree + flat node index |
| `query_ticks` | Flexible tick range queries with filters |
| `get_node_snapshot` | Full node state at specific tick |
| `analyze_hot_nodes` | CPU profile top-N nodes |
| `get_activity_path` | Current execution activity branches |
| `get_node_history` | Full result history for a node |
| `get_ref_timeline` | State changes for a specific ref |
| `get_flame_graph` | Hierarchical timing frames |

Plus MCP resources for docs:
- `docs://library/core-concepts` -- lifecycle, tick semantics
- `docs://library/decorators` -- decorator reference
- `docs://tree/{treeId}/index` -- live tree structure
- `docs://tree/{treeId}/activity` -- current activity summary
- `search://docs` -- full-text doc search

Support both `stdio` (local dev) and HTTP (remote) transports.

### Phase 2: Analysis & Code Generation (6-8 weeks)

**Anomaly Detection Tools:**
- `detect_deadlock` -- nodes stuck in Running
- `detect_infinite_retry` -- Retry nodes that never succeed
- `detect_unused_conditions` -- conditions with constant results
- `detect_race_conditions` -- parallel nodes with conflicting ref mutations
- `optimize_cpu_profile` -- automated optimization suggestions

**Code Generation:**
- `generate_tree_code` -- plain-language requirements to tree code (builder/TSX/direct)
- `validate_tree_structure` -- type-check and lint tree definitions
- `suggest_decorator` -- recommend decorators based on node description
- `generate_test` -- create unit tests for tree behavior

### Phase 3: Quality & Discoverability (4-6 weeks)

- Publish MCP servers in Official MCP Registry
- AI compatibility test matrix (Claude, GPT-4, local models)
- AI evals: build tree from requirements, diagnose failing nodes, explain lifecycle
- Agent skills for Cursor/Claude Code integration
- `AGENTS.md` snippets for preferred MCP usage patterns

### Example AI Workflow: "Fix stuck node"

```
1. Resource: Read docs://agents/debugging-checklist
2. Tool: detect_deadlock -> confirm node stuck in Running
3. Tool: get_node_history(nodeId) -> see result pattern
4. Tool: get_ref_timeline -> check state for leaks
5. Resource: Read docs://library/decorators -> suggest Timeout
6. Tool: generate_tree_code -> wrap with Timeout decorator
7. Tool: validate_tree_structure -> confirm generated code compiles
```

### Implementation Notes

- All existing inspector data (profiling, state, activity) maps directly to MCP tools
- Zod schemas in `studio-common` can be reused for MCP input validation
- `TreeInspector` already provides most query backends needed
- Phase 1 is read-only (no mutations) -- simpler security model
- Consider OAuth 2.1 + PKCE for Phase 3 remote access
