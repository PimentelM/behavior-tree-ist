import { NodeResult, SerializableNode, SerializableState, NodeHistoryEvent, TickRecord } from "../base/types";
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
    CpuTimelineEntry,
    ActivityDisplayMode,
    ActivitySnapshot,
} from "./types";
import { projectActivityFromTreeIndex } from "../activity/projector";

export class TreeInspector {
    private _tree: TreeIndex | undefined;
    private readonly maxTicks: number;
    private readonly store: TickStore;
    private readonly profiler: Profiler;
    private totalTickCount = 0;
    private totalRootCpuTime = 0;
    private readonly rootCpuByTick = new Map<number, number>();

    constructor(options: TreeInspectorOptions = {}) {
        this.maxTicks = options.maxTicks ?? 1000;
        this.store = new TickStore(this.maxTicks);
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
            this.profiler.removeTick(evicted.tickId, evicted.events);
            const evictedRootCpu = this.rootCpuByTick.get(evicted.tickId) ?? 0;
            this.totalRootCpuTime -= evictedRootCpu;
            this.rootCpuByTick.delete(evicted.tickId);
        }

        const rootCpuTime = this.getRootCpuTime(record);
        this.rootCpuByTick.set(record.tickId, rootCpuTime);
        this.totalRootCpuTime += rootCpuTime;
        this.profiler.ingestTick(record.tickId, record.events);
    }

    ingestTicks(records: TickRecord[]): void {
        // Filter empty/duplicate/older records, enforce monotonic increase
        const newest = this.store.newestTickId;
        const deduped: TickRecord[] = [];
        let lastId = newest ?? -Infinity;
        for (const r of records) {
            if (r.events.length === 0) continue;
            if (r.tickId <= lastId) continue;
            lastId = r.tickId;
            deduped.push(r);
        }
        if (deduped.length === 0) return;

        this.totalTickCount += deduped.length;

        // Batch push to store, collect all evictions (pre-existing + overflow within batch)
        const evicted = this.store.pushMany(deduped);

        // Separate evictions: pre-existing (in profiler) vs overflow-within-batch (never ingested)
        const dedupedSet = new Set(deduped.map(r => r.tickId));
        const preExistingEvictions: TickRecord[] = [];
        for (const e of evicted) {
            if (dedupedSet.has(e.tickId)) continue; // overflow within batch, never in profiler
            preExistingEvictions.push(e);
        }

        // Remove pre-existing evictions from profiler
        if (preExistingEvictions.length > 0) {
            this.profiler.removeTicks(preExistingEvictions.map(e => ({ tickId: e.tickId, events: e.events })));
        }
        for (const e of evicted) {
            const evictedRootCpu = this.rootCpuByTick.get(e.tickId) ?? 0;
            this.totalRootCpuTime -= evictedRootCpu;
            this.rootCpuByTick.delete(e.tickId);
        }

        // Only ingest records that survived in the store
        const evictedSet = new Set(evicted.map(e => e.tickId));
        const survivors = deduped.filter(r => !evictedSet.has(r.tickId));

        // Track root CPU times for survivors only
        for (const record of survivors) {
            const rootCpuTime = this.getRootCpuTime(record);
            this.rootCpuByTick.set(record.tickId, rootCpuTime);
            this.totalRootCpuTime += rootCpuTime;
        }

        // Batch ingest survivors to profiler
        this.profiler.ingestTicks(survivors.map(r => ({ tickId: r.tickId, events: r.events })));
    }

    /**
     * Insert historical tick records before the current window.
     * Records older than the current oldest stored tick are prepended.
     * If the buffer overflows, the newest ticks are evicted from the tail.
     * Does NOT increment totalTickCount (historical loads are not new live ticks).
     */
    insertTicksBefore(records: TickRecord[]): void {
        if (records.length === 0) return;

        const evicted = this.store.insertBefore(records);

        // Evicted are previously-stored ticks — remove from profiler and CPU tracking
        if (evicted.length > 0) {
            this.profiler.removeTicks(evicted.map(e => ({ tickId: e.tickId, events: e.events })));
            for (const e of evicted) {
                const evictedRootCpu = this.rootCpuByTick.get(e.tickId) ?? 0;
                this.totalRootCpuTime -= evictedRootCpu;
                this.rootCpuByTick.delete(e.tickId);
            }
        }

        // Ingest records that actually made it into the store
        const survivors: TickRecord[] = [];
        for (const record of records) {
            if (this.store.hasTick(record.tickId)) {
                survivors.push(record);
            }
        }

        for (const record of survivors) {
            const rootCpuTime = this.getRootCpuTime(record);
            this.rootCpuByTick.set(record.tickId, rootCpuTime);
            this.totalRootCpuTime += rootCpuTime;
        }
        this.profiler.ingestTicksBefore(survivors.map(r => ({ tickId: r.tickId, events: r.events })));
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

    /** Check if a tick is currently loaded in the in-memory window. */
    hasTickLoaded(tickId: number): boolean {
        return this.store.hasTick(tickId);
    }

    // --- History ---

    getNodeHistory(nodeId: number): NodeHistoryEvent[] {
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

    getPercentileMode(): "sampled" | "exact" {
        return this.profiler.getPercentileMode();
    }

    getCpuTimeline(): CpuTimelineEntry[] {
        const tickIds = this.store.getStoredTickIds();
        const entries: CpuTimelineEntry[] = [];
        for (const tickId of tickIds) {
            entries.push({
                tickId,
                cpuTime: this.rootCpuByTick.get(tickId) ?? 0,
            });
        }
        return entries;
    }

    getFlameGraphFrames(tickId: number): FlameGraphFrame[] {
        const record = this.store.getByTickId(tickId);
        if (!record || !this._tree) return [];
        return Profiler.buildFlameGraphFrames(record.events, this._tree);
    }

    getActivitySnapshotAtTick(tickId: number, mode: ActivityDisplayMode = "running"): ActivitySnapshot | undefined {
        const record = this.store.getByTickId(tickId);
        if (!record || !this._tree) return undefined;
        return projectActivityFromTreeIndex(this._tree, record, { mode });
    }

    getLatestActivitySnapshot(mode: ActivityDisplayMode = "running"): ActivitySnapshot | undefined {
        const record = this.store.newestRecord;
        if (!record || !this._tree) return undefined;
        return projectActivityFromTreeIndex(this._tree, record, { mode });
    }

    cloneForTimeTravel(options: { exactPercentiles?: boolean } = {}): TreeInspector {
        const exactPercentiles = options.exactPercentiles ?? true;
        const cloned = new TreeInspector({ maxTicks: this.maxTicks });
        cloned._tree = this._tree;

        const range: TickRecord[] = [];
        const tickIds = this.store.getStoredTickIds();
        if (tickIds.length > 0) {
            const firstTickId = tickIds[0]!;
            const lastTickId = tickIds[tickIds.length - 1]!;
            range.push(...this.store.getTickRange(firstTickId, lastTickId));
            for (const record of range) {
                cloned.store.push(record);
            }
        }

        cloned.profiler.copyFrom(this.profiler);
        if (exactPercentiles) {
            cloned.profiler.recomputeExactPercentilesFromTickEvents(range.map((record) => record.events));
        }
        cloned.totalTickCount = this.totalTickCount;
        cloned.totalRootCpuTime = this.totalRootCpuTime;
        for (const [tickId, rootCpuTime] of this.rootCpuByTick) {
            cloned.rootCpuByTick.set(tickId, rootCpuTime);
        }

        return cloned;
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
