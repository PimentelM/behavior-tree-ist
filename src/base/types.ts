export const NodeResult = {
    Succeeded: "Succeeded",
    Failed: "Failed",
    Running: "Running",
} as const;
export type NodeResult = (typeof NodeResult)[keyof typeof NodeResult];

export const NodeType = {
    Action: "Action",
    Condition: "Condition",
    Selector: "Selector",
    Sequence: "Sequence",
    Parallel: "Parallel",
    Decorator: "Decorator",
    Composite: "Composite", // Fallback for generic composite types
    UtilitySelector: "UtilitySelector",
    SequenceMemory: "SequenceMemory",
    SelectorMemory: "SelectorMemory"
} as const;
export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export type SerializableValue = string | number | boolean | null | undefined | SerializableValue[] | { [key: string]: SerializableValue };
export type SerializableState = Record<string, SerializableValue>;

export interface SerializableNode {
    id: number;
    type: NodeType;
    displayName: string;
    state?: SerializableState;
    children?: SerializableNode[];
}

export type TickTraceEvent = {
    tickId: number;
    tickNumber: number;
    nodeId: number;
    timestampMs: number;
    nodeType: NodeType;
    nodeDisplayName: string;
    result: NodeResult;
};

export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest] ? Rest : never;