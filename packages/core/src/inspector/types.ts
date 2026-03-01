import { NodeFlags, NodeResult, SerializableState } from "../base/types";

/** Flat node from serialized tree, with parent/children refs for fast lookups */
export interface IndexedNode {
    id: number;
    nodeFlags: NodeFlags;
    defaultName: string;
    name: string;
    tags: readonly string[];
    activity: string | undefined;
    parentId: number | undefined;
    childrenIds: number[];
    depth: number;
}

export type ActivityDisplayMode = "running" | "running_or_success" | "all";

export interface ActivityBranch {
    labels: readonly string[];
    nodeIds: readonly number[];
    pathNodeIds: readonly number[];
    tailNodeId: number;
    tailResult: NodeResult;
    lastEventIndex: number;
}

export interface ActivitySnapshot {
    tickId: number;
    timestamp: number;
    branches: readonly ActivityBranch[];
}

/** Per-node profiling accumulator */
export interface NodeProfilingData {
    nodeId: number;
    totalCpuTime: number;
    tickCount: number;
    minCpuTime: number;
    maxCpuTime: number;
    lastCpuTime: number;
    totalSelfCpuTime: number;
    minSelfCpuTime: number;
    maxSelfCpuTime: number;
    lastSelfCpuTime: number;
    selfCpuP50: number;
    selfCpuP95: number;
    selfCpuP99: number;
    cpuP50: number;
    cpuP95: number;
    cpuP99: number;
    totalRunningTime: number;
    runningTimeCount: number;
    minRunningTime: number;
    maxRunningTime: number;
    lastRunningTime: number;
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
    totalProfilingCpuTime: number;
    totalRootCpuTime: number;
    totalProfilingRunningTime: number;
    oldestTickId: number | undefined;
    newestTickId: number | undefined;
    profilingWindowStart: number | undefined;
    profilingWindowEnd: number | undefined;
    profilingWindowSpan: number;
}
