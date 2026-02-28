import { NodeResult, SerializableNode, SerializableState, TickTraceEvent, TickRecord } from "../base/types";
import { TreeIndex } from "./tree-index";
import { TickStore } from "./tick-store";
import { Profiler } from "./profiler";
import {
    TreeInspectorOptions,
    NodeTickSnapshot,
    TreeTickSnapshot,
    FlameGraphFrame,
    TreeStats,
    NodeProfilingData,
} from "./types";

export class TreeInspector {
    private _tree: TreeIndex | undefined;
    private readonly store: TickStore;
    private readonly profiler: Profiler;
    private totalTickCount = 0;
    private totalRootCpuTime = 0;
    private readonly rootCpuByTick = new Map<number, number>();

    constructor(options: TreeInspectorOptions = {}) {
        const maxTicks = options.maxTicks ?? 1000;
        this.store = new TickStore(maxTicks);
        this.profiler = new Profiler();
    }

    // --- Tree structure ---

    indexTree(root: SerializableNode): void {
        this._tree = new TreeIndex(root);
    }

    get tree(): TreeIndex | undefined {
        return this._tree;
    }

    // --- Event ingestion ---

    ingestTick(record: TickRecord): void {
        if (record.events.length === 0) return;

        const newest = this.store.newestTickId;
        if (newest !== undefined && record.tickId <= newest) {
            return; // completely ignore older/duplicate ticks
        }

        this.totalTickCount++;

        const evicted = this.store.push(record);
        if (evicted) {
            this.profiler.removeTick(evicted.events);
            const evictedRootCpu = this.rootCpuByTick.get(evicted.tickId) ?? 0;
            this.totalRootCpuTime -= evictedRootCpu;
            this.rootCpuByTick.delete(evicted.tickId);
        }

        const rootCpuTime = this.getRootCpuTime(record);
        this.rootCpuByTick.set(record.tickId, rootCpuTime);
        this.totalRootCpuTime += rootCpuTime;
        this.profiler.ingestTick(record.events);
    }

    // --- State reconstruction ---

    getSnapshotAtTick(tickId: number): TreeTickSnapshot | undefined {
        return this.store.getSnapshotAtTick(tickId);
    }

    getLatestSnapshot(): TreeTickSnapshot | undefined {
        const newest = this.store.newestTickId;
        if (newest === undefined) return undefined;
        return this.store.getSnapshotAtTick(newest);
    }

    getNodeAtTick(nodeId: number, tickId: number): NodeTickSnapshot | undefined {
        const snapshot = this.store.getSnapshotAtTick(tickId);
        return snapshot?.nodes.get(nodeId);
    }

    // --- History ---

    getNodeHistory(nodeId: number): TickTraceEvent[] {
        return this.store.getNodeHistory(nodeId);
    }

    getLastDisplayState(nodeId: number, atOrBeforeTickId?: number): SerializableState | undefined {
        return this.store.getLastNodeState(nodeId, atOrBeforeTickId);
    }

    getNodeResultSummary(nodeId: number): Map<NodeResult, number> {
        const history = this.store.getNodeHistory(nodeId);
        const counts = new Map<NodeResult, number>();
        for (const event of history) {
            counts.set(event.result, (counts.get(event.result) ?? 0) + 1);
        }
        return counts;
    }

    getStoredTickIds(): number[] {
        return this.store.getStoredTickIds();
    }

    getTickRange(from: number, to: number) {
        return this.store.getTickRange(from, to);
    }

    // --- Profiling ---

    getNodeProfilingData(nodeId: number): NodeProfilingData | undefined {
        return this.profiler.getNodeData(nodeId);
    }

    getHotNodes(): NodeProfilingData[] {
        return this.profiler.getHotNodes();
    }

    getFlameGraphFrames(tickId: number): FlameGraphFrame[] {
        const record = this.store.getByTickId(tickId);
        if (!record || !this._tree) return [];
        return Profiler.buildFlameGraphFrames(record.events, this._tree);
    }

    // --- Statistics ---

    getStats(): TreeStats {
        const profilingWindow = this.store.getProfilingWindowBounds();

        return {
            nodeCount: this._tree?.size ?? 0,
            storedTickCount: this.store.size,
            totalTickCount: this.totalTickCount,
            totalProfilingCpuTime: this.profiler.totalCpuTime,
            totalRootCpuTime: this.totalRootCpuTime,
            totalProfilingRunningTime: this.profiler.totalRunningTime,
            oldestTickId: this.store.oldestTickId,
            newestTickId: this.store.newestTickId,
            profilingWindowStart: profilingWindow.start,
            profilingWindowEnd: profilingWindow.end,
            profilingWindowSpan: profilingWindow.span,
        };
    }

    // --- Reset ---

    clearTicks(): void {
        this.store.clear();
        this.profiler.clear();
        this.totalTickCount = 0;
        this.totalRootCpuTime = 0;
        this.rootCpuByTick.clear();
    }

    reset(): void {
        this.clearTicks();
        this._tree = undefined;
    }

    private getRootCpuTime(record: TickRecord): number {
        const rootId = this._tree?.preOrder[0];
        if (rootId === undefined) return 0;

        let total = 0;
        for (const event of record.events) {
            if (event.nodeId !== rootId) continue;
            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            total += event.finishedAt - event.startedAt;
        }

        return total;
    }
}
