import { NodeResult, TickTraceEvent } from "../base/types";
import { NodeProfilingData, FlameGraphFrame } from "./types";
import { TreeIndex } from "./tree-index";

interface TimingEntry {
    nodeId: number;
    startedAt: number;
    finishedAt: number;
}

interface TimedEvent {
    nodeId: number;
    startedAt: number;
    finishedAt: number;
    inclusiveTime: number;
    childInclusiveTime: number;
}

interface TickNodeContribution {
    cpuSum: number;
    cpuCount: number;
    minCpuTime: number;
    maxCpuTime: number;
    lastCpuTime: number;
    selfCpuSum: number;
    selfCpuCount: number;
    minSelfCpuTime: number;
    maxSelfCpuTime: number;
    lastSelfCpuTime: number;
    runningSum: number;
    runningCount: number;
    minRunningTime: number;
    maxRunningTime: number;
    lastRunningTime: number;
}

interface PercentileWindow {
    samples: number[];
    nextIndex: number;
}

interface PercentileCache {
    version: number;
    p50: number;
    p95: number;
    p99: number;
}

interface NodeAccumulator {
    nodeId: number;
    totalCpuTime: number;
    tickCount: number;
    minCpuTime: number;
    maxCpuTime: number;
    lastCpuTime: number;
    totalSelfCpuTime: number;
    selfCpuCount: number;
    minSelfCpuTime: number;
    maxSelfCpuTime: number;
    lastSelfCpuTime: number;
    totalRunningTime: number;
    runningTimeCount: number;
    minRunningTime: number;
    maxRunningTime: number;
    lastRunningTime: number;
    dirtyMinMax: boolean;
    version: number;
}

const DEFAULT_PERCENTILE_SAMPLE_CAP = 256;
const DEFAULT_MIN_MAX_REPAIR_INTERVAL_TICKS = 128;
const DEFAULT_MAX_DIRTY_NODES_PER_REPAIR_PASS = 200;

export class Profiler {
    private readonly accumulators = new Map<number, NodeAccumulator>();
    private readonly tickContribByTick = new Map<number, Map<number, TickNodeContribution>>();
    private readonly percentileWindowsByNode = new Map<number, PercentileWindow>();
    private readonly percentileCacheByNode = new Map<number, PercentileCache>();
    private readonly dirtyMinMaxNodeIds = new Set<number>();
    private _totalCpuTime = 0;
    private _tickCount = 0;
    private lastProcessedTickId = -1;
    private _totalRunningTime = 0;
    private _totalSelfCpuTime = 0;
    private ticksSinceRepair = 0;
    private readonly percentileSampleCap = DEFAULT_PERCENTILE_SAMPLE_CAP;
    private readonly minMaxRepairIntervalTicks = DEFAULT_MIN_MAX_REPAIR_INTERVAL_TICKS;
    private readonly maxDirtyNodesPerRepairPass = DEFAULT_MAX_DIRTY_NODES_PER_REPAIR_PASS;

    // nodeId -> exact startedAt timestamp when node first transitioned to Running
    private readonly runningStartTimes = new Map<number, number>();

    get totalCpuTime(): number {
        return this._totalCpuTime;
    }

    get totalRunningTime(): number {
        return this._totalRunningTime;
    }

