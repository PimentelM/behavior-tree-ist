# Getting Started

## Installation

```bash
npm install @behavior-tree-ist/core
# or
yarn add @behavior-tree-ist/core
# or
pnpm add @behavior-tree-ist/core
```

## Your First Tree

Let's build a simple patrol-and-attack AI. The entity patrols by default, but attacks when an enemy is in range.

### Using Direct Instantiation

```typescript
import {
  BehaviourTree,
  Fallback,
  Sequence,
  ConditionNode,
  Action,
  NodeResult,
} from '@behavior-tree-ist/core';

const entity = { enemyInRange: false, position: 0 };

// A condition checks a boolean -- Succeeded if true, Failed if false
const enemyInRange = ConditionNode.from('Enemy in range?', () => entity.enemyInRange);

// An action performs work and returns a NodeResult
const attack = Action.from('Attack', () => {
  console.log('Attacking!');
  return NodeResult.Succeeded;
});

const patrol = Action.from('Patrol', () => {
  entity.position += 1;
  return NodeResult.Running; // Patrol is ongoing
});

// Fallback (OR): tries attack sequence first, falls back to patrol
const root = Fallback.from('AI', [
  Sequence.from('Attack Flow', [enemyInRange, attack]),
  patrol,
]);

const tree = new BehaviourTree(root);
```

### Using Builder Functions

The same tree using the builder API, which supports inline decorator props:

```typescript
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { fallback, sequence, condition, action } from '@behavior-tree-ist/core/builder';

const entity = { enemyInRange: false, position: 0 };

const root = fallback({ name: 'AI' }, [
  sequence({ name: 'Attack Flow' }, [
    condition({ name: 'Enemy in range?', eval: () => entity.enemyInRange }),
    action({ name: 'Attack', execute: () => {
      console.log('Attacking!');
      return NodeResult.Succeeded;
    }}),
  ]),
  action({ name: 'Patrol', execute: () => {
    entity.position += 1;
    return NodeResult.Running;
  }}),
]);

const tree = new BehaviourTree(root);
```

### Using TSX

The same tree in TSX (see [tsx.md](tsx.md) for setup):

```tsx
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { BT } from '@behavior-tree-ist/core/tsx';

const entity = { enemyInRange: false, position: 0 };

const root = (
  <fallback name="AI">
    <sequence name="Attack Flow">
      <condition name="Enemy in range?" eval={() => entity.enemyInRange} />
      <action name="Attack" execute={() => {
        console.log('Attacking!');
        return NodeResult.Succeeded;
      }} />
    </sequence>
    <action name="Patrol" execute={() => {
      entity.position += 1;
      return NodeResult.Running;
    }} />
  </fallback>
);

const tree = new BehaviourTree(root);
```

## Running the Tree

A behaviour tree executes by **ticking** -- calling `tree.tick()` repeatedly, typically once per game loop iteration:

```typescript
// Simple game loop
setInterval(() => {
  const result = tree.tick({ now: Date.now() });
  // result is a TickRecord: { tickId, timestamp, events }
}, 100); // 10 ticks per second
```

Each tick traverses the tree from the root, executing nodes according to their logic. The three possible outcomes are:

| Result | Meaning |
|---|---|
| `Succeeded` | The node's objective was achieved |
| `Failed` | The node's objective cannot be achieved |
| `Running` | The node needs more ticks to complete |

The `now` parameter supplies the current timestamp (in milliseconds). Timing-based decorators like `Timeout`, `Cooldown`, and `Delay` use this value to track elapsed time.

## Next Steps

- [Core Concepts](core-concepts.md) -- Understand the tick lifecycle, hooks, and TickContext
- [Leaf Nodes](leaf-nodes.md) -- Action and ConditionNode in depth
- [Composite Nodes](composite-nodes.md) -- Sequence, Fallback, Parallel, and more
- [Decorators](decorators.md) -- All 28+ decorators
- [Construction APIs](construction-apis.md) -- Comparison of all three APIs
