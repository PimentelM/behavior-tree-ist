# TSX

@behavior-tree-ist/core provides first-class JSX/TSX support for defining behavior trees with a declarative, visual syntax while maintaining full type safety and IDE autocomplete.

## Setup

### 1. Configure `tsconfig.json`

Tell TypeScript to use the @behavior-tree-ist/core JSX factory:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "BT.createElement",
    "jsxFragmentFactory": "BT.Fragment"
  }
}
```

### 2. Configure Your Linter (Optional)

Since TSX compilation implicitly uses the `BT` namespace, your linter may warn about an unused import. Suppress it:

```tsx
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BT } from '@behavior-tree-ist/core/tsx';
```

## Basic Usage

Create `.tsx` files, import the factory, and compose trees visually:

```tsx
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { BT } from '@behavior-tree-ist/core/tsx';

const hero = { health: 100, target: null as string | null };

const heroBrain = (
  <sequence name="Hero Logic">
    <condition name="Is alive?" eval={() => hero.health > 0} />
    <fallback name="Combat or Patrol">
      <sequence name="Attack">
        <condition name="Has target?" eval={() => hero.target !== null} />
        <action name="Strike" execute={() => {
          console.log(`Attacking ${hero.target}`);
          return NodeResult.Succeeded;
        }} />
      </sequence>
      <action name="Patrol" execute={() => NodeResult.Running} />
    </fallback>
  </sequence>
);

const tree = new BehaviourTree(heroBrain);
```

## Intrinsic Elements

All built-in elements and the props they accept:

### Composite Elements

These accept `NodeProps` + `children`:

| Element | Behavior |
|---|---|
| `<sequence>` | Ticks children in order, fails on first failure |
| `<reactive-sequence>` | Alias for `<sequence>` |
| `<fallback>` | Ticks children in order, succeeds on first success |
| `<reactive-fallback>` | Alias for `<fallback>` |
| `<selector>` | Alias for `<fallback>` |
| `<parallel>` | Ticks all children every tick. Result depends on the specified policy (`policy`) and optional `keepRunningChildren` |
| `<if-then-else>` | Conditional: expects 3 children (condition, then, else) |
| `<sequence-with-memory>` | Sequence that resumes from last running child |
| `<fallback-with-memory>` | Fallback that resumes from last running child |
| `<selector-with-memory>` | Alias for `<fallback-with-memory>` |

### Utility Elements

| Element | Props | Behavior |
|---|---|---|
| `<utility-fallback>` | `NodeProps + children` | Fallback sorted by utility score. Children must be `<utility-node>` |
| `<utility-selector>` | `NodeProps + children` | Alias for `<utility-fallback>` |
| `<utility-sequence>` | `NodeProps + children` | Sequence sorted by utility score. Children must be `<utility-node>` |
| `<utility-node>` | `NodeProps + { scorer } + children` | Wraps exactly one child with a scoring function |
| `<sub-tree>` | `SubTreeProps + children` | Metadata-only subtree boundary wrapper (exactly one child) |

```tsx
<utility-fallback>
  <utility-node scorer={() => hungerLevel}>
    <action name="Eat" execute={() => NodeResult.Succeeded} />
  </utility-node>
  <utility-node scorer={() => tiredness}>
    <action name="Sleep" execute={() => NodeResult.Succeeded} />
  </utility-node>
</utility-fallback>
```

### Leaf Elements

| Element | Required props | Behavior |
|---|---|---|
| `<action>` | `execute: (ctx) => NodeResult` | Performs work |
| `<async-action>` | `execute: (ctx, signal) => Promise<NodeResult \| void>` | Performs asynchronous work |
| `<condition>` | `eval: (ctx) => boolean` | Pure boolean check |
| `<always-success>` | -- | Always returns Succeeded |
| `<always-failure>` | -- | Always returns Failed |
| `<always-running>` | -- | Always returns Running |
| `<sleep>` | `duration: number` | Returns Running for `duration` time units, then Succeeded |

## Decorator Props

All elements accept [NodeProps](construction-apis.md#nodeprops-reference) for automatic decorator application. These are the same props available in the builder API.

### Result Transformers

```tsx
<action execute={fn} forceSuccess />
<action execute={fn} forceFailure />
<action execute={fn} inverter />
<action execute={fn} runningIsSuccess />
<action execute={fn} runningIsFailure />
```

### Guards

```tsx
<action execute={fn} precondition={{ condition: () => hasMana }} />
<action execute={fn} precondition={{ name: 'Has mana?', condition: () => hasMana }} />
<action execute={fn} succeedIf={{ condition: () => alreadyDone }} />
<action execute={fn} failIf={{ condition: () => isDisabled }} />
```

### Timing (values use the same unit as `ctx.now`)

```tsx
<action execute={fn} timeout={5000} />
<action execute={fn} delay={1000} />
<action execute={fn} cooldown={3000} />
<action execute={fn} throttle={500} />
<action execute={fn} requireSustainedSuccess={2000} />
```

### Control Flow

```tsx
<action execute={fn} repeat={5} />
<action execute={fn} retry={3} />
<action execute={fn} keepRunningUntilFailure />
<action execute={fn} runOnce />
<action execute={fn} nonAbortable />
```

Parallel-specific option:

```tsx
<parallel keepRunningChildren>
  <action execute={fnA} />
  <action execute={fnB} />
