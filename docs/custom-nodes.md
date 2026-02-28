# Custom Nodes

This guide covers extending the library with your own node types.

## Custom Action

Extend `Action` and implement `onTick()`:

```typescript
import { Action, NodeResult, TickContext } from '@behavior-tree-ist/core';

class MoveToTarget extends Action {
  readonly defaultName = 'MoveToTarget';
  private startTime: number | undefined;

  constructor(
    private entity: { x: number; targetX: number; speed: number },
  ) {
    super('Move to target');
  }

  protected onEnter(ctx: TickContext): void {
    this.startTime = ctx.now;
  }

  protected onTick(ctx: TickContext): NodeResult {
    const dx = this.entity.targetX - this.entity.x;
    if (Math.abs(dx) < 0.1) return NodeResult.Succeeded;

    this.entity.x += Math.sign(dx) * this.entity.speed;
    return NodeResult.Running;
  }

  protected onReset(_ctx: TickContext): void {
    this.startTime = undefined;
  }
}
```

### Conventions

- Set `readonly defaultName` to a descriptive type name
- Use `onEnter` to initialize per-execution state
- Use `onReset` to clean up -- it fires on both natural completion and abort
- Make `onReset` idempotent (safe to call multiple times)
- Use `onAbort` to do specific cleanup when node is preempted, it runs before onReset during an abort
- Compare sentinel timing fields with `=== undefined`, never use falsy checks (`0` is a valid timestamp)
- Use named `Ref` instances for state shared between nodes — writes are auto-traced during ticks via the ambient context stack (see [Core Concepts — Ref System](core-concepts.md#ref-system))

## Custom Condition

For simple checks, use the factory. For stateful checks, extend the class:

```typescript
import { ConditionNode, TickContext } from '@behavior-tree-ist/core';

// Factory (preferred for simple checks)
const isAlive = ConditionNode.from('Is alive?', () => entity.health > 0);

// Subclass (when you need constructor logic)
class IsWithinRange extends ConditionNode {
  constructor(private entity: { x: number }, private target: { x: number }, private range: number) {
    super('Within range?', (_ctx: TickContext) => {
      return Math.abs(this.entity.x - this.target.x) <= this.range;
    });
  }
}
```

Conditions never return `Running` -- they map `true` to `Succeeded` and `false` to `Failed`.

## Custom Decorator

Extend `Decorator` and implement `onTick()`. Use `BTNode.Tick()` and `BTNode.Abort()` to control the child:

```typescript
import { Decorator, BTNode, NodeResult, TickContext, NodeFlags } from '@behavior-tree-ist/core';

class LogDecorator extends Decorator {
  readonly defaultName = 'LogDecorator';

  constructor(child: BTNode, private label: string) {
    super(child);
    this.addFlags(NodeFlags.Lifecycle);
  }

  protected onTick(ctx: TickContext): NodeResult {
    const result = BTNode.Tick(this.child, ctx);
    console.log(`[${this.label}] ${this.child.displayName} -> ${result}`);
    return result;
  }
}
```

### Stateful Decorator Example

```typescript
import {
  Decorator, BTNode, NodeResult, TickContext, NodeFlags,
  SerializableState,
} from '@behavior-tree-ist/core';

class MaxExecutions extends Decorator {
  readonly defaultName = 'MaxExecutions';
  private count = 0;

  constructor(child: BTNode, private maxCount: number) {
    super(child);
    this.addFlags(NodeFlags.Stateful);
  }

  protected onTick(ctx: TickContext): NodeResult {
    if (this.count >= this.maxCount) return NodeResult.Failed;

    const result = BTNode.Tick(this.child, ctx);
    if (result !== NodeResult.Running) this.count++;
    return result;
  }

  protected onReset(_ctx: TickContext): void {
    // Don't reset count -- it persists across executions
  }

  getDisplayState(): SerializableState {
    return { executionCount: this.count, maxCount: this.maxCount };
  }
}
```

### Key Rules for Decorators

- Always call `BTNode.Tick(this.child, ctx)` when you want the child to execute
- The base `Decorator.onAbort()` automatically calls `BTNode.Abort(this.child, ctx)`
- If you override `onAbort`, call `super.onAbort(ctx)` unless you intentionally want to block propagation (for example, `NonAbortable`)
- Add appropriate [NodeFlags](node-flags.md) in the constructor

## Custom Composite

Extend `Composite` and iterate `this._nodes`:

```typescript
import { Composite, BTNode, NodeResult, TickContext, NodeFlags } from '@behavior-tree-ist/core';

class RandomSelector extends Composite {
  readonly defaultName = 'RandomSelector';
  private shuffledIndices: number[] = [];

  constructor(name?: string) {
    super(name);
    this.addFlags(NodeFlags.Selector);
  }

  protected onEnter(_ctx: TickContext): void {
    // Shuffle on each fresh execution
    this.shuffledIndices = this._nodes.map((_, i) => i);
    for (let i = this.shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.shuffledIndices[i], this.shuffledIndices[j]] =
        [this.shuffledIndices[j], this.shuffledIndices[i]];
    }
  }

  protected onTick(ctx: TickContext): NodeResult {
    for (const idx of this.shuffledIndices) {
      const result = BTNode.Tick(this._nodes[idx], ctx);
      if (result !== NodeResult.Failed) {
        // Abort any previously running children except this one
        this.abortChildrenExcept(idx, ctx);
        return result;
      }
    }
    return NodeResult.Failed;
  }

  protected onReset(_ctx: TickContext): void {
    this.shuffledIndices = [];
  }

  static from(nodes: BTNode[]): RandomSelector;
  static from(name: string, nodes: BTNode[]): RandomSelector;
  static from(nameOrNodes: string | BTNode[], maybeNodes?: BTNode[]): RandomSelector {
    const [name, nodes] = typeof nameOrNodes === 'string'
      ? [nameOrNodes, maybeNodes!]
      : [undefined, nameOrNodes];
    const composite = new RandomSelector(name);
    composite.setNodes(nodes);
    return composite;
  }
}
```

### Key Rules for Composites

- Access children via `this._nodes` (protected array)
- Use `this.abortChildrenFrom(index, ctx)` to abort children from a given index onward
- Use `this.abortChildrenExcept(index, ctx)` to abort all children except one
- Use `this.abortAllChildren(ctx)` to abort everything
- The base `Composite.onAbort()` calls `abortAllChildren` automatically
- Provide a `static from()` factory method for consistency with built-in composites
- Add appropriate [NodeFlags](node-flags.md) (`Sequence`, `Selector`, `Parallel`, etc.)
