# Leaf Nodes

Leaf nodes are the terminal nodes of a behaviour tree -- they have no children and perform actual work or checks.

## Action

`Action` is the abstract base class for nodes that perform work. Subclasses implement `onTick(ctx)` to return a `NodeResult`.

**Flags**: `Leaf`, `Action`

### Extending Action

```typescript
import { Action, NodeResult, TickContext } from 'behavior-tree-ist';

class MoveToTarget extends Action {
  readonly defaultName = 'MoveToTarget';

  constructor(private entity: { x: number; targetX: number }) {
    super('Move to target');
  }

  protected onTick(_ctx: TickContext): NodeResult {
    if (Math.abs(this.entity.x - this.entity.targetX) < 1) {
      return NodeResult.Succeeded;
    }
    this.entity.x += Math.sign(this.entity.targetX - this.entity.x);
    return NodeResult.Running;
  }
}
```

### Action.from() Factory

For simple actions, use the static factory instead of creating a subclass:

```typescript
import { Action, NodeResult } from 'behavior-tree-ist';

const patrol = Action.from('Patrol', (ctx) => {
  // ctx.now gives you the current tick timestamp
  console.log(`Patrolling at tick ${ctx.tickId}`);
  return NodeResult.Running;
});
```

## AsyncAction

`AsyncAction` is an abstract base class for asynchronous work (e.g., HTTP requests, file I/O). It runs `execute(ctx, signal)` which returns a Promise. The node natively bridges this Promise into the tick lifecycle, returning `Running` while pending, and appropriately `Succeeded` or `Failed` when settled.

**Flags**: `Leaf`, `Action`, `Stateful`

### Extending AsyncAction

```typescript
import { AsyncAction, CancellationSignal, NodeResult, TickContext } from 'behavior-tree-ist';

class FetchData extends AsyncAction {
  protected async execute(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult | void> {
    // Note: To use native fetch with CancellationSignal, you can convert it or map onAbort
    const controller = new AbortController();
    signal.onAbort(() => controller.abort());
    
    const res = await fetch('https://api.example.com/data', { signal: controller.signal });
    if (!res.ok) throw new Error('Fetch failed');
    return NodeResult.Succeeded; // returning undefined is also Succeeded
  }
}
```

### AsyncAction.from() Factory

```typescript
import { AsyncAction, NodeResult } from 'behavior-tree-ist';

const waitAndSucceed = AsyncAction.from('Wait a bit', async (ctx, signal) => {
  await new Promise(resolve => setTimeout(resolve, 1000));
});
```

## ConditionNode

`ConditionNode` evaluates a boolean check. Returns `Succeeded` if the check is true, `Failed` if false. Conditions **never return Running** -- they are pure, synchronous checks.

**Flags**: `Leaf`, `Condition`

### ConditionNode.from() Factory

```typescript
import { ConditionNode } from 'behavior-tree-ist';

const hasHealth = ConditionNode.from('Has health?', (ctx) => entity.health > 0);
const enemyNearby = ConditionNode.from('Enemy nearby?', () => entity.enemyDistance < 10);
```

### Extending ConditionNode

```typescript
import { ConditionNode, TickContext } from 'behavior-tree-ist';

class IsTimerExpired extends ConditionNode {
  constructor(private deadline: number) {
    super('Timer expired?', (ctx: TickContext) => ctx.now >= this.deadline);
  }
}
```

## Built-in Leaf Nodes

Four ready-made leaf nodes are provided for common patterns and testing:

### AlwaysSuccess

Always returns `Succeeded`. Useful as a placeholder or to cap a sequence.

```typescript
import { AlwaysSuccess } from 'behavior-tree-ist';

const noop = new AlwaysSuccess();
const named = new AlwaysSuccess('Placeholder');
```

### AlwaysFailure

Always returns `Failed`. Useful for forcing fallback evaluation or testing.

```typescript
import { AlwaysFailure } from 'behavior-tree-ist';

const fail = new AlwaysFailure();
```

### AlwaysRunning

Always returns `Running`. Useful for testing stateful decorators or keeping a branch alive indefinitely.

```typescript
import { AlwaysRunning } from 'behavior-tree-ist';

const idle = new AlwaysRunning('Idle');
```

### Sleep

Returns `Running` for a specified duration (in milliseconds), then `Succeeded`. A time-based action that uses `ctx.now` to track elapsed time.

**Flags**: `Leaf`, `Action`, `Stateful`

```typescript
import { Sleep } from 'behavior-tree-ist';

const wait = new Sleep(2000); // Returns Running for 2 seconds, then Succeeded
```

`Sleep` exposes `getDisplayState()` returning `{ remainingTime: number }` for inspector integration.