    get totalSelfCpuTime(): number {
        return this._totalSelfCpuTime;
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
        const tickContribByNode = new Map<number, TickNodeContribution>();
        const timedEvents: TimedEvent[] = [];
        const currentTickNodes = new Set<number>();

        for (const event of events) {
            currentTickNodes.add(event.nodeId);

            if (event.startedAt === undefined || event.finishedAt === undefined) continue;
            const cpuTime = event.finishedAt - event.startedAt;
            const contribution = this.getOrCreateContribution(tickContribByNode, event.nodeId);
            this.addCpuSampleToContribution(contribution, cpuTime);
            timedEvents.push({
                nodeId: event.nodeId,
                startedAt: event.startedAt,
                finishedAt: event.finishedAt,
                inclusiveTime: cpuTime,
                childInclusiveTime: 0,
            });
            this.pushPercentileCpuSample(event.nodeId, cpuTime);

            // Running duration tracking remains exact because it represents discrete spans.
            if (event.result === NodeResult.Running) {
                if (!this.runningStartTimes.has(event.nodeId)) {
                    this.runningStartTimes.set(event.nodeId, event.startedAt);
                }
            } else if (event.result === NodeResult.Succeeded || event.result === NodeResult.Failed) {
                const initialStartedAt = this.runningStartTimes.get(event.nodeId) ?? event.startedAt;
                const runningTime = event.finishedAt - initialStartedAt;
                this.addRunningSampleToContribution(contribution, runningTime);
                this.runningStartTimes.delete(event.nodeId);
            }
        }

        const tickSelfTimes = this.groupSelfCpuSamplesFromTimedEvents(timedEvents);
        for (const [nodeId, samples] of tickSelfTimes) {
            const contribution = this.getOrCreateContribution(tickContribByNode, nodeId);
            for (const sample of samples) {
                this.addSelfCpuSampleToContribution(contribution, sample);
            }
        }

        this.tickContribByTick.set(tickId, tickContribByNode);
        for (const [nodeId, contribution] of tickContribByNode) {
            this.applyContribution(nodeId, contribution);
        }

        // Clean up aborted nodes (nodes that were running but not ticked in the current execution)
        for (const nodeId of Array.from(this.runningStartTimes.keys())) {
            if (!currentTickNodes.has(nodeId)) {
                this.runningStartTimes.delete(nodeId);
            }
        }

        this.ticksSinceRepair++;
        if (this.ticksSinceRepair >= this.minMaxRepairIntervalTicks) {
            this.repairDirtyNodes(this.maxDirtyNodesPerRepairPass);
            this.ticksSinceRepair = 0;
        }
    }

    /**
     * Subtract an evicted tick's contribution.
     */
    removeTick(events: TickTraceEvent[]): void {
        if (events.length === 0) return;
        const tickId = events[0].tickId;
        if (this._tickCount > 0) {
            this._tickCount--;
        }

        const tickContribByNode = this.tickContribByTick.get(tickId);
        if (!tickContribByNode) return;

        for (const [nodeId, contribution] of tickContribByNode) {
            this.removeContribution(nodeId, contribution);
        }

        this.tickContribByTick.delete(tickId);
    }

    getNodeData(nodeId: number): NodeProfilingData | undefined {
        const acc = this.accumulators.get(nodeId);
        if (!acc) return undefined;
        if (acc.dirtyMinMax) {
            this.repairNodeMinMax(nodeId);
        }
        return this.buildNodeData(acc);
    }

    getAverageCpuTime(nodeId: number): number | undefined {
        const d = this.accumulators.get(nodeId);
        if (!d || d.tickCount === 0) return undefined;
        return d.totalCpuTime / d.tickCount;
    }

    getAverageRunningTime(nodeId: number): number | undefined {
        const d = this.accumulators.get(nodeId);
        if (!d || d.runningTimeCount === 0) return undefined;
        return d.totalRunningTime / d.runningTimeCount;
    }

    /**
     * Get all nodes sorted by total CPU time descending.
     */
    getHotNodes(): NodeProfilingData[] {
        this.repairDirtyNodes(this.maxDirtyNodesPerRepairPass);
        const nodes = Array.from(this.accumulators.values(), (acc) => this.buildNodeData(acc));
        nodes.sort((a, b) => b.totalCpuTime - a.totalCpuTime);
        return nodes;
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
        this.accumulators.clear();
        this.tickContribByTick.clear();
        this.percentileWindowsByNode.clear();
        this.percentileCacheByNode.clear();
        this.dirtyMinMaxNodeIds.clear();
        this._totalCpuTime = 0;
        this._totalRunningTime = 0;
        this._totalSelfCpuTime = 0;
        this._tickCount = 0;
        this.lastProcessedTickId = -1;
        this.ticksSinceRepair = 0;
        this.runningStartTimes.clear();
    }

