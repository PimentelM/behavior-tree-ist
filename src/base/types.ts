export const NodeResult = {
    Succeeded: "Succeeded",
    Failed: "Failed",
    Running: "Running",
} as const;
export type NodeResult = (typeof NodeResult)[keyof typeof NodeResult];

export const NodeFlags = {
    Leaf: 1 << 0,   // 0x001  — no children
    Composite: 1 << 1,   // 0x002  — multiple children
    Decorator: 1 << 2,   // 0x004  — wraps one child
    Action: 1 << 3,   // 0x008  — performs work (leaf sub-kind)
    Condition: 1 << 4,   // 0x010  — pure check (leaf sub-kind)
    Sequence: 1 << 5,   // 0x020  — AND-like flow
    Selector: 1 << 6,   // 0x040  — OR-like flow
    Fallback: 1 << 6,   // 0x040  — alias for Selector (BT.CPP naming)
    Parallel: 1 << 7,   // 0x080  — concurrent children
    Memory: 1 << 8,   // 0x100  — remembers last running child
    Stateful: 1 << 9,   // 0x200  — has time/counter state
    Utility: 1 << 10,  // 0x400  — uses utility scoring
    Repeating: 1 << 11,  // 0x800  — loops child execution
    ResultTransformer: 1 << 12,  // 0x1000 — remaps child result
    Guard: 1 << 13,  // 0x2000 — conditionally gates child
    Lifecycle: 1 << 14,  // 0x4000 — lifecycle hook side-effect
    Async: 1 << 15,  // 0x8000 — asynchronous/promise-based node
} as const;
export type NodeFlags = number;

export function hasFlag(nodeFlags: NodeFlags, flag: number): boolean {
    return (nodeFlags & flag) === flag;
}

export type SerializableValue = string | number | boolean | null | undefined | SerializableValue[] | { [key: string]: SerializableValue };
export type SerializableState = Record<string, SerializableValue>;

export interface SerializableNode {
    id: number;
    nodeFlags: NodeFlags;
    defaultName: string;
    name: string;
    children?: SerializableNode[];
    state?: SerializableState;
    tags?: readonly string[];
}

export type TickTraceEvent = {
    tickId: number;
    nodeId: number;
    timestamp: number;
    result: NodeResult;
    state?: SerializableState;
    startedAt?: number;
    finishedAt?: number;
};

export type RefChangeEvent = {
    tickId: number;
    timestamp: number;
    refName: string | undefined;
    nodeId?: number;
    newValue: unknown;
    isAsync: boolean;
};

export interface TickRecord {
    tickId: number;
    timestamp: number;
    events: TickTraceEvent[];
    refEvents: RefChangeEvent[];
}

export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never;