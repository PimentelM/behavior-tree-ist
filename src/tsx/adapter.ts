import { BTNode, CancellationSignal, NodeResult, TickContext } from "../base";
import { UtilityScorer } from "../base/utility";
import * as Builder from "../builder";
import { Utility as UtilityNode } from "../nodes/decorators/utility";

export function Fragment(_props: unknown, ...children: BTNode[]): BTNode[] {
    return children;
}

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

    // 2. Intrinsic Engine Elements (like "sequence", "action")
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Builder.utility(safeProps as unknown as any, flatChildren[0]);
        }
        case "action":
            // Action requires an execute prop
            if (typeof safeProps.execute !== "function") {
                throw new Error(`<action> requires an "execute" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Builder.action(safeProps as unknown as any);
        case "async-action":
            // AsyncAction requires an execute prop
            if (typeof safeProps.execute !== "function") {
                throw new Error(`<async-action> requires an "execute" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Builder.condition(safeProps as unknown as any);
        case "sleep":
            if (typeof safeProps.duration !== "number") {
                throw new Error(`<sleep> requires a "duration" prop of type number.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Builder.sleep(safeProps as unknown as any);
        default:
            throw new Error(`Unknown intrinsic behavior tree node type: <${type}>`);
    }
}

// Global JSX Namespace Definition for Type-Safety
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
        // Defines the return type of BT.createElement
        type Element = BTNode;
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        type ElementChildrenAttribute = { children: {} };

        type DefaultCompositeProps = Builder.NodeProps & { children?: Element | Element[] };

        // Defines our built-in tag names and the props they accept
        interface IntrinsicElements {
            "sequence": DefaultCompositeProps;
            "reactive-sequence": DefaultCompositeProps;
            "fallback": DefaultCompositeProps;
            "reactive-fallback": DefaultCompositeProps;
            "selector": DefaultCompositeProps; // alias for fallback
            "parallel": DefaultCompositeProps;
            "if-then-else": DefaultCompositeProps;
            "sequence-with-memory": DefaultCompositeProps;
            "fallback-with-memory": DefaultCompositeProps;
            "selector-with-memory": DefaultCompositeProps; // alias for fallback-with-memory
            "utility-fallback": DefaultCompositeProps;
            "utility-selector": DefaultCompositeProps; // alias for utility-fallback
            "utility-sequence": DefaultCompositeProps;
            "utility-node": Builder.NodeProps & { scorer: UtilityScorer; children?: Element | Element[] };
            "action": Builder.NodeProps & { execute: (ctx: TickContext) => NodeResult };
            "async-action": Builder.NodeProps & { execute: (ctx: TickContext, signal: CancellationSignal) => Promise<NodeResult | void> };
            "condition": Builder.NodeProps & { eval: (ctx: TickContext) => boolean };
            "always-success": Builder.NodeProps;
            "always-failure": Builder.NodeProps;
            "always-running": Builder.NodeProps;
            "sleep": Builder.NodeProps & { duration: number };
        }
    }
}