    clone(): Profiler {
        const cloned = new Profiler();
        cloned.copyFrom(this);
        return cloned;
    }

    copyFrom(source: Profiler): void {
        this.clear();
        this._totalCpuTime = source._totalCpuTime;
        this._tickCount = source._tickCount;
        this.lastProcessedTickId = source.lastProcessedTickId;
        this._totalRunningTime = source._totalRunningTime;
        this._totalSelfCpuTime = source._totalSelfCpuTime;
        this.ticksSinceRepair = source.ticksSinceRepair;

        for (const [nodeId, acc] of source.accumulators) {
            this.accumulators.set(nodeId, { ...acc });
        }

        for (const [tickId, contribByNode] of source.tickContribByTick) {
            const tickCopy = new Map<number, TickNodeContribution>();
            for (const [nodeId, contribution] of contribByNode) {
                tickCopy.set(nodeId, { ...contribution });
            }
            this.tickContribByTick.set(tickId, tickCopy);
        }

        for (const [nodeId, window] of source.percentileWindowsByNode) {
            this.percentileWindowsByNode.set(nodeId, {
                samples: [...window.samples],
                nextIndex: window.nextIndex,
            });
        }
        for (const [nodeId, cache] of source.percentileCacheByNode) {
            this.percentileCacheByNode.set(nodeId, { ...cache });
        }
        for (const nodeId of source.dirtyMinMaxNodeIds) {
            this.dirtyMinMaxNodeIds.add(nodeId);
        }
        for (const [nodeId, startedAt] of source.runningStartTimes) {
            this.runningStartTimes.set(nodeId, startedAt);
        }
    }

    private getOrCreateContribution(
        map: Map<number, TickNodeContribution>,
        nodeId: number,
    ): TickNodeContribution {
        const existing = map.get(nodeId);
        if (existing) return existing;
        const created: TickNodeContribution = {
            cpuSum: 0,
            cpuCount: 0,
            minCpuTime: 0,
            maxCpuTime: 0,
            lastCpuTime: 0,
            selfCpuSum: 0,
            selfCpuCount: 0,
            minSelfCpuTime: 0,
            maxSelfCpuTime: 0,
            lastSelfCpuTime: 0,
            runningSum: 0,
            runningCount: 0,
            minRunningTime: 0,
            maxRunningTime: 0,
            lastRunningTime: 0,
        };
        map.set(nodeId, created);
        return created;
    }

    private getOrCreateAccumulator(nodeId: number): NodeAccumulator {
        const existing = this.accumulators.get(nodeId);
        if (existing) return existing;
        const created: NodeAccumulator = {
            nodeId,
            totalCpuTime: 0,
            tickCount: 0,
            minCpuTime: 0,
            maxCpuTime: 0,
            lastCpuTime: 0,
            totalSelfCpuTime: 0,
            selfCpuCount: 0,
            minSelfCpuTime: 0,
            maxSelfCpuTime: 0,
            lastSelfCpuTime: 0,
            totalRunningTime: 0,
            runningTimeCount: 0,
            minRunningTime: Number.MAX_VALUE,
            maxRunningTime: 0,
            lastRunningTime: 0,
            dirtyMinMax: false,
            version: 0,
        };
        this.accumulators.set(nodeId, created);
        return created;
    }

    private addCpuSampleToContribution(contribution: TickNodeContribution, sample: number): void {
        contribution.cpuSum += sample;
        contribution.lastCpuTime = sample;
        if (contribution.cpuCount === 0) {
            contribution.minCpuTime = sample;
            contribution.maxCpuTime = sample;
        } else {
            contribution.minCpuTime = Math.min(contribution.minCpuTime, sample);
            contribution.maxCpuTime = Math.max(contribution.maxCpuTime, sample);
        }
        contribution.cpuCount++;
    }

