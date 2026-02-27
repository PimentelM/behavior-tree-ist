import { describe, it, expect } from "vitest";
import { Sequence } from "./sequence";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("Sequence", () => {
    it("returns Succeeded when all children succeed", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const sequence = Sequence.from([child1, child2]);

        const result = BTNode.Tick(sequence, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Failed on first child failure", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Failed);
        const child3 = new StubAction(NodeResult.Succeeded);
        const sequence = Sequence.from([child1, child2, child3]);

        const result = BTNode.Tick(sequence, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("returns Running when a child returns Running", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const sequence = Sequence.from([child1, child2]);

        const result = BTNode.Tick(sequence, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("stops ticking remaining children after Failed", () => {
        const child1 = new StubAction(NodeResult.Failed);
        const child2 = new StubAction(NodeResult.Succeeded);
        const sequence = Sequence.from([child1, child2]);

        BTNode.Tick(sequence, createTickContext());

        expect(child2.tickCount).toBe(0);
        // child2 was never Running, so abort is a no-op
        expect(child2.abortCount).toBe(0);
    });

    it("stops ticking remaining children after Running", () => {
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Succeeded);
        const sequence = Sequence.from([child1, child2]);

        BTNode.Tick(sequence, createTickContext());

        expect(child2.tickCount).toBe(0);
        // child2 was never Running, so abort is a no-op
        expect(child2.abortCount).toBe(0);
    });

    it("aborts previously-running children when earlier child fails", () => {
        // Tick 1: child1 succeeds, child2 returns Running
        // Tick 2: child1 fails, child2 should be aborted
        const child1 = new StubAction([NodeResult.Succeeded, NodeResult.Failed]);
        const child2 = new StubAction(NodeResult.Running);
        const sequence = Sequence.from([child1, child2]);

        BTNode.Tick(sequence, createTickContext()); // child2 is Running
        BTNode.Tick(sequence, createTickContext()); // child1 fails, child2 aborted

        expect(child2.abortCount).toBe(1);
    });

    it("throws when no children", () => {
        const sequence = Sequence.from([]);

        expect(() => BTNode.Tick(sequence, createTickContext())).toThrow("has no nodes");
    });

    it("from factory works with name", () => {
        const sequence = Sequence.from("mySequence", [new StubAction()]);

        expect(sequence.name).toBe("mySequence");
    });

    it("from factory works without name", () => {
        const sequence = Sequence.from([new StubAction()]);

        expect(sequence.nodes).toHaveLength(1);
    });
});
