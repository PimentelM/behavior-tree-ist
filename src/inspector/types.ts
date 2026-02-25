import { NodeFlags, NodeResult, SerializableState } from "../base/types";

/** Flat node from serialized tree, with parent/children refs for fast lookups */
export interface IndexedNode {
    id: number;
    nodeFlags: NodeFlags;
    defaultName: string;
    name: string;
    tags: readonly string[];
    parentId: number | undefined;
    childrenIds: number[];
    depth: number;
}

/** Per-node profiling accumulator */
export interface NodeProfilingData {
    nodeId: number;
    totalTime: number;
    tickCount: number;
    minTime: number;
    maxTime: number;
    lastTime: number;
}

/** Reconstructed node state at a specific tick */
export interface NodeTickSnapshot {
    nodeId: number;
    result: NodeResult;
    state?: SerializableState;
    startedAt?: number;
    finishedAt?: number;
}

/** Full tree state at a tick */
export interface TreeTickSnapshot {
    tickId: number;
    timestamp: number;
    nodes: Map<number, NodeTickSnapshot>;
}


export interface TreeInspectorOptions {
    maxTicks?: number; // default: 1000
}

/** Flamegraph frame for visualization */
export interface FlameGraphFrame {
    nodeId: number;
    name: string;
    depth: number;
    inclusiveTime: number;
    selfTime: number;
    startedAt: number;
    finishedAt: number;
    children: FlameGraphFrame[];
}

/** Aggregate statistics for the inspector */
export interface TreeStats {
    nodeCount: number;
    storedTickCount: number;
    totalTickCount: number;
    totalProfilingTime: number;
    oldestTickId: number | undefined;
    newestTickId: number | undefined;
}
