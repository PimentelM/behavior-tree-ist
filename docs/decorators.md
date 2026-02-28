# Decorators

Decorators wrap a single child node to modify its behavior. All decorators extend the `Decorator` base class and are applied via direct instantiation, the [`.decorate()` method](core-concepts.md#the-decorate-method), [builder props](construction-apis.md), or [TSX props](tsx.md).

## Result Transformers

Remap the child's result without altering its execution.

| Decorator | Constructor | Behavior |
|---|---|---|
| `Inverter` | `(child)` | Swaps `Succeeded` <-> `Failed`; `Running` unchanged |
| `ForceSuccess` | `(child)` | Maps `Succeeded` and `Failed` -> `Succeeded`; `Running` unchanged |
| `ForceFailure` | `(child)` | Maps `Succeeded` and `Failed` -> `Failed`; `Running` unchanged |
| `RunningIsSuccess` | `(child)` | Maps `Running` -> `Succeeded`; aborts child. Others unchanged |
| `RunningIsFailure` | `(child)` | Maps `Running` -> `Failed`; aborts child. Others unchanged |

**Flags**: `ResultTransformer`

```typescript
import { Inverter, ForceSuccess, Action, NodeResult } from '@behavior-tree-ist/core';

// Invert: treat failure as success
const notDead = new Inverter(
  ConditionNode.from('Is dead?', () => entity.health <= 0)
);

// Force success: swallow failures
const bestEffort = new ForceSuccess(riskyAction);
```

## Guards

Conditionally gate child execution based on a boolean check.

| Decorator | Constructor | If condition true | If condition false |
|---|---|---|---|
| `Precondition` | `(child, name, condition)` | Tick child | Abort child, return `Failed` |
| `SucceedIf` | `(child, name, condition)` | Abort child, return `Succeeded` | Tick child |
| `FailIf` | `(child, name, condition)` | Abort child, return `Failed` | Tick child |

**Flags**: `Guard`

**Aliases**: `SucceedIf` is also exported as `SkipIf`

```typescript
import { Precondition, SucceedIf, Action, NodeResult } from '@behavior-tree-ist/core';

// Only tick child if entity has mana
const guarded = new Precondition(
  Action.from('Cast spell', () => NodeResult.Succeeded),
  'Has mana?',
  (ctx) => entity.mana > 0,
);

// Skip the subtree entirely (return Succeeded) if already at destination
const skipIfDone = new SucceedIf(
  moveToTarget,
  'At destination?',
  () => entity.atDestination,
);
```

## Timing

Time-based decorators that use `ctx.now` to track elapsed time. Duration values use the same unit as `ctx.now` (defaults to milliseconds via `Date.now()` but can be any time unit — see [TickContext](core-concepts.md#tickcontext)).

| Decorator | Constructor | Behavior |
|---|---|---|
| `Timeout` | `(child, timeout)` | Aborts child and returns `Failed` if it runs longer than `timeout` |
| `Delay` | `(child, delayDuration)` | Returns `Running` for `delayDuration` before ticking child |
| `Cooldown` | `(child, cooldown)` | After child finishes, returns `Failed` for `cooldown` |
| `Throttle` | `(child, throttle)` | Prevents re-entry for `throttle` after initial tick (does not throttle resumption) |
| `RequireSustainedSuccess` | `(child, duration)` | Child must return `Succeeded` continuously for `duration`; resets on failure/running |

**Flags**: `Stateful`, `TimeBased`

All timing decorators expose `getDisplayState()` with their remaining time.

```typescript
import { Timeout, Delay, Cooldown, RequireSustainedSuccess } from '@behavior-tree-ist/core';

// Fail if child runs longer than 5000 time units
const timed = new Timeout(longRunningAction, 5000);

// Wait 1000 time units before starting
const delayed = new Delay(action, 1000);

// After completing, wait 3000 time units before allowing re-execution
const cooled = new Cooldown(action, 3000);

// Only succeed if the sensor reads true for 2000 continuous time units
const sustained = new RequireSustainedSuccess(sensorCheck, 2000);
```

### Timing Decorator Comparison

```
Timeline:  t=0     t=500    t=1000   t=1500   t=2000

Delay:     |--Running--|---child ticks--->
                       ^ child starts after delay

Timeout:   |---child ticks---|Failed
                              ^ aborted after timeout

Cooldown:  |--child--|--Failed--|--child-->
                     ^ finished  ^ cooldown expired

Throttle:  |--child--|--Failed--|--child-->
                     ^ entry     ^ throttle expired (re-entry OK)
```

## Control Flow

Decorators that alter execution flow (looping, caching).

| Decorator | Constructor | Behavior |
|---|---|---|
| `Repeat` | `(child, times?)` | Repeats child on success. `times=-1` for infinite. Fails immediately on child failure. |
| `Retry` | `(child, maxRetries?)` | Retries child on failure. `maxRetries=-1` for infinite. Succeeds immediately on child success. |
| `KeepRunningUntilFailure` | `(child)` | Loops child until it fails. Success -> restart (Running). Failure -> `Succeeded`. |
| `RunOnce` | `(child)` | Executes child once, caches terminal result. Returns cached result on subsequent ticks. |

**Flags**: `Repeat`/`Retry`/`KeepRunningUntilFailure` have `Repeating`. `Repeat`/`Retry`/`RunOnce` also have `Stateful`. `Repeat` and `Retry` additionally have `CountBased`.

```typescript
import { Repeat, Retry, RunOnce } from '@behavior-tree-ist/core';

// Run patrol action 5 times
const patrolRoute = new Repeat(patrolAction, 5);

// Retry flaky network call up to 3 times
const resilient = new Retry(networkCall, 3);

// Initialize only once, cache result
const init = new RunOnce(setupAction);

// RunOnce can be force-reset programmatically
init.forceReset();
```

### Repeat vs Retry

| | On child `Succeeded` | On child `Failed` | On child `Running` |
|---|---|---|---|
| **Repeat** | Increment counter. If done -> `Succeeded`, else -> `Running` | Immediately `Failed` | `Running` |
| **Retry** | Immediately `Succeeded` | Increment counter. If exhausted -> `Failed`, else -> `Running` | `Running` |

## Lifecycle Hooks

Decorator wrappers that call a callback on specific lifecycle events. These are the decorator equivalents of overriding lifecycle methods on a custom node.

**Flags**: `Lifecycle`

| Decorator | Constructor | Fires when |
|---|---|---|
| `OnEnter` | `(child, cb)` | Node begins fresh execution |
| `OnResume` | `(child, cb)` | Node resumes from Running |
| `OnReset` | `(child, cb)` | Node transitions out of Running |
| `OnTicked` | `(child, cb: (result, ctx) => void)` | After every tick (receives result) |
| `OnSuccess` | `(child, cb)` | Result is `Succeeded` |
| `OnFailure` | `(child, cb)` | Result is `Failed` |
| `OnRunning` | `(child, cb)` | Result is `Running` |
| `OnFinished` | `(child, cb: (result, ctx) => void)` | Result is `Succeeded` or `Failed` |
| `OnSuccessOrRunning` | `(child, cb)` | Result is `Succeeded` or `Running` |
| `OnFailedOrRunning` | `(child, cb)` | Result is `Failed` or `Running` |
| `OnAbort` | `(child, cb)` | Node is aborted (not during normal ticking) |

```typescript
import { OnEnter, OnSuccess, OnAbort, Action, NodeResult } from '@behavior-tree-ist/core';

const tracked = new OnEnter(
  new OnSuccess(
    new OnAbort(
      Action.from('Attack', () => NodeResult.Succeeded),
      (ctx) => console.log('Attack was interrupted!'),
    ),
    (ctx) => console.log('Attack succeeded!'),
  ),
  (ctx) => console.log('Starting attack...'),
);
```

Using `.decorate()` is more readable for multiple hooks:

```typescript
const tracked = Action.from('Attack', () => NodeResult.Succeeded).decorate(
  [OnEnter, (ctx) => console.log('Starting attack...')],
  [OnSuccess, (ctx) => console.log('Attack succeeded!')],
  [OnAbort, (ctx) => console.log('Attack was interrupted!')],
);
```

Or with builder props:

```typescript
const tracked = action({
  name: 'Attack',
  execute: () => NodeResult.Succeeded,
  onEnter: (ctx) => console.log('Starting attack...'),
  onSuccess: (ctx) => console.log('Attack succeeded!'),
  onAbort: (ctx) => console.log('Attack was interrupted!'),
});
```

## Abort Propagation

Control how abort requests are forwarded to a child.

| Decorator | Constructor | Behavior |
|---|---|---|
| `NonAbortable` | `(child)` | Swallows `onAbort` forwarding. The decorator itself can be aborted, but it does not call `BTNode.Abort` on its child. |

```typescript
import { NonAbortable, Action, NodeResult } from '@behavior-tree-ist/core';

const shielded = new NonAbortable(
  Action.from('Background Work', () => NodeResult.Running),
);
```

## Utility

**Flags**: `Utility`

Wraps a child with a scoring function for use in [UtilityFallback / UtilitySequence](composite-nodes.md#utilityfallback-utilityselector).

```typescript
import { Utility, Action, NodeResult, TickContext } from '@behavior-tree-ist/core';

type UtilityScorer = (ctx: TickContext) => number;

const scoredAction = new Utility(
  Action.from('Eat', () => NodeResult.Succeeded),
  (ctx) => hungerLevel, // Higher score = higher priority
);

// Access the score
scoredAction.getScore(ctx);
```

`Utility` only provides scoring (`getScore(ctx)`). For debugger score visualization, see `UtilityFallback` / `UtilitySequence` display state.

## Tag

Adds string tags to a node for filtering and inspection. Unlike other decorators, `Tag` returns the child node itself (with tags added), not a wrapper.

```typescript
import { Tag, Action, NodeResult } from '@behavior-tree-ist/core';

const tagged = new Tag(
  Action.from('Attack', () => NodeResult.Succeeded),
  'combat', 'offensive',
);

// Tags are accessible via node.tags
tagged.tags; // ['combat', 'offensive']
```

Tags can also be added directly: `node.addTags(['combat', 'offensive'])`.

## SubTree

Metadata-only boundary decorator for subtree roots. `SubTree` is behaviorally transparent: it ticks and aborts exactly like its child.

Use it when you want a stable runtime boundary marker for inspector/UI features (collapse, filtering, breadcrumbs) or future logical scoping.

```typescript
import { SubTree, Sequence, Action, NodeResult } from '@behavior-tree-ist/core';

const combatBoundary = new SubTree(
  Sequence.from('Combat Logic', [
    Action.from('Attack', () => NodeResult.Succeeded),
  ]),
  {
    id: 'combat-root',
    namespace: 'combat',
  },
);
```

`SubTree` sets the `SubTree` flag and optionally exposes `{ id, namespace }` via display state for tooling. It does not change execution semantics.

## Summary Table

| Category | Decorators | Flags |
|---|---|---|
| Result Transformers | Inverter, ForceSuccess, ForceFailure, RunningIsSuccess, RunningIsFailure | `ResultTransformer` |
| Guards | Precondition, SucceedIf/SkipIf, FailIf | `Guard` |
| Timing | Timeout, Delay, Cooldown, Throttle, RequireSustainedSuccess | `Stateful`, `TimeBased` |
| Control Flow | Repeat, Retry, KeepRunningUntilFailure, RunOnce | `Repeating` / `Stateful` / `CountBased` (Repeat, Retry) |
| Lifecycle | OnEnter, OnResume, OnReset, OnTicked, OnSuccess, OnFailure, OnRunning, OnFinished, OnSuccessOrRunning, OnFailedOrRunning, OnAbort | `Lifecycle` |
| Abort Propagation | NonAbortable | `Decorator` |
| Scoring | Utility | `Utility` |
| Metadata | Tag, SubTree | `SubTree` (SubTree only) |
