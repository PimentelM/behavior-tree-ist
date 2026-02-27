# Core Concepts

## NodeResult

Every node tick returns one of three values:

```typescript
const NodeResult = {
  Succeeded: "Succeeded", // Objective achieved
  Failed: "Failed",       // Objective cannot be achieved
  Running: "Running",     // Needs more ticks to complete
} as const;

type NodeResult = "Succeeded" | "Failed" | "Running";
```

`Running` is what makes behaviour trees powerful -- it allows nodes to span multiple ticks, enabling long-running actions like movement, animations, or waiting.

## BTNode

`BTNode` is the abstract base class for all nodes. Key properties:

| Property | Type | Description |
|---|---|---|
| `id` | `number` | Unique auto-incrementing identifier |
| `defaultName` | `string` | Type-level name (e.g. `"Sequence"`, `"Action"`) |
| `name` | `string` | Custom instance name, defaults to `displayName` |
| `displayName` | `string` | Returns custom `name` if set, otherwise `defaultName` |
| `tags` | `readonly string[]` | Metadata tags for filtering and inspection |
| `nodeFlags` | `NodeFlags` | Bitfield for classification (see [Node Flags](node-flags.md)) |
| `wasRunning` | `boolean` | True if the previous tick returned `Running` |

## Tick Lifecycle

The tick lifecycle is the heart of the library. When `BTNode.Tick(node, ctx)` is called:

```
                      BTNode.Tick(node, ctx)
                              |
                    +---------+---------+
                    |                   |
             Was NOT running       Was running
                    |                   |
               onEnter(ctx)       onResume(ctx)
                    |                   |
                    +--------+----------+
                             |
                      result = onTick(ctx)
                             |
                    +--------+----------+
                    |                   |
             Was running AND        (otherwise)
           result is NOT Running        |
                    |                   |
               onReset(ctx)             |
                    |                   |
                    +--------+----------+
                             |
                      onTicked(result, ctx)
                             |
              +--------------+--------------+
              |              |              |
          Succeeded        Failed        Running
              |              |              |
        onSuccess(ctx)  onFailed(ctx)  onRunning(ctx)
              |              |              |
              +------+-------+              |
                     |                      |
              onFinished(result, ctx)        |
                     |                      |
                     +----------+-----------+
                                |
                    onSuccessOrRunning(ctx)  [if Succeeded or Running]
                    onFailedOrRunning(ctx)   [if Failed or Running]
```

### Hook Reference

| Hook | When it fires | Typical use |
|---|---|---|
| `onEnter(ctx)` | First tick of a fresh execution (`wasRunning` was false) | Initialize state, record start time |
| `onResume(ctx)` | Continuation tick (`wasRunning` was true) | Update timers, check conditions |
| `onTick(ctx)` | Every tick (abstract -- core logic) | Implemented by each node type |
| `onReset(ctx)` | Transitioning out of Running (natural or abort) | Cleanup, release resources |
| `onTicked(result, ctx)` | After `onTick`, before result-specific hooks | Logging, metrics |
| `onSuccess(ctx)` | Result is `Succeeded` | Side effects on success |
| `onFailed(ctx)` | Result is `Failed` | Side effects on failure |
| `onRunning(ctx)` | Result is `Running` | Progress tracking |
| `onFinished(result, ctx)` | Result is `Succeeded` or `Failed` | Cleanup on completion |
| `onSuccessOrRunning(ctx)` | Result is `Succeeded` or `Running` | "Not failed" side effects |
| `onFailedOrRunning(ctx)` | Result is `Failed` or `Running` | "Not succeeded" side effects |
| `onAbort(ctx)` | Only via `BTNode.Abort()` | External interrupt handling |

## Abort

`BTNode.Abort(node, ctx)` is a separate path from ticking. It's used when a parent node needs to interrupt a running child (e.g., a Sequence aborting later children when an earlier child fails).

