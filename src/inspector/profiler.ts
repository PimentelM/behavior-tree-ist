import { NodeResult, TickTraceEvent } from "../base/types";
import { NodeProfilingData, FlameGraphFrame } from "./types";
import { TreeIndex } from "./tree-index";

interface TimingEntry {
    nodeId: number;
    startedAt: number;
    finishedAt: number;
}

export class Profiler {
    private readonly data = new Map<number, NodeProfilingData>();
    private _totalCpuTime = 0;
    private _tickCount = 0;
    private lastProcessedTickId = -1;
    private _totalRunningTime = 0;

    // nodeId -> exact startedAt timestamp when node first transitioned to Running
    private runningStartTimes = new Map<number, number>();

    // tickId -> Map<nodeId, runningTime> for handling eviction of spanning durations
    private runningTimesByTick = new Map<number, Map<number, number>>();

    get totalCpuTime(): number {
        return this._totalCpuTime;
    }

    get totalRunningTime(): number {
        return this._totalRunningTime;
    }

    get tickCount(): number {
        return this._tickCount;
    }

    /**
     * Accumulate timing data from a tick's events.
     */
    ingestTick(events: TickTraceEvent[]): void {
        if (events.length === 0) return;
        const tickId = events[0].tickId;
        if (tickId <= this.lastProcessedTickId) return;
        this.lastProcessedTickId = tickId;
        this._tickCount++;

        const currentTickNodes = new Set<number>();
        const tickRunningTimes = new Map<number, number>();

        for (const event of events) {
            currentTickNodes.add(event.nodeId);

            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            const cpuTime = event.finishedAt - event.startedAt;

            let existing = this.data.get(event.nodeId);
            if (existing) {
                existing.totalCpuTime += cpuTime;
                existing.tickCount++;
                existing.lastCpuTime = cpuTime;
                if (cpuTime < existing.minCpuTime) existing.minCpuTime = cpuTime;
                if (cpuTime > existing.maxCpuTime) existing.maxCpuTime = cpuTime;
            } else {
                existing = {
                    nodeId: event.nodeId,
                    totalCpuTime: cpuTime,
                    tickCount: 1,
                    minCpuTime: cpuTime,
                    maxCpuTime: cpuTime,
                    lastCpuTime: cpuTime,
                    totalRunningTime: 0,
                    runningTimeCount: 0,
                    minRunningTime: Number.MAX_VALUE,
                    maxRunningTime: 0,
                    lastRunningTime: 0,
                };
                this.data.set(event.nodeId, existing);
            }

            this._totalCpuTime += cpuTime;

            // Handle RunningTime tracking
            if (event.result === NodeResult.Running) {
                if (!this.runningStartTimes.has(event.nodeId)) {
                    this.runningStartTimes.set(event.nodeId, event.startedAt);
                }
            } else if (event.result === NodeResult.Succeeded || event.result === NodeResult.Failed) {
                const initialStartedAt = this.runningStartTimes.get(event.nodeId) ?? event.startedAt;
                const runningTime = event.finishedAt - initialStartedAt;

                existing.totalRunningTime += runningTime;
                existing.runningTimeCount++;
                existing.lastRunningTime = runningTime;
                if (runningTime < existing.minRunningTime) existing.minRunningTime = runningTime;
                if (runningTime > existing.maxRunningTime) existing.maxRunningTime = runningTime;

                this._totalRunningTime += runningTime;

                tickRunningTimes.set(event.nodeId, runningTime);
                this.runningStartTimes.delete(event.nodeId);
            }
        }

        // Clean up aborted nodes (nodes that were running but not ticked in the current execution)
        for (const nodeId of this.runningStartTimes.keys()) {
            if (!currentTickNodes.has(nodeId)) {
                this.runningStartTimes.delete(nodeId);
            }
        }

        if (tickRunningTimes.size > 0) {
            this.runningTimesByTick.set(tickId, tickRunningTimes);
        }
    }

