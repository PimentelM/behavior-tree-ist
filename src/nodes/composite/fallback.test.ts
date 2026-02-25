import { describe, it, expect } from "vitest";
import { Fallback } from "./fallback";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Fallback", () => {
    it("returns Succeeded on first child success", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Failed);
        const selector = Fallback.from([child1, child2, child3]);

        const result = BTNode.Tick(selector, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Failed when all children fail", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Failed);
        const selector = Fallback.from([child1, child2]);

        const result = BTNode.Tick(selector, createTickContext());

        expect(result).toBe(NodeResult.Failed);
        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
    });

    it("returns Running when a child returns Running", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Running);
        const selector = Fallback.from([child1, child2]);

        const result = BTNode.Tick(selector, createTickContext());

        expect(result).toBe(NodeResult.Running);
        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
    });

    it("stops ticking remaining children after Succeeded", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Failed);
        const selector = Fallback.from([child1, child2]);

        BTNode.Tick(selector, createTickContext());

        expect(child2.tickCount).toBe(0);
        // child2 was never Running, so abort is a no-op
        expect(child2.abortCount).toBe(0);
    });

    it("stops ticking remaining children after Running", () => {
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Failed);
        const selector = Fallback.from([child1, child2]);

        BTNode.Tick(selector, createTickContext());

        expect(child2.tickCount).toBe(0);
        // child2 was never Running, so abort is a no-op
        expect(child2.abortCount).toBe(0);
    });

    it("aborts previously-running children when earlier child succeeds", () => {
        // Tick 1: child1 fails, child2 returns Running
        // Tick 2: child1 succeeds, child2 should be aborted
        const child1 = new StubAction([NodeResult.Failed, NodeResult.Succeeded]);
        const child2 = new StubAction(NodeResult.Running);
        const selector = Fallback.from([child1, child2]);

        BTNode.Tick(selector, createTickContext()); // child2 is Running
        BTNode.Tick(selector, createTickContext()); // child1 succeeds, child2 aborted

        expect(child2.abortCount).toBe(1);
    });

    it("throws when no children", () => {
        const selector = Fallback.from([]);

        expect(() => BTNode.Tick(selector, createTickContext())).toThrow("has no nodes");
    });

    it("from factory works with name", () => {
        const selector = Fallback.from("mySelector", [new StubAction()]);

        expect(selector.name).toBe("mySelector");
    });

    it("from factory works without name", () => {
        const selector = Fallback.from([new StubAction()]);

        expect(selector.nodes).toHaveLength(1);
    });
});
