import { describe, it, expect } from "vitest";
import { NodeResult, NodeFlags, SerializableNode, TickTraceEvent, TickRecord } from "../base/types";
import { TreeInspector } from "./tree-inspector";

function makeTree(): SerializableNode {
    return {
        id: 1,
        nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
        defaultName: "Root",
        name: "",
        children: [
            {
                id: 2,
                nodeFlags: NodeFlags.Decorator,
                defaultName: "Dec",
                name: "",
                children: [
                    {
                        id: 3,
                        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                        defaultName: "Attack",
                        name: "",
                        tags: ["combat"],
                    },
                ],
            },
            {
                id: 4,
                nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                defaultName: "Idle",
                name: "",
            },
        ],
    };
}

function makeTickRecord(tickId: number, timings: Array<{ nodeId: number; start: number; end: number; result?: NodeResult }>): TickRecord {
    const events: TickTraceEvent[] = timings.map(t => ({
        tickId,
        nodeId: t.nodeId,
        timestamp: tickId * 1000,
        result: t.result ?? NodeResult.Succeeded,
        startedAt: t.start,
        finishedAt: t.end,
    }));
    return { tickId, timestamp: tickId * 1000, events, refEvents: [] };
}

describe("TreeInspector", () => {
    it("indexes tree and exposes tree index", () => {
        const inspector = new TreeInspector();
        inspector.indexTree(makeTree());

        expect(inspector.tree).toBeDefined();
        expect(inspector.tree!.size).toBe(4);
        expect(inspector.tree!.getById(1)!.defaultName).toBe("Root");
    });

    it("ingests ticks and retrieves snapshots", () => {
        const inspector = new TreeInspector();
        inspector.indexTree(makeTree());

        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 100 },
            { nodeId: 2, start: 10, end: 80, result: NodeResult.Running },
            { nodeId: 3, start: 20, end: 60 },
        ]));

        const snapshot = inspector.getSnapshotAtTick(1);
        expect(snapshot).toBeDefined();
        expect(snapshot!.nodes.size).toBe(3);
        expect(snapshot!.nodes.get(2)!.result).toBe(NodeResult.Running);
    });

    it("getLatestSnapshot returns most recent tick", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));
        inspector.ingestTick(makeTickRecord(2, [{ nodeId: 1, start: 0, end: 20 }]));

        const latest = inspector.getLatestSnapshot();
        expect(latest!.tickId).toBe(2);
    });

    it("getNodeAtTick returns single node snapshot", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 10, result: NodeResult.Running },
            { nodeId: 2, start: 5, end: 8, result: NodeResult.Succeeded },
        ]));

        const node = inspector.getNodeAtTick(2, 1);
        expect(node).toBeDefined();
        expect(node!.result).toBe(NodeResult.Succeeded);

        expect(inspector.getNodeAtTick(999, 1)).toBeUndefined();
    });

    it("getNodeHistory collects events across ticks", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 10, result: NodeResult.Running },
        ]));
        inspector.ingestTick(makeTickRecord(2, [
            { nodeId: 1, start: 0, end: 15, result: NodeResult.Succeeded },
        ]));

        const history = inspector.getNodeHistory(1);
        expect(history).toHaveLength(2);
        expect(history[0].result).toBe(NodeResult.Running);
        expect(history[1].result).toBe(NodeResult.Succeeded);
    });

    it("getLastDisplayState returns latest state without changing result snapshot semantics", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick({
            tickId: 1,
            timestamp: 1000,
            refEvents: [],
            events: [
                { tickId: 1, nodeId: 2, timestamp: 1000, result: NodeResult.Running, state: { remainingCooldown: 50 } },
            ],
        });
        inspector.ingestTick({
            tickId: 2,
            timestamp: 2000,
            refEvents: [],
            events: [
                { tickId: 2, nodeId: 3, timestamp: 2000, result: NodeResult.Succeeded },
            ],
        });

        expect(inspector.getNodeAtTick(2, 2)).toBeUndefined();
        expect(inspector.getLastDisplayState(2, 2)).toEqual({ remainingCooldown: 50 });
    });

    it("getNodeResultSummary counts results", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 10, result: NodeResult.Running },
        ]));
        inspector.ingestTick(makeTickRecord(2, [
            { nodeId: 1, start: 0, end: 10, result: NodeResult.Running },
        ]));
        inspector.ingestTick(makeTickRecord(3, [
            { nodeId: 1, start: 0, end: 10, result: NodeResult.Succeeded },
        ]));

        const summary = inspector.getNodeResultSummary(1);
        expect(summary.get(NodeResult.Running)).toBe(2);
        expect(summary.get(NodeResult.Succeeded)).toBe(1);
        expect(summary.get(NodeResult.Failed)).toBeUndefined();
    });

    it("getStoredTickIds and getTickRange", () => {
        const inspector = new TreeInspector();
        for (let i = 1; i <= 5; i++) {
            inspector.ingestTick(makeTickRecord(i, [{ nodeId: 1, start: 0, end: 10 }]));
        }

        expect(inspector.getStoredTickIds()).toEqual([1, 2, 3, 4, 5]);
        expect(inspector.getTickRange(2, 4).map(r => r.tickId)).toEqual([2, 3, 4]);
    });

    it("profiling data accumulates via ingestTick", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));
        inspector.ingestTick(makeTickRecord(2, [{ nodeId: 1, start: 0, end: 20 }]));

        const data = inspector.getNodeProfilingData(1);
        expect(data).toBeDefined();
        expect(data!.totalCpuTime).toBe(30);
        expect(data!.tickCount).toBe(2);
    });

    it("profiling syncs eviction when buffer overflows", () => {
        const inspector = new TreeInspector({ maxTicks: 2 });
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));
        inspector.ingestTick(makeTickRecord(2, [{ nodeId: 1, start: 0, end: 20 }]));
        inspector.ingestTick(makeTickRecord(3, [{ nodeId: 1, start: 0, end: 30 }]));

        // Tick 1 was evicted, profiling should reflect ticks 2 and 3 only
        const data = inspector.getNodeProfilingData(1)!;
        expect(data.totalCpuTime).toBe(50);
        expect(data.tickCount).toBe(2);
    });

    it("getHotNodes returns sorted profiling data", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 5 },
            { nodeId: 2, start: 0, end: 15 },
            { nodeId: 3, start: 0, end: 10 },
        ]));

        const hot = inspector.getHotNodes();
        expect(hot.map(n => n.nodeId)).toEqual([2, 3, 1]);
    });

    it("getFlameGraphFrames builds from tree + tick events", () => {
        const inspector = new TreeInspector();
        inspector.indexTree(makeTree());
        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 100 },
            { nodeId: 2, start: 10, end: 80 },
            { nodeId: 3, start: 20, end: 60 },
            { nodeId: 4, start: 80, end: 95 },
        ]));

        const frames = inspector.getFlameGraphFrames(1);
        expect(frames).toHaveLength(1);
        expect(frames[0].nodeId).toBe(1);
        expect(frames[0].selfTime).toBe(15);
        expect(frames[0].children).toHaveLength(2);
    });

    it("getFlameGraphFrames returns empty when no tree indexed", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));

        expect(inspector.getFlameGraphFrames(1)).toEqual([]);
    });

    it("getStats returns aggregate statistics", () => {
        const inspector = new TreeInspector({ maxTicks: 3 });
        inspector.indexTree(makeTree());

        for (let i = 1; i <= 5; i++) {
            inspector.ingestTick(makeTickRecord(i, [{ nodeId: 1, start: 0, end: 10 }]));
        }

        const stats = inspector.getStats();
        expect(stats.nodeCount).toBe(4);
        expect(stats.storedTickCount).toBe(3);
        expect(stats.totalTickCount).toBe(5);
        expect(stats.oldestTickId).toBe(3);
        expect(stats.newestTickId).toBe(5);
        expect(stats.totalRootCpuTime).toBe(30);
        expect(stats.profilingWindowStart).toBe(0);
        expect(stats.profilingWindowEnd).toBe(10);
        expect(stats.profilingWindowSpan).toBe(10);
    });

    it("tracks root cpu totals and subtracts evicted contributions", () => {
        const inspector = new TreeInspector({ maxTicks: 2 });
        inspector.indexTree(makeTree());

        inspector.ingestTick(makeTickRecord(1, [
            { nodeId: 1, start: 0, end: 50 },
            { nodeId: 2, start: 10, end: 30 },
        ]));
        inspector.ingestTick(makeTickRecord(2, [
            { nodeId: 1, start: 0, end: 80 },
            { nodeId: 4, start: 10, end: 20 },
        ]));
        expect(inspector.getStats().totalRootCpuTime).toBe(130);

        inspector.ingestTick(makeTickRecord(3, [
            { nodeId: 1, start: 0, end: 20 },
            { nodeId: 2, start: 5, end: 10 },
        ]));

        // Tick 1 was evicted, so root total should be tick2 + tick3
        expect(inspector.getStats().totalRootCpuTime).toBe(100);
    });

    it("profiling window uses timestamp fallback when oldest/newest ticks have no timings", () => {
        const inspector = new TreeInspector({ maxTicks: 3 });
        inspector.indexTree(makeTree());

        inspector.ingestTick({
            tickId: 1,
            timestamp: 1000,
            refEvents: [],
            events: [{ tickId: 1, nodeId: 1, timestamp: 1000, result: NodeResult.Succeeded }],
        });
        inspector.ingestTick(makeTickRecord(2, [{ nodeId: 1, start: 10, end: 20 }]));
        inspector.ingestTick({
            tickId: 3,
            timestamp: 1800,
            refEvents: [],
            events: [{ tickId: 3, nodeId: 1, timestamp: 1800, result: NodeResult.Succeeded }],
        });

        const stats = inspector.getStats();
        expect(stats.profilingWindowStart).toBe(1000);
        expect(stats.profilingWindowEnd).toBe(1800);
        expect(stats.profilingWindowSpan).toBe(800);
    });

    it("clearTicks preserves tree index", () => {
        const inspector = new TreeInspector();
        inspector.indexTree(makeTree());
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));

        inspector.clearTicks();

        expect(inspector.tree).toBeDefined();
        expect(inspector.tree!.size).toBe(4);
        expect(inspector.getStoredTickIds()).toEqual([]);
        expect(inspector.getStats().storedTickCount).toBe(0);
        expect(inspector.getStats().totalTickCount).toBe(0);
    });

    it("reset clears everything", () => {
        const inspector = new TreeInspector();
        inspector.indexTree(makeTree());
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));

        inspector.reset();

        expect(inspector.tree).toBeUndefined();
        expect(inspector.getStoredTickIds()).toEqual([]);
    });

    it("ignores empty event arrays", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick({ tickId: 0, timestamp: 0, events: [], refEvents: [] });
        expect(inspector.getStats().totalTickCount).toBe(0);
    });

    it("ignores duplicate or older ticks completely", () => {
        const inspector = new TreeInspector();
        inspector.ingestTick(makeTickRecord(5, [{ nodeId: 1, start: 0, end: 10 }]));
        expect(inspector.getStats().totalTickCount).toBe(1);

        inspector.ingestTick(makeTickRecord(5, [{ nodeId: 1, start: 0, end: 10 }])); // duplicate
        expect(inspector.getStats().totalTickCount).toBe(1);

        inspector.ingestTick(makeTickRecord(4, [{ nodeId: 1, start: 0, end: 10 }])); // older
        expect(inspector.getStats().totalTickCount).toBe(1);
    });

    it("cloneForTimeTravel snapshots current inspector state without replay coupling", () => {
        const inspector = new TreeInspector({ maxTicks: 3 });
        inspector.indexTree(makeTree());
        inspector.ingestTick(makeTickRecord(1, [{ nodeId: 1, start: 0, end: 10 }]));
        inspector.ingestTick(makeTickRecord(2, [{ nodeId: 1, start: 0, end: 20 }]));
        inspector.ingestTick(makeTickRecord(3, [{ nodeId: 1, start: 0, end: 30 }]));

        const cloned = inspector.cloneForTimeTravel();
        expect(cloned.getStoredTickIds()).toEqual([1, 2, 3]);
        expect(cloned.getNodeProfilingData(1)!.totalCpuTime).toBe(60);
        expect(cloned.getStats().totalRootCpuTime).toBe(60);

        inspector.ingestTick(makeTickRecord(4, [{ nodeId: 1, start: 0, end: 40 }]));
        expect(inspector.getStoredTickIds()).toEqual([2, 3, 4]);
        expect(inspector.getNodeProfilingData(1)!.totalCpuTime).toBe(90);

        // Frozen copy should remain unchanged after live inspector advances.
        expect(cloned.getStoredTickIds()).toEqual([1, 2, 3]);
        expect(cloned.getNodeProfilingData(1)!.totalCpuTime).toBe(60);
        expect(cloned.getStats().totalRootCpuTime).toBe(60);
    });
});