    /**
     * Subtract an evicted tick's contribution.
     * Note: min/max become approximate after removal — acceptable trade-off.
     */
    removeTick(events: TickTraceEvent[]): void {
        if (events.length === 0) return;
        const tickId = events[0].tickId;
        this._tickCount--;

        const tickRunningTimes = this.runningTimesByTick.get(tickId);

        for (const event of events) {
            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            const cpuTime = event.finishedAt - event.startedAt;

            const existing = this.data.get(event.nodeId);
            if (!existing) continue;

            existing.totalCpuTime -= cpuTime;
            existing.tickCount--;
            this._totalCpuTime -= cpuTime;

            if (tickRunningTimes && tickRunningTimes.has(event.nodeId)) {
                const runningTime = tickRunningTimes.get(event.nodeId)!;
                existing.totalRunningTime -= runningTime;
                existing.runningTimeCount--;
                this._totalRunningTime -= runningTime;
            }

            if (existing.tickCount <= 0) {
                this.data.delete(event.nodeId);
            }
        }

        this.runningTimesByTick.delete(tickId);
    }

    getNodeData(nodeId: number): NodeProfilingData | undefined {
        return this.data.get(nodeId);
    }

    getAverageCpuTime(nodeId: number): number | undefined {
        const d = this.data.get(nodeId);
        if (!d || d.tickCount === 0) return undefined;
        return d.totalCpuTime / d.tickCount;
    }

    getAverageRunningTime(nodeId: number): number | undefined {
        const d = this.data.get(nodeId);
        if (!d || d.runningTimeCount === 0) return undefined;
        return d.totalRunningTime / d.runningTimeCount;
    }

    /**
     * Get all nodes sorted by total CPU time descending.
     */
    getHotNodes(): NodeProfilingData[] {
        return Array.from(this.data.values()).sort((a, b) => b.totalCpuTime - a.totalCpuTime);
    }

    /**
     * Build raw timing entries for one tick, sorted by startedAt.
     */
    static buildTickTimeline(events: TickTraceEvent[]): TimingEntry[] {
        return events
            .filter(e => e.startedAt !== undefined && e.finishedAt !== undefined)
            .map(e => ({
                nodeId: e.nodeId,
                startedAt: e.startedAt!,
                finishedAt: e.finishedAt!,
            }))
            .sort((a, b) => a.startedAt - b.startedAt);
    }

    /**
     * Build flamegraph frames from a tick's events combined with tree structure.
     * inclusiveTime = finishedAt - startedAt for that node in this tick
     * selfTime = inclusiveTime - sum of children's inclusiveTime
     */
    static buildFlameGraphFrames(events: TickTraceEvent[], treeIndex: TreeIndex): FlameGraphFrame[] {
        // Build a map of nodeId -> timing for this tick
        const timingMap = new Map<number, { startedAt: number; finishedAt: number }>();
        for (const event of events) {
            if (event.startedAt !== undefined && event.finishedAt !== undefined) {
                timingMap.set(event.nodeId, {
                    startedAt: event.startedAt,
                    finishedAt: event.finishedAt,
                });
            }
        }

        // Build frames recursively following tree structure
        function buildFrame(nodeId: number): FlameGraphFrame | undefined {
            const timing = timingMap.get(nodeId);
            if (!timing) return undefined;

            const node = treeIndex.getById(nodeId);
            if (!node) return undefined;

            const inclusiveTime = timing.finishedAt - timing.startedAt;
            const children: FlameGraphFrame[] = [];

            let childrenTime = 0;
            for (const childId of node.childrenIds) {
                const childFrame = buildFrame(childId);
                if (childFrame) {
                    children.push(childFrame);
                    childrenTime += childFrame.inclusiveTime;
                }
            }

            return {
                nodeId,
                name: node.name || node.defaultName,
                depth: node.depth,
                inclusiveTime,
                selfTime: inclusiveTime - childrenTime,
                startedAt: timing.startedAt,
                finishedAt: timing.finishedAt,
                children,
            };
        }

        // Start from root nodes (those that are in the events and have no parent in events)
        const rootFrames: FlameGraphFrame[] = [];
        for (const event of events) {
            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            const node = treeIndex.getById(event.nodeId);
            if (!node) continue;
            // A node is a "root" of the flamegraph if its parent wasn't ticked
            if (node.parentId === undefined || !timingMap.has(node.parentId)) {
                const frame = buildFrame(event.nodeId);
                if (frame) rootFrames.push(frame);
            }
        }

        return rootFrames;
    }

    clear(): void {
        this.data.clear();
        this._totalCpuTime = 0;
        this._totalRunningTime = 0;
        this._tickCount = 0;
        this.lastProcessedTickId = -1;
        this.runningStartTimes.clear();
        this.runningTimesByTick.clear();
    }
}
