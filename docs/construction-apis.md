# Construction APIs

@behavior-tree-ist/core provides three equivalent APIs for building trees. All produce the same `BTNode` objects.

## Direct Instantiation

The most explicit API. Create node instances directly and compose them with `.addNode()`, `static from()`, or `.decorate()`.

```typescript
import {
  Sequence, Fallback, ConditionNode, Action,
  Timeout, Repeat, NodeResult,
} from '@behavior-tree-ist/core';

const root = Fallback.from('AI', [
  Sequence.from('Attack', [
    ConditionNode.from('Enemy nearby?', () => enemyNearby),
    Action.from('Strike', () => NodeResult.Succeeded)
      .decorate([Timeout, 5000], [Repeat, 3]),
  ]),
  Action.from('Patrol', () => NodeResult.Running),
]);
```

### `.decorate()` Application Order

Decorators are applied **right-to-left** -- the first spec becomes the outermost wrapper:

```typescript
node.decorate(
  [Repeat, 3],     // Outermost: repeats everything 3 times
  [Timeout, 1000], // Inner: each repetition has a 1s timeout
);
// Equivalent to: new Repeat(new Timeout(node, 1000), 3)
```

### Manual Composition

```typescript
const seq = new Sequence('My Sequence');
seq.addNode(child1);
seq.addNode(child2);
// Or: seq.setNodes([child1, child2]);
```

## Builder Functions

Function-based API with automatic decorator application via the `NodeProps` interface. Import from `@behavior-tree-ist/core/builder`.

```typescript
import {
  fallback, sequence, condition, action,
  parallel, ifThenElse, sleep,
} from '@behavior-tree-ist/core/builder';

const root = fallback({ name: 'AI' }, [
  sequence({ name: 'Attack', timeout: 5000 }, [
    condition({ name: 'Enemy nearby?', eval: () => enemyNearby }),
    action({
      name: 'Strike',
      repeat: 3,
      onSuccess: () => console.log('Hit!'),
      execute: () => NodeResult.Succeeded,
    }),
  ]),
  action({ name: 'Patrol', execute: () => NodeResult.Running }),
]);
```

### All Builder Functions

**Composites** (take `props` + `children`):

| Function | Node type |
|---|---|
| `sequence(props, children)` | `Sequence` |
| `fallback(props, children)` | `Fallback` |
| `selector(props, children)` | Alias for `fallback` |
| `parallel(props, children)` | `Parallel` |
| `sequenceWithMemory(props, children)` | `SequenceWithMemory` |
| `fallbackWithMemory(props, children)` | `FallbackWithMemory` |
| `selectorWithMemory(props, children)` | Alias for `fallbackWithMemory` |
| `ifThenElse(props, children)` | `IfThenElse` |
| `utilityFallback(props, children)` | `UtilityFallback` |
| `utilitySelector(props, children)` | Alias for `utilityFallback` |
| `utilitySequence(props, children)` | `UtilitySequence` |

`parallel` also accepts:
- `policy?: ParallelPolicy`
- `keepRunningChildren?: boolean` (when true, terminal policy results do not auto-abort running children)

**Utility wrapper** (takes `props` + single `child`):

| Function | Node type |
|---|---|
| `utility(props & { scorer }, child)` | `Utility` |
| `subTree(props?, child)` | `SubTree` |

**Leaves** (take `props` only):

| Function | Required prop | Node type |
|---|---|---|
| `action(props & { execute })` | `execute: (ctx) => NodeResult` | `Action` |
| `asyncAction(props & { execute })` | `execute: (ctx, signal) => Promise<NodeResult \| void>` | `AsyncAction` |
| `condition(props & { eval })` | `eval: (ctx) => boolean` | `ConditionNode` |
| `alwaysSuccess(props?)` | -- | `AlwaysSuccess` |
| `alwaysFailure(props?)` | -- | `AlwaysFailure` |
| `alwaysRunning(props?)` | -- | `AlwaysRunning` |
| `sleep(props & { duration })` | `duration: number` | `Sleep` |

### NodeProps Reference

All builder functions accept these props for automatic decorator application:

**Naming & Metadata:**

| Prop | Type | Effect |
|---|---|---|
| `name` | `string` | Sets node name |
| `tag` | `string` | Adds a single classification tag |
| `tags` | `string[]` | Adds multiple classification tags |
| `activity` | `string \| true` | Sets runtime activity label (`true` means use `name \|\| defaultName`) |
| `displayActivity` | `string \| true` | Alias for `activity` |
| `decorate` | `AnyDecoratorSpec \| AnyDecoratorSpec[]` | Apply arbitrary decorator specs |

Only one of `activity` or `displayActivity` can be provided at a time.

**Result Transformers:**

| Prop | Type | Effect |
|---|---|---|
| `forceSuccess` | `boolean` | Wrap with `ForceSuccess` |
| `forceFailure` | `boolean` | Wrap with `ForceFailure` (mutually exclusive with `forceSuccess`) |
| `inverter` | `boolean` | Wrap with `Inverter` |
| `runningIsSuccess` | `boolean` | Wrap with `RunningIsSuccess` |
| `runningIsFailure` | `boolean` | Wrap with `RunningIsFailure` (mutually exclusive with `runningIsSuccess`) |

**Guards:**

