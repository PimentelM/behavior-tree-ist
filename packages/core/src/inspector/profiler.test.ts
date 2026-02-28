import { describe, it, expect } from "vitest";
import { NodeResult, NodeFlags, TickTraceEvent, SerializableNode } from "../base/types";
import { Profiler } from "./profiler";
import { TreeIndex } from "./tree-index";

function makeEvents(tickId: number, timings: Array<{ nodeId: number; start: number; end: number }>): TickTraceEvent[] {
    return timings.map(t => ({
        tickId,
        nodeId: t.nodeId,
        timestamp: tickId * 1000,
        result: NodeResult.Succeeded,
        startedAt: t.start,
        finishedAt: t.end,
    }));
}

describe("Profiler", () => {
    it("accumulates timing data from ticks", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [
            { nodeId: 1, start: 0, end: 10 },
            { nodeId: 2, start: 2, end: 5 },
        ]));

        expect(profiler.tickCount).toBe(1);
        expect(profiler.totalCpuTime).toBe(13);

        const node1 = profiler.getNodeData(1);
        expect(node1).toBeDefined();
        expect(node1!.totalCpuTime).toBe(10);
        expect(node1!.tickCount).toBe(1);
        expect(node1!.minCpuTime).toBe(10);
        expect(node1!.maxCpuTime).toBe(10);
    });

    it("accumulates across multiple ticks", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [
            { nodeId: 1, start: 0, end: 10 },
        ]));
        profiler.ingestTick(makeEvents(2, [
            { nodeId: 1, start: 0, end: 20 },
        ]));

        const node1 = profiler.getNodeData(1)!;
        expect(node1.totalCpuTime).toBe(30);
        expect(node1.tickCount).toBe(2);
        expect(node1.minCpuTime).toBe(10);
        expect(node1.maxCpuTime).toBe(20);
        expect(node1.lastCpuTime).toBe(20);
    });

    it("ignores duplicate tick ids", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));

        expect(profiler.tickCount).toBe(1);
        expect(profiler.getNodeData(1)!.totalCpuTime).toBe(10);
    });

    it("ignores events without timing", () => {
        const profiler = new Profiler();
        profiler.ingestTick([{
            tickId: 1,
            nodeId: 1,
            timestamp: 1000,
            result: NodeResult.Succeeded,
            // no startedAt/finishedAt
        }]);

        expect(profiler.tickCount).toBe(1);
        expect(profiler.getNodeData(1)).toBeUndefined();
    });

    it("removeTick subtracts contribution", () => {
        const profiler = new Profiler();
        const tick1 = makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]);
        const tick2 = makeEvents(2, [{ nodeId: 1, start: 0, end: 20 }]);

        profiler.ingestTick(tick1);
        profiler.ingestTick(tick2);
        profiler.removeTick(tick1);

        expect(profiler.tickCount).toBe(1);
        expect(profiler.getNodeData(1)!.totalCpuTime).toBe(20);
        expect(profiler.totalCpuTime).toBe(20);
    });

    it("removeTick deletes node data when tick count reaches zero", () => {
        const profiler = new Profiler();
        const tick1 = makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]);

        profiler.ingestTick(tick1);
        profiler.removeTick(tick1);

        expect(profiler.getNodeData(1)).toBeUndefined();
    });

    it("getAverageCpuTime computes correctly", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));
        profiler.ingestTick(makeEvents(2, [{ nodeId: 1, start: 0, end: 30 }]));

        expect(profiler.getAverageCpuTime(1)).toBe(20);
        expect(profiler.getAverageCpuTime(999)).toBeUndefined();
    });

    it("tracks self cpu time for nested timed events", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [
            { nodeId: 1, start: 0, end: 100 },
            { nodeId: 2, start: 20, end: 60 },
        ]));

        const root = profiler.getNodeData(1)!;
        const child = profiler.getNodeData(2)!;
        expect(root.totalCpuTime).toBe(100);
        expect(root.totalSelfCpuTime).toBe(60);
        expect(child.totalCpuTime).toBe(40);
        expect(child.totalSelfCpuTime).toBe(40);
    });

    it("computes cpu percentiles from exact window samples", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 1 }]));
        profiler.ingestTick(makeEvents(2, [{ nodeId: 1, start: 0, end: 2 }]));
        profiler.ingestTick(makeEvents(3, [{ nodeId: 1, start: 0, end: 3 }]));
        profiler.ingestTick(makeEvents(4, [{ nodeId: 1, start: 0, end: 4 }]));
        profiler.ingestTick(makeEvents(5, [{ nodeId: 1, start: 0, end: 100 }]));

        const node = profiler.getNodeData(1)!;
        expect(node.cpuP50).toBe(3);
        expect(node.cpuP95).toBe(100);
        expect(node.cpuP99).toBe(100);
        expect(node.selfCpuP50).toBe(3);
        expect(node.selfCpuP95).toBe(100);
        expect(node.selfCpuP99).toBe(100);
    });

    it("computes self cpu percentiles independently from cpu percentiles", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 100 }, { nodeId: 2, start: 0, end: 99 }]));
        profiler.ingestTick(makeEvents(2, [{ nodeId: 1, start: 0, end: 100 }, { nodeId: 2, start: 0, end: 98 }]));
        profiler.ingestTick(makeEvents(3, [{ nodeId: 1, start: 0, end: 100 }, { nodeId: 2, start: 0, end: 97 }]));
        profiler.ingestTick(makeEvents(4, [{ nodeId: 1, start: 0, end: 100 }, { nodeId: 2, start: 0, end: 96 }]));
        profiler.ingestTick(makeEvents(5, [{ nodeId: 1, start: 0, end: 100 }, { nodeId: 2, start: 0, end: 95 }]));

        const root = profiler.getNodeData(1)!;
        expect(root.cpuP50).toBe(100);
        expect(root.cpuP95).toBe(100);
        expect(root.cpuP99).toBe(100);
        expect(root.selfCpuP50).toBe(3);
        expect(root.selfCpuP95).toBe(5);
        expect(root.selfCpuP99).toBe(5);
    });

    it("can recompute exact percentiles from provided tick events", () => {
        const profiler = new Profiler();
        const tick1 = makeEvents(1, [{ nodeId: 1, start: 0, end: 100 }]);
        const tick2 = makeEvents(2, [{ nodeId: 1, start: 0, end: 1 }]);
        const tick3 = makeEvents(3, [{ nodeId: 1, start: 0, end: 2 }]);
        profiler.ingestTick(tick1);
        profiler.ingestTick(tick2);
        profiler.ingestTick(tick3);
        profiler.removeTick(tick1);

        const sampledData = profiler.getNodeData(1)!;
        expect(sampledData.tickCount).toBe(2);
        expect(sampledData.cpuP95).toBe(100);

        profiler.recomputeExactPercentilesFromTickEvents([tick2, tick3]);
        const exactData = profiler.getNodeData(1)!;
        expect(exactData.cpuP50).toBe(1);
        expect(exactData.cpuP95).toBe(2);
        expect(exactData.cpuP99).toBe(2);

        // Any further mutation should invalidate exact caches and return to sampled mode.
        profiler.ingestTick(makeEvents(4, [{ nodeId: 1, start: 0, end: 3 }]));
        const backToSampled = profiler.getNodeData(1)!;
        expect(backToSampled.cpuP95).toBe(100);
    });

    it("updates cpu and self min/max exactly after eviction", () => {
        const profiler = new Profiler();
        const tick1 = makeEvents(1, [{ nodeId: 1, start: 0, end: 5 }]);
        const tick2 = makeEvents(2, [{ nodeId: 1, start: 0, end: 10 }]);
        const tick3 = makeEvents(3, [{ nodeId: 1, start: 0, end: 20 }]);

        profiler.ingestTick(tick1);
        profiler.ingestTick(tick2);
        profiler.ingestTick(tick3);
        profiler.removeTick(tick1);

        const node = profiler.getNodeData(1)!;
        expect(node.minCpuTime).toBe(10);
        expect(node.maxCpuTime).toBe(20);
        expect(node.minSelfCpuTime).toBe(10);
        expect(node.maxSelfCpuTime).toBe(20);
    });

    it("getHotNodes returns sorted by total cpu time", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [
            { nodeId: 1, start: 0, end: 5 },
            { nodeId: 2, start: 0, end: 15 },
            { nodeId: 3, start: 0, end: 10 },
        ]));

        const hot = profiler.getHotNodes();
        expect(hot.map(n => n.nodeId)).toEqual([2, 3, 1]);
    });

    it("buildTickTimeline returns sorted entries", () => {
        const events = makeEvents(1, [
            { nodeId: 3, start: 20, end: 30 },
            { nodeId: 1, start: 0, end: 10 },
            { nodeId: 2, start: 5, end: 15 },
        ]);

        const timeline = Profiler.buildTickTimeline(events);
        expect(timeline.map(e => e.nodeId)).toEqual([1, 2, 3]);
    });

    it("clear resets all state", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));

        profiler.clear();

        expect(profiler.tickCount).toBe(0);
        expect(profiler.totalCpuTime).toBe(0);
        expect(profiler.getNodeData(1)).toBeUndefined();
    });

    it("clone preserves state and stays isolated from further updates", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));
        profiler.ingestTick(makeEvents(2, [{ nodeId: 1, start: 0, end: 20 }]));

        const cloned = profiler.clone();
        expect(cloned.tickCount).toBe(2);
        expect(cloned.totalCpuTime).toBe(30);
        expect(cloned.getNodeData(1)!.totalCpuTime).toBe(30);

        profiler.ingestTick(makeEvents(3, [{ nodeId: 1, start: 0, end: 40 }]));
        expect(profiler.tickCount).toBe(3);
        expect(profiler.totalCpuTime).toBe(70);
        expect(cloned.tickCount).toBe(2);
        expect(cloned.totalCpuTime).toBe(30);
        expect(cloned.getNodeData(1)!.totalCpuTime).toBe(30);
    });

    describe("runningTime (duration spans)", () => {
        it("records single-tick duration correctly", () => {
            const profiler = new Profiler();
            profiler.ingestTick(makeEvents(1, [
                { nodeId: 1, start: 100, end: 110 }
            ]));

            const data = profiler.getNodeData(1)!;
            expect(data.totalRunningTime).toBe(10);
            expect(data.runningTimeCount).toBe(1);
        });

        it("updates running min/max exactly after eviction", () => {
            const profiler = new Profiler();
            const tick1 = makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]);
            const tick2 = makeEvents(2, [{ nodeId: 1, start: 0, end: 30 }]);

            profiler.ingestTick(tick1);
            profiler.ingestTick(tick2);
            profiler.removeTick(tick1);

            const data = profiler.getNodeData(1)!;
            expect(data.minRunningTime).toBe(30);
            expect(data.maxRunningTime).toBe(30);
        });

        it("spans duration correctly across multiple running ticks", () => {
            const profiler = new Profiler();
            // Tick 1: node 1 returns Running
            profiler.ingestTick([{
                tickId: 1,
                nodeId: 1,
                timestamp: 1000,
                result: NodeResult.Running,
                startedAt: 1000,
                finishedAt: 1005,
            }]);

            // Tick 2: node 1 still returns Running
            profiler.ingestTick([{
                tickId: 2,
                nodeId: 1,
                timestamp: 1500,
                result: NodeResult.Running,
                startedAt: 1500,
                finishedAt: 1502,
            }]);

            // Tick 3: node 1 finishes Succeeded
            profiler.ingestTick([{
                tickId: 3,
                nodeId: 1,
                timestamp: 2000,
                result: NodeResult.Succeeded,
                startedAt: 2000,
                finishedAt: 2010, // The async task finally completes here
            }]);

            const data = profiler.getNodeData(1)!;
            // totalCpuTime = (1005-1000) + (1502-1500) + (2010-2000) = 5 + 2 + 10 = 17
            expect(data.totalCpuTime).toBe(17);

            // totalRunningTime = 2010 (final finishedAt) - 1000 (initial startedAt) = 1010
            expect(data.totalRunningTime).toBe(1010);
            expect(data.runningTimeCount).toBe(1);
        });

        it("handles aborted nodes without leaking tracking data", () => {
            const profiler = new Profiler();
            // Node starts running
            profiler.ingestTick([{
                tickId: 1,
                nodeId: 1,
                timestamp: 1000,
                result: NodeResult.Running,
                startedAt: 1000,
                finishedAt: 1010,
            }]);

            // Node is NOT ticked in tick 2 (e.g. branch aborted)
            profiler.ingestTick([{
                tickId: 2,
                nodeId: 2,
                timestamp: 2000,
                result: NodeResult.Succeeded,
                startedAt: 2000,
                finishedAt: 2010,
            }]);

            const data = profiler.getNodeData(1)!;
            // CPU time was recorded for the first tick
            expect(data.totalCpuTime).toBe(10);
            // But NO running time should be finalized since it never hit Succeeded/Failed
            expect(data.totalRunningTime).toBe(0);
            expect(data.runningTimeCount).toBe(0);

            // Ticking Node 1 again as a fresh execution shouldn't use the old timestamp
            profiler.ingestTick([{
                tickId: 3,
                nodeId: 1,
                timestamp: 3000,
                result: NodeResult.Succeeded,
                startedAt: 3000,
                finishedAt: 3010,
            }]);

            const newData = profiler.getNodeData(1)!;
            expect(newData.totalCpuTime).toBe(20);
            expect(newData.totalRunningTime).toBe(10); // Not 2010!
        });

        it("handles multiple spans of abortion and resumption correctly without corrupting metrics", () => {
            const profiler = new Profiler();

            // First execution span: ticks 1 to 3
            profiler.ingestTick([{ tickId: 1, nodeId: 1, timestamp: 1000, result: NodeResult.Running, startedAt: 100, finishedAt: 110 }]);
            profiler.ingestTick([{ tickId: 2, nodeId: 1, timestamp: 2000, result: NodeResult.Running, startedAt: 200, finishedAt: 220 }]);
            profiler.ingestTick([{ tickId: 3, nodeId: 1, timestamp: 3000, result: NodeResult.Running, startedAt: 300, finishedAt: 330 }]);
            // Node 1 was running with start time 100.

            // Abortion: Tick 4 drops Node 1
            profiler.ingestTick([{ tickId: 4, nodeId: 2, timestamp: 4000, result: NodeResult.Succeeded, startedAt: 400, finishedAt: 410 }]);
            // Node 1 should be swept from runningStartTimes. No running time logged yet.
            expect(profiler.getNodeData(1)!.totalRunningTime).toBe(0);
            expect(profiler.getNodeData(1)!.runningTimeCount).toBe(0);
            // cpu time is 10 + 20 + 30 = 60
            expect(profiler.getNodeData(1)!.totalCpuTime).toBe(60);

            // Second execution span: ticks 5 to 7
            profiler.ingestTick([{ tickId: 5, nodeId: 1, timestamp: 5000, result: NodeResult.Running, startedAt: 500, finishedAt: 510 }]);
            profiler.ingestTick([{ tickId: 6, nodeId: 1, timestamp: 6000, result: NodeResult.Running, startedAt: 600, finishedAt: 620 }]);

            // Tick 8 resolves Node 1! (Skipped tick 7 altogether, just to simulate time gap)
            profiler.ingestTick([{ tickId: 8, nodeId: 1, timestamp: 8000, result: NodeResult.Succeeded, startedAt: 800, finishedAt: 830 }]);

            // Assert metrics:
            const data = profiler.getNodeData(1)!;

            // New CPU time = 10 + 20 + 30 = 60
            // Total CPU time = 60 (from 1st span) + 60 (from 2nd span) = 120
            expect(data.totalCpuTime).toBe(120);

            // Running time should strictly be based on the 2nd span!
            // First span was aborted.
            // 2nd span started at tick 5 (startedAt: 500) and finished at tick 8 (finishedAt: 830)
            // 830 - 500 = 330
            expect(data.totalRunningTime).toBe(330);
            expect(data.runningTimeCount).toBe(1);
        });

        it("removes tick durations correctly during eviction", () => {
            const profiler = new Profiler();

            // Tick 1
            const tick1: TickTraceEvent[] = [{
                tickId: 1,
                nodeId: 1,
                timestamp: 1000,
                result: NodeResult.Running,
                startedAt: 100,
                finishedAt: 110,
            }];
            profiler.ingestTick(tick1);

            // Tick 2 (node finishes, resolving the duration)
            const tick2: TickTraceEvent[] = [{
                tickId: 2,
                nodeId: 1,
                timestamp: 2000,
                result: NodeResult.Succeeded,
                startedAt: 200,
                finishedAt: 210, // runningTime = 210 - 100 = 110
            }];
            profiler.ingestTick(tick2);

            expect(profiler.getNodeData(1)!.totalRunningTime).toBe(110);
            expect(profiler.getNodeData(1)!.runningTimeCount).toBe(1);

            // Evicting tick 1 shouldn't remove the duration (it was finalized in tick 2)
            profiler.removeTick(tick1);
            expect(profiler.getNodeData(1)!.totalRunningTime).toBe(110);
            expect(profiler.getNodeData(1)!.runningTimeCount).toBe(1);

            // Evicting tick 2 should remove the duration
            profiler.removeTick(tick2);
            expect(profiler.getNodeData(1)).toBeUndefined(); // Returns to 0 ticks
        });

        it("preserves duration accuracy across deep spans when intermediate running ticks are evicted", () => {
            const profiler = new Profiler();

            // Start of a long running action
            const startTick: TickTraceEvent[] = [{ tickId: 1, nodeId: 1, timestamp: 1000, result: NodeResult.Running, startedAt: 100, finishedAt: 110 }];
            profiler.ingestTick(startTick);

            // An intermediate tick that we don't hold a reference to, simulating ongoing ticks that get pushed out of a sliding window buffer
            profiler.ingestTick([{ tickId: 2, nodeId: 1, timestamp: 2000, result: NodeResult.Running, startedAt: 200, finishedAt: 210 }]);

            // Evict the intermediate running tick 2 while the node is still active
            profiler.removeTick([{ tickId: 2, nodeId: 1, timestamp: 2000, result: NodeResult.Running, startedAt: 200, finishedAt: 210 }]);

            // Also evict the original starting tick (simulating a very old tick rolling out)
            profiler.removeTick(startTick);

            // Tick 3: Finally resolves the long running action
            // Notice how startedAt continues to tick higher CPU time, but we care about the span from tick 1
            profiler.ingestTick([{ tickId: 3, nodeId: 1, timestamp: 3000, result: NodeResult.Succeeded, startedAt: 300, finishedAt: 310 }]);

            // Let's assert!
            const data = profiler.getNodeData(1)!;

            // Only tick 3 CPU time remains accumulated because tick 1 and 2 were explicitly evicted!
            expect(data.totalCpuTime).toBe(10); // 310 - 300

            // BUT! The span length must be from Tick 1's starting 100 timestamp to Tick 3's finishing 310 timestamp
            // Running duration = 310 (finish) - 100 (original start) = 210
            expect(data.totalRunningTime).toBe(210);
            expect(data.runningTimeCount).toBe(1);
            expect(profiler.totalRunningTime).toBe(210);
        });
    });
});

