# Core Library Improvement Suggestions

Actionable improvements for `@behavior-tree-ist/core` based on deep codebase analysis and competitive comparison with BehaviorTree.CPP, py_trees, and Unreal Engine BTs.

---

## High Priority

### 1. Error Handling & Recovery

**Problem:** No built-in exception handling in `BTNode.Tick` -- errors propagate and crash trees. No error recovery mechanisms.

**Suggestion:** Add an `ErrorBoundary` decorator that catches exceptions in subtrees:

```typescript
abstract class ErrorBoundary extends Decorator {
  protected abstract onError(error: unknown, ctx: TickContext): NodeResult;
  protected override onTick(ctx: TickContext): NodeResult {
    try {
      return BTNode.Tick(this.child, ctx);
    } catch (error) {
      return this.onError(error, ctx);
    }
  }
}
```

Built-in variants: `CatchAndFail`, `CatchAndSucceed`, `CatchAndRetry`. This is a blocker for production use -- every other major BT library supports error recovery.

### 2. Subtree References & Composition

**Problem:** No way to define reusable tree fragments. Every other major BT library supports this (BehaviorTree.CPP via XML, py_trees via subtree nodes).

**Suggestion:** Add a `SubTreeRef` mechanism for referencing shared tree definitions:

```typescript
const patrolBehavior = defineSubTree('patrol', () =>
  sequence({}, [
    condition({ eval: () => !entity.atDestination }),
    action({ execute: () => entity.moveToWaypoint() }),
  ])
);

// Reuse across multiple trees
const tree = fallback({}, [
  patrolBehavior.instantiate(),
  patrolBehavior.instantiate(),
]);
```

Essential for scaling beyond small trees. DRY principle for tree design.

### 3. Non-Reactive Composite Variants

**Problem:** Current Sequence/Fallback are always reactive (re-evaluate from start each tick). Memory variants skip but lose reactivity entirely. No middle ground.

**Suggestion:** Add `SequenceNonReactive` that remembers succeeded children but re-evaluates failed/running ones:

```typescript
// Skips already-succeeded children but re-evaluates current+failed
// Good for stable preconditions where reactivity is wasteful
export class SequenceNonReactive extends Composite {
  private succeededIndices = new Set<number>();

  protected override onTick(ctx: TickContext): NodeResult {
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.succeededIndices.has(i)) continue;
      const status = BTNode.Tick(this.nodes[i], ctx);
      if (status === NodeResult.Succeeded) {
        this.succeededIndices.add(i);
        continue;
      }
      return status;
    }
    return NodeResult.Succeeded;
  }

  protected override onReset(): void {
    this.succeededIndices.clear();
  }
}
```

BehaviorTree.CPP provides this as a common performance optimization.

### 4. Expose `wasRunning` for Custom Decorators

**Problem:** `_wasRunning` is private, making it hard to build correct custom decorators (debounce, smart retry, etc.).

**Suggestion:** Add a public readonly getter:

```typescript
abstract class BTNode {
  public get wasRunning(): boolean { return this._wasRunning; }
}
```

Low effort, high value for extensibility.

### 5. Tree Serialization Round-Trip

**Problem:** Trees can be serialized to JSON but not reconstructed. Breaks persistence, config-driven trees, and visual editor workflows.

**Suggestion:** Add a factory-based deserializer:

```typescript
const restored = deserializeTree(json, {
  nodeFactories: {
    Action: (config) => Action.from(config.name, actionMap[config.fnName]),
    Sequence: (config) => Sequence.from(config.name, config.children),
  }
});
```

This unlocks configuration files, network-transmitted trees, and visual editor export.

---

## Medium Priority

### 6. Async Condition Support

**Problem:** `ConditionNode` is synchronous-only. Async checks require `AsyncAction` + `ForceSuccess` workaround.

**Suggestion:** Add `AsyncCondition` leaf node that returns Running while checking, then Succeeded/Failed based on boolean result. Same pattern as `AsyncAction` but for conditions.

### 7. Debounce Decorator

**Problem:** No way to prevent "jitter" in decision trees from rapid condition flapping.

**Suggestion:** Add `Debounce(quietDuration)` decorator that defers child execution until N ms of "silence" (no state changes).

### 8. Smart Retry with Exponential Backoff

**Problem:** Current `Retry` immediately re-executes. No delay/backoff between attempts.

**Suggestion:** Add `SmartRetry` with configurable backoff policy:

```typescript
new SmartRetry(child, {
  maxRetries: 5,
  baseDelay: 100,
  strategy: 'exponential', // linear, constant, exponential
});
```

Standard practice for network/IO-bound actions.

### 9. Split NodeProps into Refined Types

**Problem:** `NodeProps` has 30+ fields, reducing discoverability.

**Suggestion:** Split into `TimingProps`, `RetryProps`, `HookProps`, `ConditionProps` and compose via intersection. Better IDE completion, clearer intent.

### 10. Blackboard-Style Shared State

**Problem:** Ref system covers most use cases but lacks a global shared-state pattern. Every major BT library (Unreal, BehaviorTree.CPP, py_trees) features blackboards.

**Suggestion:** Optional blackboard integration via TickContext:

```typescript
interface Blackboard {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
}

// Provide to tree
tree.setBlackboard(bb);

// Use in nodes
action({ execute: (ctx) => {
  const target = ctx.blackboard.get('target');
}});
```

### 11. Tree Cloning

**Problem:** Trees cannot be duplicated -- limits template-based behavior and multi-agent scenarios.

**Suggestion:** Add `BTNode.clone()` that deep-copies the tree structure with fresh IDs and reset state. Enables efficient population of agents sharing the same behavior template.

---

## Low Priority

### 12. Built-in Action Library

Common utility actions to reduce boilerplate: `WaitAction`, `LogAction`, `AssertAction`, `NoopAction`.

### 13. Memoization Decorator

Cache condition results within a single tick to prevent redundant evaluations in complex trees.

### 14. Rate Limit Decorator

Distinct from Throttle -- rate-limits all executions (not just initial) at a configurable interval.

### 15. Activity Metadata Extensions

Enrich activity beyond `string | true` to support progress tracking:

```typescript
type ActivityMetadata = string | true | {
  name: string;
  progress?: number; // 0-100
  estimatedRemaining?: number;
};
```

### 16. Inspector Query DSL

Replace manual event filtering with a query builder:

```typescript
inspector.query()
  .where(e => e.result === NodeResult.Failed)
  .nodeType(NodeFlags.Action)
  .timeRange(start, end)
  .select('nodeId', 'tickId');
```