| Prop | Type | Effect |
|---|---|---|
| `precondition` | `{ name?, condition }` | Wrap with `Precondition` |
| `succeedIf` | `{ name?, condition }` | Wrap with `SucceedIf` (mutually exclusive with `failIf`) |
| `failIf` | `{ name?, condition }` | Wrap with `FailIf` (mutually exclusive with `succeedIf`) |

**Control Flow:**

| Prop | Type | Effect |
|---|---|---|
| `repeat` | `number` | Wrap with `Repeat` (-1 for infinite) |
| `retry` | `number` | Wrap with `Retry` (-1 for infinite) |
| `keepRunningUntilFailure` | `boolean` | Wrap with `KeepRunningUntilFailure` |
| `runOnce` | `boolean` | Wrap with `RunOnce` |
| `nonAbortable` | `boolean` | Wrap with `NonAbortable` |

**Timing** (values use the same unit as `ctx.now`):

| Prop | Type | Effect |
|---|---|---|
| `timeout` | `number` | Wrap with `Timeout` |
| `delay` | `number` | Wrap with `Delay` |
| `cooldown` | `number` | Wrap with `Cooldown` |
| `throttle` | `number` | Wrap with `Throttle` |
| `requireSustainedSuccess` | `number` | Wrap with `RequireSustainedSuccess` |

**Lifecycle Hooks:**

| Prop | Type |
|---|---|
| `onEnter` | `(ctx) => void` |
| `onResume` | `(ctx) => void` |
| `onReset` | `(ctx) => void` |
| `onTicked` | `(result, ctx) => void` |
| `onSuccess` | `(ctx) => void` |
| `onFailure` | `(ctx) => void` |
| `onRunning` | `(ctx) => void` |
| `onFinished` | `(result, ctx) => void` |
| `onSuccessOrRunning` | `(ctx) => void` |
| `onFailedOrRunning` | `(ctx) => void` |
| `onAbort` | `(ctx) => void` |

**Ref Metadata** (declarative, no runtime effect — for UI tooling):

| Prop | Type | Description |
|---|---|---|
| `inputs` | `ReadonlyRef<unknown>[]` | Refs this node reads from |
| `outputs` | `Ref<unknown>[]` | Refs this node writes to |

These props are purely metadata for external tooling (inspectors, visualizers). They have no runtime effect on node execution.

### SubTreeProps

`subTree(props, child)` accepts `SubTreeProps`, which extends `NodeProps` with boundary metadata:

| Prop | Type | Description |
|---|---|---|
| `id` | `string` | Optional stable subtree identifier for tooling |
| `namespace` | `string` | Optional logical namespace label |

`SubTree` metadata is declarative only. It does not alter ticking, control flow, or context behavior.

### Decorator Application Order

`applyDecorators()` applies props in a fixed order (innermost to outermost):

1. Result transformers: `forceSuccess` / `forceFailure`
2. Inversions: `inverter`, `runningIsFailure` / `runningIsSuccess`
3. Control flow: `keepRunningUntilFailure`, `runOnce`, `nonAbortable`, `repeat`, `retry`
4. Guards: `precondition`, `succeedIf` / `failIf`
5. Timing: `requireSustainedSuccess`, `cooldown`, `throttle`, `timeout`, `delay`
6. Hooks: `onEnter`, `onResume`, `onReset`, `onAbort`, `onTicked`, `onSuccess`, `onFailure`, `onRunning`, `onSuccessOrRunning`, `onFailedOrRunning`, `onFinished`
7. Generic: `decorate` prop (applied last / outermost)

This order is deterministic and can change behavior. Example: `nonAbortable` from `NodeProps` shields its inner subtree, but wrappers applied later in the fixed order can still observe abort/reset.

If you need exact decorator placement, prefer direct `.decorate(...)` composition (or the `decorate` prop with explicit decorator specs) instead of relying only on boolean/number `NodeProps` toggles.

### Validation

These prop pairs are mutually exclusive (throws if both set):
- `forceSuccess` + `forceFailure`
- `succeedIf` + `failIf`
- `runningIsSuccess` + `runningIsFailure`

## TSX

JSX syntax for tree construction. See [tsx.md](tsx.md) for the full reference.

```tsx
import { BT } from '@behavior-tree-ist/core/tsx';

const root = (
  <fallback name="AI">
    <sequence name="Attack" timeout={5000}>
      <condition name="Enemy nearby?" eval={() => enemyNearby} />
      <action name="Strike" repeat={3} execute={() => NodeResult.Succeeded} />
    </sequence>
    <action name="Patrol" execute={() => NodeResult.Running} />
  </fallback>
);
```

TSX elements accept the same `NodeProps` as builder functions, plus element-specific props (`execute`, `eval`, `duration`, `scorer`).

## Comparison

| Feature | Direct Instantiation | Builder Functions | TSX |
|---|---|---|---|
| **Syntax** | `new Node()` / `.from()` | `node(props, children)` | `<node prop={val}>` |
| **Decorator application** | Manual `.decorate()` or nesting | Automatic via props | Automatic via props |
| **Type safety** | Full (compile-time spec validation) | Full (prop type checking) | Full (JSX type checking) |
| **Readability** | Explicit, verbose | Concise, functional | Visual, declarative |
| **Setup required** | None | Import builder | tsconfig + import |
| **Best for** | Programmatic composition, dynamic trees | Functional style | Static tree definitions, visual layout |
