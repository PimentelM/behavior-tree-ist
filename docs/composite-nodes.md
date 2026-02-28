# Composite Nodes

Composite nodes have multiple children and define control flow. All composites extend the `Composite` base class.

**Flags**: All composites have the `Composite` flag, plus type-specific flags noted below.

## Composite Base Class

```typescript
abstract class Composite extends BTNode {
  get nodes(): ReadonlyArray<BTNode>;
  addNode(node: BTNode): void;
  setNodes(nodes: BTNode[]): void;
  clearNodes(): void;
  getChildren(): BTNode[];
}
```

Protected abort helpers for subclasses:
- `abortChildrenFrom(startIndex, ctx)` -- abort children from index onward
- `abortChildrenExcept(index, ctx)` -- abort all except the child at index
- `abortAllChildren(ctx)` -- abort every child

## Sequence

**Flags**: `Sequence`

Ticks children left-to-right. Stops at the first child that does not succeed.

| Child result | Sequence result |
|---|---|
| All `Succeeded` | `Succeeded` |
| Any `Failed` | `Failed` (remaining children not ticked) |
| Any `Running` | `Running` (remaining children not ticked) |

**Reactive behavior**: On every tick, the Sequence starts from the first child. If child 0 was `Succeeded` last tick but now returns `Failed`, the sequence immediately fails -- even if child 2 was `Running`. Previously running children are aborted.

```typescript
import { Sequence, ConditionNode, Action, NodeResult } from '@behavior-tree-ist/core';

const attackFlow = Sequence.from('Attack', [
  ConditionNode.from('Has target?', () => hasTarget),
  ConditionNode.from('In range?', () => isInRange),
  Action.from('Strike', () => NodeResult.Succeeded),
]);
```

**Aliases**: `ReactiveSequence`

## Fallback (Selector)

**Flags**: `Selector`

Ticks children left-to-right. Stops at the first child that does not fail.

| Child result | Fallback result |
|---|---|
| Any `Succeeded` | `Succeeded` (remaining children not ticked) |
| Any `Running` | `Running` (remaining children not ticked) |
| All `Failed` | `Failed` |

**Reactive behavior**: Like Sequence, always starts from the first child. If a higher-priority child succeeds on a later tick, lower-priority running children are aborted.

```typescript
import { Fallback, Action, NodeResult } from '@behavior-tree-ist/core';

const ai = Fallback.from('AI', [
  attackFlow,   // Try attacking first
  fleeFlow,     // Then try fleeing
  patrolAction, // Fall back to patrolling
]);
```

**Aliases**: `ReactiveFallback`, `Selector`

## Reactive vs Memory Variants

The standard `Sequence` and `Fallback` are **reactive** -- they re-evaluate from the first child every tick. This means conditions are continuously checked, and the tree can preempt lower-priority behaviors.

**Memory variants** skip re-evaluation of already-succeeded/failed children and resume from the last running child. This is more efficient but loses reactivity.

| Variant | Restarts from | Re-checks conditions | Preempts lower priority |
|---|---|---|---|
| `Sequence` (reactive) | Child 0 | Yes | Yes |
| `SequenceWithMemory` | Last running child | No | No |
| `Fallback` (reactive) | Child 0 | Yes | Yes |
| `FallbackWithMemory` | Last running child | No | No |

## SequenceWithMemory

**Flags**: `Sequence`, `Memory`, `Stateful`

A Sequence that remembers the index of the last running child and resumes from there.

```typescript
import { SequenceWithMemory, Action, NodeResult } from '@behavior-tree-ist/core';

// Step 1 runs to completion, then step 2, then step 3.
// If step 2 returns Running, next tick resumes at step 2 (skips step 1).
const steps = SequenceWithMemory.from('Build Process', [step1, step2, step3]);
```

Exposes `runningChildIndex` property and `getDisplayState()` returning `{ runningChildIndex }`.

## FallbackWithMemory (SelectorWithMemory)

**Flags**: `Selector`, `Memory`, `Stateful`

A Fallback that remembers the index of the last running child and resumes from there.

```typescript
import { FallbackWithMemory } from '@behavior-tree-ist/core';

const plan = FallbackWithMemory.from('Find Path', [pathA, pathB, pathC]);
```

**Aliases**: `SelectorWithMemory`, `MemorySelector`

## Parallel

**Flags**: `Parallel`

Ticks **all** children every tick and evaluates results using a pluggable policy.
By default, when the policy returns a terminal result (`Succeeded`/`Failed`), the node aborts any children still `Running`.

