import { describe, it, expect } from "vitest";
import { NodeResult, TickTraceEvent, TickRecord } from "../base/types";
import { TickStore } from "./tick-store";

function makeRecord(tickId: number, nodeIds: number[] = [1, 2, 3]): TickRecord {
    const events = nodeIds.map((nodeId, i) => ({
        tickId,
        nodeId,
        timestamp: tickId * 1000,
        result: NodeResult.Succeeded,
        startedAt: i * 10,
        finishedAt: i * 10 + 5,
    }));
    return { tickId, timestamp: tickId * 1000, events, refEvents: [] };
}

describe("TickStore", () => {
    it("stores and retrieves tick records", () => {
        const store = new TickStore(100);
        store.push(makeRecord(1));
        store.push(makeRecord(2));

        expect(store.size).toBe(2);
        expect(store.hasTick(1)).toBe(true);
        expect(store.hasTick(2)).toBe(true);
        expect(store.hasTick(3)).toBe(false);
    });

    it("returns undefined for empty events", () => {
        const store = new TickStore(100);
        const evicted = store.push({ tickId: 0, timestamp: 0, events: [], refEvents: [] });
        expect(evicted).toBeUndefined();
        expect(store.size).toBe(0);
    });

    it("ignores duplicate or older ticks", () => {
        const store = new TickStore(100);
        store.push(makeRecord(5));

        const evicted1 = store.push(makeRecord(5)); // duplicate
        expect(evicted1).toBeUndefined();
        expect(store.size).toBe(1);
        expect(store.newestTickId).toBe(5);

        const evicted2 = store.push(makeRecord(4)); // older
        expect(evicted2).toBeUndefined();
        expect(store.size).toBe(1);
        expect(store.newestTickId).toBe(5);
    });

    it("returns evicted record when buffer is full", () => {
        const store = new TickStore(3);
        store.push(makeRecord(1));
        store.push(makeRecord(2));
        store.push(makeRecord(3));

        // Buffer is now full, next push evicts tick 1
        const evicted = store.push(makeRecord(4));
        expect(evicted).toBeDefined();
        expect(evicted!.tickId).toBe(1);
        expect(store.hasTick(1)).toBe(false);
        expect(store.hasTick(4)).toBe(true);
        expect(store.size).toBe(3);
    });

    it("tracks oldest and newest tick ids", () => {
        const store = new TickStore(3);
        expect(store.oldestTickId).toBeUndefined();
        expect(store.newestTickId).toBeUndefined();

        store.push(makeRecord(5));
        store.push(makeRecord(10));
        expect(store.oldestTickId).toBe(5);
        expect(store.newestTickId).toBe(10);

        store.push(makeRecord(15));
        store.push(makeRecord(20)); // evicts 5
        expect(store.oldestTickId).toBe(10);
        expect(store.newestTickId).toBe(20);
    });

    it("getSnapshotAtTick reconstructs per-node state", () => {
        const store = new TickStore(100);
        const events: TickTraceEvent[] = [
            { tickId: 1, nodeId: 10, timestamp: 1000, result: NodeResult.Running, state: { hp: 50 }, startedAt: 0, finishedAt: 5 },
            { tickId: 1, nodeId: 20, timestamp: 1000, result: NodeResult.Succeeded, startedAt: 5, finishedAt: 8 },
        ];
        store.push({ tickId: 1, timestamp: 1000, events, refEvents: [] });

        const snapshot = store.getSnapshotAtTick(1);
        expect(snapshot).toBeDefined();
        expect(snapshot!.tickId).toBe(1);
        expect(snapshot!.timestamp).toBe(1000);
        expect(snapshot!.nodes.size).toBe(2);
        expect(snapshot!.nodes.get(10)!.result).toBe(NodeResult.Running);
        expect(snapshot!.nodes.get(10)!.state).toEqual({ hp: 50 });
        expect(snapshot!.nodes.get(20)!.result).toBe(NodeResult.Succeeded);
    });

    it("getSnapshotAtTick returns undefined for unknown tick", () => {
        const store = new TickStore(100);
        expect(store.getSnapshotAtTick(999)).toBeUndefined();
    });

    it("getNodeHistory returns events for a node across ticks", () => {
        const store = new TickStore(100);
        store.push({
            tickId: 1, timestamp: 1000, refEvents: [], events: [
                { tickId: 1, nodeId: 5, timestamp: 1000, result: NodeResult.Running },
                { tickId: 1, nodeId: 6, timestamp: 1000, result: NodeResult.Failed },
            ]
        });
        store.push({
            tickId: 2, timestamp: 2000, refEvents: [], events: [
                { tickId: 2, nodeId: 5, timestamp: 2000, result: NodeResult.Succeeded },
                { tickId: 2, nodeId: 6, timestamp: 2000, result: NodeResult.Running },
            ]
        });

        const history = store.getNodeHistory(5);
        expect(history).toHaveLength(2);
        expect(history[0].tickId).toBe(1);
        expect(history[0].result).toBe(NodeResult.Running);
        expect(history[1].tickId).toBe(2);
        expect(history[1].result).toBe(NodeResult.Succeeded);
    });

    it("getLastNodeState returns most recent known state", () => {
        const store = new TickStore(100);
        store.push({
            tickId: 1,
            timestamp: 1000,
            refEvents: [],
            events: [
                { tickId: 1, nodeId: 5, timestamp: 1000, result: NodeResult.Running, state: { cooldown: 300 } },
            ],
        });
        store.push({
            tickId: 2,
            timestamp: 2000,
            refEvents: [],
            events: [
                { tickId: 2, nodeId: 6, timestamp: 2000, result: NodeResult.Succeeded },
            ],
        });
        store.push({
            tickId: 3,
            timestamp: 3000,
            refEvents: [],
            events: [
                { tickId: 3, nodeId: 5, timestamp: 3000, result: NodeResult.Failed, state: { cooldown: 120 } },
            ],
        });

        expect(store.getLastNodeState(5)).toEqual({ cooldown: 120 });
        expect(store.getLastNodeState(5, 2)).toEqual({ cooldown: 300 });
        expect(store.getLastNodeState(999)).toBeUndefined();
    });

    it("getStoredTickIds returns ids in insertion order", () => {
        const store = new TickStore(100);
        store.push(makeRecord(3));
        store.push(makeRecord(7));
        store.push(makeRecord(11));

        expect(store.getStoredTickIds()).toEqual([3, 7, 11]);
    });

    it("getTickRange filters by tick id range", () => {
        const store = new TickStore(100);
        for (let i = 1; i <= 10; i++) {
            store.push(makeRecord(i));
        }

        const range = store.getTickRange(3, 6);
        expect(range.map(r => r.tickId)).toEqual([3, 4, 5, 6]);
    });

    it("clear removes all data", () => {
        const store = new TickStore(100);
        store.push(makeRecord(1));
        store.push(makeRecord(2));

        store.clear();
        expect(store.size).toBe(0);
        expect(store.hasTick(1)).toBe(false);
        expect(store.oldestTickId).toBeUndefined();
    });

    it("eviction cascade keeps secondary index in sync", () => {
        const store = new TickStore(2);
        store.push(makeRecord(1));
        store.push(makeRecord(2));
        store.push(makeRecord(3)); // evicts 1
        store.push(makeRecord(4)); // evicts 2

        expect(store.hasTick(1)).toBe(false);
        expect(store.hasTick(2)).toBe(false);
        expect(store.hasTick(3)).toBe(true);
        expect(store.hasTick(4)).toBe(true);
        expect(store.getByTickId(1)).toBeUndefined();
        expect(store.getByTickId(3)).toBeDefined();
    });
});
