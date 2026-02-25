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
        expect(profiler.totalTime).toBe(13);

        const node1 = profiler.getNodeData(1);
        expect(node1).toBeDefined();
        expect(node1!.totalTime).toBe(10);
        expect(node1!.tickCount).toBe(1);
        expect(node1!.minTime).toBe(10);
        expect(node1!.maxTime).toBe(10);
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
        expect(node1.totalTime).toBe(30);
        expect(node1.tickCount).toBe(2);
        expect(node1.minTime).toBe(10);
        expect(node1.maxTime).toBe(20);
        expect(node1.lastTime).toBe(20);
    });

    it("ignores duplicate tick ids", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));

        expect(profiler.tickCount).toBe(1);
        expect(profiler.getNodeData(1)!.totalTime).toBe(10);
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
        expect(profiler.getNodeData(1)!.totalTime).toBe(20);
        expect(profiler.totalTime).toBe(20);
    });

    it("removeTick deletes node data when tick count reaches zero", () => {
        const profiler = new Profiler();
        const tick1 = makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]);

        profiler.ingestTick(tick1);
        profiler.removeTick(tick1);

        expect(profiler.getNodeData(1)).toBeUndefined();
    });

    it("getAverageTime computes correctly", () => {
        const profiler = new Profiler();
        profiler.ingestTick(makeEvents(1, [{ nodeId: 1, start: 0, end: 10 }]));
        profiler.ingestTick(makeEvents(2, [{ nodeId: 1, start: 0, end: 30 }]));

        expect(profiler.getAverageTime(1)).toBe(20);
        expect(profiler.getAverageTime(999)).toBeUndefined();
    });

    it("getHotNodes returns sorted by total time", () => {
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
        expect(profiler.totalTime).toBe(0);
        expect(profiler.getNodeData(1)).toBeUndefined();
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