    private addSelfCpuSampleToContribution(contribution: TickNodeContribution, sample: number): void {
        contribution.selfCpuSum += sample;
        contribution.lastSelfCpuTime = sample;
        if (contribution.selfCpuCount === 0) {
            contribution.minSelfCpuTime = sample;
            contribution.maxSelfCpuTime = sample;
        } else {
            contribution.minSelfCpuTime = Math.min(contribution.minSelfCpuTime, sample);
            contribution.maxSelfCpuTime = Math.max(contribution.maxSelfCpuTime, sample);
        }
        contribution.selfCpuCount++;
    }

    private addRunningSampleToContribution(contribution: TickNodeContribution, sample: number): void {
        contribution.runningSum += sample;
        contribution.lastRunningTime = sample;
        if (contribution.runningCount === 0) {
            contribution.minRunningTime = sample;
            contribution.maxRunningTime = sample;
        } else {
            contribution.minRunningTime = Math.min(contribution.minRunningTime, sample);
            contribution.maxRunningTime = Math.max(contribution.maxRunningTime, sample);
        }
        contribution.runningCount++;
    }

    private applyContribution(nodeId: number, contribution: TickNodeContribution): void {
        const acc = this.getOrCreateAccumulator(nodeId);

        if (contribution.cpuCount > 0) {
            this._totalCpuTime += contribution.cpuSum;
            const hadCpu = acc.tickCount > 0;
            acc.totalCpuTime += contribution.cpuSum;
            acc.tickCount += contribution.cpuCount;
            acc.lastCpuTime = contribution.lastCpuTime;
            if (!hadCpu) {
                acc.minCpuTime = contribution.minCpuTime;
                acc.maxCpuTime = contribution.maxCpuTime;
            } else {
                acc.minCpuTime = Math.min(acc.minCpuTime, contribution.minCpuTime);
                acc.maxCpuTime = Math.max(acc.maxCpuTime, contribution.maxCpuTime);
            }
        }

        if (contribution.selfCpuCount > 0) {
            this._totalSelfCpuTime += contribution.selfCpuSum;
            const hadSelf = acc.selfCpuCount > 0;
            acc.totalSelfCpuTime += contribution.selfCpuSum;
            acc.selfCpuCount += contribution.selfCpuCount;
            acc.lastSelfCpuTime = contribution.lastSelfCpuTime;
            if (!hadSelf) {
                acc.minSelfCpuTime = contribution.minSelfCpuTime;
                acc.maxSelfCpuTime = contribution.maxSelfCpuTime;
            } else {
                acc.minSelfCpuTime = Math.min(acc.minSelfCpuTime, contribution.minSelfCpuTime);
                acc.maxSelfCpuTime = Math.max(acc.maxSelfCpuTime, contribution.maxSelfCpuTime);
            }
        }

        if (contribution.runningCount > 0) {
            this._totalRunningTime += contribution.runningSum;
            const hadRunning = acc.runningTimeCount > 0;
            acc.totalRunningTime += contribution.runningSum;
            acc.runningTimeCount += contribution.runningCount;
            acc.lastRunningTime = contribution.lastRunningTime;
            if (!hadRunning) {
                acc.minRunningTime = contribution.minRunningTime;
                acc.maxRunningTime = contribution.maxRunningTime;
            } else {
                acc.minRunningTime = Math.min(acc.minRunningTime, contribution.minRunningTime);
                acc.maxRunningTime = Math.max(acc.maxRunningTime, contribution.maxRunningTime);
            }
        }

        acc.version++;
    }

