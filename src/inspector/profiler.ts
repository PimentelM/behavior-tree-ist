import { TickTraceEvent } from "../base/types";
import { NodeProfilingData, FlameGraphFrame } from "./types";
import { TreeIndex } from "./tree-index";

interface TimingEntry {
    nodeId: number;
    startedAt: number;
    finishedAt: number;
}

export class Profiler {
    private readonly data = new Map<number, NodeProfilingData>();
    private _totalTime = 0;
    private _tickCount = 0;
    private lastProcessedTickId = -1;

    get totalTime(): number {
        return this._totalTime;
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

        for (const event of events) {
            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            const time = event.finishedAt - event.startedAt;

            const existing = this.data.get(event.nodeId);
            if (existing) {
                existing.totalTime += time;
                existing.tickCount++;
                existing.lastTime = time;
                if (time < existing.minTime) existing.minTime = time;
                if (time > existing.maxTime) existing.maxTime = time;
            } else {
                this.data.set(event.nodeId, {
                    nodeId: event.nodeId,
                    totalTime: time,
                    tickCount: 1,
                    minTime: time,
                    maxTime: time,
                    lastTime: time,
                });
            }

            this._totalTime += time;
        }
    }

    /**
     * Subtract an evicted tick's contribution.
     * Note: min/max become approximate after removal — acceptable trade-off.
     */
    removeTick(events: TickTraceEvent[]): void {
        if (events.length === 0) return;
        this._tickCount--;

        for (const event of events) {
            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            const time = event.finishedAt - event.startedAt;

            const existing = this.data.get(event.nodeId);
            if (!existing) continue;

            existing.totalTime -= time;
            existing.tickCount--;
            this._totalTime -= time;

            if (existing.tickCount <= 0) {
                this.data.delete(event.nodeId);
            }
        }
    }

    getNodeData(nodeId: number): NodeProfilingData | undefined {
        return this.data.get(nodeId);
    }

    getAverageTime(nodeId: number): number | undefined {
        const d = this.data.get(nodeId);
        if (!d || d.tickCount === 0) return undefined;
        return d.totalTime / d.tickCount;
    }

    /**
     * Get all nodes sorted by total time descending.
     */
    getHotNodes(): NodeProfilingData[] {
        return Array.from(this.data.values()).sort((a, b) => b.totalTime - a.totalTime);
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
        this._totalTime = 0;
        this._tickCount = 0;
        this.lastProcessedTickId = -1;
    }
}