```typescript
import { Parallel } from '@behavior-tree-ist/core';

const combat = Parallel.from('Combat', [moveToEnemy, playAnimation, dealDamage]);
```

### Parallel Policies

| Policy | Succeeds when | Fails when |
|---|---|---|
| `RequireAllSuccess` (default) | All children succeed | Any child fails |
| `RequireOneSuccess` | At least 1 child succeeds | All children fail |
| `SuccessThreshold(n)` | `n` or more children succeed | Any child fails or it becomes impossible to reach `n` successes |
| `FailThreshold(n)` | It becomes impossible to reach `n` failures | `n` or more children fail |
| `AlwaysRunningPolicy` | Never | Never (always returns `Running`) |
| `AlwaysSucceedPolicy` | Always returns `Succeeded` | Never |
| `AlwaysFailPolicy` | Never | Always returns `Failed` |

```typescript
import { Parallel, SuccessThreshold } from '@behavior-tree-ist/core';

// Succeed when at least 2 of 3 children succeed
const parallel = Parallel.from(
  'Quorum',
  [taskA, taskB, taskC],
  SuccessThreshold(2),
);
```

### Parallel Abort Behavior

Use `options.keepRunningChildren=true` to prevent `Parallel` from auto-aborting running children when the policy reaches a terminal result.

```typescript
const parallel = Parallel.from(
  'NonInterruptingQuorum',
  [taskA, taskB, taskC],
  SuccessThreshold(2),
  { keepRunningChildren: true },
);
```

This only affects the internal "terminal policy result" path. Explicit parent aborts (`BTNode.Abort(parallel, ctx)`) still propagate to children.

## IfThenElse

Conditional branching with 2 or 3 children: `[condition, thenBranch]` or `[condition, thenBranch, elseBranch]`.

```typescript
import { IfThenElse, ConditionNode, Action, NodeResult } from '@behavior-tree-ist/core';

const behavior = IfThenElse.from([
  ConditionNode.from('Has ammo?', () => entity.ammo > 0),
  Action.from('Shoot', () => NodeResult.Succeeded),
  Action.from('Melee', () => NodeResult.Succeeded),
]);
```

| Condition result | Behavior |
|---|---|
| `Succeeded` | Tick `thenBranch`, abort `elseBranch` |
| `Failed` | Tick `elseBranch` (or return `Failed` if only 2 children), abort `thenBranch` |
| `Running` | Return `Running`, abort both branches |

## UtilityFallback (UtilitySelector)

**Flags**: `Selector`, `Utility`, `Stateful`

A Fallback that sorts children by [Utility](decorators.md#utility) score (highest first) before ticking. Children must be wrapped in `Utility` decorators.

```typescript
import { UtilityFallback, Utility, Action, NodeResult } from '@behavior-tree-ist/core';

const behavior = UtilityFallback.from([
  new Utility(Action.from('Eat', () => NodeResult.Succeeded), () => hunger),
  new Utility(Action.from('Sleep', () => NodeResult.Succeeded), () => tiredness),
  new Utility(Action.from('Play', () => NodeResult.Succeeded), () => boredom),
]);
```

On each tick, children are re-sorted by score. The highest-scored child is ticked first; if it fails, the next highest is tried, and so on. Exposes `getDisplayState()` with `{ lastScores }`, where `lastScores[i]` is the score of child `i`.

**Aliases**: `UtilitySelector`

## UtilitySequence

**Flags**: `Sequence`, `Utility`, `Stateful`

A Sequence that sorts children by utility score (highest first). All children must succeed for the sequence to succeed; execution order is determined by score.

```typescript
import { UtilitySequence, Utility, Action, NodeResult } from '@behavior-tree-ist/core';

const preparation = UtilitySequence.from('Prepare', [
  new Utility(Action.from('Sharpen sword', () => NodeResult.Succeeded), () => swordDullness),
  new Utility(Action.from('Brew potion', () => NodeResult.Succeeded), () => potionNeed),
]);
```

Exposes `getDisplayState()` with `{ lastScores }`, where `lastScores[i]` is the score of child `i`.

## Static Factory Methods

All composites provide overloaded `from()` factories:

```typescript
// Without name
const seq = Sequence.from([child1, child2]);

// With name
const seq = Sequence.from('My Sequence', [child1, child2]);

// Parallel with policy and optional options object
const par = Parallel.from('My Parallel', [child1, child2], policy, { keepRunningChildren: true });

// IfThenElse with 2 or 3 children
const ite = IfThenElse.from([condition, thenBranch, elseBranch]);
```