</parallel>
```

### Lifecycle Hooks

```tsx
<action
  name="Attack"
  execute={() => NodeResult.Succeeded}
  onEnter={(ctx) => console.log('Starting...')}
  onSuccess={(ctx) => console.log('Hit!')}
  onFailure={(ctx) => console.log('Missed!')}
  onAbort={(ctx) => console.log('Interrupted!')}
/>
```

All hooks: `onEnter`, `onResume`, `onReset`, `onTicked`, `onSuccess`, `onFailure`, `onRunning`, `onFinished`, `onSuccessOrRunning`, `onFailedOrRunning`, `onAbort`.

### Naming & Tags

```tsx
<sequence name="Combat" tag="ai" />
<action name="Attack" tags={['combat', 'offensive']} execute={fn} />
<action name="Attack" activity="Attacking" execute={fn} />
<action name="Attack" displayActivity="Attacking" execute={fn} />
```

### Subtree Boundaries

```tsx
<sub-tree name="Combat" id="combat-root" namespace="combat">
  <sequence>
    <condition name="Has target?" eval={() => hasTarget} />
    <action name="Attack" execute={() => NodeResult.Succeeded} />
  </sequence>
</sub-tree>
```

`<sub-tree>` is metadata-only and behaviorally transparent. It marks an explicit boundary for inspector/UI tooling.

### Generic Decorator Specs

Apply arbitrary decorators with the `decorate` prop:

```tsx
import { Timeout, Repeat } from '@behavior-tree-ist/core';

<action execute={fn} decorate={[[Timeout, 1000], [Repeat, 3]]} />
```

Use `decorate` when ordering matters. Builder/TSX convenience props (like `retry`, `timeout`, `nonAbortable`, hooks) are applied by a fixed internal order from `applyDecorators()`, so explicit specs are the way to control exact wrapper nesting.

## Fragments

Use fragments to return multiple nodes without a wrapper:

```tsx
const CombatNodes = () => (
  <>
    <condition name="Has target?" eval={() => hasTarget} />
    <action name="Attack" execute={() => NodeResult.Succeeded} />
  </>
);

// Use inside a composite
<sequence>
  <CombatNodes />
</sequence>
```

## Functional Components

Create reusable subtree components as plain functions:

```tsx
interface CombatProps {
  entity: { health: number; target: string | null };
}

function CombatBehaviour({ entity }: CombatProps) {
  return (
    <sequence name="Combat">
      <condition name="Is alive?" eval={() => entity.health > 0} />
      <condition name="Has target?" eval={() => entity.target !== null} />
      <action name="Attack" execute={() => NodeResult.Succeeded} />
    </sequence>
  );
}

// Usage
const tree = (
  <fallback>
    <CombatBehaviour entity={hero} />
    <action name="Idle" execute={() => NodeResult.Running} />
  </fallback>
);
```

## Dependency Injection

The `TickContext` (`ctx`) is for engine timing data only, not for application state. Use closures and function parameters for dependency injection:

```tsx
function createCombatSubtree(movement: Movement, radar: Radar) {
  return (
    <selector name="Combat">
      <sequence name="Attack">
        <condition name="Enemy sighted" eval={() => radar.hasTarget()} />
        <action name="Approach" execute={() => movement.approach()} />
        <action name="Strike" execute={() => radar.strike()} />
      </sequence>
      <action name="Search" execute={() => movement.patrol()} />
    </selector>
  );
}

// Inject dependencies when assembling
const mainTree = (
  <sequence>
    {createCombatSubtree(myMovement, myRadar)}
    <action name="Idle" execute={() => NodeResult.Running} />
  </sequence>
);
```
