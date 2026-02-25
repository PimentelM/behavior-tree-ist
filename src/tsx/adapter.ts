import { BTNode, NodeResult, TickContext } from "../base";
import * as Builder from "../builder";

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
    const flatChildren = children.flat(Infinity) as BTNode[];
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
            return Builder.fallback(safeProps, flatChildren);
        case "parallel":
            return Builder.parallel(safeProps, flatChildren);
        case "sequence-with-memory":
            return Builder.sequenceWithMemory(safeProps, flatChildren);
        case "fallback-with-memory":
            return Builder.fallbackWithMemory(safeProps, flatChildren);
        case "action":
            // Action requires an execute prop
            if (typeof safeProps.execute !== "function") {
                throw new Error(`<action> requires an "execute" prop of type function.`);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Builder.action(safeProps as unknown as any);
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
            sequence: DefaultCompositeProps;
            fallback: DefaultCompositeProps;
            "reactive-fallback": DefaultCompositeProps;
            parallel: DefaultCompositeProps;
            "sequence-with-memory": DefaultCompositeProps;
            "fallback-with-memory": DefaultCompositeProps;
            action: Builder.NodeProps & { execute: (ctx: TickContext) => NodeResult };
            condition: Builder.NodeProps & { eval: (ctx: TickContext) => boolean };
            "always-success": Builder.NodeProps;
            "always-failure": Builder.NodeProps;
            "always-running": Builder.NodeProps;
            sleep: Builder.NodeProps & { duration: number };
        }
    }
}
