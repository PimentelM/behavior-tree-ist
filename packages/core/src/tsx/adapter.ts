import { type BTNode, type CancellationSignal, type NodeResult, type TickContext, type SerializableState } from "../base";
import { type UtilityScorer } from "../base/utility";
import * as Builder from "../builder";
import { type ParallelPolicy } from "../nodes/composite/parallel";
import { Utility as UtilityNode } from "../nodes/decorators/utility";
import * as Decorators from "../nodes/decorators";

export function Fragment(_props: unknown, ...children: BTNode[]): BTNode[] {
    return children;
}

// Registry for decorator intrinsic elements. Each entry describes how to
// construct the inner decorator node and which props it "owns" (consumed by
// the constructor). Own props are stripped from safeProps before the
// remaining NodeProps are forwarded to applyDecorators, preventing
// double-wrapping when a prop name is shared with NodeProps (e.g. cooldown).
type DecoratorEntry = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    build: (props: Record<string, any>, child: BTNode) => BTNode;
    ownProps: readonly string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dec(build: (props: Record<string, any>, child: BTNode) => BTNode, ...ownProps: string[]): DecoratorEntry {
    return { build, ownProps };
}

const DECORATOR_REGISTRY: Record<string, DecoratorEntry> = {
    // Zero-arg (child only)
    "inverter":                  dec((_p, c) => new Decorators.Inverter(c)),
    "force-success":             dec((_p, c) => new Decorators.ForceSuccess(c)),
    "force-failure":             dec((_p, c) => new Decorators.ForceFailure(c)),
    "running-is-failure":        dec((_p, c) => new Decorators.RunningIsFailure(c)),
    "running-is-success":        dec((_p, c) => new Decorators.RunningIsSuccess(c)),
    "keep-running-until-failure": dec((_p, c) => new Decorators.KeepRunningUntilFailure(c)),
    "run-once":                  dec((_p, c) => new Decorators.RunOnce(c)),
    "non-abortable":             dec((_p, c) => new Decorators.NonAbortable(c)),

    // One numeric arg — use natural constructor param names
    "retry":                     dec((p, c) => new Decorators.Retry(c, p.maxRetries as number | undefined), "maxRetries"),
    "repeat":                    dec((p, c) => new Decorators.Repeat(c, p.times as number | undefined), "times"),
    "cooldown":                  dec((p, c) => new Decorators.Cooldown(c, p.cooldown as number), "cooldown"),
    "cache-result":              dec((p, c) => new Decorators.CacheResult(c, p.cacheDuration as number), "cacheDuration"),
    "throttle":                  dec((p, c) => new Decorators.Throttle(c, p.throttle as number), "throttle"),
    "timeout":                   dec((p, c) => new Decorators.Timeout(c, p.timeout as number), "timeout"),
    "delay":                     dec((p, c) => new Decorators.Delay(c, p.delayDuration as number), "delayDuration"),
    "require-sustained-success": dec((p, c) => new Decorators.RequireSustainedSuccess(c, p.requireSustainedSuccess as number), "requireSustainedSuccess"),

    // Name + condition function
    "precondition": dec((p, c) => new Decorators.Precondition(c, (p.name as string | undefined) ?? "Precondition", p.condition as (ctx: TickContext) => boolean), "condition"),
    "succeed-if":   dec((p, c) => new Decorators.SucceedIf(c, (p.name as string | undefined) ?? "SucceedIf", p.condition as (ctx: TickContext) => boolean), "condition"),
    "fail-if":      dec((p, c) => new Decorators.FailIf(c, (p.name as string | undefined) ?? "FailIf", p.condition as (ctx: TickContext) => boolean), "condition"),

    // Lifecycle hooks — callback via cb prop
    "on-enter":             dec((p, c) => new Decorators.OnEnter(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-resume":            dec((p, c) => new Decorators.OnResume(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-reset":             dec((p, c) => new Decorators.OnReset(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-ticked":            dec((p, c) => new Decorators.OnTicked(c, p.cb as (result: NodeResult, ctx: TickContext) => void), "cb"),
    "on-success":           dec((p, c) => new Decorators.OnSuccess(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-failure":           dec((p, c) => new Decorators.OnFailure(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-running":           dec((p, c) => new Decorators.OnRunning(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-success-or-running": dec((p, c) => new Decorators.OnSuccessOrRunning(c, p.cb as (ctx: TickContext) => void), "cb"),
    "on-failed-or-running": dec((p, c) => new Decorators.OnFailedOrRunning(c, p.cb as (ctx: TickContext) => void), "cb"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    "on-finished":          dec((p, c) => new Decorators.OnFinished(c, p.cb as any), "cb"),
    "on-abort":             dec((p, c) => new Decorators.OnAbort(c, p.cb as (ctx: TickContext) => void), "cb"),
};

export function createElement(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: string | ((props: any) => BTNode | BTNode[]),
    props: Record<string, unknown> | null,
    ...children: (BTNode | BTNode[])[]
): BTNode | BTNode[] {
    // Flatten children in case Fragment returned an array of nodes
    const flatChildren = children.flat(Number.MAX_SAFE_INTEGER) as BTNode[];
    const safeProps = props || {};

    // 1. Functional Components
    if (typeof type === "function") {
        if (type === Fragment) {
            return flatChildren;
        }
        // Custom TSX functional component returning one or more nodes
        return type({ ...safeProps, children: flatChildren });
    }

    // 2. Decorator registry — single-child intrinsic elements
    if (type in DECORATOR_REGISTRY) {
        if (flatChildren.length !== 1) {
            throw new Error(`<${type}> must have exactly one child node, but got ${flatChildren.length}.`);
        }
        const entry = DECORATOR_REGISTRY[type]!;
        const inner = entry.build(safeProps, flatChildren[0]!);
        // Strip own props to avoid double-wrapping when prop names overlap NodeProps
        const nodeProps = entry.ownProps.length > 0
            ? Object.fromEntries(Object.entries(safeProps).filter(([k]) => !(entry.ownProps as string[]).includes(k)))
            : safeProps;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
        return Builder.applyDecorators(inner, nodeProps as any);
    }

    // 3. Intrinsic Engine Elements (like "sequence", "action")
    switch (type) {
        case "sequence":
        case "reactive-sequence":
            return Builder.sequence(safeProps, flatChildren);
        case "fallback":
        case "reactive-fallback":
        case "selector":
            return Builder.fallback(safeProps, flatChildren);
        case "parallel":
            return Builder.parallel(safeProps, flatChildren);
        case "if-then-else":
            return Builder.ifThenElse(safeProps, flatChildren);
        case "sequence-with-memory":
            return Builder.sequenceWithMemory(safeProps, flatChildren);
        case "fallback-with-memory":
        case "selector-with-memory":
            return Builder.fallbackWithMemory(safeProps, flatChildren);
        case "utility-fallback":
        case "utility-selector":
            if (flatChildren.some((child) => !(child instanceof UtilityNode))) {
                throw new Error(`Children of <${type}> must be wrapped in <utility-node scorer={...}>.`);
            }
            return Builder.utilityFallback(safeProps, flatChildren as UtilityNode[]);
        case "utility-sequence":
            if (flatChildren.some((child) => !(child instanceof UtilityNode))) {
                throw new Error(`Children of <${type}> must be wrapped in <utility-node scorer={...}>.`);
            }
            return Builder.utilitySequence(safeProps, flatChildren as UtilityNode[]);
        case "utility-node": {
            if (flatChildren.length !== 1) {
                throw new Error(`<utility-node> must have exactly one child node, but got ${flatChildren.length}.`);
            }
            if (typeof safeProps.scorer !== "function") {
                throw new Error(`<utility-node> requires a "scorer" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.utility(safeProps as unknown as any, flatChildren[0] as BTNode);
        }
        case "sub-tree": {
            if (flatChildren.length !== 1) {
                throw new Error(`<sub-tree> must have exactly one child node, but got ${flatChildren.length}.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.subTree(safeProps as unknown as any, flatChildren[0] as BTNode);
        }
        case "action":
            // Action requires an execute prop
            if (typeof safeProps.execute !== "function") {
                throw new Error(`<action> requires an "execute" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.action(safeProps as unknown as any);
        case "async-action":
            // AsyncAction requires an execute prop
            if (typeof safeProps.execute !== "function") {
                throw new Error(`<async-action> requires an "execute" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.asyncAction(safeProps as unknown as any);
        case "always-success":
            return Builder.alwaysSuccess(safeProps);
        case "always-failure":
            return Builder.alwaysFailure(safeProps);
        case "always-running":
            return Builder.alwaysRunning(safeProps);
        case "condition":
            // Condition requires an eval prop
            if (typeof safeProps.eval !== "function") {
                throw new Error(`<condition> requires an "eval" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.condition(safeProps as unknown as any);
        case "sleep":
            if (typeof safeProps.duration !== "number") {
                throw new Error(`<sleep> requires a "duration" prop of type number.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.sleep(safeProps as unknown as any);
        case "display-state":
            if (typeof safeProps.display !== "function") {
                throw new Error(`<display-state> requires a "display" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.displayState(safeProps as unknown as any);
        case "display-note":
            if (typeof safeProps.text !== "string") {
                throw new Error(`<display-note> requires a "text" prop of type string.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.displayNote(safeProps as unknown as any);
        case "display-progress":
            if (typeof safeProps.progress !== "function") {
                throw new Error(`<display-progress> requires a "progress" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
            return Builder.displayProgress(safeProps as unknown as any);
        default:
            throw new Error(`Unknown intrinsic behavior tree node type: <${type}>`);
    }
}

// Global JSX Namespace Definition for Type-Safety
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        // Defines the return type of BT.createElement
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        interface Element extends BTNode {}
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        interface ElementChildrenAttribute { children: {} }

        type DefaultCompositeProps = Builder.NodeProps & { children?: Element | Element[] };
        type DecoratorProps = Builder.NodeProps & { children?: Element };

        // Defines our built-in tag names and the props they accept
        interface IntrinsicElements {
            "sequence": DefaultCompositeProps;
            "reactive-sequence": DefaultCompositeProps;
            "fallback": DefaultCompositeProps;
            "reactive-fallback": DefaultCompositeProps;
            "selector": DefaultCompositeProps; // alias for fallback
            "parallel": DefaultCompositeProps & { policy?: ParallelPolicy; keepRunningChildren?: boolean };
            "if-then-else": DefaultCompositeProps;
            "sequence-with-memory": DefaultCompositeProps;
            "fallback-with-memory": DefaultCompositeProps;
            "selector-with-memory": DefaultCompositeProps; // alias for fallback-with-memory
            "utility-fallback": DefaultCompositeProps;
            "utility-selector": DefaultCompositeProps; // alias for utility-fallback
            "utility-sequence": DefaultCompositeProps;
            "utility-node": Builder.NodeProps & { scorer: UtilityScorer; children?: Element | Element[] };
            "sub-tree": Builder.SubTreeProps & { children?: Element | Element[] };
            "action": Builder.NodeProps & { execute: (ctx: TickContext) => NodeResult };
            "async-action": Builder.NodeProps & { execute: (ctx: TickContext, signal: CancellationSignal) => Promise<NodeResult | undefined> };
            "condition": Builder.NodeProps & { eval: (ctx: TickContext) => boolean };
            "always-success": Builder.NodeProps;
            "always-failure": Builder.NodeProps;
            "always-running": Builder.NodeProps;
            "sleep": Builder.NodeProps & { duration: number };
            "display-state": Builder.NodeProps & { display: () => SerializableState };
            "display-note": Builder.NodeProps & { text: string };
            "display-progress": Builder.NodeProps & { progress: () => { progress: number; label?: string } };

            // Decorator intrinsic elements — zero-arg (child only)
            "inverter":                   DecoratorProps;
            "force-success":              DecoratorProps;
            "force-failure":              DecoratorProps;
            "running-is-failure":         DecoratorProps;
            "running-is-success":         DecoratorProps;
            "keep-running-until-failure": DecoratorProps;
            "run-once":                   DecoratorProps;
            "non-abortable":              DecoratorProps;

            // Decorator intrinsic elements — one numeric arg (natural constructor param name)
            "retry":                      DecoratorProps & { maxRetries?: number };
            "repeat":                     DecoratorProps & { times?: number };
            "cooldown":                   DecoratorProps & { cooldown: number };
            "cache-result":               DecoratorProps & { cacheDuration: number };
            "throttle":                   DecoratorProps & { throttle: number };
            "timeout":                    DecoratorProps & { timeout: number };
            "delay":                      DecoratorProps & { delayDuration: number };
            "require-sustained-success":  DecoratorProps & { requireSustainedSuccess: number };

            // Decorator intrinsic elements — name + condition function
            "precondition": DecoratorProps & { condition: (ctx: TickContext) => boolean };
            "succeed-if":   DecoratorProps & { condition: (ctx: TickContext) => boolean };
            "fail-if":      DecoratorProps & { condition: (ctx: TickContext) => boolean };

            // Decorator intrinsic elements — lifecycle hooks (callback via cb prop)
            "on-enter":              DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-resume":             DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-reset":              DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-ticked":             DecoratorProps & { cb: (result: NodeResult, ctx: TickContext) => void };
            "on-success":            DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-failure":            DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-running":            DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-success-or-running": DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-failed-or-running":  DecoratorProps & { cb: (ctx: TickContext) => void };
            "on-finished":           DecoratorProps & { cb: (result: NodeResult & ("Succeeded" | "Failed"), ctx: TickContext) => void };
            "on-abort":              DecoratorProps & { cb: (ctx: TickContext) => void };
        }
    }
}