    private removeContribution(nodeId: number, contribution: TickNodeContribution): void {
        const acc = this.accumulators.get(nodeId);
        if (!acc) return;

        if (contribution.cpuCount > 0) {
            this._totalCpuTime -= contribution.cpuSum;
            acc.totalCpuTime -= contribution.cpuSum;
            acc.tickCount = Math.max(0, acc.tickCount - contribution.cpuCount);
            if (
                acc.tickCount > 0
                && (contribution.minCpuTime <= acc.minCpuTime || contribution.maxCpuTime >= acc.maxCpuTime)
            ) {
                this.markDirtyMinMax(acc);
            }
        }

        if (contribution.selfCpuCount > 0) {
            this._totalSelfCpuTime -= contribution.selfCpuSum;
            acc.totalSelfCpuTime -= contribution.selfCpuSum;
            acc.selfCpuCount = Math.max(0, acc.selfCpuCount - contribution.selfCpuCount);
            if (
                acc.selfCpuCount > 0
                && (contribution.minSelfCpuTime <= acc.minSelfCpuTime || contribution.maxSelfCpuTime >= acc.maxSelfCpuTime)
            ) {
                this.markDirtyMinMax(acc);
            }
        }

        if (contribution.runningCount > 0) {
            this._totalRunningTime -= contribution.runningSum;
            acc.totalRunningTime -= contribution.runningSum;
            acc.runningTimeCount = Math.max(0, acc.runningTimeCount - contribution.runningCount);
            if (
                acc.runningTimeCount > 0
                && (contribution.minRunningTime <= acc.minRunningTime || contribution.maxRunningTime >= acc.maxRunningTime)
            ) {
                this.markDirtyMinMax(acc);
            }
        }

        if (acc.tickCount === 0) {
            this.deleteNode(nodeId);
            return;
        }

        if (acc.selfCpuCount === 0) {
            acc.minSelfCpuTime = 0;
            acc.maxSelfCpuTime = 0;
            acc.lastSelfCpuTime = 0;
        }
        if (acc.runningTimeCount === 0) {
            acc.minRunningTime = Number.MAX_VALUE;
            acc.maxRunningTime = 0;
            acc.lastRunningTime = 0;
        }

        acc.version++;
    }

    private markDirtyMinMax(acc: NodeAccumulator): void {
        if (acc.dirtyMinMax) return;
        acc.dirtyMinMax = true;
        this.dirtyMinMaxNodeIds.add(acc.nodeId);
    }

    private repairDirtyNodes(limit: number): void {
        if (limit <= 0 || this.dirtyMinMaxNodeIds.size === 0) return;

        let repaired = 0;
        for (const nodeId of this.dirtyMinMaxNodeIds) {
            this.repairNodeMinMax(nodeId);
            repaired++;
            if (repaired >= limit) {
                return;
            }
        }
    }

    private repairNodeMinMax(nodeId: number): void {
        const acc = this.accumulators.get(nodeId);
        if (!acc || !acc.dirtyMinMax) return;

        let cpuMin = Number.MAX_VALUE;
        let cpuMax = 0;
        let selfMin = Number.MAX_VALUE;
        let selfMax = 0;
        let runningMin = Number.MAX_VALUE;
        let runningMax = 0;

        for (const contributionByNode of this.tickContribByTick.values()) {
            const contribution = contributionByNode.get(nodeId);
            if (!contribution) continue;

            if (contribution.cpuCount > 0) {
                cpuMin = Math.min(cpuMin, contribution.minCpuTime);
                cpuMax = Math.max(cpuMax, contribution.maxCpuTime);
            }
            if (contribution.selfCpuCount > 0) {
                selfMin = Math.min(selfMin, contribution.minSelfCpuTime);
                selfMax = Math.max(selfMax, contribution.maxSelfCpuTime);
            }
            if (contribution.runningCount > 0) {
                runningMin = Math.min(runningMin, contribution.minRunningTime);
                runningMax = Math.max(runningMax, contribution.maxRunningTime);
            }
        }

        acc.minCpuTime = cpuMin === Number.MAX_VALUE ? 0 : cpuMin;
        acc.maxCpuTime = cpuMax;
        acc.minSelfCpuTime = selfMin === Number.MAX_VALUE ? 0 : selfMin;
        acc.maxSelfCpuTime = selfMax;
        acc.minRunningTime = runningMin;
        acc.maxRunningTime = runningMax;
        acc.dirtyMinMax = false;
        this.dirtyMinMaxNodeIds.delete(nodeId);
    }

