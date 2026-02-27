import { describe, it, expect } from "vitest";
import { SequenceWithMemory } from "./sequence-with-memory";
import { BTNode } from "../../base/node";
import { NodeResult } from "../../base/types";
import { createTickContext, StubAction } from "../../test-helpers";

describe("SequenceWithMemory", () => {
    it("returns Succeeded when all children succeed", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Succeeded);
        const seq = SequenceWithMemory.from([child1, child2]);

        const result = BTNode.Tick(seq, createTickContext());

        expect(result).toBe(NodeResult.Succeeded);
    });

    it("returns Failed when a child fails", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Failed);
        const seq = SequenceWithMemory.from([child1, child2]);

        const result = BTNode.Tick(seq, createTickContext());

        expect(result).toBe(NodeResult.Failed);
    });

    it("returns Running when a child is Running", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const seq = SequenceWithMemory.from([child1, child2]);

        const result = BTNode.Tick(seq, createTickContext());

        expect(result).toBe(NodeResult.Running);
    });

    it("resumes from the running child index on next tick", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const child3 = new StubAction(NodeResult.Succeeded);
        const seq = SequenceWithMemory.from([child1, child2, child3]);

        BTNode.Tick(seq, createTickContext()); // child1 succeeds, child2 running
        expect(child1.tickCount).toBe(1);
        expect(child2.tickCount).toBe(1);
        expect(child3.tickCount).toBe(0);

        BTNode.Tick(seq, createTickContext()); // resumes at child2, skips child1
        expect(child1.tickCount).toBe(1); // NOT ticked again
        expect(child2.tickCount).toBe(2);
        expect(child3.tickCount).toBe(1);
    });

    it("resets running index after completion (Succeeded)", () => {
        const child1 = new StubAction([NodeResult.Running, NodeResult.Succeeded]);
        const child2 = new StubAction(NodeResult.Succeeded);
        const seq = SequenceWithMemory.from([child1, child2]);

        BTNode.Tick(seq, createTickContext()); // child1 running
        BTNode.Tick(seq, createTickContext()); // child1 succeeds, child2 succeeds

        expect(seq.runningChildIndex).toBeUndefined();

        BTNode.Tick(seq, createTickContext()); // should start from child1 again
        expect(child1.tickCount).toBe(3);
    });

    it("resets running index after completion (Failed)", () => {
        const child1 = new StubAction([NodeResult.Running, NodeResult.Failed]);
        const seq = SequenceWithMemory.from([child1]);

        BTNode.Tick(seq, createTickContext());
        BTNode.Tick(seq, createTickContext());

        expect(seq.runningChildIndex).toBeUndefined();
    });

    it("only aborts Running children after the current child", () => {
        // child2 and child3 were never ticked (never Running), so abort is a no-op
        const child1 = new StubAction(NodeResult.Running);
        const child2 = new StubAction(NodeResult.Succeeded);
        const child3 = new StubAction(NodeResult.Succeeded);
        const seq = SequenceWithMemory.from([child1, child2, child3]);

        BTNode.Tick(seq, createTickContext());

        expect(child2.abortCount).toBe(0);
        expect(child3.abortCount).toBe(0);
    });

    it("aborts running child when sequence is aborted", () => {
        // When SequenceWithMemory is aborted, it propagates to running children
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const seq = SequenceWithMemory.from([child1, child2]);

        BTNode.Tick(seq, createTickContext()); // child1 succeeds, child2 Running, sequence Running
        BTNode.Abort(seq, createTickContext()); // sequence aborted, child2 aborted

        expect(child2.abortCount).toBe(1);
        // child1 completed (not Running), so not aborted
        expect(child1.abortCount).toBe(0);
    });

    it("onAbort resets runningChildIndex", () => {
        const child1 = new StubAction(NodeResult.Running);
        const seq = SequenceWithMemory.from([child1]);

        BTNode.Tick(seq, createTickContext());
        expect(seq.runningChildIndex).toBe(0);

        BTNode.Abort(seq, createTickContext());

        expect(seq.runningChildIndex).toBeUndefined();
    });

    it("tracks runningChildIndex", () => {
        const child1 = new StubAction(NodeResult.Succeeded);
        const child2 = new StubAction(NodeResult.Running);
        const seq = SequenceWithMemory.from([child1, child2]);

        expect(seq.runningChildIndex).toBeUndefined();

        BTNode.Tick(seq, createTickContext());

        expect(seq.runningChildIndex).toBe(1);
    });

    it("from factory works with name", () => {
        const seq = SequenceWithMemory.from("test", [new StubAction()]);

        expect(seq.name).toBe("test");
        expect(seq.nodes).toHaveLength(1);
    });

    it("from factory works without name", () => {
        const seq = SequenceWithMemory.from([new StubAction()]);

        expect(seq.nodes).toHaveLength(1);
    });

    it("throws when no children", () => {
        const seq = SequenceWithMemory.from([]);

        expect(() => BTNode.Tick(seq, createTickContext())).toThrow("has no nodes");
    });
});