```
BTNode.Abort(node, ctx)
        |
  [only if wasRunning]
        |
   onAbort(ctx)
        |
   onReset(ctx)
        |
   wasRunning = false
```

`onAbort` is the **only** hook that is never called during `BTNode.Tick`. It fires exclusively during `BTNode.Abort`.

## TickContext

The context object passed to every hook and `onTick`:

```typescript
interface TickContext {
  tickId: number;               // Current tick identifier (auto-incremented by BehaviourTree)
  now: number;                  // Timestamp for this tick (milliseconds)
  events: TickTraceEvent[];     // Accumulated trace events (when tracing enabled)
  refEvents: RefChangeEvent[];  // Ref change events recorded during this tick
  trace: (node, result, startedAt?, finishedAt?) => void;  // Trace recording function
  getTime?: () => number;       // High-res timer for profiling (when profiling enabled)
}
```

`now` is what timing decorators use. Always pass a consistent timestamp per tick (e.g., `Date.now()` or your game engine's clock).

## Ref System

The library provides a `Ref<T>` primitive for type-safe, auto-traced state sharing between nodes. Refs fill the gap for small-scale inter-node communication while preserving the existing closure/DI patterns for larger-scale needs.

### Ref\<T\>

A mutable container with automatic tracing. When a named ref is written during a tick, a `RefChangeEvent` is pushed to the ambient `TickContext.refEvents`.

```typescript
import { ref } from 'behavior-tree-ist';

const health = ref(100, 'health');  // Named ref (traced)
const scratch = ref(0);             // Unnamed ref (untraced, lightweight)

health.value = 80;   // Traced if inside a tick, otherwise silent
health.set(60);      // Same as .value = 60
health.set(50, ctx); // Explicit ctx — for async actions where ambient ctx isn't active
```

### ReadonlyRef\<T\>

A read-only view of a `Ref`. Use `.asReadonly()` or the `readonlyRef()` factory:

```typescript
import { ref, readonlyRef } from 'behavior-tree-ist';

const source = ref(42, 'answer');
const ro = readonlyRef(source);  // ReadonlyRef<number>
// ro.value → 42 (reflects source updates)
```

### DerivedRef\<T\>

A lazily computed read-only ref. Recomputes on each `.value` access. Produces no trace events.

```typescript
import { ref, derivedRef } from 'behavior-tree-ist';

const a = ref(2, 'a');
const b = ref(3, 'b');
const sum = derivedRef(() => a.value + b.value, 'sum');
// sum.value → 5 (recomputes each access)
```

### Ambient Tracing

`BTNode.Tick` and `BTNode.Abort` push the `TickContext` onto an internal stack before invoking hooks, and pop it in a `finally` block. This means any `ref.value = x` inside `onTick`, `onEnter`, `onAbort`, etc. automatically traces to the correct context — no ceremony needed.

- **Named refs** produce `RefChangeEvent` entries with `oldValue` and `newValue`
- **Unnamed refs** are lightweight and untraced (no events even during ticks)
- **Outside ticks** (no ambient context), writes succeed silently with no tracing
- The stack design supports nested ticks (composite → children) and multiple concurrent tree instances

## The `.decorate()` Method

Any `BTNode` can be wrapped with decorators using `.decorate()`:

```typescript
import { Action, Repeat, Timeout, NodeResult } from 'behavior-tree-ist';

const node = Action.from('My Action', () => NodeResult.Succeeded);

// Decorators are applied right-to-left: first spec = outermost wrapper
const decorated = node.decorate(
  [Repeat, 3],      // Outermost: repeats the whole thing 3 times
  [Timeout, 1000],  // Inner: each attempt has a 1s timeout
);
```

The type system validates decorator specs at compile time -- you'll get errors for invalid constructor arguments.

This is the low-level API. The [builder](construction-apis.md) and [TSX](tsx.md) APIs provide the same functionality through props.