    private buildNodeData(acc: NodeAccumulator): NodeProfilingData {
        const percentiles = this.getCachedPercentiles(acc.nodeId, acc.version);
        return {
            nodeId: acc.nodeId,
            totalCpuTime: acc.totalCpuTime,
            tickCount: acc.tickCount,
            minCpuTime: acc.minCpuTime,
            maxCpuTime: acc.maxCpuTime,
            lastCpuTime: acc.lastCpuTime,
            totalSelfCpuTime: acc.totalSelfCpuTime,
            minSelfCpuTime: acc.minSelfCpuTime,
            maxSelfCpuTime: acc.maxSelfCpuTime,
            lastSelfCpuTime: acc.lastSelfCpuTime,
            cpuP50: percentiles.p50,
            cpuP95: percentiles.p95,
            cpuP99: percentiles.p99,
            totalRunningTime: acc.totalRunningTime,
            runningTimeCount: acc.runningTimeCount,
            minRunningTime: acc.minRunningTime,
            maxRunningTime: acc.maxRunningTime,
            lastRunningTime: acc.lastRunningTime,
        };
    }

    private getCachedPercentiles(nodeId: number, version: number): PercentileCache {
        const cached = this.percentileCacheByNode.get(nodeId);
        if (cached && cached.version === version) {
            return cached;
        }

        const window = this.percentileWindowsByNode.get(nodeId);
        if (!window || window.samples.length === 0) {
            const empty: PercentileCache = { version, p50: 0, p95: 0, p99: 0 };
            this.percentileCacheByNode.set(nodeId, empty);
            return empty;
        }

        const sorted = [...window.samples].sort((a, b) => a - b);
        const next: PercentileCache = {
            version,
            p50: this.getPercentile(sorted, 0.5),
            p95: this.getPercentile(sorted, 0.95),
            p99: this.getPercentile(sorted, 0.99),
        };
        this.percentileCacheByNode.set(nodeId, next);
        return next;
    }

    private pushPercentileCpuSample(nodeId: number, sample: number): void {
        let window = this.percentileWindowsByNode.get(nodeId);
        if (!window) {
            window = { samples: [], nextIndex: 0 };
            this.percentileWindowsByNode.set(nodeId, window);
        }

        if (window.samples.length < this.percentileSampleCap) {
            window.samples.push(sample);
            return;
        }

        window.samples[window.nextIndex] = sample;
        window.nextIndex = (window.nextIndex + 1) % this.percentileSampleCap;
    }

    private deleteNode(nodeId: number): void {
        this.accumulators.delete(nodeId);
        this.dirtyMinMaxNodeIds.delete(nodeId);
        this.percentileWindowsByNode.delete(nodeId);
        this.percentileCacheByNode.delete(nodeId);
    }

    private groupSelfCpuSamplesFromTimedEvents(timedEvents: TimedEvent[]): Map<number, number[]> {
        if (timedEvents.length === 0) {
            return new Map<number, number[]>();
        }
        const sortedEvents = timedEvents
            .map((event) => ({ ...event }))
            .sort((a, b) => (a.startedAt - b.startedAt) || (b.finishedAt - a.finishedAt));

        const stack: TimedEvent[] = [];
        for (const event of sortedEvents) {
            while (stack.length > 0 && event.startedAt >= stack[stack.length - 1]!.finishedAt) {
                stack.pop();
            }
            while (stack.length > 0 && event.finishedAt > stack[stack.length - 1]!.finishedAt) {
                stack.pop();
            }
            const parent = stack[stack.length - 1];
            if (parent) {
                parent.childInclusiveTime += event.inclusiveTime;
            }
            stack.push(event);
        }

        const result = new Map<number, number[]>();
        for (const event of sortedEvents) {
            const selfTime = Math.max(0, event.inclusiveTime - event.childInclusiveTime);
            const list = result.get(event.nodeId);
            if (list) {
                list.push(selfTime);
            } else {
                result.set(event.nodeId, [selfTime]);
            }
        }
        return result;
    }

    private getPercentile(sortedSamples: number[], quantile: number): number {
        if (sortedSamples.length === 0) return 0;
        const idx = Math.min(
            sortedSamples.length - 1,
            Math.max(0, Math.ceil(quantile * sortedSamples.length) - 1),
        );
        return sortedSamples[idx]!;
    }
}
