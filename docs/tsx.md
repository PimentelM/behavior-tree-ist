# Using behavior-tree-ist with TSX

behavior-tree-ist provides first-class support for defining behavior trees using TSX (JSX for TypeScript). This allows you to compose your trees visually using a familiar XML-like syntax while maintaining 100% type safety and IDE autocomplete.

## Setup

To start using TSX to build behavior trees, you only need to update your TypeScript configuration and import the builder namespace.

### 1. Configure `tsconfig.json`
You need to tell the TypeScript compiler how to transform the TSX tags into function calls. Add the following to your `compilerOptions`:

```json
{
  "compilerOptions": {
    "jsx": "react",
    "jsxFactory": "BT.createElement",
    "jsxFragmentFactory": "BT.Fragment"
  }
}
```

### 2. Configure Your Linter (Optional but Recommended)
Since TSX tags implicitly use the `BT` namespace during compilation, your linter (like ESLint) might incorrectly warn you that the `BT` import is unused. 

You can configure ESLint to ignore this, or simply disable the rule on the import line:
```tsx
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BT } from 'behavior-tree-ist/tsx';
/* eslint-enable @typescript-eslint/no-unused-vars */
```

## Basic Usage

To build a tree, create a `.tsx` file, import the factory, and start writing!

```tsx
import { BehaviourTree, NodeResult } from 'behavior-tree-ist';
import { BT } from 'behavior-tree-ist/tsx';

// 1. Define your dependencies (e.g. injected services or state)
const hero = new HeroEntity();

// 2. Define your tree visually using those dependencies via closures
const heroBrain = (
    <sequence name="Hero Logic">
        <condition name="Has Health" eval={() => hero.health > 0} />
        <action name="Attack Enemy" execute={() => {
            hero.attack();
            return NodeResult.Succeeded;
        }} />
    </sequence>
);

// 3. Pass it into the BehaviourTree runner just like any normal node!
const tree = new BehaviourTree(heroBrain);
```

### Intrinsic Nodes
The core behavior tree control flow nodes are built-in and fully typed:
- `<sequence>`
- `<selector>`
- `<parallel>`
- `<action>` (Requires the `execute` prop)
- `<condition>` (Requires the `eval` prop)

## Decorators as Props

One of the most powerful features of the TSX adapter is how it handles decorators. Instead of manually wrapping nodes, you apply them directly as props on any node!

```tsx
<action 
    name="Patrol Sequence"
    repeat={3}                  // Repeat Decorator
    debounce={500}              // Debounce Decorator
    onEnter={() => playSound()} // Lifecycle Hook
    execute={() => NodeResult.Succeeded} 
/>
```

### Supported Decorator Props

**Condition/Guards:**
- `guard={{ condition: () => boolean }}`
- `succeedIf={{ condition: () => boolean }}`
- `failIf={{ condition: () => boolean }}`

**Behavior Modifiers:**
- `alwaysSucceed={true}`
- `alwaysFail={true}`
- `inverter={true}`
- `runningIsFailure={true}`
- `runningIsSuccess={true}`
- `untilFail={true}`
- `untilSuccess={true}`

**Flow & Timing:**
- `repeat={number}`
- `retry={number}`
- `debounce={number}` (ms)
- `cooldown={number}` (ms)
- `throttle={number}` (ms)
- `timeout={number}` (ms)

**Hooks:**
- `onEnter={fn}`
- `onResume={fn}`
- `onFinished={fn}`
...and all other standard library hooks!

## Dependency Injection vs Context (`ctx`)

**Important Note:** The `TickContext` (`ctx`) provided to the `execute` and `eval` callbacks is strictly meant for passing timing/delta information required for ticking the core tree engine. It is **not** intended to be a global state block or blackboards for passing application logic around. 

Because TSX files compile down to ordinary functions returning `BTNode` objects, the canonical and recommended way to share state and methods across your nodes is through **Dependency Injection** by wrapping subtrees in higher-order functions:

```tsx
export function createCombatSubtree(movementPlugin: Movement, targetingPlugin: Radar) {
    return (
        <selector name="Combat">
            {/* Functional components work perfectly in TSX! */}
            <FleeBehaviour threshold={0.2} />
            
            <sequence name="Attack Flow">
                <condition name="Enemy Sighted" eval={() => targetingPlugin.hasTarget()} />
                <action name="Move to Enemy" execute={() => movementPlugin.approach()} />
                <action name="Strike" execute={() => targetingPlugin.strike()} />
            </sequence>
        </selector>
    );
}
```

Then simply inject your dependencies when you assemble your main game tree:

```tsx
const mainTree = (
    <sequence>
        { createCombatSubtree(myMovement, myRadar) }
        <action name="Idle" execute={() => NodeResult.Running} />
    </sequence>
);
```
