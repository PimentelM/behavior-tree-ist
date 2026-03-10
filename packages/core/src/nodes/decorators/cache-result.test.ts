import { describe, it, expect } from "vitest";
import { CacheResult } from "./cache-result";
import { NodeResult } from "../../base";
import { StubAction, createNodeTicker } from "../../test-helpers";

describe("CacheResult", () => {
    it("returns child result on first tick (no cache)", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        const result = tick(node, { now: 0 });

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("returns cached Succeeded without ticking child", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        tick(node, { now: 0 });
        const result = tick(node, { now: 50 });

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(1);
    });

    it("returns cached Failed without ticking child", () => {
        const child = new StubAction(NodeResult.Failed);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        tick(node, { now: 0 });
        const result = tick(node, { now: 50 });

        expect(result).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);
    });

    it("ticks child again after cache expires", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        tick(node, { now: 0 });
        tick(node, { now: 50 }); // cached
        const result = tick(node, { now: 100 }); // expired, fresh tick

        expect(result).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(2);
    });

    it("passes through Running without caching", () => {
        const child = new StubAction([NodeResult.Running, NodeResult.Running, NodeResult.Succeeded]);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        const r1 = tick(node, { now: 0 });
        const r2 = tick(node, { now: 10 });
        const r3 = tick(node, { now: 20 });

        expect(r1).toBe(NodeResult.Running);
        expect(r2).toBe(NodeResult.Running);
        expect(r3).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(3);
    });

    it("caches result after child transitions from Running", () => {
        const child = new StubAction([NodeResult.Running, NodeResult.Running, NodeResult.Succeeded, NodeResult.Failed]);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        expect(tick(node, { now: 0 })).toBe(NodeResult.Running);
        expect(tick(node, { now: 10 })).toBe(NodeResult.Running);
        expect(tick(node, { now: 20 })).toBe(NodeResult.Succeeded);

        expect(tick(node, { now: 50 })).toBe(NodeResult.Succeeded);
        expect(child.tickCount).toBe(3);

        expect(tick(node, { now: 120 })).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(4);
    });

    it("handles t=0 edge case correctly (sentinel check)", () => {
        const child = new StubAction(NodeResult.Failed);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        const r1 = tick(node, { now: 0 });
        expect(r1).toBe(NodeResult.Failed);

        const r2 = tick(node, { now: 50 });
        expect(r2).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(1);

        const r3 = tick(node, { now: 100 });
        expect(r3).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(2);
    });

    it("caches new result after expiry", () => {
        const child = new StubAction([NodeResult.Succeeded, NodeResult.Failed]);
        const node = new CacheResult(child, 50);
        const { tick } = createNodeTicker();

        const r1 = tick(node, { now: 0 });
        expect(r1).toBe(NodeResult.Succeeded);

        const r2 = tick(node, { now: 25 });
        expect(r2).toBe(NodeResult.Succeeded);

        // Cache expired, child now returns Failed
        const r3 = tick(node, { now: 50 });
        expect(r3).toBe(NodeResult.Failed);

        // New cached value is Failed
        const r4 = tick(node, { now: 75 });
        expect(r4).toBe(NodeResult.Failed);
        expect(child.tickCount).toBe(2);
    });

    it("reports display state with remaining time and cached result", () => {
        const child = new StubAction(NodeResult.Succeeded);
        const node = new CacheResult(child, 100);
        const { tick } = createNodeTicker();

        expect(node.getDisplayState()).toEqual({ remaining: 0, cachedResult: undefined });

        tick(node, { now: 0 });
        tick(node, { now: 30 });

        expect(node.getDisplayState()).toEqual({ remaining: 70, cachedResult: NodeResult.Succeeded });
    });
});