describe("Profiler.buildFlameGraphFrames", () => {
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

    it("builds flamegraph frames with inclusive and self time", () => {
        const treeIndex = new TreeIndex(makeTree());
        const events = makeEvents(1, [
            { nodeId: 1, start: 0, end: 100 },
            { nodeId: 2, start: 10, end: 80 },
            { nodeId: 3, start: 20, end: 60 },
            { nodeId: 4, start: 80, end: 95 },
        ]);

        const frames = Profiler.buildFlameGraphFrames(events, treeIndex);

        expect(frames).toHaveLength(1); // single root
        const root = frames[0];
        expect(root.nodeId).toBe(1);
        expect(root.inclusiveTime).toBe(100);
        // selfTime = 100 - (70 + 15) = 15
        expect(root.selfTime).toBe(15);
        expect(root.children).toHaveLength(2);

        const dec = root.children[0];
        expect(dec.nodeId).toBe(2);
        expect(dec.inclusiveTime).toBe(70);
        // selfTime = 70 - 40 = 30
        expect(dec.selfTime).toBe(30);
        expect(dec.children).toHaveLength(1);

        const attack = dec.children[0];
        expect(attack.nodeId).toBe(3);
        expect(attack.inclusiveTime).toBe(40);
        expect(attack.selfTime).toBe(40); // leaf
        expect(attack.children).toHaveLength(0);

        const idle = root.children[1];
        expect(idle.nodeId).toBe(4);
        expect(idle.inclusiveTime).toBe(15);
        expect(idle.selfTime).toBe(15); // leaf
    });

    it("handles partial tick (not all nodes ticked)", () => {
        const treeIndex = new TreeIndex(makeTree());
        // Only root and one child ticked
        const events = makeEvents(1, [
            { nodeId: 1, start: 0, end: 50 },
            { nodeId: 2, start: 5, end: 45 },
        ]);

        const frames = Profiler.buildFlameGraphFrames(events, treeIndex);
        expect(frames).toHaveLength(1);
        expect(frames[0].children).toHaveLength(1);
        expect(frames[0].children[0].nodeId).toBe(2);
        // No child 3 or 4 frames since they weren't ticked
    });
});
